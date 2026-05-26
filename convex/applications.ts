import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

const VALID_TRANSITIONS: Record<string, string[]> = {
  sourced: ["screened", "rejected", "on_hold"],
  screened: ["demo_scheduled", "rejected", "on_hold"],
  demo_scheduled: ["demo_completed", "rejected"],
  demo_completed: ["offer_sent", "rejected"],
  offer_sent: ["hired", "rejected"],
  hired: [],
  rejected: [],
  on_hold: ["screened", "rejected"],
};

const PIPELINE_STAGES = [
  "sourced",
  "screened",
  "demo_scheduled",
  "demo_completed",
  "offer_sent",
  "hired",
] as const;

export const create = mutation({
  args: {
    candidateId: v.id("candidates"),
    jobPostingId: v.optional(v.id("jobPostings")),
    schoolId: v.id("schools"),
    aiMatchScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("pipelineConfigs")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();

    const firstStage = config?.stages
      ?.sort((a, b) => a.order - b.order)
      .find(s => !s.isTerminal)?.id ?? "sourced";

    const applicationId = await ctx.db.insert("applications", {
      candidateId: args.candidateId,
      jobPostingId: args.jobPostingId,
      schoolId: args.schoolId,
      stage: firstStage,
      aiMatchScore: args.aiMatchScore,
      createdAt: Date.now(),
    });
    await ctx.db.patch(applicationId, { source: "careers_site", matchedAt: Date.now() });
    await ctx.scheduler.runAfter(0, api.triage.runTriage, { applicationId });
    return applicationId;
  },
});

export const patchScore = mutation({
  args: {
    applicationId: v.id("applications"),
    globalScore: v.number(),
    scoringResult: v.object({
      totalScore: v.number(),
      dimensionScores: v.array(v.any()),
      recommendation: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.applicationId, {
      globalScore: args.globalScore,
      scoringResult: args.scoringResult,
    });
  },
});

export const get = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.applicationId);
  },
});

export const moveStage = mutation({
  args: {
    applicationId: v.id("applications"),
    newStage: v.string(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    const config = await ctx.db
      .query("pipelineConfigs")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", app.schoolId))
      .first();

    let allowedTransitions: string[];
    if (config) {
      allowedTransitions = config.transitions
        .filter(t => t.fromStageId === app.stage)
        .map(t => t.toStageId);
    } else {
      allowedTransitions = VALID_TRANSITIONS[app.stage] ?? [];
    }

    if (!allowedTransitions.includes(args.newStage)) {
      throw new Error(
        `Cannot move from ${app.stage} to ${args.newStage}. Allowed: ${allowedTransitions.join(", ")}`
      );
    }

    await ctx.db.patch(args.applicationId, { stage: args.newStage });

    // Check for automation on this transition
    const automation = await ctx.db
      .query("pipelineAutomations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", app.schoolId))
      .filter((q) =>
        q.and(
          q.eq(q.field("fromStageId"), app.stage),
          q.eq(q.field("toStageId"), args.newStage)
        )
      )
      .first();

    if (automation?.messageTemplate) {
      const candidate = await ctx.db.get(app.candidateId);
      const job = app.jobPostingId ? await ctx.db.get(app.jobPostingId) : null;
      const school = await ctx.db.get(app.schoolId);

      let body = automation.messageTemplate
        .replace(/{candidate_name}/g, candidate?.name ?? "Candidate")
        .replace(/{school_name}/g, school?.name ?? "School")
        .replace(/{job_title}/g, job?.title ?? "Position");

      let bookingLink: string | undefined;
      if (automation.includeBookingLink) {
        await ctx.scheduler.runAfter(0, internal.applications.generateAndAttachBookingLink, {
          applicationId: args.applicationId,
          schoolId: app.schoolId,
        });
      }

      await ctx.db.insert("outreachMessages", {
        applicationId: args.applicationId,
        candidateId: app.candidateId,
        type: "custom",
        channel: automation.messageChannel === "email" ? "email" : "whatsapp",
        body,
        sentAt: Date.now(),
        status: "sent",
      });
    }

    return args.applicationId;
  },
});

export const getPipelineForJob = query({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_jobPostingId", (q) => q.eq("jobPostingId", args.jobId))
      .collect();

    const result: Record<string, any[]> = {};
    for (const stage of PIPELINE_STAGES) {
      result[stage] = [];
    }

    for (const app of apps) {
      if (result[app.stage]) {
        const candidate = await ctx.db.get(app.candidateId);
        result[app.stage].push({
          ...app,
          candidate: candidate ?? null,
        });
      }
    }

    return result;
  },
});

export const getUnmatchedForSchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    const candidatesWithApps = [];
    for (const app of apps) {
      if (app.stage === "rejected" || app.stage === "on_hold") continue;
      const candidate = await ctx.db.get(app.candidateId);
      if (candidate) {
        candidatesWithApps.push({ ...app, candidate });
      }
    }

    return candidatesWithApps;
  },
});

export const setSource = internalMutation({
  args: {
    applicationId: v.id("applications"),
    source: v.union(
      v.literal("careers_site"),
      v.literal("talent_pool_match"),
      v.literal("agent_sourced"),
      v.literal("triage_cross_match"),
      v.literal("manual"),
    ),
    matchedFromPoolId: v.optional(v.id("pools")),
  },
  handler: async (ctx, args) => {
    const patch: any = { source: args.source, matchedAt: Date.now() };
    if (args.matchedFromPoolId) patch.matchedFromPoolId = args.matchedFromPoolId;
    await ctx.db.patch(args.applicationId, patch);
  },
});

export const setTriageResult = internalMutation({
  args: {
    applicationId: v.id("applications"),
    triageOutcome: v.union(
      v.literal("auto_shortlisted"),
      v.literal("auto_rejected"),
      v.literal("human_review"),
      v.literal("cross_role_suggested"),
    ),
    triageDecisionId: v.id("triageDecisions"),
    matchReasons: v.array(v.string()),
    aiMatchScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { applicationId, ...patch } = args;
    await ctx.db.patch(applicationId, patch);
  },
});

export const generateAndAttachBookingLink = internalMutation({
  args: {
    applicationId: v.id("applications"),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < 48; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }

    await ctx.db.insert("bookingTokens", {
      token,
      applicationId: args.applicationId,
      schoolId: args.schoolId,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      used: false,
    });

    return token;
  },
});
