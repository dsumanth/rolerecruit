import { action, mutation, query, internalMutation, internalAction } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { PARSED_FACETS_VERSION, EMBEDDING_VERSION } from "./versions";
import { deleteApplicationChildren } from "./applications";

export const getRejectionHistory = query({
  args: {
    candidateId: v.id("candidates"),
    excludeApplicationId: v.optional(v.id("applications")),
  },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", args.candidateId))
      .filter((q) => q.eq(q.field("pendingDeleteAt"), undefined))
      .collect();

    const result: any[] = [];
    for (const app of apps) {
      if (args.excludeApplicationId && app._id === args.excludeApplicationId) continue;

      const evaluations = await ctx.db
        .query("evaluations")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", app._id))
        .filter((q) => q.eq(q.field("submitted"), true))
        .collect();

      const hasReject = evaluations.some((e: any) => e.recommendation === "reject");
      if (app.stage !== "rejected" && !hasReject) continue;

      const job = app.jobPostingId ? await ctx.db.get(app.jobPostingId) : null;
      const evalSubmitted = evaluations
        .filter((e: any) => e.recommendation != null)
        .map((e: any) => e.submittedAt ?? 0);
      const rejectedAt = Math.max(app._creationTime, ...(evalSubmitted.length ? evalSubmitted : [0]));

      result.push({
        applicationId: app._id,
        jobId: app.jobPostingId,
        jobTitle: (job as any)?.title ?? "(deleted role)",
        jobSubject: (job as any)?.subject,
        jobLevel: (job as any)?.level,
        rejectedAt,
        evaluations: evaluations.map((e: any) => ({
          evaluatorRole: e.evaluatorRole,
          recommendation: e.recommendation,
          comments: e.comments,
          scores: {
            subjectKnowledge: e.subjectKnowledge,
            classroomManagement: e.classroomManagement,
            communication: e.communication,
            overallFit: e.overallFit,
          },
          submittedAt: e.submittedAt,
        })),
      });
    }

    result.sort((a, b) => b.rejectedAt - a.rejectedAt);
    return result;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    location: v.optional(v.string()),
    qualifications: v.array(v.string()),
    certifications: v.optional(v.array(v.string())),
    boardExperience: v.optional(v.array(v.string())),
    subjects: v.array(v.string()),
    yearsExperience: v.optional(v.number()),
    currentSchool: v.optional(v.string()),
    resumeUrl: v.optional(v.string()),
    sourceChannel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("candidates", {
      name: args.name,
      phone: args.phone,
      email: args.email,
      location: args.location,
      qualifications: args.qualifications,
      certifications: args.certifications ?? [],
      boardExperience: args.boardExperience ?? [],
      subjects: args.subjects,
      yearsExperience: args.yearsExperience,
      currentSchool: args.currentSchool,
      resumeUrl: args.resumeUrl,
      sourceChannel: args.sourceChannel,
      talentBankFlag: false,
    });
  },
});

export const get = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.candidateId);
  },
});

export const updateScore = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    applicationId: v.id("applications"),
    globalScore: v.number(),
    scoringResult: v.object({
      totalScore: v.number(),
      dimensionScores: v.array(v.any()),
      recommendation: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.candidateId, {
      talentBankFlag: true,
    });
    await ctx.db.patch(args.applicationId, {
      globalScore: args.globalScore,
      scoringResult: args.scoringResult,
    });
  },
});

