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
    if (!tpl) throw new Error(`No active template for role ${role} in school ${schoolId}`);
    return tpl;
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
