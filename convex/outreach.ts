import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { OUTREACH_DRAFT_SYSTEM } from "./prompts/outreachDraft";
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";
import { generateReplyToken } from "./lib/replyToken";
import { cloudSend } from "./whatsapp";

export const sendMessage = mutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    type: v.union(
      v.literal("shortlist"),
      v.literal("demo_schedule"),
      v.literal("feedback_request"),
      v.literal("offer"),
      v.literal("rejection"),
      v.literal("custom")
    ),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachMessages", {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      type: args.type,
      channel: args.channel,
      body: args.body,
      sentAt: Date.now(),
      status: "sent",
    });
  },
});

export const getMessageHistory = query({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("outreachMessages")
      .withIndex("by_applicationId", (q) =>
        q.eq("applicationId", args.applicationId)
      )
      .collect();
  },
});

export const saveSentMessage = internalMutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    type: v.string(),
    channel: v.string(),
    body: v.string(),
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachMessages", {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      type: args.type as any,
      channel: args.channel as any,
      body: args.body,
      sentAt: Date.now(),
      status: "sent",
      externalId: args.externalId,
    });
  },
});

export const getOutreachHistoryForJob = query({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_jobPostingId", (q) => q.eq("jobPostingId", args.jobId))
      .collect();

    const groups = [];
    for (const app of apps) {
      const messages = await ctx.db
        .query("outreachMessages")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", app._id))
        .collect();

      if (messages.length === 0) continue;

      const candidate = await ctx.db.get(app.candidateId);
      groups.push({
        applicationId: app._id,
        candidateName: candidate?.name ?? "Unknown Candidate",
        messages,
      });
    }

    groups.sort((a, b) => {
      const aLatest = Math.max(0, ...a.messages.filter((m: any) => typeof m.sentAt === "number").map((m: any) => m.sentAt));
      const bLatest = Math.max(0, ...b.messages.filter((m: any) => typeof m.sentAt === "number").map((m: any) => m.sentAt));
      return bLatest - aLatest;
    });

    return groups;
  },
});

export const saveFailedMessage = internalMutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    type: v.string(),
    channel: v.string(),
    body: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachMessages", {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      type: args.type as any,
      channel: args.channel as any,
      body: args.body,
      sentAt: Date.now(),
      status: "failed",
    });
  },
});

export const createDraft = internalMutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    type: v.union(
      v.literal("shortlist"),
      v.literal("rejection"),
      v.literal("cross_role_suggestion"),
    ),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    body: v.string(),
    scheduledSendAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");
    const replyToken = args.channel === "email" ? generateReplyToken() : undefined;
    return await ctx.db.insert("outreachMessages", {
      ...args,
      status: args.scheduledSendAt ? "scheduled" : "draft_pending_approval",
      draftedBy: "triage_agent",
      direction: "outbound",
      schoolId: app.schoolId,
      replyToken,
    });
  },
});

export async function draftOutreach(ctx: any, args: { candidate: any; school: any; role: any; outcome: string; primaryReasons: string[] }): Promise<string | null> {
  const client = getLlmClient();
  if (!client) return null;
  const res = await client.chat.completions.create({
    model: LLM_MODEL,
    max_tokens: 512,
    temperature: 0.4,
    messages: [
      { role: "system", content: OUTREACH_DRAFT_SYSTEM },
      { role: "user", content: JSON.stringify({
        candidateSummary: args.candidate?.candidateSummary ?? "",
        candidateName: args.candidate?.name ?? "",
        schoolName: args.school?.name ?? "",
        schoolCity: args.school?.city ?? "",
        roleTitle: args.role?.title ?? "",
        type: args.outcome === "auto_shortlisted" ? "shortlist" : args.outcome === "auto_rejected" ? "rejection" : "cross_role_suggestion",
        channel: "whatsapp",
        primaryReasons: args.primaryReasons,
      }) },
    ],
  });
  return res.choices[0]?.message?.content ?? null;
}

