import { describe, it, expect, vi, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

vi.mock("../../convex/conversation_classify", () => ({
  classifyReply: vi.fn(),
}));
vi.mock("../../convex/conversation_faq", () => ({
  draftFaqReply: vi.fn(),
}));
vi.mock("../../convex/conversation_reschedule", () => ({
  buildRescheduleReply: vi.fn().mockReturnValue("Reschedule reply"),
}));

import { classifyReply } from "../../convex/conversation_classify";
import { draftFaqReply } from "../../convex/conversation_faq";
import * as conversation from "../../convex/conversation";
import * as schools from "../../convex/schools";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as outreach from "../../convex/outreach";
import * as booking from "../../convex/booking";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "outreach.ts": async () => outreach,
  "booking.ts": async () => booking,
  "conversation.ts": async () => conversation,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

async function seedInbound(t: ReturnType<typeof convexTest>, opts: { agentEnabled?: boolean } = {}) {
  return await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", {
      name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      conversationAgentEnabled: opts.agentEnabled ?? true,
    });
    const candidateId = await ctx.db.insert("candidates", {
      name: "Asha",
      qualifications: [], certifications: [], boardExperience: [], subjects: [],
      talentBankFlag: false,
    });
    const jobId = await ctx.db.insert("jobPostings", {
      schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: ["B.Ed"],
      naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
    });
    const appId = await ctx.db.insert("applications", {
      candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now(),
    });
    const inboundId = await ctx.db.insert("outreachMessages", {
      applicationId: appId, candidateId, schoolId, type: "candidate_reply", channel: "email",
      body: "What's the salary?", status: "sent", direction: "inbound", sentAt: Date.now(),
    });
    return { schoolId, candidateId, appId, inboundId };
  });
}

beforeEach(() => vi.clearAllMocks());

describe("handleInbound", () => {
  it("FAQ high-confidence: drafts and schedules an agent reply", async () => {
    (classifyReply as any).mockResolvedValueOnce({ intent: "faq", confidence: 0.9, summary: "salary" });
    (draftFaqReply as any).mockResolvedValueOnce({ draft: "The salary range is 4-6 LPA.", confidence: 0.85 });
    const t = convexTest(schema, modules);
    const { inboundId, appId } = await seedInbound(t);

    await t.action(apiModule.internal.conversation.handleInbound, { messageId: inboundId });

    const messages = await t.run(async (ctx) =>
      ctx.db.query("outreachMessages")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", appId))
        .collect(),
    );
    const agentReply = messages.find((m: any) => m.type === "agent_reply");
    expect(agentReply).toBeDefined();
    expect(agentReply?.body).toContain("4-6 LPA");
    expect(agentReply?.status).toBe("scheduled");
    expect(typeof agentReply?.replyToken).toBe("string");
    expect(agentReply?.replyToken?.length).toBe(32);

    const inbound = messages.find((m: any) => m._id === inboundId);
    expect(inbound?.escalated).not.toBe(true);
    expect(inbound?.intent).toBe("faq");
  });

  it("FAQ low-confidence: escalates and saves a draft pending approval", async () => {
    (classifyReply as any).mockResolvedValueOnce({ intent: "faq", confidence: 0.6, summary: "hostel?" });
    (draftFaqReply as any).mockResolvedValueOnce({ draft: "Not sure, will check.", confidence: 0.4 });
    const t = convexTest(schema, modules);
    const { inboundId, appId } = await seedInbound(t);

    await t.action(apiModule.internal.conversation.handleInbound, { messageId: inboundId });

    const inbound = await t.run(async (ctx) => ctx.db.get(inboundId));
    expect(inbound?.escalated).toBe(true);
    expect(inbound?.escalationReason).toBe("low_confidence_faq");

    const messages = await t.run(async (ctx) =>
      ctx.db.query("outreachMessages")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", appId))
        .collect(),
    );
    const draft = messages.find((m: any) => m.type === "agent_reply");
    expect(draft?.status).toBe("draft_pending_approval");
  });

  it("negotiation: escalates with no reply sent", async () => {
    (classifyReply as any).mockResolvedValueOnce({ intent: "negotiation", confidence: 0.95, summary: "wants more salary" });
    const t = convexTest(schema, modules);
    const { inboundId, appId } = await seedInbound(t);

    await t.action(apiModule.internal.conversation.handleInbound, { messageId: inboundId });

    const inbound = await t.run(async (ctx) => ctx.db.get(inboundId));
    expect(inbound?.escalated).toBe(true);
    expect(inbound?.escalationReason).toBe("negotiation");
    const messages = await t.run(async (ctx) =>
      ctx.db.query("outreachMessages")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", appId))
        .collect(),
    );
    expect(messages.filter((m: any) => m.type === "agent_reply").length).toBe(0);
  });

  it("escalates with reason='agent_disabled' when the feature flag is off", async () => {
    const t = convexTest(schema, modules);
    const { inboundId } = await seedInbound(t, { agentEnabled: false });
    await t.action(apiModule.internal.conversation.handleInbound, { messageId: inboundId });
    const inbound = await t.run(async (ctx) => ctx.db.get(inboundId));
    expect(inbound?.escalated).toBe(true);
    expect(inbound?.escalationReason).toBe("agent_disabled");
  });
});
