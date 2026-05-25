import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const GUPSHUP_API = "https://api.gupshup.io/wa/api/v1/msg";

async function sendViaGupshup(phone: string, body: string): Promise<string | null> {
  const apiKey = process.env.GUPSHUP_API_KEY;
  const appName = process.env.GUPSHUP_APP_NAME;
  const sourceNumber = process.env.GUPSHUP_SOURCE_NUMBER;
  if (!apiKey || !appName || !sourceNumber) return null;

  const response = await fetch(
    `${GUPSHUP_API}?apikey=${apiKey}&source=${sourceNumber}&destination=${phone}&message=${encodeURIComponent(body)}&app_name=${appName}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  );

  if (!response.ok) return null;
  const json = await response.json();
  return json.messageId ?? null;
}

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

    let channel: "whatsapp" | "email" = "email";
    let externalId: string | null = null;

    if (args.whatsappEnabled && args.candidatePhone) {
      const msgId = await sendViaGupshup(args.candidatePhone, messageBody);
      if (msgId) {
        channel = "whatsapp";
        externalId = msgId;
      }
    }

    if (!externalId && args.candidateEmail) {
      const emailSubject = args.jobTitle
        ? `Application Received — ${args.schoolName} — ${args.jobTitle}`
        : `Application Received — ${args.schoolName}`;
      const emailId = await sendViaResend(args.candidateEmail, emailSubject, messageBody);
      externalId = emailId;
    }

    if (externalId) {
      await ctx.runMutation(internal.outreach.saveSentMessage as any, {
        applicationId: args.applicationId,
        candidateId: args.candidateId,
        type: "custom",
        channel,
        body: messageBody,
        externalId,
      });
    }

    return { channel: externalId ? channel : "none", success: !!externalId };
  },
});
