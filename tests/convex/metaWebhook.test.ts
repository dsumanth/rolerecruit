// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";
import { verifyMetaSignature, parseMetaWebhook } from "../../convex/lib/metaWebhook";

const SECRET = "app-secret-123";
beforeAll(() => { process.env.META_APP_SECRET = SECRET; });

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
}

describe("verifyMetaSignature", () => {
  it("accepts a valid signature", async () => {
    const body = JSON.stringify({ hello: "world" });
    expect(await verifyMetaSignature(body, sign(body))).toBe(true);
  });
  it("rejects a tampered body", async () => {
    const body = JSON.stringify({ hello: "world" });
    expect(await verifyMetaSignature(body + "x", sign(body))).toBe(false);
  });
  it("rejects a missing header", async () => {
    expect(await verifyMetaSignature("{}", null)).toBe(false);
  });
});

describe("parseMetaWebhook", () => {
  it("extracts inbound text messages", () => {
    const payload = {
      entry: [{ changes: [{ value: {
        metadata: { phone_number_id: "111" },
        messages: [{ from: "919876543210", id: "wamid.IN", type: "text", text: { body: "hi there" } }],
      } }] }],
    };
    const { inbound, statuses } = parseMetaWebhook(payload);
    expect(statuses).toHaveLength(0);
    expect(inbound).toHaveLength(1);
    expect(inbound[0]).toMatchObject({ phoneNumberId: "111", fromPhone: "919876543210", text: "hi there", metaMessageId: "wamid.IN" });
  });

  it("extracts delivery statuses with pricing", () => {
    const payload = {
      entry: [{ changes: [{ value: {
        metadata: { phone_number_id: "111" },
        statuses: [{
          id: "wamid.OUT", status: "delivered", recipient_id: "919876543210",
          conversation: { id: "conv-1" },
          pricing: { category: "utility", pricing_model: "CBP" },
        }],
      } }] }],
    };
    const { inbound, statuses } = parseMetaWebhook(payload);
    expect(inbound).toHaveLength(0);
    expect(statuses[0]).toMatchObject({
      phoneNumberId: "111", metaMessageId: "wamid.OUT", status: "delivered",
      recipientPhone: "919876543210", category: "utility", pricingModel: "CBP", conversationId: "conv-1",
    });
  });

  it("ignores non-text inbound and empty changes", () => {
    const { inbound, statuses } = parseMetaWebhook({ entry: [{ changes: [{ value: {} }] }] });
    expect(inbound).toHaveLength(0);
    expect(statuses).toHaveLength(0);
  });
});
