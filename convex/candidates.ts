import { mutation, query, internalMutation, internalAction } from "./_generated/server";
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
    sourceChannel: v.optional(v.string()),
    poolId: v.optional(v.id("pools")),
  },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    const candidateMap = new Map<string, any>();
    const seen = new Set<string>();

    for (const app of apps) {
      if (seen.has(app.candidateId)) continue;
      seen.add(app.candidateId);
      const candidate = await ctx.db.get(app.candidateId);
      if (!candidate) continue;
      if (args.sourceChannel && candidate.sourceChannel !== args.sourceChannel) continue;

      const poolIds = candidate.poolIds ?? [];
      const poolNames: string[] = [];
      for (const pId of poolIds) {
        const pool = await ctx.db.get(pId);
        if (pool) poolNames.push(pool.name);
      }

      if (args.poolId) {
        if (!poolIds.includes(args.poolId)) continue;
      }

      candidateMap.set(candidate._id, {
        ...candidate,
        applicationId: app._id,
        stage: app.stage,
        aiMatchScore: app.aiMatchScore,
        globalScore: app.globalScore,
        scoringResult: app.scoringResult,
        poolIds,
        poolNames,
      });
    }

    return Array.from(candidateMap.values());
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
