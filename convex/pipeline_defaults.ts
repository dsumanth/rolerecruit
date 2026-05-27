import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const DEFAULT_STAGES = [
  { id: "sourced", name: "Sourced", order: 0, isTerminal: false, color: "#86868b" },
  { id: "screened", name: "Screened", order: 1, isTerminal: false, color: "#86868b" },
  { id: "demo_scheduled", name: "Demo Scheduled", order: 2, isTerminal: false, color: "#0071e3" },
  { id: "demo_completed", name: "Demo Completed", order: 3, isTerminal: false, color: "#5856d6" },
  { id: "offer_sent", name: "Offer Sent", order: 4, isTerminal: false, color: "#ff9f0a" },
  { id: "hired", name: "Hired", order: 5, isTerminal: true, color: "#34c759" },
  { id: "rejected", name: "Rejected", order: 6, isTerminal: true, color: "#ff3b30" },
  { id: "on_hold", name: "On Hold", order: 7, isTerminal: false, color: "#aeaeb2" },
];

export const DEFAULT_TRANSITIONS = [
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

export const PIPELINE_STAGE_IDS = ["sourced", "screened", "demo_scheduled", "demo_completed", "offer_sent", "hired"] as const;

// Linear pipeline stages where a candidate is still "in motion" — used by
// graph sourcing queries (untappedOnly filter) to exclude candidates already
// being actively recruited. Excludes "hired" (terminal good outcome) plus
// "rejected"/"on_hold" (off-pipeline states that aren't in PIPELINE_STAGE_IDS).
export const ACTIVE_PIPELINE_STAGES = ["sourced", "screened", "demo_scheduled", "demo_completed", "offer_sent"] as const;

export const seedDefaultPipelineForSchool = internalMutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pipelineConfigs")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
    if (existing) return existing._id;

    return ctx.db.insert("pipelineConfigs", {
      schoolId: args.schoolId,
      stages: DEFAULT_STAGES,
      transitions: DEFAULT_TRANSITIONS,
      version: 1,
    });
  },
});

export const migrateExistingSchools = internalMutation({
  args: {},
  handler: async (ctx) => {
    const schools = await ctx.db.query("schools").collect();
    for (const school of schools) {
      const existing = await ctx.db
        .query("pipelineConfigs")
        .withIndex("by_schoolId", (q) => q.eq("schoolId", school._id))
        .first();
      if (!existing) {
        await ctx.db.insert("pipelineConfigs", {
          schoolId: school._id,
          stages: DEFAULT_STAGES,
          transitions: DEFAULT_TRANSITIONS,
          version: 1,
        });
      }
    }
  },
});
