import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const REC = v.union(v.literal("hire"), v.literal("maybe"), v.literal("reject"));
const ROLE = v.union(v.literal("principal"), v.literal("hod"), v.literal("hr_admin"), v.literal("teacher"));
const RANGE_OP = v.union(v.literal("atLeast"), v.literal("atMost"));
const COUNT_OP = v.union(v.literal("atLeast"), v.literal("atMost"), v.literal("exactly"));

const ACTION_VALIDATOR = v.union(
  v.literal("advance"),
  v.literal("reject"),
  v.literal("redemo"),
  v.literal("manual"),
);

const CONDITION_VALIDATOR = v.union(
  v.object({ type: v.literal("recCount"), rec: REC, op: COUNT_OP, value: v.number() }),
  v.object({ type: v.literal("recPercent"), rec: REC, op: RANGE_OP, value: v.number() }),
  v.object({ type: v.literal("scoreAvg"), formTemplateId: v.optional(v.string()), fieldKey: v.string(), op: RANGE_OP, value: v.number() }),
  v.object({ type: v.literal("overallScore"), op: RANGE_OP, value: v.number() }),
  v.object({ type: v.literal("roleSubmitted"), mode: v.union(v.literal("allOf"), v.literal("anyOf")), roles: v.array(ROLE) }),
  v.object({ type: v.literal("roleVerdict"), role: ROLE, rec: REC }),
);

const STEP_VALIDATOR = v.array(v.object({
  match: v.union(v.literal("all"), v.literal("any")),
  conditions: v.array(CONDITION_VALIDATOR),
  action: ACTION_VALIDATOR,
}));

export const list = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) =>
    await ctx.db
      .query("decisionRules")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId))
      .collect(),
});

export const listActive = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) => {
    const rows = await ctx.db
      .query("decisionRules")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId))
      .collect();
    return rows.filter((r) => r.isActive);
  },
});

export const get = query({
  args: { ruleId: v.id("decisionRules") },
  handler: async (ctx, { ruleId }) => {
    const r = await ctx.db.get(ruleId);
    if (!r) throw new Error("Rule not found");
    return r;
  },
});

export const create = mutation({
  args: { schoolId: v.id("schools"), name: v.string(), steps: STEP_VALIDATOR, otherwise: ACTION_VALIDATOR },
  handler: async (ctx, args) => {
    if (!args.name.trim()) throw new Error("Rule name cannot be empty");
    return await ctx.db.insert("decisionRules", {
      schoolId: args.schoolId,
      name: args.name,
      steps: args.steps,
      otherwise: args.otherwise,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    ruleId: v.id("decisionRules"),
    name: v.optional(v.string()),
    steps: v.optional(STEP_VALIDATOR),
    otherwise: v.optional(ACTION_VALIDATOR),
  },
  handler: async (ctx, { ruleId, name, steps, otherwise }) => {
    const r = await ctx.db.get(ruleId);
    if (!r) throw new Error("Rule not found");
    const patch: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!name.trim()) throw new Error("Rule name cannot be empty");
      patch.name = name;
    }
    if (steps !== undefined) patch.steps = steps;
    if (otherwise !== undefined) patch.otherwise = otherwise;
    if (Object.keys(patch).length === 0) return;
    await ctx.db.patch(ruleId, patch);
  },
});

export const setActive = mutation({
  args: { ruleId: v.id("decisionRules"), active: v.boolean() },
  handler: async (ctx, { ruleId, active }) => {
    const r = await ctx.db.get(ruleId);
    if (!r) throw new Error("Rule not found");
    await ctx.db.patch(ruleId, { isActive: active });
  },
});

export const remove = mutation({
  args: { ruleId: v.id("decisionRules") },
  handler: async (ctx, { ruleId }) => {
    const r = await ctx.db.get(ruleId);
    if (!r) throw new Error("Rule not found");
    await ctx.db.delete(ruleId);
  },
});
