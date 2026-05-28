import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { generateToken } from "./lib/tokenGen";
import { maybeApplyDecision } from "./decisions";
import { internal } from "./_generated/api";

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
    await maybeApplyDecision(ctx, inv.demoSessionId);
  },
});

async function loadInviteContext(ctx: any, inv: any) {
  const demo = await ctx.db.get(inv.demoSessionId);
  if (!demo) return null;
  const template = await ctx.db.get(inv.formTemplateId);
  const application = await ctx.db.get(demo.applicationId);
  const candidate = application ? await ctx.db.get(application.candidateId) : null;
  return {
    invite: inv,
    demo,
    template,
    candidate: candidate ? { _id: candidate._id, name: candidate.name } : null,
  };
}

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const inv = await ctx.db
      .query("evaluationInvites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!inv) return null;
    return await loadInviteContext(ctx, inv);
  },
});

export const getById = query({
  args: { inviteId: v.id("evaluationInvites") },
  handler: async (ctx, { inviteId }) => {
    const inv = await ctx.db.get(inviteId);
    if (!inv) return null;
    return await loadInviteContext(ctx, inv);
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

/**
 * Dev/E2E only: returns the most recently invited row in the table.
 * The dev-only API route `/api/test/last-invite-url` reads this to hand the
 * Playwright spec a fresh token URL without polling the email outbox. Do not
 * expose to production traffic.
 */
export const lastInviteForTest = query({
  args: { index: v.optional(v.number()) },
  handler: async (ctx, { index }) => {
    const rows = await ctx.db.query("evaluationInvites").collect();
    if (rows.length === 0) return null;
    const sorted = rows.sort((a, b) => b.invitedAt - a.invitedAt);
    const i = index ?? 0;
    return sorted[i] ?? null;
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

    // Fire-and-forget swap notifications. Both emails are best-effort: if the
    // recipient's email is missing or Resend is not configured the action
    // logs and returns without throwing.
    const demo = await ctx.db.get(old.demoSessionId);
    const application = demo ? await ctx.db.get(demo.applicationId) : null;
    const candidate = application ? await ctx.db.get(application.candidateId) : null;
    const newEvaluator = await ctx.db.get(newEvaluatorUserId);
    const oldEvaluator = await ctx.db.get(old.evaluatorUserId);

    if (demo && candidate && newEvaluator?.email) {
      const newInvite = await ctx.db.get(newInviteId);
      const tokenUrl = newInvite
        ? `${process.env.PUBLIC_APP_URL ?? ""}/evaluations/from-token?token=${newInvite.token}`
        : "";
      await ctx.scheduler.runAfter(0, internal.notifications.sendSwapEmail, {
        to: newEvaluator.email,
        newEvaluatorName: newEvaluator.name ?? "",
        candidateName: candidate.name,
        scheduledAt: demo.scheduledAt,
        tokenUrl,
      });
    }
    if (demo && candidate && oldEvaluator?.email) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendSwapOutEmail, {
        to: oldEvaluator.email,
        oldEvaluatorName: oldEvaluator.name ?? "",
        candidateName: candidate.name,
        scheduledAt: demo.scheduledAt,
      });
    }

    await ctx.scheduler.runAfter(0, internal.notifications.sendDemoEvent, {
      event: "evaluator_swap_in",
      demoId: old.demoSessionId,
      targetUserIds: [newEvaluatorUserId],
    });
    await ctx.scheduler.runAfter(0, internal.notifications.sendDemoEvent, {
      event: "evaluator_swap_out",
      demoId: old.demoSessionId,
      targetUserIds: [old.evaluatorUserId],
    });

    await maybeApplyDecision(ctx, old.demoSessionId);
    return newInviteId;
  },
});
