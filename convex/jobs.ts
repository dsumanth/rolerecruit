import { mutation, query, internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";

function makeBatchId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const create = mutation({
  args: {
    schoolId: v.id("schools"),
    title: v.string(),
    subject: v.string(),
    level: v.union(
      v.literal("PRT"),
      v.literal("TGT"),
      v.literal("PGT"),
      v.literal("Other")
    ),
    board: v.string(),
    qualifications: v.array(v.string()),
    minExperience: v.optional(v.number()),
    maxExperience: v.optional(v.number()),
    salaryRange: v.optional(v.string()),
    naturalLanguageDescription: v.string(),
    criteria: v.optional(v.string()),
    positions: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("jobPostings", {
      schoolId: args.schoolId,
      title: args.title,
      subject: args.subject,
      level: args.level,
      board: args.board,
      qualifications: args.qualifications,
      minExperience: args.minExperience,
      maxExperience: args.maxExperience,
      salaryRange: args.salaryRange,
      naturalLanguageDescription: args.naturalLanguageDescription,
      criteria: args.criteria ?? args.naturalLanguageDescription,
      positions: args.positions ?? 1,
      status: "draft",
      createdAt: Date.now(),
    });
  },
});

export const updateJob = mutation({
  args: {
    jobId: v.id("jobPostings"),
    title: v.optional(v.string()),
    subject: v.optional(v.string()),
    level: v.optional(v.union(
      v.literal("PRT"), v.literal("TGT"), v.literal("PGT"), v.literal("Other"),
    )),
    board: v.optional(v.string()),
    criteria: v.optional(v.string()),
    positions: v.optional(v.number()),
    minExperience: v.optional(v.number()),
    maxExperience: v.optional(v.number()),
    salaryRange: v.optional(v.string()),
    naturalLanguageDescription: v.optional(v.string()),
    qualifications: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { jobId, ...rest } = args;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v;
    }
    if (Object.keys(patch).length === 0) return;
    await ctx.db.patch(jobId, patch);
  },
});

/**
 * Hard-delete a draft role and its derivative artifacts. Refuses to delete
 * anything past `draft` so application/triage history is never silently lost —
 * non-draft roles must use `setStatus` ("closed") instead.
 *
 * The defensive cleanup of sourcingRuns / triageDecisions handles the case
 * where a draft was used to dry-run sourcing or triage before publish.
 * If any real applications exist for this draft (edge case from manual data
 * imports), refuse — that would orphan candidate-side records.
 */
export const deleteDraft = mutation({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.status !== "draft") {
      throw new Error(
        `Only draft roles can be deleted. This role is ${job.status} — close it instead.`,
      );
    }

    const applications = await ctx.db
      .query("applications")
      .withIndex("by_jobPostingId", (q) => q.eq("jobPostingId", args.jobId))
      .collect();
    if (applications.length > 0) {
      throw new Error(
        `Cannot delete: ${applications.length} application(s) exist for this role.`,
      );
    }

    const sourcingRuns = await ctx.db
      .query("sourcingRuns")
      .withIndex("by_jobPostingId", (q) => q.eq("jobPostingId", args.jobId))
      .collect();
    for (const r of sourcingRuns) await ctx.db.delete(r._id);

    const triage = await ctx.db
      .query("triageDecisions")
      .collect();
    for (const t of triage) {
      if (String(t.primaryRoleId) === String(args.jobId)) {
        await ctx.db.delete(t._id);
      }
    }

    await ctx.db.delete(args.jobId);
  },
});

export const setStatus = mutation({
  args: {
    jobId: v.id("jobPostings"),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("filled"),
      v.literal("closed"),
    ),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "filled") patch.filledAt = Date.now();
    await ctx.db.patch(args.jobId, patch);
  },
});

