import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { countryFromPhone } from "./lib/phone";
import { lookupMetaCostUsd, computeBillableUsd, type MessageCategory } from "./lib/metaPricing";
import { bumpUsage } from "./whatsappUsage";

function mapStatus(metaStatus: string): "sent" | "delivered" | "failed" | undefined {
  if (metaStatus === "sent") return "sent";
  if (metaStatus === "delivered" || metaStatus === "read") return "delivered";
  if (metaStatus === "failed") return "failed";
  return undefined;
}

export const recordStatus = internalMutation({
  args: {
    phoneNumberId: v.string(),
    metaMessageId: v.string(),
    status: v.string(),
    recipientPhone: v.optional(v.string()),
    category: v.optional(v.string()),
    pricingModel: v.optional(v.string()),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("outreachMessages")
      .withIndex("by_metaMessageId", (q) => q.eq("metaMessageId", args.metaMessageId))
      .first();
    if (!row) {
      console.log(`[whatsapp] status for unknown message ${args.metaMessageId}`);
      return;
    }

    const patch: Record<string, unknown> = {};
    const mapped = mapStatus(args.status);
    if (mapped) patch.status = mapped;

    // Record cost exactly once - when pricing first arrives and we haven't priced this row yet.
    if (args.category && row.metaCostUsd === undefined) {
      const integ = await ctx.db
        .query("whatsappIntegrations")
        .withIndex("by_phoneNumberId", (q) => q.eq("phoneNumberId", args.phoneNumberId))
        .first();
      const markupPct = row.markupPct ?? integ?.markupPct ?? 20;
      const category = args.category as MessageCategory;
      const countryCode = countryFromPhone(args.recipientPhone);
      const metaCostUsd = lookupMetaCostUsd({ countryCode, category });
      const billableUsd = computeBillableUsd(metaCostUsd, markupPct);
      patch.metaCategory = category;
      patch.metaPricingModel = args.pricingModel;
      patch.metaConversationId = args.conversationId;
      patch.metaCostUsd = metaCostUsd;
      patch.billableUsd = billableUsd;
      patch.markupPct = markupPct;
      patch.costCurrency = "USD";
      await ctx.db.patch(row._id, patch);
      if (row.schoolId) {
        await bumpUsage(ctx, { schoolId: row.schoolId, category, metaCostUsd, billableUsd });
      }
      return;
    }

    if (Object.keys(patch).length > 0) await ctx.db.patch(row._id, patch);
  },
});
