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