export const get = query({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const listBySchool = query({
  args: {
    schoolId: v.id("schools"),
    paginationOpts: paginationOptsValidator,
    filter: v.optional(v.object({
      status: v.optional(v.union(
        v.literal("draft"), v.literal("active"), v.literal("paused"),
        v.literal("filled"), v.literal("closed"),
      )),
      search: v.optional(v.string()),
    })),
    sort: v.optional(v.union(v.literal("newest"), v.literal("title"))),
  },
  handler: async (ctx, args) => {
    // Sort note:
    // - "newest" uses by_schoolId + _creationTime desc (Convex default).
    // - "title" uses by_schoolId_title (asc alphabetical).
    const indexName = args.sort === "title" ? "by_schoolId_title" : "by_schoolId";
    const builder = ctx.db.query("jobPostings").withIndex(indexName as any, (q: any) => q.eq("schoolId", args.schoolId));
    const filtered = builder.filter((q) => {
      let expr = q.eq(q.field("pendingDeleteAt"), undefined);
      if (args.filter?.status) expr = q.and(expr, q.eq(q.field("status"), args.filter.status));
      return expr;
    });
    const ordered = args.sort === "title" ? filtered.order("asc") : filtered.order("desc");
    const result = await ordered.paginate(args.paginationOpts);

    let page = result.page;
    if (args.filter?.search) {
      const s = args.filter.search.toLowerCase();
      page = page.filter((j) => (j.title ?? "").toLowerCase().includes(s));
    }
    return { page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

export const publish = mutation({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, { status: "active" });
    await ctx.scheduler.runAfter(0, api.jobs_ai.computeRoleEmbeddings, { jobId: args.jobId });
  },
});

/**
 * Auto-close a job when its hired count reaches `positions`. Called from
 * applications.moveStage after a candidate moves to the `hired` stage. No-op
 * if the job has no positions set, is already terminal, or has fewer hires
 * than positions.
 */
export const maybeAutoFillJob = internalMutation({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    if (job.status === "filled" || job.status === "closed") return;
    const positions = job.positions ?? 1;
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_jobPostingId", (q) => q.eq("jobPostingId", args.jobId))
      .collect();
    const hiredCount = apps.filter((a) => a.stage === "hired").length;
    if (hiredCount >= positions) {
      await ctx.db.patch(args.jobId, { status: "filled", filledAt: Date.now() });
    }
  },
});

export const close = mutation({
  args: {
    jobId: v.id("jobPostings"),
    reason: v.union(v.literal("filled"), v.literal("closed")),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.reason };
    if (args.reason === "filled") {
      patch.filledAt = Date.now();
    }
    return await ctx.db.patch(args.jobId, patch);
  },
});

export const saveParsedCriteria = internalMutation({
  args: {
    jobId: v.id("jobPostings"),
    parsedCriteria: v.object({
      subjects: v.array(v.string()),
      board: v.string(),
      level: v.string(),
      requiredQualifications: v.array(v.string()),
      preferredQualifications: v.array(v.string()),
      minExperience: v.optional(v.number()),
      skills: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.jobId, {
      parsedCriteria: args.parsedCriteria,
    });
  },
});

export const saveScoringRules = mutation({
  args: {
    jobId: v.id("jobPostings"),
    scoringRules: v.object({
      dimensions: v.array(v.object({
        name: v.string(),
        weight: v.number(),
        config: v.any(),
      })),
      minimumScore: v.number(),
      autoRejectScore: v.number(),
      generatedBy: v.union(
        v.literal("agent"),
        v.literal("manual"),
        v.literal("agent_reviewed")
      ),
      version: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.jobId, {
      scoringRules: args.scoringRules,
    });
  },
});

export const saveCriteriaText = mutation({
  args: { jobId: v.id("jobPostings"), text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, { criteria: args.text });
  },
});

export const setRoleEmbeddings = mutation({
  args: {
    jobId: v.id("jobPostings"),
    roleEmbeddings: v.object({
      overall: v.array(v.float64()),
      experience: v.array(v.float64()),
      pedagogy: v.array(v.float64()),
      achievements: v.array(v.float64()),
      leadership: v.array(v.float64()),
    }),
    version: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      roleEmbeddings: args.roleEmbeddings,
      roleEmbeddingVersion: args.version,
    });
  },
});

/**
 * Returns a map of jobId → hired-count for the school. Used by the jobs list
 * to render "Hires / Positions" without N+1 queries on the client.
 */
export const hiredCountsForSchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args): Promise<Record<string, number>> => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();
    const out: Record<string, number> = {};
    for (const a of apps) {
      if (a.stage !== "hired" || !a.jobPostingId) continue;
      const k = String(a.jobPostingId);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  },
});

export const countBySchool = query({
  args: {
    schoolId: v.id("schools"),
    filter: v.optional(v.object({
      status: v.optional(v.union(
        v.literal("draft"), v.literal("active"), v.literal("paused"),
        v.literal("filled"), v.literal("closed"),
      )),
      search: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("jobPostings")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.eq(q.field("pendingDeleteAt"), undefined));
    if (args.filter?.status) q = q.filter((qb) => qb.eq(qb.field("status"), args.filter!.status));
    const rows = await q.collect();
    let filtered = rows;
    if (args.filter?.search) {
      const s = args.filter.search.toLowerCase();
      filtered = filtered.filter((j) => (j.title ?? "").toLowerCase().includes(s));
    }
    return { total: filtered.length };
  },
});

export const listOpenForSchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobPostings")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});

export const listAllActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobPostings").filter((q) => q.eq(q.field("status"), "active")).collect();
  },
});

