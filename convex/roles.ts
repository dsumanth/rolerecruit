import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_ROLES = [
  { name: "hr_admin", permissions: ["*"], isSystem: true },
  { name: "principal", permissions: ["dashboard", "jobs", "pipeline", "feedback", "talent"], isSystem: true },
  { name: "hod", permissions: ["pipeline", "feedback"], isSystem: true },
  { name: "viewer", permissions: ["dashboard"], isSystem: true },
];

export const list = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("roles")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();
  },
});

export const seedDefaults = mutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    if (existing.length > 0) return existing;

    for (const r of DEFAULT_ROLES) {
      await ctx.db.insert("roles", { ...r, schoolId: args.schoolId });
    }

    return await ctx.db
      .query("roles")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();
  },
});

export const create = mutation({
  args: {
    schoolId: v.id("schools"),
    name: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) throw new Error("A role with this name already exists");

    return await ctx.db.insert("roles", {
      schoolId: args.schoolId,
      name: args.name,
      permissions: args.permissions,
      isSystem: false,
    });
  },
});

export const update = mutation({
  args: {
    roleId: v.id("roles"),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Role not found");
    await ctx.db.patch(args.roleId, { permissions: args.permissions });
  },
});

export const remove = mutation({
  args: { roleId: v.id("roles") },
  handler: async (ctx, args) => {
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Role not found");
    if (role.isSystem) throw new Error("Cannot delete system roles");

    const usersWithRole = await ctx.db
      .query("userProfiles")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", role.schoolId))
      .filter((q) => q.eq(q.field("role"), role.name))
      .first();

    if (usersWithRole) throw new Error("Cannot delete role currently assigned to team members");

    await ctx.db.delete(args.roleId);
  },
});
