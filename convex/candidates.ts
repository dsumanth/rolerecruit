import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { PARSED_FACETS_VERSION, EMBEDDING_VERSION } from "./versions";

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
    for (const app of result.page) {
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
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.candidateId, {
      parsedFacets: args.parsedFacets,
      candidateSummary: args.candidateSummary,
      rawChunks: args.rawChunks,
      facetEmbeddings: args.facetEmbeddings,
      parsedVersion: PARSED_FACETS_VERSION,
      embeddingVersion: args.facetEmbeddings ? EMBEDDING_VERSION : undefined,
      parsedAt: Date.now(),
      parsingNotes: args.parsingNotes,
    });
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