export const removeMany = mutation({
  args: {
    ids: v.optional(v.array(v.id("jobPostings"))),
    matchAll: v.optional(v.object({
      schoolId: v.id("schools"),
      filter: v.optional(v.any()),
    })),
  },
  handler: async (ctx, args) => {
    const a = args as { ids?: string[]; matchAll?: { schoolId: any; filter?: any } };
    let ids: any[] = [];
    if (a.ids) {
      ids = a.ids;
    } else if (a.matchAll) {
      const matchAll = a.matchAll;
      if (matchAll.filter?.status && matchAll.filter.status !== "draft") {
        throw new Error("Bulk delete only supports draft jobs");
      }
      const rows = await ctx.db.query("jobPostings")
        .withIndex("by_schoolId", (q) => q.eq("schoolId", matchAll.schoolId))
        .filter((q) => q.and(
          q.eq(q.field("pendingDeleteAt"), undefined),
          q.eq(q.field("status"), "draft"),
        ))
        .collect();
      ids = rows.map((r) => r._id);
    }

    // Validate draft-only BEFORE marking anything.
    for (const id of ids) {
      const job = await ctx.db.get(id as any) as any;
      if (!job) continue;
      if (job.status !== "draft") {
        throw new Error(`Job ${id} is not a draft; bulk delete denied`);
      }
    }

    const batchId = makeBatchId();
    let count = 0;
    for (const id of ids) {
      const job = await ctx.db.get(id as any) as any;
      if (!job || job.pendingDeleteAt != null) continue;
      await ctx.db.patch(id as any, { pendingDeleteAt: Date.now(), pendingDeleteBatchId: batchId });
      count++;
    }
    await ctx.scheduler.runAfter(10_000, internal.jobs.finalizeBatchDelete, { batchId });
    return { batchId, count };
  },
});

export const undoBatchDelete = mutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("jobPostings")
      .filter((q) => q.eq(q.field("pendingDeleteBatchId"), args.batchId))
      .collect();
    let restored = 0;
    for (const r of rows) {
      if (r.pendingDeleteAt == null) continue;
      await ctx.db.patch(r._id, { pendingDeleteAt: undefined, pendingDeleteBatchId: undefined });
      restored++;
    }
    return { restored };
  },
});

export const finalizeBatchDelete = internalMutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("jobPostings")
      .filter((q) => q.eq(q.field("pendingDeleteBatchId"), args.batchId))
      .collect();
    for (const r of rows) {
      if (r.pendingDeleteAt == null) continue;
      await ctx.db.delete(r._id);
    }
  },
});

export const bulkSetStatus = mutation({
  args: {
    ids: v.optional(v.array(v.id("jobPostings"))),
    matchAll: v.optional(v.object({
      schoolId: v.id("schools"),
      filter: v.optional(v.any()),
    })),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const a = args as { ids?: string[]; matchAll?: { schoolId: any; filter?: any }; status: string };
    let ids: any[] = [];
    if (a.ids) {
      ids = a.ids;
    } else if (a.matchAll) {
      const matchAll = a.matchAll;
      const rows = await ctx.db.query("jobPostings")
        .withIndex("by_schoolId", (q) => q.eq("schoolId", matchAll.schoolId))
        .filter((q) => q.eq(q.field("pendingDeleteAt"), undefined))
        .collect();
      ids = rows.map((r) => r._id);
    }
    const batchId = makeBatchId();
    const previousStatuses: Array<{ id: any; previousStatus: string }> = [];
    for (const id of ids) {
      const j = await ctx.db.get(id as any) as any;
      if (!j) continue;
      previousStatuses.push({ id, previousStatus: j.status });
      await ctx.db.patch(id as any, { status: a.status as any });
    }
    return { batchId, previousStatuses };
  },
});

export const backfillRoleEmbeddings = action({
  args: {},
  handler: async (ctx): Promise<{ processed: number }> => {
    const all = await ctx.runQuery(api.jobs.listAllActive, {});
    let processed = 0;
    for (const job of all) {
      if (!job.roleEmbeddings) {
        await ctx.runAction(api.jobs_ai.computeRoleEmbeddings, { jobId: job._id });
        processed++;
      }
    }
    return { processed };
  },
});