export const listForSchool = query({
  args: {
    schoolId: v.id("schools"),
    paginationOpts: paginationOptsValidator,
    filter: v.optional(v.object({
      poolId: v.optional(v.union(v.id("pools"), v.literal("all"))),
      stages: v.optional(v.array(v.string())),
      search: v.optional(v.string()),
    })),
    sort: v.optional(v.union(
      v.literal("newest"), v.literal("score"), v.literal("name"),
    )),
  },
  handler: async (ctx, args) => {
    // Sort note:
    // - "newest" uses by_schoolId + _creationTime desc (Convex default).
    // - "score" uses by_schoolId_aiMatchScore. Applications without aiMatchScore
    //   are EXCLUDED from results (Convex sparse-index semantics) — un-scored
    //   candidates won't appear under this sort.
    // - "name" has no backing index today; falls back to "newest" order. The UI
    //   sort label is misleading; this will be fixed in a follow-up when a
    //   by_schoolId_name index is added.
    const indexName =
      args.sort === "score" ? "by_schoolId_aiMatchScore" : "by_schoolId";

    const builder = ctx.db
      .query("applications")
      .withIndex(indexName as any, (q: any) => q.eq("schoolId", args.schoolId));

    const filtered = builder.filter((q) => {
      let expr = q.eq(q.field("pendingDeleteAt"), undefined);
      if (args.filter?.stages && args.filter.stages.length > 0) {
        const stageExprs = args.filter.stages.map((s) => q.eq(q.field("stage"), s));
        expr = q.and(expr, q.or(...stageExprs));
      }
      return expr;
    });

    const ordered = filtered.order("desc");
    const result = await ordered.paginate(args.paginationOpts);

    const enriched: any[] = [];
    const seen = new Set<string>();
    for (const app of result.page) {
      if (seen.has(app.candidateId)) continue;
      seen.add(app.candidateId);
      const candidate = await ctx.db.get(app.candidateId);
      if (!candidate) continue;
      if (candidate.pendingDeleteAt != null) continue;

      if (args.filter?.search) {
        const s = args.filter.search.toLowerCase();
        const haystack = `${candidate.name ?? ""} ${candidate.email ?? ""}`.toLowerCase();
        if (!haystack.includes(s)) continue;
      }

      if (args.filter?.poolId && args.filter.poolId !== "all") {
        const poolMember = await ctx.db
          .query("candidatePools")
          .withIndex("by_candidateId", (q) => q.eq("candidateId", candidate._id))
          .filter((q) => q.eq(q.field("poolId"), args.filter!.poolId))
          .first();
        if (!poolMember) continue;
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
        sourceChannel: candidate.sourceChannel,
        createdAt: app._creationTime,
      });
    }

    return {
      page: enriched,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const countForSchool = query({
  args: {
    schoolId: v.id("schools"),
    filter: v.optional(v.object({
      poolId: v.optional(v.union(v.id("pools"), v.literal("all"))),
      stages: v.optional(v.array(v.string())),
      search: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.eq(q.field("pendingDeleteAt"), undefined))
      .collect();
    const seen = new Set<string>();
    let total = 0;
    for (const app of apps) {
      if (seen.has(app.candidateId)) continue;
      seen.add(app.candidateId);

      if (args.filter?.stages && args.filter.stages.length > 0
          && !args.filter.stages.includes(app.stage)) continue;
      const cand = await ctx.db.get(app.candidateId);
      if (!cand || cand.pendingDeleteAt != null) continue;
      if (args.filter?.search) {
        const s = args.filter.search.toLowerCase();
        const hay = `${cand.name ?? ""} ${cand.email ?? ""}`.toLowerCase();
        if (!hay.includes(s)) continue;
      }
      if (args.filter?.poolId && args.filter.poolId !== "all") {
        const member = await ctx.db
          .query("candidatePools")
          .withIndex("by_candidateId", (q) => q.eq("candidateId", cand._id))
          .filter((q) => q.eq(q.field("poolId"), args.filter!.poolId))
          .first();
        if (!member) continue;
      }
      total++;
    }
    return { total };
  },
});

// ============================================================================
// Phase 1: compiled candidate data (Task 13)
// ============================================================================

const _facetValueValidator = v.object({
  value: v.string(),
  evidence: v.object({
    quote: v.string(),
    offset: v.number(),
    context: v.string(),
  }),
});
const _facetArrayValidator = v.array(_facetValueValidator);

export const writeCompiledData = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    parsedFacets: v.object({
      specializations: _facetArrayValidator,
      gradeLevels: _facetArrayValidator,
      pedagogicalApproach: _facetArrayValidator,
      leadershipRoles: _facetArrayValidator,
      extracurricular: _facetArrayValidator,
      languages: _facetArrayValidator,
      schoolTypes: _facetArrayValidator,
      keyAchievements: _facetArrayValidator,
      redFlags: _facetArrayValidator,
      extras: v.record(v.string(), _facetArrayValidator),
    }),
    candidateSummary: v.string(),
    rawChunks: v.array(v.object({
      text: v.string(),
      section: v.union(
        v.literal("header"), v.literal("experience"), v.literal("pedagogy"),
        v.literal("achievements"), v.literal("leadership"), v.literal("other"),
      ),
      offset: v.number(),
    })),
    facetEmbeddings: v.optional(v.object({
      overall: v.array(v.float64()),
      experience: v.array(v.float64()),
      pedagogy: v.array(v.float64()),
      achievements: v.array(v.float64()),
      leadership: v.array(v.float64()),
    })),
    parsingNotes: v.optional(v.string()),
    // Top-level identity/profile fields lifted from the parsed resume. Optional
    // because they may be empty/null when the LLM can't extract them. The
    // existing candidate row already has its own values from initial insert;
    // these only overwrite when truthy (see handler).
    name: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    phone: v.optional(v.union(v.string(), v.null())),
    location: v.optional(v.union(v.string(), v.null())),
    currentSchool: v.optional(v.union(v.string(), v.null())),
    qualifications: v.optional(v.array(v.string())),
    certifications: v.optional(v.array(v.string())),
    boardExperience: v.optional(v.array(v.string())),
    subjects: v.optional(v.array(v.string())),
    yearsExperience: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.candidateId);
    const patch: Record<string, unknown> = {
      parsedFacets: args.parsedFacets,
      candidateSummary: args.candidateSummary,
      rawChunks: args.rawChunks,
      facetEmbeddings: args.facetEmbeddings,
      parsedVersion: PARSED_FACETS_VERSION,
      embeddingVersion: args.facetEmbeddings ? EMBEDDING_VERSION : undefined,
      parsedAt: Date.now(),
      parsingNotes: args.parsingNotes,
    };

    // The initial row from createFromUpload sets `name` to the original
    // filename (e.g. "12345_Updated Resume.pdf") as a placeholder. Replace it
    // with the parsed name if we have one, but don't overwrite a real
    // user-provided name that doesn't look like a filename.
    const looksLikeFilename = typeof existing?.name === "string"
      && /\.(pdf|docx?|png|jpe?g)$/i.test(existing.name);
    if (args.name && (looksLikeFilename || !existing?.name)) {
      patch.name = args.name;
    }

    if (args.email && !existing?.email) patch.email = args.email;
    if (args.phone) patch.phone = args.phone;
    if (args.location) patch.location = args.location;
    if (args.currentSchool) patch.currentSchool = args.currentSchool;
    if (args.qualifications && args.qualifications.length > 0) patch.qualifications = args.qualifications;
    if (args.certifications && args.certifications.length > 0) patch.certifications = args.certifications;
    if (args.boardExperience && args.boardExperience.length > 0) patch.boardExperience = args.boardExperience;
    if (args.subjects && args.subjects.length > 0) patch.subjects = args.subjects;
    if (typeof args.yearsExperience === "number") patch.yearsExperience = args.yearsExperience;

    await ctx.db.patch(args.candidateId, patch);
  },
});

export const attachResumeFile = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    storageId: v.id("_storage"),
    originalName: v.optional(v.string()),
    method: v.union(
      v.literal("pdf-parse"),
      v.literal("openai-vision"),
      v.literal("gemini-vision"),
      v.literal("mammoth"),
      v.literal("plain-text"),
    ),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    await ctx.db.patch(args.candidateId, {
      resumeStorageId: args.storageId,
      resumeOriginalName: args.originalName,
      resumeExtractionMethod: args.method,
      resumeUrl: url ?? undefined,
    });
  },
});

