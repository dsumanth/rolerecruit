import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

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

export const sendPushNotification = internalAction({
  args: {
    expoPushTokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (_ctx, args) => {
    if (args.expoPushTokens.length === 0) return;
    const messages = args.expoPushTokens.map((token) => ({
      to: token,
      sound: "default",
      title: args.title,
      body: args.body,
      data: args.data,
    }));
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Expo push send failed", res.status, text);
    }
  },
});

export type DemoEvent =
  | "invite_created"
  | "form_opens"
  | "demo_completed"
  | "demo_cancelled"
  | "evaluator_swap_in"
  | "evaluator_swap_out";

export function renderDemoEventPush(
  event: DemoEvent,
  extra: { candidateName?: string; subject?: string } = {},
): { title: string; body: string } {
  const candidate = extra.candidateName ?? "a candidate";
  const subject = extra.subject ? ` for ${extra.subject}` : "";
  switch (event) {
    case "invite_created":
      return {
        title: "You've been invited to evaluate",
        body: `${candidate}${subject} - tap to view`,
      };
    case "form_opens":
      return {
        title: "Form is now open",
        body: `Submit your feedback for ${candidate}`,
      };
    case "demo_completed":
      return {
        title: "Demo completed",
        body: `All evaluations are in for ${candidate}`,
      };
    case "demo_cancelled":
      return {
        title: "Demo cancelled",
        body: `${candidate}'s demo was cancelled. No action needed.`,
      };
    case "evaluator_swap_in":
      return {
        title: "You've been added as an evaluator",
        body: `You're now evaluating ${candidate}`,
      };
    case "evaluator_swap_out":
      return {
        title: "You were swapped out",
        body: `You no longer need to evaluate ${candidate}`,
      };
  }
}

export const sendDemoEvent = internalAction({
  args: {
    event: v.union(
      v.literal("invite_created"),
      v.literal("form_opens"),
      v.literal("demo_completed"),
      v.literal("demo_cancelled"),
      v.literal("evaluator_swap_in"),
      v.literal("evaluator_swap_out"),
    ),
    demoId: v.id("demoSessions"),
    targetUserIds: v.array(v.id("userProfiles")),
    extra: v.optional(v.object({
      candidateName: v.optional(v.string()),
      subject: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const tokens: string[] = [];
    for (const uid of args.targetUserIds) {
      const u = await ctx.runQuery(internal.users.getByIdInternal, { userId: uid });
      if (u?.expoPushTokens) tokens.push(...u.expoPushTokens);
    }
    if (tokens.length === 0) return;
    const { title, body } = renderDemoEventPush(args.event, args.extra ?? {});
    await ctx.runAction(internal.notifications.sendPushNotification, {
      expoPushTokens: tokens,
      title,
      body,
      data: { demoId: args.demoId, event: args.event },
    });
  },
});

export const notifyDemoComplete = internalAction({
  args: { demoId: v.id("demoSessions") },
  handler: async (ctx, { demoId }) => {
    const demo = await ctx.runQuery(internal.demoSessions.getInternal, { demoId });
    if (!demo) return;
    const profiles: Doc<"userProfiles">[] = await ctx.runQuery(
      internal.users.listSchoolStaffInternal,
      { schoolId: demo.schoolId },
    );
    const targets = profiles
      .filter((p) => p.role === "hr_admin" || p.role === "principal")
      .filter((p) => Array.isArray(p.expoPushTokens) && p.expoPushTokens.length > 0)
      .map((p) => p._id);
    if (targets.length === 0) return;
    await ctx.scheduler.runAfter(0, internal.notifications.sendDemoEvent, {
      event: "demo_completed",
      demoId,
      targetUserIds: targets,
    });
  },
});
