import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MessageCategory } from "./lib/metaPricing";

export function monthStartUtc(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

const CATEGORY_COLUMN: Record<MessageCategory, "utilityCount" | "marketingCount" | "authenticationCount" | "serviceCount"> = {
  utility: "utilityCount",
  marketing: "marketingCount",
  authentication: "authenticationCount",
  service: "serviceCount",
};

// Plain helper called from recordStatus (a mutation cannot call another mutation).
export async function bumpUsage(
  ctx: any,
  args: { schoolId: Id<"schools">; category: MessageCategory; metaCostUsd: number; billableUsd: number },
): Promise<void> {
  const periodStart = monthStartUtc(Date.now());
  const existing = await ctx.db
    .query("whatsappUsage")
    .withIndex("by_schoolId_periodStart", (q: any) => q.eq("schoolId", args.schoolId).eq("periodStart", periodStart))
    .first();
  const col = CATEGORY_COLUMN[args.category];
  if (!existing) {
    const counts = { utilityCount: 0, marketingCount: 0, authenticationCount: 0, serviceCount: 0 };
    counts[col] = 1;
    await ctx.db.insert("whatsappUsage", {
      schoolId: args.schoolId, periodStart, messageCount: 1, ...counts,
      metaCostUsdTotal: args.metaCostUsd, billableUsdTotal: args.billableUsd, updatedAt: Date.now(),
    });
    return;
  }
  await ctx.db.patch(existing._id, {
    messageCount: existing.messageCount + 1,
    [col]: existing[col] + 1,
    metaCostUsdTotal: existing.metaCostUsdTotal + args.metaCostUsd,
    billableUsdTotal: existing.billableUsdTotal + args.billableUsd,
    updatedAt: Date.now(),
  });
}

export const getCurrentUsage = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const periodStart = monthStartUtc(Date.now());
    return await ctx.db
      .query("whatsappUsage")
      .withIndex("by_schoolId_periodStart", (q) => q.eq("schoolId", args.schoolId).eq("periodStart", periodStart))
      .first();
  },
});

export const getUsageHistory = query({
  args: { schoolId: v.id("schools"), months: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("whatsappUsage")
      .withIndex("by_schoolId_periodStart", (q) => q.eq("schoolId", args.schoolId))
      .collect();
    return rows.sort((a, b) => b.periodStart - a.periodStart).slice(0, args.months ?? 6);
  },
});