export const createFromUpload = mutation({
  args: {
    schoolId: v.id("schools"),
    storageId: v.id("_storage"),
    originalName: v.optional(v.string()),
    sourceChannel: v.optional(v.string()),
    candidateNameHint: v.optional(v.string()),
    candidateEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const candidateId = await ctx.db.insert("candidates", {
      name: args.candidateNameHint ?? args.originalName ?? "Unnamed Candidate",
      email: args.candidateEmail,
      qualifications: [],
      certifications: [],
      boardExperience: [],
      subjects: [],
      sourceChannel: args.sourceChannel ?? "hr_upload",
      talentBankFlag: false,
      origin: "manual_import",
      parseStatus: "pending",
    });

    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let trackingToken = "";
    for (let i = 0; i < 32; i++) {
      trackingToken += chars[Math.floor(Math.random() * chars.length)];
    }

    const applicationId = await ctx.db.insert("applications", {
      candidateId,
      schoolId: args.schoolId,
      stage: "sourced",
      trackingToken,
      source: "manual",
      matchedAt: Date.now(),
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.intake_pdf.extractTextFromResume, {
      candidateId,
      storageId: args.storageId,
      originalName: args.originalName,
      applicationId,
    });

    return { candidateId, applicationId };
  },
});

export const setParseStatus = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    status: v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { parseStatus: args.status };
    if (args.status === "failed") {
      patch.parseError = args.error ?? "Unknown error";
    } else {
      patch.parseError = undefined;
    }
    await ctx.db.patch(args.candidateId, patch);
  },
});

