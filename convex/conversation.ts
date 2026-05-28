import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { classifyReply } from "./conversation_classify";
import { draftFaqReply } from "./conversation_faq";
import { buildRescheduleReply } from "./conversation_reschedule";

const CONFIDENCE_THRESHOLD = 0.75;

export const loadContext = internalQuery({
  args: { messageId: v.id("outreachMessages") },
  handler: async (ctx, args) => {
    const inbound = await ctx.db.get(args.messageId);
    if (!inbound) return null;
    const app = await ctx.db.get(inbound.applicationId);
    if (!app) return null;
    const school = await ctx.db.get(app.schoolId);
    const job = app.jobPostingId ? await ctx.db.get(app.jobPostingId) : null;
    const candidate = await ctx.db.get(inbound.candidateId);
    const threadRaw = await ctx.db
      .query("outreachMessages")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", inbound.applicationId))
      .collect();
    const thread = threadRaw
      .sort((a, b) => (a.sentAt ?? 0) - (b.sentAt ?? 0))
      .map((m) => ({
        role: (m.direction === "inbound" ? "candidate" : "agent") as "agent" | "candidate",
        body: m.body,
      }));
    return { inbound, app, school, job, candidate, thread };
  },
});

export const persistClassification = internalMutation({
  args: {
    messageId: v.id("outreachMessages"),
    intent: v.union(
      v.literal("faq"), v.literal("reschedule"), v.literal("negotiation"), v.literal("unclear"),
    ),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { intent: args.intent, confidence: args.confidence });
  },
});

export const escalate = internalMutation({
  args: { messageId: v.id("outreachMessages"), reason: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      escalated: true,
      escalationReason: args.reason,
      processedAt: Date.now(),
    });
  },
});

export const insertAgentReply = internalMutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    schoolId: v.id("schools"),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    body: v.string(),
    schedule: v.boolean(),
    inReplyToMessageId: v.id("outreachMessages"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachMessages", {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      schoolId: args.schoolId,
      type: "agent_reply",
      channel: args.channel,
      body: args.body,
      status: args.schedule ? "scheduled" : "draft_pending_approval",
      scheduledSendAt: args.schedule ? Date.now() : undefined,
      direction: "outbound",
      draftedBy: "conversation_agent",
      inReplyToMessageId: args.inReplyToMessageId,
    });
  },
});

export const markProcessed = internalMutation({
  args: { messageId: v.id("outreachMessages") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { processedAt: Date.now() });
  },
});

export const handleInbound = internalAction({
  args: { messageId: v.id("outreachMessages") },
  handler: async (ctx, args): Promise<void> => {
    const ctxData = await ctx.runQuery(internal.conversation.loadContext, { messageId: args.messageId });
    if (!ctxData) return;
    const { inbound, app, school, job, candidate, thread } = ctxData;
    if (!school) {
      await ctx.runMutation(internal.conversation.escalate, {
        messageId: args.messageId,
        reason: "missing_school",
      });
      return;
    }

    if (school.conversationAgentEnabled !== true) {
      await ctx.runMutation(internal.conversation.escalate, {
        messageId: args.messageId,
        reason: "agent_disabled",
      });
      return;
    }

    const classified = await classifyReply({
      replyText: inbound.body,
      threadContext: thread.slice(0, -1),
    });
    await ctx.runMutation(internal.conversation.persistClassification, {
      messageId: args.messageId,
      intent: classified.intent,
      confidence: classified.confidence,
    });

    if (classified.intent === "negotiation" || classified.intent === "unclear") {
      await ctx.runMutation(internal.conversation.escalate, {
        messageId: args.messageId,
        reason: classified.intent,
      });
      return;
    }

    if (classified.intent === "reschedule") {
      const rejected = app.stage === "rejected";
      let bookingUrl = "";
      if (!rejected) {
        const token: string = await ctx.runMutation(api.booking.generateBookingToken, {
          applicationId: app._id,
          schoolId: school._id,
        });
        bookingUrl = `${process.env.PUBLIC_BASE_URL ?? "https://rolerecruit.com"}/book/${token}`;
      }
      const body = buildRescheduleReply({
        candidateName: candidate?.name ?? "there",
        bookingUrl,
        schoolName: school.name,
        rejected,
      });
      await ctx.runMutation(internal.conversation.insertAgentReply, {
        applicationId: app._id,
        candidateId: inbound.candidateId,
        schoolId: school._id,
        channel: inbound.channel,
        body,
        schedule: true,
        inReplyToMessageId: args.messageId,
      });
      await ctx.runMutation(internal.conversation.markProcessed, { messageId: args.messageId });
      return;
    }

    // FAQ branch
    const draft = await draftFaqReply({
      replyText: inbound.body,
      job: job ?? {},
      school,
      faqContent: school.faqContent ?? "",
    });
    if (draft.confidence >= CONFIDENCE_THRESHOLD && draft.draft.length > 0) {
      await ctx.runMutation(internal.conversation.insertAgentReply, {
        applicationId: app._id,
        candidateId: inbound.candidateId,
        schoolId: school._id,
        channel: inbound.channel,
        body: draft.draft,
        schedule: true,
        inReplyToMessageId: args.messageId,
      });
      await ctx.runMutation(internal.conversation.markProcessed, { messageId: args.messageId });
    } else {
      if (draft.draft.length > 0) {
        await ctx.runMutation(internal.conversation.insertAgentReply, {
          applicationId: app._id,
          candidateId: inbound.candidateId,
          schoolId: school._id,
          channel: inbound.channel,
          body: draft.draft,
          schedule: false,
          inReplyToMessageId: args.messageId,
        });
      }
      await ctx.runMutation(internal.conversation.escalate, {
        messageId: args.messageId,
        reason: "low_confidence_faq",
      });
    }
  },
});
