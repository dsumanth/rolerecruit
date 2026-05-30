import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { BUILT_IN_TEMPLATES } from "./formTemplates.defaults";
import { EVALUATOR_ROLE_UNION } from "./types";

export const seedForSchool = mutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) => {
    const existing = await ctx.db
      .query("formTemplates")
      .withIndex("by_schoolId_role", (q) => q.eq("schoolId", schoolId))
      .collect();
    const seededRoles = new Set(existing.map((r) => r.role));
    const now = Date.now();
    for (const tpl of BUILT_IN_TEMPLATES) {
      if (seededRoles.has(tpl.role)) continue;
      await ctx.db.insert("formTemplates", {
        schoolId,
        role: tpl.role,
        name: tpl.name,
        fields: tpl.fields,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const listForSchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) => {
    return await ctx.db
      .query("formTemplates")
      .withIndex("by_schoolId_role", (q) => q.eq("schoolId", schoolId))
      .collect();
  },
});

export const getForRole = query({
  args: { schoolId: v.id("schools"), role: EVALUATOR_ROLE_UNION },
  handler: async (ctx, { schoolId, role }) => {
    const tpl = await ctx.db
      .query("formTemplates")
      .withIndex("by_schoolId_role", (q) => q.eq("schoolId", schoolId).eq("role", role))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    return tpl ?? null;
  },
});

export const getById = query({
  args: { templateId: v.id("formTemplates") },
  handler: async (ctx, { templateId }) => {
    const tpl = await ctx.db.get(templateId);
    if (!tpl) throw new Error("Template not found");
    return tpl;
  },
});

const FIELD_VALIDATOR = v.array(v.object({
  key: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("score_1_5"),
    v.literal("score_1_10"),
    v.literal("text"),
    v.literal("choice"),
  ),
  choices: v.optional(v.array(v.string())),
  weight: v.optional(v.number()),
  allowDictation: v.optional(v.boolean()),
  required: v.optional(v.boolean()),
}));

function validateFields(fields: Array<{ key: string; label: string }>) {
  const seen = new Set<string>();
  for (const f of fields) {
    if (!f.key || !f.key.trim()) throw new Error("Field key cannot be empty");
    if (!f.label || !f.label.trim()) throw new Error("Field label cannot be empty");
    if (seen.has(f.key)) throw new Error(`Duplicate field key: ${f.key}`);
    seen.add(f.key);
  }
}

export const saveOverride = mutation({
  args: {
    schoolId: v.id("schools"),
    role: EVALUATOR_ROLE_UNION,
    name: v.string(),
    fields: FIELD_VALIDATOR,
  },
  handler: async (ctx, { schoolId, role, name, fields }) => {
    if (!name.trim()) throw new Error("Template name cannot be empty");
    validateFields(fields);

    const existing = await ctx.db
      .query("formTemplates")
      .withIndex("by_schoolId_role", (q) => q.eq("schoolId", schoolId).eq("role", role))
      .collect();
    for (const row of existing) {
      if (row.isActive) await ctx.db.patch(row._id, { isActive: false });
    }
    const now = Date.now();
    return await ctx.db.insert("formTemplates", {
      schoolId, role, name, fields,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const duplicateFromDefault = query({
  args: { schoolId: v.id("schools"), role: EVALUATOR_ROLE_UNION },
  handler: async (_ctx, { role }) => {
    const def = BUILT_IN_TEMPLATES.find((t) => t.role === role);
    if (!def) throw new Error(`No built-in default for role ${role}`);
    return {
      role: def.role,
      name: `${def.name} (copy)`,
      fields: def.fields,
    };
  },
});
