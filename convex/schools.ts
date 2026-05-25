import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_PIPELINE_STAGES = [
  { id: "sourced", name: "Sourced", order: 0, isTerminal: false, color: "#86868b" },
  { id: "screened", name: "Screened", order: 1, isTerminal: false, color: "#86868b" },
  { id: "demo_scheduled", name: "Demo Scheduled", order: 2, isTerminal: false, color: "#0071e3" },
  { id: "demo_completed", name: "Demo Completed", order: 3, isTerminal: false, color: "#5856d6" },
  { id: "offer_sent", name: "Offer Sent", order: 4, isTerminal: false, color: "#ff9f0a" },
  { id: "hired", name: "Hired", order: 5, isTerminal: true, color: "#34c759" },
  { id: "rejected", name: "Rejected", order: 6, isTerminal: true, color: "#ff3b30" },
  { id: "on_hold", name: "On Hold", order: 7, isTerminal: false, color: "#aeaeb2" },
];

const DEFAULT_PIPELINE_TRANSITIONS = [
  { fromStageId: "sourced", toStageId: "screened" },
  { fromStageId: "sourced", toStageId: "rejected" },
  { fromStageId: "sourced", toStageId: "on_hold" },
  { fromStageId: "screened", toStageId: "demo_scheduled" },
  { fromStageId: "screened", toStageId: "rejected" },
  { fromStageId: "screened", toStageId: "on_hold" },
  { fromStageId: "demo_scheduled", toStageId: "demo_completed" },
  { fromStageId: "demo_scheduled", toStageId: "rejected" },
  { fromStageId: "demo_completed", toStageId: "offer_sent" },
  { fromStageId: "demo_completed", toStageId: "rejected" },
  { fromStageId: "offer_sent", toStageId: "hired" },
  { fromStageId: "offer_sent", toStageId: "rejected" },
  { fromStageId: "on_hold", toStageId: "screened" },
  { fromStageId: "on_hold", toStageId: "rejected" },
];

const DEFAULT_ROLES = [
  { name: "hr_admin", permissions: ["*"], isSystem: true },
  { name: "principal", permissions: ["dashboard", "jobs", "pipeline", "feedback", "talent"], isSystem: true },
  { name: "hod", permissions: ["pipeline", "feedback"], isSystem: true },
  { name: "viewer", permissions: ["dashboard"], isSystem: true },
];

export const create = mutation({
  args: {
    name: v.string(),
    board: v.union(
      v.literal("CBSE"),
      v.literal("ICSE"),
      v.literal("IB"),
      v.literal("State"),
      v.literal("IGCSE")
    ),
    city: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("schools")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      throw new Error("A school with this name already exists");
    }

    const schoolId = await ctx.db.insert("schools", {
      name: args.name,
      board: args.board,
      city: args.city,
      state: args.state,
      planTier: "free",
      whatsappEnabled: false,
    });

    await ctx.db.insert("pipelineConfigs", {
      schoolId,
      stages: DEFAULT_PIPELINE_STAGES,
      transitions: DEFAULT_PIPELINE_TRANSITIONS,
      version: 1,
    });

    for (const r of DEFAULT_ROLES) {
      await ctx.db.insert("roles", { ...r, schoolId });
    }

    return schoolId;
  },
});

export const get = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.schoolId);
  },
});

export const getInternal = internalQuery({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.schoolId);
  },
});

export const updateSettings = mutation({
  args: {
    schoolId: v.id("schools"),
    slug: v.optional(v.string()),
    whatsappEnabled: v.optional(v.boolean()),
    messageChannelPrefs: v.optional(v.object({
      shortlist: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      demo_schedule: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      feedback_request: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      offer: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      rejection: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      custom: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
    })),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, any> = {};
    if (args.slug !== undefined) patch.slug = args.slug || undefined;
    if (args.whatsappEnabled !== undefined) patch.whatsappEnabled = args.whatsappEnabled;
    if (args.messageChannelPrefs !== undefined) patch.messageChannelPrefs = args.messageChannelPrefs;
    return await ctx.db.patch(args.schoolId, patch);
  },
});

export const updateCalendarConnectedInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    connected: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.schoolId, { googleCalendarConnected: args.connected });
  },
});
