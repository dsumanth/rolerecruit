import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { normalizeToE164, countryFromPhone } from "./lib/phone";
import { internal } from "./_generated/api";
import { lookupMetaCostUsd, computeBillableUsd, type MessageCategory } from "./lib/metaPricing";
import { bumpUsage } from "./whatsappUsage";
import { verifyMetaSignature, parseMetaWebhook } from "./lib/metaWebhook";

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

export const recordInbound = internalMutation({
  args: {
    phoneNumberId: v.string(),
    fromPhone: v.string(),
    text: v.string(),
    metaMessageId: v.string(),
  },
  handler: async (ctx, args): Promise<{ matched: boolean }> => {
    const integ = await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_phoneNumberId", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .first();
    if (!integ) {
      console.log(`[whatsapp] inbound for unknown phoneNumberId ${args.phoneNumberId}`);
      return { matched: false };
    }
    const target = normalizeToE164(args.fromPhone);
    if (!target) return { matched: false };

    const candidates = await ctx.db.query("candidates").collect();
    const candidate = candidates.find((c) => normalizeToE164(c.phone) === target);
    if (!candidate) {
      console.log(`[whatsapp] inbound from unknown candidate ${args.fromPhone}`);
      return { matched: false };
    }

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const schoolMessages = await ctx.db
      .query("outreachMessages")
      .withIndex("by_schoolId_sentAt", (q) => q.eq("schoolId", integ.schoolId))
      .collect();
    const outbounds = schoolMessages
      .filter((m) =>
        m.candidateId === candidate._id &&
        m.direction !== "inbound" &&
        m.type !== "rejection" &&
        typeof m.sentAt === "number" &&
        (m.sentAt as number) >= cutoff,
      )
      .sort((a, b) => (b.sentAt as number) - (a.sentAt as number));
    if (outbounds.length === 0) return { matched: false };
    const parent = outbounds[0];

    const inboundId = await ctx.db.insert("outreachMessages", {
      applicationId: parent.applicationId,
      candidateId: candidate._id,
      schoolId: integ.schoolId,
      type: "candidate_reply",
      channel: "whatsapp",
      body: args.text,
      status: "sent",
      direction: "inbound",
      inReplyToMessageId: parent._id,
      metaMessageId: args.metaMessageId,
      sentAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.conversation.handleInbound, { messageId: inboundId });
    return { matched: true };
  },
});

export const processWebhook = internalAction({
  args: { rawBody: v.string(), signature: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args): Promise<{ verified: boolean; inbound: number; statuses: number }> => {
    const verified = await verifyMetaSignature(args.rawBody, args.signature ?? null);
    if (!verified) return { verified: false, inbound: 0, statuses: 0 };

    let payload: any;
    try {
      payload = JSON.parse(args.rawBody);
    } catch {
      return { verified: true, inbound: 0, statuses: 0 };
    }
    const { inbound, statuses } = parseMetaWebhook(payload);

    for (const s of statuses) {
      await ctx.runMutation(internal.whatsappWebhook.recordStatus, {
        phoneNumberId: s.phoneNumberId,
        metaMessageId: s.metaMessageId,
        status: s.status,
        recipientPhone: s.recipientPhone,
        category: s.category,
        pricingModel: s.pricingModel,
        conversationId: s.conversationId,
      });
    }
    for (const m of inbound) {
      await ctx.runMutation(internal.whatsappWebhook.recordInbound, {
        phoneNumberId: m.phoneNumberId,
        fromPhone: m.fromPhone,
        text: m.text,
        metaMessageId: m.metaMessageId,
      });
    }
    return { verified: true, inbound: inbound.length, statuses: statuses.length };
  },
});
