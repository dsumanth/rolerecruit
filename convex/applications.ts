import { mutation, query, internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { deleteApplicationChildren } from "./candidates";

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
    stage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("pipelineConfigs")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();

    const firstStage = args.stage ?? (config?.stages
      ?.sort((a, b) => a.order - b.order)
      .find(s => !s.isTerminal)?.id ?? "sourced");

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
      const otherApps = await ctx.db
        .query("applications")
        .withIndex("by_candidateId", (q) => q.eq("candidateId", candidate._id))
        .filter((q) => q.and(
          q.eq(q.field("pendingDeleteAt"), undefined),
          q.neq(q.field("_id"), app._id),
        ))
        .collect();
      let priorRejectCount = 0;
      for (const other of otherApps) {
        if (other.stage === "rejected") { priorRejectCount++; continue; }
        const evals = await ctx.db
          .query("evaluations")
          .withIndex("by_applicationId", (q) => q.eq("applicationId", other._id))
          .filter((q) => q.eq(q.field("recommendation"), "reject"))
          .collect();
        if (evals.length > 0) priorRejectCount++;
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
        priorRejectCount,
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

// ============================================================================
// Bulk delete: pending mark + undo (Task 7.1) + cascade finalize
// ============================================================================

function makeBatchId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const removeManyAppsArgs = v.union(
  v.object({ ids: v.array(v.id("applications")) }),
  v.object({
    matchAll: v.object({
      jobId: v.union(v.id("jobPostings"), v.null()),
      filter: v.optional(v.any()),
    }),
  }),
);

export const removeManyApplications = mutation({
  args: removeManyAppsArgs,
  handler: async (ctx, args) => {
    const a = args as { ids?: string[]; matchAll?: { jobId: any; filter?: any } };
    let ids: any[] = [];
    if (a.ids) {
      ids = a.ids;
    } else if (a.matchAll) {
      const matchAll = a.matchAll;
      const builder = matchAll.jobId
        ? ctx.db.query("applications").withIndex("by_jobPostingId", (q) => q.eq("jobPostingId", matchAll.jobId))
        : ctx.db.query("applications");
      const apps = await (builder as any)
        .filter((q: any) => q.eq(q.field("pendingDeleteAt"), undefined))
        .collect();
      ids = apps.map((row: any) => row._id);
    }

    const batchId = makeBatchId();
    let count = 0;
    for (const id of ids) {
      const row = await ctx.db.get(id as any) as any;
      if (!row || row.pendingDeleteAt != null) continue;
      await ctx.db.patch(id as any, { pendingDeleteAt: Date.now(), pendingDeleteBatchId: batchId });
      count++;
    }
    await ctx.scheduler.runAfter(10_000, internal.applications.finalizeBatchDelete, { batchId });
    return { batchId, count };
  },
});

export const undoBatchDelete = mutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("applications")
      .filter((q) => q.eq(q.field("pendingDeleteBatchId"), args.batchId))
      .collect();
    let restored = 0;
    for (const row of rows) {
      if (row.pendingDeleteAt == null) continue;
      await ctx.db.patch(row._id, { pendingDeleteAt: undefined, pendingDeleteBatchId: undefined });
      restored++;
    }
    return { restored };
  },
});

export const finalizeBatchDelete = internalMutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("applications")
      .filter((q) => q.eq(q.field("pendingDeleteBatchId"), args.batchId))
      .collect();
    for (const row of rows) {
      if (row.pendingDeleteAt == null) continue;
      await deleteApplicationChildren(ctx, row._id);
      await ctx.db.delete(row._id);
    }
  },
});

// ============================================================================
// Bulk stage change: bulkSetStage (Task 7.2)
// ============================================================================

const bulkSetStageArgs = v.union(
  v.object({ ids: v.array(v.id("applications")), stage: v.string() }),
  v.object({
    matchAll: v.object({
      jobId: v.union(v.id("jobPostings"), v.null()),
      filter: v.optional(v.any()),
    }),
    stage: v.string(),
  }),
);

export const bulkSetStage = mutation({
  args: bulkSetStageArgs,
  handler: async (ctx, args) => {
    const a = args as { ids?: string[]; matchAll?: { jobId: any; filter?: any }; stage: string };
    let ids: any[] = [];
    if (a.ids) {
      ids = a.ids;
    } else if (a.matchAll) {
      const matchAll = a.matchAll;
      const builder = matchAll.jobId
        ? ctx.db.query("applications").withIndex("by_jobPostingId", (q) => q.eq("jobPostingId", matchAll.jobId))
        : ctx.db.query("applications");
      const apps = await (builder as any)
        .filter((q: any) => q.eq(q.field("pendingDeleteAt"), undefined))
        .collect();
      ids = apps.map((r: any) => r._id);
    }

    const batchId = makeBatchId();
    const previousStages: Array<{ id: any; previousStage: string }> = [];
    for (const id of ids) {
      const row = await ctx.db.get(id as any) as any;
      if (!row) continue;
      previousStages.push({ id, previousStage: row.stage });
      await ctx.db.patch(id as any, { stage: a.stage });
    }
    return { batchId, previousStages };
  },
});
