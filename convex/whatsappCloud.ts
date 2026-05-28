import { action, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { decryptSecret } from "./lib/crypto";
import { sendCloudText, sendCloudTemplate } from "./lib/meta";

export const getSendContextByApplication = internalQuery({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");
    const integ = await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", app.schoolId))
      .first();
    if (
      !integ || integ.status !== "active" ||
      !integ.phoneNumberId || !integ.accessTokenCipher || !integ.accessTokenIv
    ) {
      throw new Error("WHATSAPP_NOT_CONNECTED");
    }
    return {
      schoolId: app.schoolId,
      phoneNumberId: integ.phoneNumberId,
      accessTokenCipher: integ.accessTokenCipher,
      accessTokenIv: integ.accessTokenIv,
      markupPct: integ.markupPct,
    };
  },
});

type SendArgs =
  | { kind: "text"; body: string }
  | { kind: "template"; templateName: string; languageCode: string; bodyParams: string[] };

// Plain helper (mirrors draftOutreach in outreach.ts for the ctx-passing pattern).
// Sends via Graph API only - persistence is the caller's job.
export async function cloudSend(
  ctx: any,
  args: { applicationId: Id<"applications">; to: string } & SendArgs,
): Promise<{ metaMessageId: string; markupPct: number; schoolId: Id<"schools"> }> {
  const cxt = await ctx.runQuery(internal.whatsappCloud.getSendContextByApplication, {
    applicationId: args.applicationId,
  });
  const token = await decryptSecret({ cipher: cxt.accessTokenCipher, iv: cxt.accessTokenIv });
  let metaMessageId: string;
  if (args.kind === "text") {
    metaMessageId = await sendCloudText({ phoneNumberId: cxt.phoneNumberId, token, to: args.to, body: args.body });
  } else {
    metaMessageId = await sendCloudTemplate({
      phoneNumberId: cxt.phoneNumberId, token, to: args.to,
      templateName: args.templateName, languageCode: args.languageCode, bodyParams: args.bodyParams,
    });
  }
  return { metaMessageId, markupPct: cxt.markupPct, schoolId: cxt.schoolId };
}

export const insertCloudSentMessage = internalMutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    schoolId: v.id("schools"),
    type: v.string(),
    body: v.string(),
    metaMessageId: v.string(),
    markupPct: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachMessages", {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      schoolId: args.schoolId,
      type: args.type as any,
      channel: "whatsapp",
      body: args.body,
      status: "sent",
      direction: "outbound",
      sentAt: Date.now(),
      metaMessageId: args.metaMessageId,
      markupPct: args.markupPct,
      costCurrency: "USD",
    });
  },
});

// Maps internal outreach template keys -> approved Meta templates (created in Meta Business Manager).
// `params` is the ordered list of templateParams keys that fill the template body variables {{1}}, {{2}}, ...
const TEMPLATE_REGISTRY: Record<string, { metaName: string; languageCode: string; params: string[] }> = {
  shortlist_notification: { metaName: "shortlist_notification", languageCode: "en", params: ["name", "position", "school"] },
  demo_schedule: { metaName: "demo_schedule", languageCode: "en", params: ["name", "date", "time", "topic", "classLevel", "address", "school"] },
  feedback_request: { metaName: "feedback_request", languageCode: "en", params: ["name", "feedbackUrl"] },
  offer_notification: { metaName: "offer_notification", languageCode: "en", params: ["name", "position", "school", "deadline"] },
  rejection_notification: { metaName: "rejection_notification", languageCode: "en", params: ["name", "position", "school"] },
};

export const sendWhatsAppTemplate = action({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    templateName: v.string(),
    templateParams: v.any(),
    phone: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    const spec = TEMPLATE_REGISTRY[args.templateName];
    if (!spec) throw new Error(`Unknown template: ${args.templateName}`);
    const p = (args.templateParams ?? {}) as Record<string, string>;
    const bodyParams = spec.params.map((k) => p[k] ?? "");
    try {
      const { metaMessageId, markupPct, schoolId } = await cloudSend(ctx, {
        applicationId: args.applicationId, to: args.phone,
        kind: "template", templateName: spec.metaName, languageCode: spec.languageCode, bodyParams,
      });
      await ctx.runMutation(internal.whatsappCloud.insertCloudSentMessage, {
        applicationId: args.applicationId, candidateId: args.candidateId, schoolId,
        type: args.templateName.replace("_notification", ""), body: bodyParams.join(" | "),
        metaMessageId, markupPct,
      });
      return { success: true, messageId: metaMessageId };
    } catch (err: any) {
      await ctx.runMutation(internal.outreach.saveFailedMessage as any, {
        applicationId: args.applicationId, candidateId: args.candidateId,
        type: args.templateName, channel: "whatsapp", body: bodyParams.join(" | "), error: err?.message ?? "Unknown error",
      });
      return { success: false, error: err?.message };
    }
  },
});

export const sendWhatsAppMessage = action({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    type: v.union(
      v.literal("shortlist"),
      v.literal("demo_schedule"),
      v.literal("feedback_request"),
      v.literal("offer"),
      v.literal("rejection"),
      v.literal("custom"),
    ),
    channel: v.literal("whatsapp"),
    body: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      const { metaMessageId, markupPct, schoolId } = await cloudSend(ctx, {
        applicationId: args.applicationId, to: args.phone, kind: "text", body: args.body,
      });
      await ctx.runMutation(internal.whatsappCloud.insertCloudSentMessage, {
        applicationId: args.applicationId, candidateId: args.candidateId, schoolId,
        type: args.type, body: args.body, metaMessageId, markupPct,
      });
      return { success: true, messageId: metaMessageId };
    } catch (err: any) {
      await ctx.runMutation(internal.outreach.saveFailedMessage as any, {
        applicationId: args.applicationId, candidateId: args.candidateId,
        type: args.type, channel: "whatsapp", body: args.body, error: err?.message ?? "Unknown error",
      });
      return { success: false, error: err?.message };
    }
  },
});