export const setOrigin = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    origin: v.union(
      v.literal("fresh_application"),
      v.literal("talent_pool"),
      v.literal("agent_sourced"),
      v.literal("referral"),
      v.literal("manual_import"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.candidateId, { origin: args.origin });
  },
});

export const hardFilter = query({
  args: {
    subjects: v.optional(v.array(v.string())),
    minYears: v.optional(v.number()),
    boards: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
    excludeCandidateIds: v.optional(v.array(v.id("candidates"))),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    const exclude = new Set((args.excludeCandidateIds ?? []).map(String));
    const all = await ctx.db.query("candidates").collect();
    const filtered = all.filter((c) => {
      if (exclude.has(String(c._id))) return false;
      if (args.subjects?.length) {
        const hit = args.subjects.some((s) =>
          c.subjects.some((cs) => cs.toLowerCase().includes(s.toLowerCase()))
        );
        if (!hit) return false;
      }
      if (args.minYears != null && (c.yearsExperience ?? 0) < args.minYears) return false;
      if (args.boards?.length) {
        const hit = args.boards.some((b) =>
          c.boardExperience.some((cb) => cb.toLowerCase().includes(b.toLowerCase()))
        );
        if (!hit) return false;
      }
      return true;
    });
    return filtered.slice(0, limit);
  },
});

// ============================================================================
// Phase 2 — Dynamic Facet Promotion helpers
// ============================================================================
// These mutations shuffle a single candidate's parsedFacets.extras bag between
// the un-prefixed key and the `__promoted__<key>` namespace. They are called
// per-candidate from the facetPromotion backfill internalActions during
// promote/demote lifecycle transitions.

export const promoteFacetForCandidate = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.candidateId);
    if (!c || !c.parsedFacets) return;
    const extras = { ...c.parsedFacets.extras };
    const values = extras[args.key];
    if (!values) return;
    delete extras[args.key];
    extras[`__promoted__${args.key}`] = values;
    await ctx.db.patch(args.candidateId, {
      parsedFacets: { ...c.parsedFacets, extras },
    });
  },
});

export const demoteFacetForCandidate = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.candidateId);
    if (!c || !c.parsedFacets) return;
    const extras = { ...c.parsedFacets.extras };
    const promotedKey = `__promoted__${args.key}`;
    const values = extras[promotedKey];
    if (!values) return;
    delete extras[promotedKey];
    extras[args.key] = values;
    await ctx.db.patch(args.candidateId, {
      parsedFacets: { ...c.parsedFacets, extras },
    });
  },
});

