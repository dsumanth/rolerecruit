import { query } from "./_generated/server";
import { v } from "convex/values";
import { collectStatsHandler } from "./morningBrief_stats";

export const getStats = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("jobPostings")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    const openPositions = jobs.filter((j) => j.status === "active").length;

    const apps = await ctx.db
      .query("applications")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    const totalCandidates = apps.length;

    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const hiredThisMonth = apps.filter(
      (a) => a.stage === "hired" && a.createdAt >= monthAgo
    ).length;

    return {
      openPositions,
      totalCandidates,
      hiredThisMonth,
    };
  },
});

export const getPipelineBreakdown = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    const result: Record<string, { _id: string; stage: string }[]> = {};

    for (const app of apps) {
      const jid = app.jobPostingId as string;
      if (!jid) continue;
      if (!result[jid]) {
        result[jid] = [];
      }
      result[jid].push({
        _id: app._id,
        stage: app.stage,
      });
    }

    return result;
  },
});

export const getMorningBriefStats = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => collectStatsHandler(ctx, args.schoolId),
});
