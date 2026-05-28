import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { generateToken } from "./lib/tokenGen";

export const listForDemo = query({
  args: { demoId: v.id("demoSessions") },
  handler: async (ctx, { demoId }) =>
    await ctx.db
      .query("evaluationInvites")
      .withIndex("by_demoSessionId", (q) => q.eq("demoSessionId", demoId))
      .collect(),
});