// ============================================================================
// Scheduled outreach dispatcher (cron target)
// ============================================================================

function extractSubject(body: string): { subject: string; rest: string } {
  const m = body.match(/^Subject:\s*(.+?)\n\n([\s\S]*)$/);
  if (m) return { subject: m[1].trim(), rest: m[2].trim() };
  return { subject: "Application update", rest: body };
}

export const findDueScheduled = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("outreachMessages")
      .withIndex("by_status_scheduledSendAt", (q) =>
        q.eq("status", "scheduled" as any).lte("scheduledSendAt", now)
      )
      .take(50);
    return due;
  },
});

export const markSent = internalMutation({
  args: {
    messageId: v.id("outreachMessages"),
    externalId: v.optional(v.string()),
    metaMessageId: v.optional(v.string()),
    markupPct: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      status: "sent" as any,
      sentAt: Date.now(),
      externalId: args.externalId,
    };
    if (args.metaMessageId !== undefined) patch.metaMessageId = args.metaMessageId;
    if (args.markupPct !== undefined) {
      patch.markupPct = args.markupPct;
      patch.costCurrency = "USD";
    }
    await ctx.db.patch(args.messageId, patch);
  },
});

export const markFailed = internalMutation({
  args: { messageId: v.id("outreachMessages") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { status: "failed" as any });
  },
});

export const dispatchScheduledOutreach = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number; sent: number; failed: number }> => {
    const due = await ctx.runMutation(internal.outreach.findDueScheduled, {});
    let sent = 0;
    let failed = 0;

    for (const msg of due) {
      try {
        // Look up the candidate to get the destination address
        const candidate = await ctx.runQuery(api.candidates.get, { candidateId: msg.candidateId });
        if (!candidate) {
          await ctx.runMutation(internal.outreach.markFailed, { messageId: msg._id });
          failed++;
          continue;
        }

        let externalId: string | undefined;
        let metaMessageId: string | undefined;
        let markupPct: number | undefined;

        if (msg.channel === "whatsapp") {
          if (!candidate.phone) {
            await ctx.runMutation(internal.outreach.markFailed, { messageId: msg._id });
            failed++;
            continue;
          }
          const result = await cloudSend(ctx, {
            applicationId: msg.applicationId,
            to: candidate.phone,
            kind: "text",
            body: msg.body,
          });
          externalId = result.metaMessageId;
          metaMessageId = result.metaMessageId;
          markupPct = result.markupPct;

        } else if (msg.channel === "email") {
          if (!candidate.email) {
            await ctx.runMutation(internal.outreach.markFailed, { messageId: msg._id });
            failed++;
            continue;
          }

          // Call the Resend API directly so we can update the existing row.
          const resendApiKey = process.env.RESEND_API_KEY;
          if (!resendApiKey) {
            throw new Error("Resend API not configured");
          }
          const { subject, rest } = extractSubject(msg.body);
          const { Resend } = await import("resend");
          const resend = new Resend(resendApiKey);
          const replyDomain = process.env.REPLY_INBOUND_DOMAIN ?? "reply.rolerecruit.com";
          const replyTo = msg.replyToken
            ? `reply+${msg.replyToken}@${replyDomain}`
            : undefined;
          const result = await resend.emails.send({
            from: "RoleRecruit <noreply@rolerecruit.com>",
            to: candidate.email,
            subject,
            text: rest,
            replyTo,
          });
          externalId = result.data?.id ?? undefined;
        }

        await ctx.runMutation(internal.outreach.markSent, {
          messageId: msg._id,
          externalId,
          metaMessageId,
          markupPct,
        });
        sent++;
      } catch (_err) {
        await ctx.runMutation(internal.outreach.markFailed, { messageId: msg._id });
        failed++;
      }
    }

    return { processed: due.length, sent, failed };
  },
});
