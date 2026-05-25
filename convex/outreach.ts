import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

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
      const aLatest = Math.max(...a.messages.map((m: any) => m.sentAt));
      const bLatest = Math.max(...b.messages.map((m: any) => m.sentAt));
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
