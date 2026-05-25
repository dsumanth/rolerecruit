import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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
