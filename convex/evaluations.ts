import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { maybeApplyDecision } from "./decisions";

const VOICE_INPUT_VALIDATOR = v.array(v.object({
  fieldKey: v.string(),
  transcript: v.string(),
  summaryPoints: v.array(v.string()),
  language: v.string(),
  durationSec: v.number(),
  processedAt: v.number(),
}));

const RESPONSES_VALIDATOR = v.record(v.string(), v.union(v.number(), v.string()));

const RECOMMENDATION_VALIDATOR = v.optional(v.union(
  v.literal("hire"), v.literal("maybe"), v.literal("reject"),
));

const PLATFORM_VALIDATOR = v.union(
  v.literal("mobile_ios"),
  v.literal("mobile_android"),
  v.literal("web"),
);

async function persistSubmission(
  ctx: any,
  inviteId: any,
  responses: any,
  recommendation: any,
  voiceInputs: any,
  platform: any,
) {
  const inv = await ctx.db.get(inviteId);
  if (!inv) throw new Error("Invite not found");
  if (inv.status === "submitted") throw new Error("Already submitted");
  if (inv.status === "cancelled") throw new Error("Invite was cancelled");
  if (inv.status === "declined") throw new Error("Invite was declined");

  const now = Date.now();
  await ctx.db.insert("evaluations", {
    inviteId,
    formTemplateId: inv.formTemplateId,
    responses,
    recommendation,
    voiceInputs: voiceInputs ?? undefined,
    submittedAt: now,
    submittedFromPlatform: platform,
  });
  await ctx.db.patch(inviteId, { status: "submitted", submittedAt: now });
  await maybeApplyDecision(ctx, inv.demoSessionId);
}

export const submit = mutation({
  args: {
    inviteId: v.id("evaluationInvites"),
    responses: RESPONSES_VALIDATOR,
    recommendation: RECOMMENDATION_VALIDATOR,
    voiceInputs: v.optional(VOICE_INPUT_VALIDATOR),
    submittedFromPlatform: PLATFORM_VALIDATOR,
  },
  handler: async (ctx, args) => {
    await persistSubmission(
      ctx, args.inviteId, args.responses, args.recommendation,
      args.voiceInputs, args.submittedFromPlatform,
    );
  },
});

export const submitByToken = mutation({
  args: {
    token: v.string(),
    responses: RESPONSES_VALIDATOR,
    recommendation: RECOMMENDATION_VALIDATOR,
    voiceInputs: v.optional(VOICE_INPUT_VALIDATOR),
    submittedFromPlatform: PLATFORM_VALIDATOR,
  },
  handler: async (ctx, args) => {
    const inv = await ctx.db
      .query("evaluationInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!inv) throw new Error("Invite not found for token");
    await persistSubmission(
      ctx, inv._id, args.responses, args.recommendation,
      args.voiceInputs, args.submittedFromPlatform,
    );
  },
});

export const listForInvite = query({
  args: { inviteId: v.id("evaluationInvites") },
  handler: async (ctx, { inviteId }) =>
    await ctx.db
      .query("evaluations")
      .withIndex("by_inviteId", (q) => q.eq("inviteId", inviteId))
      .collect(),
});
