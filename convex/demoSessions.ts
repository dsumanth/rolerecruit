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
