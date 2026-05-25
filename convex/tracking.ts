import { query } from "./_generated/server";
import { v } from "convex/values";

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("applications")
      .withIndex("by_trackingToken", (q) => q.eq("trackingToken", args.token))
      .first();

    if (!app) return null;

    const candidate = await ctx.db.get(app.candidateId);
    const job = app.jobPostingId ? await ctx.db.get(app.jobPostingId) : null;
    const school = await ctx.db.get(app.schoolId);

    return {
      ...app,
      candidate: candidate ?? null,
      job: job ?? null,
      school: school ?? null,
    };
  },
});