// Re-runs the resume extraction + parsing pipeline for an existing candidate.
// Exposed publicly so the UI can trigger it from a (hidden) drawer action when
// a candidate was parsed by a buggy version of the pipeline and needs a redo.
// Idempotent: writeCompiledData uses ctx.db.patch, so existing identity fields
// the user has manually edited are only overwritten by the new patch logic
// (filename-looking names get replaced; user-edited names stay).
export const reparse = action({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args): Promise<{ ok: boolean; reason?: string }> => {
    const candidate = await ctx.runQuery(api.candidates.get, { candidateId: args.candidateId });
    if (!candidate) return { ok: false, reason: "Candidate not found" };
    if (!candidate.resumeStorageId) {
      return { ok: false, reason: "No resume file attached — nothing to reparse" };
    }
    await ctx.runAction(internal.intake_pdf.extractTextFromResume, {
      candidateId: args.candidateId,
      storageId: candidate.resumeStorageId,
      originalName: candidate.resumeOriginalName,
    });
    return { ok: true };
  },
});

// ============================================================================
// Soft-delete: pending mark + undo (Task 6.1) + cascade finalize (Task 6.2)
// ============================================================================

function makeBatchId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const removeMany = mutation({
  args: {
    ids: v.optional(v.array(v.id("candidates"))),
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
      // matchAll: resolve via applications under the school, collect unique candidateIds.
      const matchAll = a.matchAll;
      const apps = await ctx.db
        .query("applications")
        .withIndex("by_schoolId", (q) => q.eq("schoolId", matchAll.schoolId))
        .filter((q) => q.eq(q.field("pendingDeleteAt"), undefined))
        .collect();
      const candIds = new Set<string>();
      for (const app of apps) candIds.add(app.candidateId);
      ids = Array.from(candIds);
    }

    const batchId = makeBatchId();
    let count = 0;
    for (const id of ids) {
      const cand = await ctx.db.get(id as any);
      if (!cand || (cand as any).pendingDeleteAt != null) continue;
      await ctx.db.patch(id as any, { pendingDeleteAt: Date.now(), pendingDeleteBatchId: batchId });
      count++;
    }
    await ctx.scheduler.runAfter(10_000, internal.candidates.finalizeBatchDelete, { batchId });
    return { batchId, count };
  },
});

export const remove = mutation({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.candidateId);
    if (!doc || doc.pendingDeleteAt != null) {
      return { batchId: "", count: 0 as const };
    }
    const batchId = makeBatchId();
    await ctx.db.patch(args.candidateId, { pendingDeleteAt: Date.now(), pendingDeleteBatchId: batchId });
    await ctx.scheduler.runAfter(10_000, internal.candidates.finalizeBatchDelete, { batchId });
    return { batchId, count: 1 as const };
  },
});

export const undoBatchDelete = mutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const cands = await ctx.db
      .query("candidates")
      .filter((q) => q.eq(q.field("pendingDeleteBatchId"), args.batchId))
      .collect();
    let restored = 0;
    for (const c of cands) {
      if (c.pendingDeleteAt == null) continue;
      await ctx.db.patch(c._id, { pendingDeleteAt: undefined, pendingDeleteBatchId: undefined });
      restored++;
    }
    return { restored };
  },
});

export const finalizeBatchDelete = internalMutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const cands = await ctx.db
      .query("candidates")
      .filter((q) => q.eq(q.field("pendingDeleteBatchId"), args.batchId))
      .collect();

    for (const cand of cands) {
      if (cand.pendingDeleteAt == null) continue;

      // 1. Walk applications
      const apps = await ctx.db
        .query("applications")
        .withIndex("by_candidateId", (q) => q.eq("candidateId", cand._id))
        .collect();
      for (const app of apps) {
        await deleteApplicationChildren(ctx, app._id);
        await ctx.db.delete(app._id);
      }

      // 2. candidatePools (by_candidateId)
      const pools = await ctx.db
        .query("candidatePools")
        .withIndex("by_candidateId", (q) => q.eq("candidateId", cand._id))
        .collect();
      for (const p of pools) await ctx.db.delete(p._id);

      // 3. Resume file (idempotent)
      if (cand.resumeStorageId) {
        try { await ctx.storage.delete(cand.resumeStorageId as any); } catch {}
      }

      // 4. The candidate itself
      await ctx.db.delete(cand._id);
    }
  },
});
