import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { cloudSend } from "./whatsapp";

async function sendViaResend(to: string, subject: string, text: string): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: "RoleRecruit <noreply@rolerecruit.com>",
      to,
      subject,
      text,
    });
    return result.data?.id ?? null;
  } catch {
    return null;
  }
}

export const sendMagicLink = internalAction({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    candidateName: v.string(),
    candidateEmail: v.optional(v.string()),
    candidatePhone: v.optional(v.string()),
    trackingToken: v.string(),
    schoolName: v.string(),
    jobTitle: v.optional(v.string()),
    whatsappEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const trackingUrl = `${baseUrl}/track/${args.trackingToken}`;
    const messageBody = args.jobTitle
      ? `Your application to ${args.schoolName} for ${args.jobTitle} has been received. Track your status: ${trackingUrl}`
      : `Your application to ${args.schoolName} has been received. Track your status: ${trackingUrl}`;

    // Prefer the school's connected WhatsApp Cloud API number; fall back to email.
    if (args.whatsappEnabled && args.candidatePhone) {
      try {
        const { metaMessageId, markupPct, schoolId } = await cloudSend(ctx, {
          applicationId: args.applicationId,
          to: args.candidatePhone,
          kind: "text",
          body: messageBody,
        });
        await ctx.runMutation(internal.whatsapp.insertCloudSentMessage, {
          applicationId: args.applicationId,
          candidateId: args.candidateId,
          schoolId,
          type: "custom",
          body: messageBody,
          metaMessageId,
          markupPct,
        });
        return { channel: "whatsapp" as const, success: true };
      } catch {
        // WhatsApp not connected or send failed - fall through to email.
      }
    }

    if (args.candidateEmail) {
      const emailSubject = args.jobTitle
        ? `Application Received — ${args.schoolName} — ${args.jobTitle}`
        : `Application Received — ${args.schoolName}`;
      const emailId = await sendViaResend(args.candidateEmail, emailSubject, messageBody);
      if (emailId) {
        await ctx.runMutation(internal.outreach.saveSentMessage as any, {
          applicationId: args.applicationId,
          candidateId: args.candidateId,
          type: "custom",
          channel: "email",
          body: messageBody,
          externalId: emailId,
        });
        return { channel: "email" as const, success: true };
      }
    }

    return { channel: "none" as const, success: false };
  },
});
