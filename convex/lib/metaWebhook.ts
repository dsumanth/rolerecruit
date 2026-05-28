export interface InboundEvent {
  phoneNumberId: string;
  fromPhone: string;
  text: string;
  metaMessageId: string;
}

export interface StatusEvent {
  phoneNumberId: string;
  metaMessageId: string;
  status: string;
  recipientPhone?: string;
  category?: string;
  pricingModel?: string;
  conversationId?: string;
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyMetaSignature(rawBody: string, header: string | null): Promise<boolean> {
  if (!header || !header.startsWith("sha256=")) return false;
  const secret = process.env.META_APP_SECRET;
  if (!secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return timingSafeEqual("sha256=" + hex(sig), header);
}

export function parseMetaWebhook(payload: any): { inbound: InboundEvent[]; statuses: StatusEvent[] } {
  const inbound: InboundEvent[] = [];
  const statuses: StatusEvent[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const phoneNumberId = value?.metadata?.phone_number_id ?? "";
      for (const m of value?.messages ?? []) {
        if (m?.type === "text" && m?.text?.body) {
          inbound.push({ phoneNumberId, fromPhone: m.from, text: m.text.body, metaMessageId: m.id });
        }
      }
      for (const s of value?.statuses ?? []) {
        statuses.push({
          phoneNumberId,
          metaMessageId: s.id,
          status: s.status,
          recipientPhone: s.recipient_id,
          category: s.pricing?.category,
          pricingModel: s.pricing?.pricing_model,
          conversationId: s.conversation?.id,
        });
      }
    }
  }
  return { inbound, statuses };
}
