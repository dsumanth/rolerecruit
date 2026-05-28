import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const getProfileInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const getByClerkId = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const getBySchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();
  },
});

export const listSchoolStaff = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) =>
    await ctx.db
      .query("userProfiles")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId))
      .collect(),
});

export const createProfile = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    email: v.string(),
    schoolId: v.id("schools"),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) throw new Error("Profile already exists");

    return await ctx.db.insert("userProfiles", {
      userId: args.userId,
      name: args.name,
      email: args.email,
      schoolId: args.schoolId,
      role: args.role,
    });
  },
});

export const updateRole = mutation({
  args: {
    userId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) throw new Error("User not found");

    const roleExists = await ctx.db
      .query("roles")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", profile.schoolId))
      .filter((q) => q.eq(q.field("name"), args.role))
      .first();

    if (!roleExists) throw new Error(`Role "${args.role}" does not exist`);

    return await ctx.db.patch(profile._id, { role: args.role });
  },
});

export const getPermissions = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) return [];

    const role = await ctx.db
      .query("roles")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", profile.schoolId))
      .filter((q) => q.eq(q.field("name"), profile.role))
      .first();

    if (role) return role.permissions;

    const legacyPermissions: Record<string, string[]> = {
      hr_admin: ["*"],
      principal: ["dashboard", "jobs", "pipeline", "feedback", "talent"],
      hod: ["pipeline", "feedback"],
      viewer: ["dashboard"],
    };

    return legacyPermissions[profile.role] ?? [];
  },
});

export const getById = query({
  args: { userId: v.id("userProfiles") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    if (!u) throw new Error("User profile not found");
    return u;
  },
});

export const getByIdInternal = internalQuery({
  args: { userId: v.id("userProfiles") },
  handler: async (ctx, { userId }) => await ctx.db.get(userId),
});

export const registerExpoToken = mutation({
  args: { userId: v.id("userProfiles"), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    if (!token.trim()) throw new Error("Token cannot be empty");
    const u = await ctx.db.get(userId);
    if (!u) throw new Error("User profile not found");
    const existing = u.expoPushTokens ?? [];
    if (existing.includes(token)) return;
    await ctx.db.patch(userId, { expoPushTokens: [...existing, token] });
  },
});

export const unregisterExpoToken = mutation({
  args: { userId: v.id("userProfiles"), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    const u = await ctx.db.get(userId);
    if (!u) throw new Error("User profile not found");
    const existing = u.expoPushTokens ?? [];
    const next = existing.filter((t) => t !== token);
    if (next.length === existing.length) return;
    await ctx.db.patch(userId, { expoPushTokens: next });
  },
});
