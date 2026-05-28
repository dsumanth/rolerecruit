// @vitest-environment node
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { encryptSecret } from "../../convex/lib/crypto";
import * as whatsapp from "../../convex/whatsapp";
import * as resend from "../../convex/resend";
import * as whatsappIntegration from "../../convex/whatsappIntegration";
import * as outreach from "../../convex/outreach";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "resend.ts": async () => resend,
  "whatsapp.ts": async () => whatsapp,
  "whatsappIntegration.ts": async () => whatsappIntegration,
  "outreach.ts": async () => outreach,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeAll(() => {
  process.env.META_GRAPH_API_VERSION = "v22.0";
  process.env.WHATSAPP_ENCRYPTION_KEY = Buffer.from(new Uint8Array(32).fill(5)).toString("base64");
});
afterEach(() => vi.restoreAllMocks());

async function seedBase(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: "Greenfield", board: "CBSE", city: "Delhi", state: "DL", planTier: "free" });
    const candidateId = await ctx.db.insert("candidates", {
      name: "Priya Sharma",
      phone: "+919876543210",
      qualifications: [],
      certifications: [],
      boardExperience: [],
      subjects: [],
      talentBankFlag: false,
    });
    const jobId = await ctx.db.insert("jobPostings", {
      schoolId,
      title: "PGT Math",
      subject: "Math",
      level: "PGT",
      board: "CBSE",
      qualifications: ["B.Ed"],
      naturalLanguageDescription: "d",
      status: "active",
      createdAt: Date.now(),
    });
    const applicationId = await ctx.db.insert("applications", {
      candidateId,
      jobPostingId: jobId,
      schoolId,
      stage: "applied",
      createdAt: Date.now(),
    });
    return { schoolId, candidateId, applicationId };
  });
}

describe("sendMagicLink", () => {
  it("sends via WhatsApp when the school is connected", async () => {
    const { cipher, iv } = await encryptSecret("T");
    const t = convexTest(schema, modules);
    const { schoolId, candidateId, applicationId } = await seedBase(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("whatsappIntegrations", {
        schoolId,
        status: "active",
        wabaId: "waba1",
        phoneNumberId: "9999",
        displayPhoneNumber: "+91 98765 43210",
        businessName: "Greenfield",
        verifiedName: "Greenfield",
        accessTokenCipher: cipher,
        accessTokenIv: iv,
        markupPct: 20,
      });
    });

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.ML" }] }),
    } as any);

    const result = await t.action("resend:sendMagicLink" as any, {
      applicationId,
      candidateId,
      candidateName: "Priya Sharma",
      candidatePhone: "+919876543210",
      candidateEmail: "a@b.com",
      trackingToken: "tok123",
      schoolName: "Greenfield",
      jobTitle: "PGT Math",
      whatsappEnabled: true,
    });

    expect(result).toMatchObject({ channel: "whatsapp", success: true });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("outreachMessages")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      channel: "whatsapp",
      metaMessageId: "wamid.ML",
    });
  });

  it("falls back to email when WhatsApp is not connected", async () => {
    const t = convexTest(schema, modules);
    const { candidateId, applicationId } = await seedBase(t);
    // No whatsappIntegrations row seeded - school is not connected.
    // Clear RESEND_API_KEY so sendViaResend returns null (no network needed).
    const orig = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "";

    try {
      const result = await t.action("resend:sendMagicLink" as any, {
        applicationId,
        candidateId,
        candidateName: "Priya Sharma",
        candidatePhone: "+919876543210",
        candidateEmail: "a@b.com",
        trackingToken: "tok456",
        schoolName: "Greenfield",
        whatsappEnabled: true,
      });

      expect(result).toMatchObject({ channel: "none", success: false });
    } finally {
      if (orig !== undefined) process.env.RESEND_API_KEY = orig;
      else delete process.env.RESEND_API_KEY;
    }
  });
});
