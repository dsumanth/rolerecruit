import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

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
      status: "draft",
      createdAt: Date.now(),
    });
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
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("active"),
        v.literal("paused"),
        v.literal("filled"),
        v.literal("closed")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("jobPostings")
        .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
        .filter((q) => q.eq(q.field("status"), args.status))
        .collect();
    }
    return await ctx.db
      .query("jobPostings")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();
  },
});

export const publish = mutation({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.jobId, { status: "active" });
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
