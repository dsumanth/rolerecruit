import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const BRANCH_VALIDATOR = v.array(v.object({
  condition: v.object({
    minHire: v.optional(v.number()),
    maxReject: v.optional(v.number()),
    minAverage: v.optional(v.object({
      fieldKey: v.string(),
      minValue: v.number(),
    })),
    requiredRoles: v.optional(v.array(v.string())),
  }),
  action: v.union(
    v.literal("advance"),
    v.literal("reject"),
    v.literal("redemo"),
    v.literal("manual"),
  ),
}));

const ACTION_VALIDATOR = v.union(
  v.literal("advance"),
  v.literal("reject"),
  v.literal("redemo"),
  v.literal("manual"),
);

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
  args: {
    schoolId: v.id("schools"),
    name: v.string(),
    branches: BRANCH_VALIDATOR,
    fallback: ACTION_VALIDATOR,
  },
  handler: async (ctx, args) => {
    if (!args.name.trim()) throw new Error("Rule name cannot be empty");
    return await ctx.db.insert("decisionRules", {
      schoolId: args.schoolId,
      name: args.name,
      branches: args.branches,
      fallback: args.fallback,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    ruleId: v.id("decisionRules"),
    name: v.optional(v.string()),
    branches: v.optional(BRANCH_VALIDATOR),
    fallback: v.optional(ACTION_VALIDATOR),
  },
  handler: async (ctx, { ruleId, name, branches, fallback }) => {
    const r = await ctx.db.get(ruleId);
    if (!r) throw new Error("Rule not found");
    const patch: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!name.trim()) throw new Error("Rule name cannot be empty");
      patch.name = name;
    }
    if (branches !== undefined) patch.branches = branches;
    if (fallback !== undefined) patch.fallback = fallback;
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
