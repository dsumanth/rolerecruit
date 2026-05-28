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

export const markViewed = mutation({
  args: { inviteId: v.id("evaluationInvites") },
  handler: async (ctx, { inviteId }) => {
    const inv = await ctx.db.get(inviteId);
    if (!inv) throw new Error("Invite not found");
    if (inv.status === "invited") {
      await ctx.db.patch(inviteId, { status: "viewed", viewedAt: Date.now() });
    } else if (!inv.viewedAt) {
      await ctx.db.patch(inviteId, { viewedAt: Date.now() });
    }
  },
});

export const decline = mutation({
  args: { inviteId: v.id("evaluationInvites"), reason: v.optional(v.string()) },
  handler: async (ctx, { inviteId, reason }) => {
    const inv = await ctx.db.get(inviteId);
    if (!inv) throw new Error("Invite not found");
    if (inv.status === "submitted" || inv.status === "declined" || inv.status === "cancelled") {
      throw new Error(`Cannot decline an invite that is ${inv.status}`);
    }
    await ctx.db.patch(inviteId, {
      status: "declined",
      declinedAt: Date.now(),
      declineReason: reason,
    });
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const inv = await ctx.db
      .query("evaluationInvites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!inv) return null;
    const demo = await ctx.db.get(inv.demoSessionId);
    if (!demo) return null;
    const template = await ctx.db.get(inv.formTemplateId);
    return { invite: inv, demo, template };
  },
});

export const getById = query({
  args: { inviteId: v.id("evaluationInvites") },
  handler: async (ctx, { inviteId }) => {
    const inv = await ctx.db.get(inviteId);
    if (!inv) return null;
    const demo = await ctx.db.get(inv.demoSessionId);
    const template = await ctx.db.get(inv.formTemplateId);
    return { invite: inv, demo, template };
  },
});

export const listForUser = query({
  args: {
    userId: v.id("userProfiles"),
    statusFilter: v.optional(v.array(v.union(
      v.literal("invited"),
      v.literal("viewed"),
      v.literal("in_progress"),
      v.literal("submitted"),
      v.literal("declined"),
      v.literal("cancelled"),
    ))),
  },
  handler: async (ctx, { userId, statusFilter }) => {
    const rows = await ctx.db
      .query("evaluationInvites")
      .withIndex("by_evaluatorUserId_status", (q) => q.eq("evaluatorUserId", userId))
      .collect();
    const allowed = statusFilter ? new Set(statusFilter) : null;
    const filtered = allowed ? rows.filter((r) => allowed.has(r.status)) : rows;
    const out: any[] = [];
    for (const inv of filtered) {
      const demo = await ctx.db.get(inv.demoSessionId);
      if (!demo) continue;
      out.push({ invite: inv, demo });
    }
    return out.sort((a, b) => a.demo.scheduledAt - b.demo.scheduledAt);
  },
});

export const swap = mutation({
  args: {
    inviteId: v.id("evaluationInvites"),
    newEvaluatorUserId: v.id("userProfiles"),
  },
  handler: async (ctx, { inviteId, newEvaluatorUserId }) => {
    const old = await ctx.db.get(inviteId);
    if (!old) throw new Error("Invite not found");
    if (old.status === "submitted") throw new Error("Cannot swap a submitted invite");
    if (old.status === "cancelled") throw new Error("Cannot swap an already cancelled invite");

    const now = Date.now();
    const newInviteId = await ctx.db.insert("evaluationInvites", {
      demoSessionId: old.demoSessionId,
      evaluatorUserId: newEvaluatorUserId,
      evaluatorRole: old.evaluatorRole,
      formTemplateId: old.formTemplateId,
      status: "invited",
      token: generateToken(),
      invitedAt: now,
    });
    await ctx.db.patch(inviteId, {
      status: "cancelled",
      cancelledAt: now,
      replacedBy: newInviteId,
    });
    return newInviteId;
  },
});
