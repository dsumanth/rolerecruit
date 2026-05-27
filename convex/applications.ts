import { mutation, query, internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
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
    skipTriage: v.optional(v.boolean()),
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
    if (!args.skipTriage) {
      await ctx.scheduler.runAfter(0, api.triage.runTriage, { applicationId });
    }
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

    // Auto-close the job when hires reach the configured positions count.
    if (args.newStage === "hired" && app.jobPostingId) {
      await ctx.scheduler.runAfter(0, internal.jobs.maybeAutoFillJob, {
        jobId: app.jobPostingId,
      });
    }

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
  args: {
    jobId: v.id("jobPostings"),
    paginationOpts: paginationOptsValidator,
    filter: v.optional(v.object({
      stage: v.optional(v.string()),
      search: v.optional(v.string()),
    })),
    sort: v.optional(v.union(
      v.literal("newest"), v.literal("score"), v.literal("name"),
    )),
  },
  handler: async (ctx, args) => {
    // Sort note:
    // - "newest" uses by_jobPostingId + _creationTime desc.
    // - "score" uses by_jobPostingId_aiMatchScore. Applications without aiMatchScore
    //   are EXCLUDED from results (Convex sparse-index semantics).
    // - "name" has no backing index today; falls back to "newest" order. The UI
    //   sort label is misleading; follow-up will add by_jobPostingId_name when needed.
    const indexName = args.sort === "score" ? "by_jobPostingId_aiMatchScore" : "by_jobPostingId";
    const builder = ctx.db
      .query("applications")
      .withIndex(indexName as any, (q: any) => q.eq("jobPostingId", args.jobId));

    const filtered = builder.filter((q) => {
      let expr = q.eq(q.field("pendingDeleteAt"), undefined);
      if (args.filter?.stage) {
        expr = q.and(expr, q.eq(q.field("stage"), args.filter.stage));
      }
      return expr;
    });

    const result = await filtered.order("desc").paginate(args.paginationOpts);

    const enriched: any[] = [];
    for (const app of result.page) {
      const candidate = await ctx.db.get(app.candidateId);
      if (!candidate || candidate.pendingDeleteAt != null) continue;
      if (args.filter?.search) {
        const s = args.filter.search.toLowerCase();
        const hay = `${candidate.name ?? ""} ${candidate.email ?? ""}`.toLowerCase();
        if (!hay.includes(s)) continue;
      }
      enriched.push({
        applicationId: app._id,
        candidateId: candidate._id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        stage: app.stage,
        aiMatchScore: app.aiMatchScore,
        subjects: candidate.subjects ?? [],
        yearsExperience: candidate.yearsExperience,
        location: candidate.location,
        createdAt: app._creationTime,
      });
    }

    return { page: enriched, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

export const countForJob = query({
  args: {
    jobId: v.id("jobPostings"),
    filter: v.optional(v.object({
      stage: v.optional(v.string()),
      search: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_jobPostingId", (q) => q.eq("jobPostingId", args.jobId))
      .filter((q) => q.eq(q.field("pendingDeleteAt"), undefined))
      .collect();
    let total = 0;
    for (const app of apps) {
      if (args.filter?.stage && app.stage !== args.filter.stage) continue;
      const cand = await ctx.db.get(app.candidateId);
      if (!cand || cand.pendingDeleteAt != null) continue;
      if (args.filter?.search) {
        const s = args.filter.search.toLowerCase();
        const hay = `${cand.name ?? ""} ${cand.email ?? ""}`.toLowerCase();
        if (!hay.includes(s)) continue;
      }
      total++;
    }
    return { total };
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

/**
 * Set the primary jobPostingId on an application. Used by triage when an
 * application arrives without a target role (talent-bank upload, agent-sourced)
 * and the reverse-match picks the best open role.
 */
export const setPrimaryJob = internalMutation({
  args: {
    applicationId: v.id("applications"),
    jobPostingId: v.id("jobPostings"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.applicationId, { jobPostingId: args.jobPostingId });
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
