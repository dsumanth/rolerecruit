import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const GUPSHUP_API = "https://api.gupshup.io/wa/api/v1/msg";

interface GupshupResponse {
  messageId?: string;
  status?: string;
}

async function sendGupshupMessage(
  phone: string,
  body: string,
): Promise<GupshupResponse> {
  const apiKey = process.env.GUPSHUP_API_KEY;
  const appName = process.env.GUPSHUP_APP_NAME;
  const sourceNumber = process.env.GUPSHUP_SOURCE_NUMBER;

  if (!apiKey || !appName || !sourceNumber) {
    throw new Error("WhatsApp API not configured");
  }

  const response = await fetch(
    `${GUPSHUP_API}?apikey=${apiKey}&source=${sourceNumber}&destination=${phone}&message=${encodeURIComponent(body)}&app_name=${appName}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  );

  if (!response.ok) {
    throw new Error(`Gupshup API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

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
  handler: async (ctx, args) => {
    try {
      const result = await sendGupshupMessage(args.phone, args.body);

      await ctx.runMutation(internal.outreach.saveSentMessage as any, {
        applicationId: args.applicationId,
        candidateId: args.candidateId,
        type: args.type,
        channel: "whatsapp",
        body: args.body,
        externalId: result.messageId ?? "unknown",
      });

      return { success: true, messageId: result.messageId };
    } catch (err: any) {
      await ctx.runMutation(internal.outreach.saveFailedMessage as any, {
        applicationId: args.applicationId,
        candidateId: args.candidateId,
        type: args.type,
        channel: "whatsapp",
        body: args.body,
        error: err.message ?? "Unknown error",
      });

      return { success: false, error: err.message };
    }
  },
});

const TEMPLATES: Record<string, (params: Record<string, string>) => string> = {
  shortlist_notification: (p) =>
    `Dear ${p.name},\n\nYour profile has been shortlisted for the ${p.position} position at ${p.school}. We would like to invite you for a demo lesson. Our team will contact you shortly with the schedule.\n\nRegards,\n${p.school} HR`,

  demo_schedule: (p) =>
    `Dear ${p.name},\n\nYour demo lesson has been scheduled:\nDate: ${p.date}\nTime: ${p.time}\nTopic: ${p.topic}\nClass: ${p.classLevel}\nAddress: ${p.address}\n\nPlease confirm your availability.\n\nRegards,\n${p.school} HR`,

  feedback_request: (p) =>
    `Dear ${p.name},\n\nPlease submit your feedback for the candidate's demo lesson using this link:\n${p.feedbackUrl}\n\nRegards,\nRoleRecruit`,

  offer_notification: (p) =>
    `Dear ${p.name},\n\nCongratulations! We are pleased to offer you the ${p.position} position at ${p.school}. Your offer letter has been sent to your email. Please review and respond by ${p.deadline}.\n\nRegards,\n${p.school} HR`,

  rejection_notification: (p) =>
    `Dear ${p.name},\n\nThank you for your interest in the ${p.position} position at ${p.school}. After careful consideration, we have decided to move forward with another candidate. We appreciate your time and wish you the best.\n\nRegards,\n${p.school} HR`,
};

export const sendWhatsAppTemplate = action({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    templateName: v.string(),
    templateParams: v.any(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const templateFn = TEMPLATES[args.templateName];
    if (!templateFn) {
      throw new Error(`Unknown template: ${args.templateName}`);
    }

    const body = templateFn(args.templateParams as Record<string, string>);

    try {
      const result = await sendGupshupMessage(args.phone, body);

      await ctx.runMutation(internal.outreach.saveSentMessage as any, {
        applicationId: args.applicationId,
        candidateId: args.candidateId,
        type: args.templateName.replace("_notification", ""),
        channel: "whatsapp",
        body,
        externalId: result.messageId ?? "unknown",
      });

      return { success: true, messageId: result.messageId };
    } catch (err: any) {
      await ctx.runMutation(internal.outreach.saveFailedMessage as any, {
        applicationId: args.applicationId,
        candidateId: args.candidateId,
        type: args.templateName,
        channel: "whatsapp",
        body,
        error: err.message ?? "Unknown error",
      });

      return { success: false, error: err.message };
    }
  },
});
