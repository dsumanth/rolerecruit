import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as whatsappWebhook from "../../convex/whatsappWebhook";
import * as whatsappUsage from "../../convex/whatsappUsage";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "whatsappWebhook.ts": async () => whatsappWebhook,
  "whatsappUsage.ts": async () => whatsappUsage,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

async function seedSentMessage(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" });
    const candidateId = await ctx.db.insert("candidates", { name: "Asha", qualifications: [], certifications: [], boardExperience: [], subjects: [], talentBankFlag: false });
    const jobId = await ctx.db.insert("jobPostings", { schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "d", status: "active", createdAt: Date.now() });
    const applicationId = await ctx.db.insert("applications", { candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now() });
    await ctx.db.insert("whatsappIntegrations", { schoolId, status: "active", wabaId: "w", phoneNumberId: "111", displayPhoneNumber: "+1", businessName: "B", verifiedName: "B", accessTokenCipher: "c", accessTokenIv: "i", markupPct: 20 });
    const messageId = await ctx.db.insert("outreachMessages", { applicationId, candidateId, schoolId, type: "shortlist", channel: "whatsapp", body: "Hi", status: "sent", direction: "outbound", sentAt: Date.now(), metaMessageId: "wamid.OUT", markupPct: 20 });
    return { schoolId, messageId };
  });
}

describe("recordStatus", () => {
  it("records cost + billable and rolls up usage on first pricing event", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, messageId } = await seedSentMessage(t);

    await t.mutation(apiModule.internal.whatsappWebhook.recordStatus, {
      phoneNumberId: "111", metaMessageId: "wamid.OUT", status: "delivered",
      recipientPhone: "919876543210", category: "utility", pricingModel: "CBP", conversationId: "conv-1",
    });

    const row = await t.run(async (ctx) => ctx.db.get(messageId));
    expect(row?.status).toBe("delivered");
    expect(row?.metaCategory).toBe("utility");
    expect(row?.metaCostUsd).toBe(0.0014); // IN utility
    expect(row?.billableUsd).toBeCloseTo(0.00168, 6); // +20%

    const usage = await t.run(async (ctx) =>
      ctx.db.query("whatsappUsage").withIndex("by_schoolId_periodStart", (q) => q.eq("schoolId", schoolId)).first(),
    );
    expect(usage?.messageCount).toBe(1);
    expect(usage?.utilityCount).toBe(1);
  });

  it("does not double-count usage on a later status for the same message", async () => {
    const t = convexTest(schema, modules);
    const { schoolId } = await seedSentMessage(t);
    const args = { phoneNumberId: "111", metaMessageId: "wamid.OUT", recipientPhone: "919876543210", category: "utility", pricingModel: "CBP" };
    await t.mutation(apiModule.internal.whatsappWebhook.recordStatus, { ...args, status: "delivered" });
    await t.mutation(apiModule.internal.whatsappWebhook.recordStatus, { ...args, status: "read" });
    const usage = await t.run(async (ctx) =>
      ctx.db.query("whatsappUsage").withIndex("by_schoolId_periodStart", (q) => q.eq("schoolId", schoolId)).first(),
    );
    expect(usage?.messageCount).toBe(1);
  });

  it("no-ops for an unknown message id", async () => {
    const t = convexTest(schema, modules);
    await seedSentMessage(t);
    await t.mutation(apiModule.internal.whatsappWebhook.recordStatus, {
      phoneNumberId: "111", metaMessageId: "wamid.UNKNOWN", status: "delivered", category: "utility",
    });
    // no throw == pass
  });
});

