// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";
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

const SECRET = "app-secret-xyz";
beforeAll(() => { process.env.META_APP_SECRET = SECRET; });
const sign = (body: string) => "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");

describe("processWebhook", () => {
  it("rejects an invalid signature without writing", async () => {
    const t = convexTest(schema, modules);
    const res = await t.action(apiModule.internal.whatsappWebhook.processWebhook, {
      rawBody: JSON.stringify({ entry: [] }), signature: "sha256=deadbeef",
    });
    expect(res.verified).toBe(false);
  });

  it("verifies, parses, and records a delivery status", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" });
      const candidateId = await ctx.db.insert("candidates", { name: "A", qualifications: [], certifications: [], boardExperience: [], subjects: [], talentBankFlag: false });
      const jobId = await ctx.db.insert("jobPostings", { schoolId, title: "T", subject: "M", level: "TGT", board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "d", status: "active", createdAt: Date.now() });
      const applicationId = await ctx.db.insert("applications", { candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now() });
      await ctx.db.insert("whatsappIntegrations", { schoolId, status: "active", wabaId: "w", phoneNumberId: "111", displayPhoneNumber: "+1", businessName: "B", verifiedName: "B", accessTokenCipher: "c", accessTokenIv: "i", markupPct: 20 });
      await ctx.db.insert("outreachMessages", { applicationId, candidateId, schoolId, type: "shortlist", channel: "whatsapp", body: "Hi", status: "sent", direction: "outbound", sentAt: Date.now(), metaMessageId: "wamid.OUT", markupPct: 20 });
    });

    const payload = { entry: [{ changes: [{ value: {
      metadata: { phone_number_id: "111" },
      statuses: [{ id: "wamid.OUT", status: "delivered", recipient_id: "919876543210", pricing: { category: "utility", pricing_model: "CBP" } }],
    } }] }] };
    const rawBody = JSON.stringify(payload);

    const res = await t.action(apiModule.internal.whatsappWebhook.processWebhook, { rawBody, signature: sign(rawBody) });
    expect(res).toMatchObject({ verified: true, statuses: 1, inbound: 0 });

    const row = await t.run(async (ctx) =>
      ctx.db.query("outreachMessages").withIndex("by_metaMessageId", (q) => q.eq("metaMessageId", "wamid.OUT")).first(),
    );
    expect(row?.status).toBe("delivered");
    expect(row?.metaCostUsd).toBe(0.0014);
  });
});
