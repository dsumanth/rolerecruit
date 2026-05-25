import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const startRun = mutation({
  args: {
    jobId: v.id("jobPostings"),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sourcingRuns", {
      jobPostingId: args.jobId,
      schoolId: args.schoolId,
      status: "pending",
      startedAt: Date.now(),
    });
  },
});

export const markRunning = mutation({
  args: {
    runId: v.id("sourcingRuns"),
    apifyRunId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.runId, {
      status: "running",
      apifyRunId: args.apifyRunId,
    });
  },
});

export const markCompleted = mutation({
  args: {
    runId: v.id("sourcingRuns"),
    candidatesFound: v.number(),
    candidatesScored: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.runId, {
      status: "completed",
      candidatesFound: args.candidatesFound,
      candidatesScored: args.candidatesScored,
      completedAt: Date.now(),
    });
  },
});

export const markFailed = mutation({
  args: {
    runId: v.id("sourcingRuns"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.runId, {
      status: "failed",
      error: args.error,
      completedAt: Date.now(),
    });
  },
});

export const getRunsForJob = query({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sourcingRuns")
      .withIndex("by_jobPostingId", (q) =>
        q.eq("jobPostingId", args.jobId)
      )
      .collect();
  },
});
