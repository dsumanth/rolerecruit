import { action, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

const REPLY_TOKEN_REGEX = /^reply\+([a-z0-9]{32})@/i;

export function extractReplyToken(toAddress: string): string | null {
  const match = toAddress.match(REPLY_TOKEN_REGEX);
  return match ? match[1] : null;
}

export const findByReplyToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("outreachMessages")
      .withIndex("by_replyToken", (q) => q.eq("replyToken", args.token))
      .first();
  },
});

export const insertInbound = internalMutation({
  args: {
    parentMessageId: v.id("outreachMessages"),
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    schoolId: v.id("schools"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachMessages", {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      schoolId: args.schoolId,
      type: "candidate_reply",
      channel: "email",
      body: args.body,
      status: "sent",
      direction: "inbound",
      inReplyToMessageId: args.parentMessageId,
      sentAt: Date.now(),
    });
  },
});

export const dispatch = action({
  args: {
    to: v.string(),
    from: v.string(),
    subject: v.optional(v.string()),
    text: v.optional(v.string()),
    html: v.optional(v.string()),
    attachments: v.optional(v.array(v.any())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ routed: "reply" | "new_resume"; applicationId?: string }> => {
    const token = extractReplyToken(args.to);
    if (token) {
      const parent = await ctx.runQuery(internal.email_reply_router.findByReplyToken, { token });
      if (parent && parent.schoolId) {
        const inboundId = await ctx.runMutation(internal.email_reply_router.insertInbound, {
          parentMessageId: parent._id,
          applicationId: parent.applicationId,
          candidateId: parent.candidateId,
          schoolId: parent.schoolId,
          body: (args.text ?? args.html ?? "").trim(),
        });
        await ctx.scheduler.runAfter(0, internal.conversation.handleInbound, { messageId: inboundId });
        return { routed: "reply", applicationId: parent.applicationId };
      }
    }
    // No token, no matching parent, or parent missing schoolId: fall through to new-resume path.
    try {
      await ctx.runAction(api.email_ingestion.receiveEmailAction, args);
    } catch (err) {
      console.error("[email_reply_router] new-resume fallthrough failed:", err);
    }
    return { routed: "new_resume" };
  },
});
