import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { generateToken } from "./lib/tokenGen";
import { EVALUATOR_ROLE_UNION } from "./types";

export const create = mutation({
  args: {
    applicationId: v.id("applications"),
    schoolId: v.id("schools"),
    scheduledAt: v.number(),
    durationMinutes: v.number(),
    mode: v.union(v.literal("live"), v.literal("post"), v.literal("async")),
    format: v.union(v.literal("classroom"), v.literal("mock"), v.literal("recorded")),
    location: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    formOpenWindowMinutes: v.optional(v.number()),
    formCloseDueDays: v.optional(v.number()),
    decisionRuleId: v.optional(v.id("decisionRules")),
    evaluators: v.array(v.object({
      userId: v.id("userProfiles"),
      role: EVALUATOR_ROLE_UNION,
    })),
    createdBy: v.id("userProfiles"),
    parentDemoId: v.optional(v.id("demoSessions")),
  },
  handler: async (ctx, args) => {
    if (args.evaluators.length === 0) {
      throw new Error("Must include at least one evaluator");
    }
    if (args.scheduledAt < Date.now()) {
      throw new Error("scheduledAt cannot be in the past");
    }
    const now = Date.now();
    const demoId = await ctx.db.insert("demoSessions", {
      applicationId: args.applicationId,
      schoolId: args.schoolId,
      parentDemoId: args.parentDemoId,
      scheduledAt: args.scheduledAt,
      durationMinutes: args.durationMinutes,
      mode: args.mode,
      format: args.format,
      location: args.location,
      videoUrl: args.videoUrl,
      status: "scheduled",
      formOpenWindowMinutes: args.formOpenWindowMinutes ?? 60,
      formCloseDueDays: args.formCloseDueDays ?? 3,
      decisionRuleId: args.decisionRuleId,
      createdBy: args.createdBy,
      createdAt: now,
    });

    for (const ev of args.evaluators) {
      const template = await ctx.db
        .query("formTemplates")
        .withIndex("by_schoolId_role", (q) =>
          q.eq("schoolId", args.schoolId).eq("role", ev.role))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      if (!template) throw new Error(`No active template for role ${ev.role}`);

      await ctx.db.insert("evaluationInvites", {
        demoSessionId: demoId,
        evaluatorUserId: ev.userId,
        evaluatorRole: ev.role,
        formTemplateId: template._id,
        status: "invited",
        token: generateToken(),
        invitedAt: now,
      });
    }
    return demoId;
  },
});

export const get = query({
  args: { demoId: v.id("demoSessions") },
  handler: async (ctx, { demoId }) => {
    const d = await ctx.db.get(demoId);
    if (!d) throw new Error("Demo not found");
    return d;
  },
});

export const cancel = mutation({
  args: { demoId: v.id("demoSessions"), reason: v.optional(v.string()) },
  handler: async (ctx, { demoId, reason }) => {
    const demo = await ctx.db.get(demoId);
    if (!demo) throw new Error("Demo not found");
    if (demo.status === "cancelled" || demo.status === "completed") {
      throw new Error(`Cannot cancel a ${demo.status} demo`);
    }
    const now = Date.now();
    await ctx.db.patch(demoId, {
      status: "cancelled",
      cancelledAt: now,
      cancellationReason: reason,
    });
    const invites = await ctx.db
      .query("evaluationInvites")
      .withIndex("by_demoSessionId", (q) => q.eq("demoSessionId", demoId))
      .collect();
    for (const inv of invites) {
      if (inv.status === "submitted" || inv.status === "declined" || inv.status === "cancelled") continue;
      await ctx.db.patch(inv._id, { status: "cancelled", cancelledAt: now });
    }
  },
});

export const listForSchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) => {
    const rows = await ctx.db
      .query("demoSessions")
      .withIndex("by_schoolId_scheduledAt", (q) => q.eq("schoolId", schoolId))
      .collect();
    return rows.sort((a, b) => a.scheduledAt - b.scheduledAt);
  },
});

export const listForCandidate = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, { applicationId }) => {
    return await ctx.db
      .query("demoSessions")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
      .collect();
  },
});

export const aggregate = query({
  args: { demoId: v.id("demoSessions") },
  handler: async (ctx, { demoId }) => {
    const demo = await ctx.db.get(demoId);
    if (!demo) throw new Error("Demo not found");
    const invites = await ctx.db
      .query("evaluationInvites")
      .withIndex("by_demoSessionId", (q) => q.eq("demoSessionId", demoId))
      .collect();

    const invitesByStatus: Record<string, number> = {
      invited: 0, viewed: 0, in_progress: 0, submitted: 0, declined: 0, cancelled: 0,
    };
    for (const inv of invites) invitesByStatus[inv.status] = (invitesByStatus[inv.status] ?? 0) + 1;

    const recommendationTally: Record<string, number> = { hire: 0, maybe: 0, reject: 0 };
    const weightedSums: Record<string, number> = {};
    const totalWeights: Record<string, number> = {};
    const perEvaluator: any[] = [];

    for (const inv of invites) {
      if (inv.status !== "submitted") continue;
      const evals = await ctx.db
        .query("evaluations")
        .withIndex("by_inviteId", (q) => q.eq("inviteId", inv._id))
        .collect();
      const ev = evals[0];
      if (!ev) continue;
      const template = await ctx.db.get(ev.formTemplateId);
      if (!template) continue;
      const evaluator = await ctx.db.get(inv.evaluatorUserId);

      if (ev.recommendation) recommendationTally[ev.recommendation] += 1;

      for (const field of template.fields) {
        if (field.type !== "score_1_5" && field.type !== "score_1_10") continue;
        const value = ev.responses[field.key];
        if (typeof value !== "number") continue;
        const w = field.weight ?? 1;
        weightedSums[field.key] = (weightedSums[field.key] ?? 0) + value * w;
        totalWeights[field.key] = (totalWeights[field.key] ?? 0) + w;
      }

      perEvaluator.push({
        invite: inv,
        evaluation: ev,
        template,
        evaluatorName: evaluator?.name ?? "Unknown",
        evaluatorRole: inv.evaluatorRole,
      });
    }

    const dimensionAverages: Record<string, number> = {};
    for (const key of Object.keys(weightedSums)) {
      dimensionAverages[key] = weightedSums[key] / totalWeights[key];
    }

    return {
      demo,
      invitesByStatus,
      recommendationTally,
      dimensionAverages,
      perEvaluator,
    };
  },
});
