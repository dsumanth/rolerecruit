// @vitest-environment node
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { encryptSecret } from "../../convex/lib/crypto";
import * as whatsappCloud from "../../convex/whatsappCloud";
import * as whatsappIntegration from "../../convex/whatsappIntegration";
import * as outreach from "../../convex/outreach";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "whatsappCloud.ts": async () => whatsappCloud,
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

async function seedConnected(t: ReturnType<typeof convexTest>, opts: { markupPct?: number; status?: string } = {}) {
  const { cipher, iv } = await encryptSecret("TEST-TOKEN");
  return await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" });
    const candidateId = await ctx.db.insert("candidates", { name: "Asha", qualifications: [], certifications: [], boardExperience: [], subjects: [], talentBankFlag: false });
    const jobId = await ctx.db.insert("jobPostings", { schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "d", status: "active", createdAt: Date.now() });
    const applicationId = await ctx.db.insert("applications", { candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now() });
    await ctx.db.insert("whatsappIntegrations", {
      schoolId, status: (opts.status ?? "active") as any, wabaId: "w", phoneNumberId: "111",
      displayPhoneNumber: "+91 98765 43210", businessName: "B", verifiedName: "B",
      accessTokenCipher: cipher, accessTokenIv: iv, markupPct: opts.markupPct ?? 20,
    });
    return { schoolId, candidateId, applicationId };
  });
}

describe("sendWhatsAppMessage (Cloud API)", () => {
  it("sends text via the school's number and records an outbound row", async () => {
    const f = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.SENT" }] }),
    } as any);
    const t = convexTest(schema, modules);
    const { applicationId, candidateId } = await seedConnected(t, { markupPct: 25 });

    const res = await t.action(apiModule.api.whatsappCloud.sendWhatsAppMessage, {
      applicationId, candidateId, type: "shortlist", channel: "whatsapp", body: "Hello", phone: "+919876543210",
    });
    expect(res.success).toBe(true);
    expect(res.messageId).toBe("wamid.SENT");
    expect((f.mock.calls[0][0] as string)).toContain("/111/messages");

    const rows = await t.run(async (ctx) =>
      ctx.db.query("outreachMessages").withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId)).collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ channel: "whatsapp", status: "sent", direction: "outbound", metaMessageId: "wamid.SENT", markupPct: 25 });
  });

  it("fails gracefully and records a failed row when not connected", async () => {
    const t = convexTest(schema, modules);
    const { applicationId, candidateId } = await seedConnected(t, { status: "disconnected" });
    const res = await t.action(apiModule.api.whatsappCloud.sendWhatsAppMessage, {
      applicationId, candidateId, type: "shortlist", channel: "whatsapp", body: "Hi", phone: "+919876543210",
    });
    expect(res.success).toBe(false);
    const rows = await t.run(async (ctx) =>
      ctx.db.query("outreachMessages").withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId)).collect(),
    );
    expect(rows[0].status).toBe("failed");
  });
});
