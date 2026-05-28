import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_MARKUP_PCT = 20;

export const getBySchoolInternal = internalQuery({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
  },
});

export const getByPhoneNumberId = internalQuery({
  args: { phoneNumberId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_phoneNumberId", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .first();
  },
});

export const upsertActiveIntegration = internalMutation({
  args: {
    schoolId: v.id("schools"),
    wabaId: v.string(),
    phoneNumberId: v.string(),
    displayPhoneNumber: v.string(),
    businessName: v.string(),
    verifiedName: v.string(),
    accessTokenCipher: v.string(),
    accessTokenIv: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
    const fields = {
      status: "active" as const,
      wabaId: args.wabaId,
      phoneNumberId: args.phoneNumberId,
      displayPhoneNumber: args.displayPhoneNumber,
      businessName: args.businessName,
      verifiedName: args.verifiedName,
      accessTokenCipher: args.accessTokenCipher,
      accessTokenIv: args.accessTokenIv,
      connectedAt: Date.now(),
      disconnectedAt: undefined,
      lastErrorAt: undefined,
      lastErrorMessage: undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("whatsappIntegrations", {
      schoolId: args.schoolId,
      markupPct: DEFAULT_MARKUP_PCT,
      ...fields,
    });
  },
});

export const setIntegrationError = internalMutation({
  args: { schoolId: v.id("schools"), message: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
    const fields = { status: "error" as const, lastErrorAt: Date.now(), lastErrorMessage: args.message };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("whatsappIntegrations", { schoolId: args.schoolId, markupPct: DEFAULT_MARKUP_PCT, ...fields });
    }
  },
});

export const getIntegration = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
    if (!row) return { status: "not_connected" as const, markupPct: DEFAULT_MARKUP_PCT };
    // Never expose the encrypted token to the client.
    return {
      status: row.status,
      displayPhoneNumber: row.displayPhoneNumber,
      businessName: row.businessName,
      verifiedName: row.verifiedName,
      markupPct: row.markupPct,
      connectedAt: row.connectedAt,
      lastErrorMessage: row.lastErrorMessage,
    };
  },
});

export const updateMarkup = mutation({
  args: { schoolId: v.id("schools"), markupPct: v.number() },
  handler: async (ctx, args) => {
    if (args.markupPct < 0 || args.markupPct > 500) throw new Error("markupPct out of range");
    const row = await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
    if (!row) throw new Error("No WhatsApp integration for this school");
    await ctx.db.patch(row._id, { markupPct: args.markupPct });
  },
});

export const disconnect = mutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
    if (!row) return;
    await ctx.db.patch(row._id, {
      status: "disconnected",
      disconnectedAt: Date.now(),
      accessTokenCipher: undefined,
      accessTokenIv: undefined,
      phoneNumberId: undefined,
      wabaId: undefined,
    });
  },
});
