import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { PIPELINE_STAGE_IDS } from "./pipeline_defaults";

export const getForSchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pipelineConfigs")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
  },
});

export const getActiveStages = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("pipelineConfigs")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
    if (!config) return PIPELINE_STAGE_IDS.map((id, i) => ({ id, name: id, order: i }));
    return config.stages
      .filter(s => !s.isTerminal)
      .sort((a, b) => a.order - b.order);
  },
});

export const getAvailableTransitions = query({
  args: {
    schoolId: v.id("schools"),
    currentStageId: v.string(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("pipelineConfigs")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
    if (!config) {
      const VALID_TRANSITIONS: Record<string, string[]> = {
        sourced: ["screened", "rejected", "on_hold"],
        screened: ["demo_scheduled", "rejected", "on_hold"],
        demo_scheduled: ["demo_completed", "rejected"],
        demo_completed: ["offer_sent", "rejected"],
        offer_sent: ["hired", "rejected"],
        hired: [],
        rejected: [],
        on_hold: ["screened", "rejected"],
      };
      return (VALID_TRANSITIONS[args.currentStageId] ?? []).map(toStageId => ({
        fromStageId: args.currentStageId,
        toStageId,
      }));
    }
    return config.transitions.filter(t => t.fromStageId === args.currentStageId);
  },
});

export const updatePipeline = mutation({
  args: {
    schoolId: v.id("schools"),
    stages: v.array(v.object({
      id: v.string(),
      name: v.string(),
      order: v.number(),
      isTerminal: v.optional(v.boolean()),
      color: v.optional(v.string()),
    })),
    transitions: v.array(v.object({
      fromStageId: v.string(),
      toStageId: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pipelineConfigs")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();

    if (!existing) {
      return await ctx.db.insert("pipelineConfigs", {
        schoolId: args.schoolId,
        stages: args.stages,
        transitions: args.transitions,
        version: 1,
      });
    }

    const removedStages = existing.stages
      .filter(es => !args.stages.find(ns => ns.id === es.id))
      .map(s => s.id);

    if (removedStages.length > 0) {
      for (const removedStageId of removedStages) {
        const apps = await ctx.db
          .query("applications")
          .withIndex("by_stage", (q) => q.eq("stage", removedStageId))
          .collect();

        const prevStage = args.stages
          .sort((a, b) => b.order - a.order)
          .find(s => !s.isTerminal && s.order < (existing.stages.find(es => es.id === removedStageId)?.order ?? 0));

        if (prevStage) {
          for (const app of apps) {
            await ctx.db.patch(app._id, { stage: prevStage.id });
          }
        }
      }
    }

    return await ctx.db.patch(existing._id, {
      stages: args.stages,
      transitions: args.transitions,
      version: existing.version + 1,
    });
  },
});

export const saveAutomation = mutation({
  args: {
    schoolId: v.id("schools"),
    fromStageId: v.string(),
    toStageId: v.string(),
    messageTemplate: v.optional(v.string()),
    messageChannel: v.optional(v.union(
      v.literal("whatsapp"), v.literal("email"), v.literal("both")
    )),
    includeBookingLink: v.optional(v.boolean()),
    createCalendarEvent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pipelineAutomations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) =>
        q.and(
          q.eq(q.field("fromStageId"), args.fromStageId),
          q.eq(q.field("toStageId"), args.toStageId)
        )
      )
      .first();

    if (existing) {
      return await ctx.db.patch(existing._id, {
        messageTemplate: args.messageTemplate,
        messageChannel: args.messageChannel,
        includeBookingLink: args.includeBookingLink,
        createCalendarEvent: args.createCalendarEvent,
      });
    }

    return await ctx.db.insert("pipelineAutomations", {
      schoolId: args.schoolId,
      fromStageId: args.fromStageId,
      toStageId: args.toStageId,
      messageTemplate: args.messageTemplate,
      messageChannel: args.messageChannel,
      includeBookingLink: args.includeBookingLink,
      createCalendarEvent: args.createCalendarEvent,
    });
  },
});

export const getAutomation = query({
  args: {
    schoolId: v.id("schools"),
    fromStageId: v.string(),
    toStageId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pipelineAutomations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) =>
        q.and(
          q.eq(q.field("fromStageId"), args.fromStageId),
          q.eq(q.field("toStageId"), args.toStageId)
        )
      )
      .first();
  },
});
