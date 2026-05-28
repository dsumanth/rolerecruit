import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export function renderInviteEmail(args: {
  candidateName: string;
  role: string;
  scheduledAt: number;
  formUrl: string;
}): string {
  const when = new Date(args.scheduledAt).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
  return `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;">
  <h2>You're invited to evaluate ${args.candidateName}</h2>
  <p>Role: <strong>${args.role}</strong></p>
  <p>When: <strong>${when}</strong></p>
  <p><a href="${args.formUrl}" style="display:inline-block;background:#0066ff;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open the evaluation</a></p>
  <p style="color:#666;font-size:13px;">Link valid until the demo's form-close window passes.</p>
</body></html>
`.trim();
}

export const sendInviteEmail = internalAction({
  args: {
    to: v.string(),
    candidateName: v.string(),
    role: v.string(),
    scheduledAt: v.number(),
    formUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set; skipping email send");
      return;
    }
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "no-reply@rolerecruit.app",
      to: args.to,
      subject: `Evaluate ${args.candidateName}`,
      html: renderInviteEmail(args),
    });
  },
});

export function renderSwapEmail(args: {
  newEvaluatorName: string;
  candidateName: string;
  scheduledAt: number;
  tokenUrl: string;
}): { subject: string; html: string } {
  const when = new Date(args.scheduledAt).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
  const subject = `You're now evaluating ${args.candidateName}`;
  const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;">
  <h2>You've been added as an evaluator</h2>
  <p>Hi ${args.newEvaluatorName},</p>
  <p>You've been added to evaluate <strong>${args.candidateName}</strong>'s demo on <strong>${when}</strong>.</p>
  <p><a href="${args.tokenUrl}" style="display:inline-block;background:#0066ff;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open the evaluation</a></p>
</body></html>
`.trim();
  return { subject, html };
}

export function renderSwapOutEmail(args: {
  oldEvaluatorName: string;
  candidateName: string;
  scheduledAt: number;
}): { subject: string; html: string } {
  const when = new Date(args.scheduledAt).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
  const subject = `You were swapped out of ${args.candidateName}'s demo`;
  const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;">
  <h2>You were swapped out</h2>
  <p>Hi ${args.oldEvaluatorName},</p>
  <p>You have been swapped out of the evaluation for <strong>${args.candidateName}</strong>'s demo on <strong>${when}</strong>. No action needed on your part.</p>
</body></html>
`.trim();
  return { subject, html };
}

export const sendSwapEmail = internalAction({
  args: {
    to: v.string(),
    newEvaluatorName: v.string(),
    candidateName: v.string(),
    scheduledAt: v.number(),
    tokenUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set; skipping swap email send");
      return;
    }
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { subject, html } = renderSwapEmail(args);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "no-reply@rolerecruit.app",
      to: args.to,
      subject,
      html,
    });
  },
});

export const sendSwapOutEmail = internalAction({
  args: {
    to: v.string(),
    oldEvaluatorName: v.string(),
    candidateName: v.string(),
    scheduledAt: v.number(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set; skipping swap-out email send");
      return;
    }
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { subject, html } = renderSwapOutEmail(args);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "no-reply@rolerecruit.app",
      to: args.to,
      subject,
      html,
    });
  },
});

// Push notification stub. Real Expo push wiring lives in Plan 3.
export const sendPushNotification = internalAction({
  args: {
    expoPushTokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (_ctx, args) => {
    if (args.expoPushTokens.length === 0) return;
    // TODO(Plan 3): POST to https://exp.host/--/api/v2/push/send
    console.log("[push stub] would send:", args.title, "->", args.expoPushTokens.length, "tokens");
  },
});