describe("recordInbound", () => {
  it("inserts an inbound reply linked to the candidate's latest outbound in that school", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, candidateId, applicationId } = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" });
      const candidateId = await ctx.db.insert("candidates", { name: "Asha", phone: "+919876543210", qualifications: [], certifications: [], boardExperience: [], subjects: [], talentBankFlag: false });
      const jobId = await ctx.db.insert("jobPostings", { schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "d", status: "active", createdAt: Date.now() });
      const applicationId = await ctx.db.insert("applications", { candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now() });
      await ctx.db.insert("whatsappIntegrations", { schoolId, status: "active", wabaId: "w", phoneNumberId: "111", displayPhoneNumber: "+1", businessName: "B", verifiedName: "B", accessTokenCipher: "c", accessTokenIv: "i", markupPct: 20 });
      await ctx.db.insert("outreachMessages", { applicationId, candidateId, schoolId, type: "shortlist", channel: "whatsapp", body: "Hi", status: "sent", direction: "outbound", sentAt: Date.now() });
      return { schoolId, candidateId, applicationId };
    });

    const res = await t.mutation(apiModule.internal.whatsappWebhook.recordInbound, {
      phoneNumberId: "111", fromPhone: "+919876543210", text: "Yes I am interested", metaMessageId: "wamid.IN",
    });
    expect(res.matched).toBe(true);

    const inbound = await t.run(async (ctx) =>
      (await ctx.db.query("outreachMessages").withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId)).collect())
        .find((m: any) => m.direction === "inbound"),
    );
    expect(inbound).toMatchObject({ type: "candidate_reply", channel: "whatsapp", body: "Yes I am interested", schoolId, candidateId, metaMessageId: "wamid.IN" });
  });

  it("returns matched:false for an unknown phoneNumberId", async () => {
    const t = convexTest(schema, modules);
    const res = await t.mutation(apiModule.internal.whatsappWebhook.recordInbound, {
      phoneNumberId: "does-not-exist", fromPhone: "+919876543210", text: "hi", metaMessageId: "wamid.IN",
    });
    expect(res.matched).toBe(false);
  });

  it("is idempotent - a retried delivery does not duplicate the inbound", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" });
      const candidateId = await ctx.db.insert("candidates", { name: "Asha", phone: "+919876543210", qualifications: [], certifications: [], boardExperience: [], subjects: [], talentBankFlag: false });
      const jobId = await ctx.db.insert("jobPostings", { schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "d", status: "active", createdAt: Date.now() });
      const applicationId = await ctx.db.insert("applications", { candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now() });
      await ctx.db.insert("whatsappIntegrations", { schoolId, status: "active", wabaId: "w", phoneNumberId: "111", displayPhoneNumber: "+1", businessName: "B", verifiedName: "B", accessTokenCipher: "c", accessTokenIv: "i", markupPct: 20 });
      await ctx.db.insert("outreachMessages", { applicationId, candidateId, schoolId, type: "shortlist", channel: "whatsapp", body: "Hi", status: "sent", direction: "outbound", sentAt: Date.now() });
    });
    const call = () => t.mutation(apiModule.internal.whatsappWebhook.recordInbound, { phoneNumberId: "111", fromPhone: "+919876543210", text: "Yes", metaMessageId: "wamid.DUP" });
    await call();
    await call();
    const inbounds = await t.run(async (ctx) =>
      (await ctx.db.query("outreachMessages").collect()).filter((m: any) => m.direction === "inbound"),
    );
    expect(inbounds).toHaveLength(1);
  });

  it("links the reply to the receiving school when the phone has candidate rows in multiple schools", async () => {
    const t = convexTest(schema, modules);
    const { schoolBId, appBId } = await t.run(async (ctx) => {
      // School A: candidate row inserted FIRST (would be the global first match), with an outbound on A.
      const schoolAId = await ctx.db.insert("schools", { name: "A", board: "CBSE", city: "X", state: "X", planTier: "free" });
      const candAId = await ctx.db.insert("candidates", { name: "Asha", phone: "+919876543210", qualifications: [], certifications: [], boardExperience: [], subjects: [], talentBankFlag: false });
      const jobAId = await ctx.db.insert("jobPostings", { schoolId: schoolAId, title: "TA", subject: "Math", level: "TGT", board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "d", status: "active", createdAt: Date.now() });
      const appAId = await ctx.db.insert("applications", { candidateId: candAId, jobPostingId: jobAId, schoolId: schoolAId, stage: "shortlisted", createdAt: Date.now() });
      await ctx.db.insert("whatsappIntegrations", { schoolId: schoolAId, status: "active", wabaId: "wa", phoneNumberId: "AAA", displayPhoneNumber: "+1", businessName: "A", verifiedName: "A", accessTokenCipher: "c", accessTokenIv: "i", markupPct: 20 });
      await ctx.db.insert("outreachMessages", { applicationId: appAId, candidateId: candAId, schoolId: schoolAId, type: "shortlist", channel: "whatsapp", body: "from A", status: "sent", direction: "outbound", sentAt: Date.now() });

      // School B: same phone, its own candidate row + outbound on B's number "BBB".
      const schoolBId = await ctx.db.insert("schools", { name: "B", board: "CBSE", city: "X", state: "X", planTier: "free" });
      const candBId = await ctx.db.insert("candidates", { name: "Asha", phone: "+919876543210", qualifications: [], certifications: [], boardExperience: [], subjects: [], talentBankFlag: false });
      const jobBId = await ctx.db.insert("jobPostings", { schoolId: schoolBId, title: "TB", subject: "Math", level: "TGT", board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "d", status: "active", createdAt: Date.now() });
      const appBId = await ctx.db.insert("applications", { candidateId: candBId, jobPostingId: jobBId, schoolId: schoolBId, stage: "shortlisted", createdAt: Date.now() });
      await ctx.db.insert("whatsappIntegrations", { schoolId: schoolBId, status: "active", wabaId: "wb", phoneNumberId: "BBB", displayPhoneNumber: "+2", businessName: "B", verifiedName: "B", accessTokenCipher: "c", accessTokenIv: "i", markupPct: 20 });
      await ctx.db.insert("outreachMessages", { applicationId: appBId, candidateId: candBId, schoolId: schoolBId, type: "shortlist", channel: "whatsapp", body: "from B", status: "sent", direction: "outbound", sentAt: Date.now() });
      return { schoolBId, appBId };
    });

    const res = await t.mutation(apiModule.internal.whatsappWebhook.recordInbound, {
      phoneNumberId: "BBB", fromPhone: "+919876543210", text: "Reply to B", metaMessageId: "wamid.B",
    });
    expect(res.matched).toBe(true);
    const inbound = await t.run(async (ctx) =>
      (await ctx.db.query("outreachMessages").collect()).find((m: any) => m.direction === "inbound"),
    );
    expect(inbound?.schoolId).toBe(schoolBId);
    expect(inbound?.applicationId).toBe(appBId);
  });
});
