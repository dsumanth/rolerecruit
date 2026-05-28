import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listEscalated = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const escalated = await ctx.db
      .query("outreachMessages")
      .withIndex("by_schoolId_escalated", (q) => q.eq("schoolId", args.schoolId).eq("escalated", true))
      .collect();
    const unresolved = escalated.filter((m) => m.resolvedAt == null);
    const byApp = new Map<string, typeof unresolved[0]>();
    for (const m of unresolved) {
      const key = m.applicationId as string;
      const existing = byApp.get(key);
      if (!existing || (m.sentAt ?? 0) > (existing.sentAt ?? 0)) {
        byApp.set(key, m);
      }
    }
    const rows: Array<{
      applicationId: string;
      candidateName: string;
      latestBody: string;
      latestEscalationReason: string;
      latestAt: number;
    }> = [];
    for (const m of byApp.values()) {
      const c = await ctx.db.get(m.candidateId);
      rows.push({
        applicationId: m.applicationId as string,
        candidateName: c?.name ?? "Unknown",
        latestBody: m.body,
        latestEscalationReason: m.escalationReason ?? "",
        latestAt: m.sentAt ?? 0,
      });
    }
    rows.sort((a, b) => b.latestAt - a.latestAt);
    return rows;
  },
});

export const countEscalated = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const escalated = await ctx.db
      .query("outreachMessages")
      .withIndex("by_schoolId_escalated", (q) => q.eq("schoolId", args.schoolId).eq("escalated", true))
      .collect();
    const unresolved = escalated.filter((m) => m.resolvedAt == null);
    const distinctApps = new Set(unresolved.map((m) => m.applicationId));
    return distinctApps.size;
  },
});

export const getThread = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("outreachMessages")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", args.applicationId))
      .collect();
    return messages.sort((a, b) => (a.sentAt ?? 0) - (b.sentAt ?? 0));
  },
});

export const humanReply = mutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");
    const newId = await ctx.db.insert("outreachMessages", {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      schoolId: app.schoolId,
      type: "custom",
      channel: args.channel,
      body: args.body,
      status: "scheduled",
      scheduledSendAt: Date.now(),
      direction: "outbound",
      draftedBy: "manual",
    });
    const allMessages = await ctx.db
      .query("outreachMessages")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", args.applicationId))
      .collect();
    const now = Date.now();
    for (const m of allMessages) {
      if (m.escalated === true && m.resolvedAt == null) {
        await ctx.db.patch(m._id, { resolvedAt: now });
      }
    }
    return newId;
  },
});

export const resolveEscalation = mutation({
  args: { messageId: v.id("outreachMessages") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { resolvedAt: Date.now() });
  },
});
