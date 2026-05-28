# Multi-tenant WhatsApp Cloud API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared Gupshup WhatsApp number with per-school Meta WhatsApp Cloud API connections (each client connects their own WABA via Embedded Signup), and record Meta's per-message cost plus a configurable markup on every message so billing is a query away once a payment provider lands.

**Architecture:** Each `school` gets a `whatsappIntegrations` row holding its WABA id, phone number id, and an AES-256-GCM-encrypted access token. Sends go to `graph.facebook.com/{phoneNumberId}/messages` with that school's token. A Convex `httpAction` webhook (`/whatsapp/webhook`) receives inbound replies and delivery/pricing statuses, routing by `phoneNumberId`. Cost is looked up from a static price table (Meta does not return raw cost in webhooks) and rolled up monthly into `whatsappUsage`. Clean cutover: Gupshup is deleted in the final phase.

**Tech Stack:** Convex (queries/mutations/actions, `httpAction`), Web Crypto API (`crypto.subtle`, available in the Convex runtime — no `"use node"` needed), `libphonenumber-js` (already a dep), Next.js 14 App Router, React + `convex/react` hooks, Vitest + `convex-test`, Meta Graph API v22.0, Facebook JS SDK for Embedded Signup.

---

## Pre-flight (out-of-band — start the Meta review NOW, it gates production)

These are not code tasks but block real client connections. Do them in parallel with Phase 1.

1. **Become a Meta Tech Provider** and create a Meta Developer App with the **WhatsApp Business Platform** product. Submit App Review for `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management` (1–3 weeks).
2. Create an **Embedded Signup Configuration** → note the `config_id`.
3. Create **message templates** in Meta Business Manager for each business-initiated type (`shortlist`, `demo_schedule`, `offer`, `rejection`, `feedback_request`). Business-initiated messages outside the 24h customer window MUST use approved templates — free-form text only delivers inside the window.
4. Generate the encryption key: `openssl rand -base64 32`.
5. Set env vars. Add to `.env.local.example` (Task done in Phase 6 cutover, but set the real values now):

```bash
# Meta WhatsApp Cloud API (server-side, also set in Convex via `bunx convex env set`)
META_APP_ID=
META_APP_SECRET=
META_CONFIG_ID=
META_GRAPH_API_VERSION=v22.0
META_WEBHOOK_VERIFY_TOKEN=          # any random string you choose; echoed back to Meta on GET verify
WHATSAPP_ENCRYPTION_KEY=            # `openssl rand -base64 32` — set in Convex env ONLY, never client-side

# Client-side (browser) — for the Embedded Signup FB SDK
NEXT_PUBLIC_META_APP_ID=
NEXT_PUBLIC_META_CONFIG_ID=
```

Set the Convex-side vars now so Phases 2–4 can run against a dev WABA:
```bash
bunx convex env set META_APP_ID "..."
bunx convex env set META_APP_SECRET "..."
bunx convex env set META_GRAPH_API_VERSION "v22.0"
bunx convex env set META_WEBHOOK_VERIFY_TOKEN "..."
bunx convex env set WHATSAPP_ENCRYPTION_KEY "$(openssl rand -base64 32)"
```

**Test command for this repo:** `bunx vitest run <path>` (NOT `bun test` — that invokes Bun's runner, not Vitest). Watch mode: `bunx vitest <path>`.

---

## Phase 1 — Foundation (schema + pure libs)

No behavior change. New tables and pure functions, each independently testable.

### Task 1: Schema — add `whatsappIntegrations`, `whatsappUsage`, extend `outreachMessages`

**Files:**
- Modify: `convex/schema.ts` (add two tables after `userProfiles`; extend `outreachMessages` at `convex/schema.ts:526-577`)

- [ ] **Step 1: Add the `whatsappIntegrations` table**

Insert after the `userProfiles` table block (after `convex/schema.ts:93`):

```ts
  whatsappIntegrations: defineTable({
    schoolId: v.id("schools"),
    status: v.union(
      v.literal("not_connected"),
      v.literal("pending"),
      v.literal("active"),
      v.literal("disconnected"),
      v.literal("error"),
    ),
    wabaId: v.optional(v.string()),
    phoneNumberId: v.optional(v.string()),
    displayPhoneNumber: v.optional(v.string()),
    businessName: v.optional(v.string()),
    verifiedName: v.optional(v.string()),
    accessTokenCipher: v.optional(v.string()),
    accessTokenIv: v.optional(v.string()),
    connectedAt: v.optional(v.number()),
    disconnectedAt: v.optional(v.number()),
    lastErrorAt: v.optional(v.number()),
    lastErrorMessage: v.optional(v.string()),
    markupPct: v.number(),
  })
    .index("by_schoolId", ["schoolId"])
    .index("by_phoneNumberId", ["phoneNumberId"])
    .index("by_wabaId", ["wabaId"]),

  whatsappUsage: defineTable({
    schoolId: v.id("schools"),
    periodStart: v.number(),
    messageCount: v.number(),
    utilityCount: v.number(),
    marketingCount: v.number(),
    authenticationCount: v.number(),
    serviceCount: v.number(),
    metaCostUsdTotal: v.number(),
    billableUsdTotal: v.number(),
    updatedAt: v.number(),
  })
    .index("by_schoolId_periodStart", ["schoolId", "periodStart"]),
```

- [ ] **Step 2: Extend `outreachMessages`**

Add these fields inside the existing `outreachMessages` `defineTable({...})` (alongside the fields ending at `convex/schema.ts:572`, before the closing `})`):

```ts
    metaMessageId: v.optional(v.string()),
    metaConversationId: v.optional(v.string()),
    metaCategory: v.optional(v.union(
      v.literal("utility"),
      v.literal("marketing"),
      v.literal("authentication"),
      v.literal("service"),
    )),
    metaPricingModel: v.optional(v.string()),
    metaCostUsd: v.optional(v.number()),
    markupPct: v.optional(v.number()),
    billableUsd: v.optional(v.number()),
    costCurrency: v.optional(v.string()),
```

Add two indexes to the `outreachMessages` index chain (after `.index("by_schoolId_escalated", ...)` at `convex/schema.ts:577`):

```ts
    .index("by_metaMessageId", ["metaMessageId"])
    .index("by_schoolId_sentAt", ["schoolId", "sentAt"]),
```

- [ ] **Step 3: Push schema and verify it compiles**

Run: `bunx convex dev --once`
Expected: schema deploys with no validation errors. (All new `outreachMessages` fields are optional, so existing rows remain valid.)

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(whatsapp): add whatsappIntegrations + whatsappUsage tables and cost fields"
```

---

### Task 2: Token encryption (`crypto.ts`)

**Files:**
- Create: `convex/lib/crypto.ts`
- Test: `tests/convex/crypto.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/convex/crypto.test.ts` — note the node-environment pragma on line 1 (jsdom does not implement `crypto.subtle`):

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "../../convex/lib/crypto";

beforeAll(() => {
  // 32 random bytes, base64 — matches `openssl rand -base64 32`
  process.env.WHATSAPP_ENCRYPTION_KEY = Buffer.from(new Uint8Array(32).fill(7)).toString("base64");
});

describe("crypto", () => {
  it("roundtrips a secret", async () => {
    const { cipher, iv } = await encryptSecret("EAAG-super-secret-token");
    expect(cipher).not.toContain("EAAG");
    const plain = await decryptSecret({ cipher, iv });
    expect(plain).toBe("EAAG-super-secret-token");
  });

  it("uses a fresh IV per call", async () => {
    const a = await encryptSecret("same");
    const b = await encryptSecret("same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.cipher).not.toBe(b.cipher);
  });

  it("throws on tampered ciphertext", async () => {
    const { cipher, iv } = await encryptSecret("tamper-me");
    const broken = cipher.slice(0, -4) + (cipher.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    await expect(decryptSecret({ cipher: broken, iv })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run tests/convex/crypto.test.ts`
Expected: FAIL — "Cannot find module '../../convex/lib/crypto'".

- [ ] **Step 3: Implement `convex/lib/crypto.ts`**

```ts
const ALG = "AES-GCM";

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(): Promise<CryptoKey> {
  const keyB64 = process.env.WHATSAPP_ENCRYPTION_KEY;
  if (!keyB64) throw new Error("WHATSAPP_ENCRYPTION_KEY not set");
  return crypto.subtle.importKey("raw", b64decode(keyB64), { name: ALG }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSecret(plaintext: string): Promise<{ cipher: string; iv: string }> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: ALG, iv }, key, new TextEncoder().encode(plaintext));
  return { cipher: b64encode(new Uint8Array(ct)), iv: b64encode(iv) };
}

export async function decryptSecret({ cipher, iv }: { cipher: string; iv: string }): Promise<string> {
  const key = await importKey();
  const pt = await crypto.subtle.decrypt({ name: ALG, iv: b64decode(iv) }, key, b64decode(cipher));
  return new TextDecoder().decode(pt);
}
```

> Web Crypto AES-GCM appends the 16-byte auth tag to the ciphertext automatically, so no separate tag field is needed. `decrypt` throws `OperationError` if the ciphertext or tag is tampered with — that satisfies the tamper test.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run tests/convex/crypto.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/lib/crypto.ts tests/convex/crypto.test.ts
git commit -m "feat(whatsapp): AES-256-GCM secret encryption helper"
```

---

### Task 3: Pricing table + billable math (`metaPricing.ts`) + phone country helper

**Files:**
- Modify: `convex/lib/phone.ts` (add `countryFromPhone`)
- Create: `convex/lib/metaPricing.ts`
- Create: `docs/integrations/meta-pricing.md`
- Test: `tests/convex/metaPricing.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/convex/metaPricing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { lookupMetaCostUsd, computeBillableUsd } from "../../convex/lib/metaPricing";
import { countryFromPhone } from "../../convex/lib/phone";

describe("metaPricing", () => {
  it("looks up cost by country and category", () => {
    expect(lookupMetaCostUsd({ countryCode: "IN", category: "utility" })).toBe(0.0014);
    expect(lookupMetaCostUsd({ countryCode: "US", category: "marketing" })).toBe(0.025);
  });

  it("returns 0 for service regardless of country", () => {
    expect(lookupMetaCostUsd({ countryCode: "IN", category: "service" })).toBe(0);
    expect(lookupMetaCostUsd({ countryCode: "ZZ", category: "service" })).toBe(0);
  });

  it("falls back to US prices for unknown countries", () => {
    expect(lookupMetaCostUsd({ countryCode: "ZZ", category: "utility" })).toBe(0.014);
    expect(lookupMetaCostUsd({ countryCode: undefined, category: "utility" })).toBe(0.014);
  });

  it("computes billable with markup", () => {
    expect(computeBillableUsd(0.014, 20)).toBeCloseTo(0.0168, 6);
    expect(computeBillableUsd(0, 20)).toBe(0);
  });

  it("derives country from an E.164 phone", () => {
    expect(countryFromPhone("+919876543210")).toBe("IN");
    expect(countryFromPhone("+14155552671")).toBe("US");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run tests/convex/metaPricing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Add `countryFromPhone` to `convex/lib/phone.ts`**

Append to `convex/lib/phone.ts`:

```ts
export function countryFromPhone(input: string | null | undefined): string | undefined {
  if (input == null) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const parsed = parsePhoneNumberFromString(trimmed, DEFAULT_COUNTRY);
  return parsed?.country;
}
```

- [ ] **Step 4: Implement `convex/lib/metaPricing.ts`**

```ts
export type MessageCategory = "utility" | "marketing" | "authentication" | "service";

// USD per message. Source: Meta WhatsApp Business Platform pricing.
// Refresh quarterly — see docs/integrations/meta-pricing.md. (PRICES_VERSION: 2025-Q3)
export const META_PRICES_USD: Record<string, Partial<Record<MessageCategory, number>>> = {
  US: { utility: 0.014, marketing: 0.025, authentication: 0.0135, service: 0 },
  IN: { utility: 0.0014, marketing: 0.0073, authentication: 0.0014, service: 0 },
  GB: { utility: 0.0341, marketing: 0.0529, authentication: 0.0319, service: 0 },
  AE: { utility: 0.0157, marketing: 0.0384, authentication: 0.0157, service: 0 },
};

const FALLBACK_COUNTRY = "US";

export function lookupMetaCostUsd(args: {
  countryCode: string | undefined;
  category: MessageCategory;
}): number {
  if (args.category === "service") return 0;
  const country =
    args.countryCode && META_PRICES_USD[args.countryCode] ? args.countryCode : FALLBACK_COUNTRY;
  return META_PRICES_USD[country]?.[args.category] ?? META_PRICES_USD[FALLBACK_COUNTRY][args.category] ?? 0;
}

export function computeBillableUsd(metaCostUsd: number, markupPct: number): number {
  // round to 6 dp to avoid float drift accumulating across rollups
  return Math.round(metaCostUsd * (1 + markupPct / 100) * 1e6) / 1e6;
}
```

- [ ] **Step 5: Write the refresh doc `docs/integrations/meta-pricing.md`**

```markdown
# Meta WhatsApp pricing refresh

`convex/lib/metaPricing.ts` holds a static USD price-per-message table by country and
category, because Meta's webhooks return only `pricing.category` and `pricing.pricing_model`,
not the raw charge.

## When to update
Meta announces pricing changes on their developer changelog, usually quarterly.

## How to update
1. Open Meta's current WhatsApp pricing page for the countries your schools operate in.
2. Update `META_PRICES_USD` in `convex/lib/metaPricing.ts`.
3. Bump the `PRICES_VERSION` comment.
4. Add any new country your schools onboarded (otherwise it falls back to US prices and logs a warning).
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bunx vitest run tests/convex/metaPricing.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add convex/lib/metaPricing.ts convex/lib/phone.ts docs/integrations/meta-pricing.md tests/convex/metaPricing.test.ts
git commit -m "feat(whatsapp): Meta price table, billable math, phone country helper"
```

---

### Task 4: Meta Graph API client (`meta.ts`)

**Files:**
- Create: `convex/lib/meta.ts`
- Test: `tests/convex/meta.test.ts`

- [ ] **Step 1: Write the failing test** (mocks `global.fetch`)

`tests/convex/meta.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  exchangeCodeForToken,
  subscribeAppToWaba,
  fetchWabaDetails,
  sendCloudText,
  MetaApiError,
} from "../../convex/lib/meta";

function mockFetchOnce(status: number, json: any) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
    text: async () => JSON.stringify(json),
  } as any);
}

afterEach(() => vi.restoreAllMocks());

describe("meta client", () => {
  it("exchanges code for access token", async () => {
    const f = mockFetchOnce(200, { access_token: "EAAG123" });
    const token = await exchangeCodeForToken("the-code");
    expect(token).toBe("EAAG123");
    expect(f.mock.calls[0][0]).toContain("/oauth/access_token");
    expect(f.mock.calls[0][0]).toContain("code=the-code");
  });

  it("sends a text message and returns the message id", async () => {
    const f = mockFetchOnce(200, { messages: [{ id: "wamid.ABC" }] });
    const id = await sendCloudText({ phoneNumberId: "111", token: "T", to: "+919876543210", body: "hi" });
    expect(id).toBe("wamid.ABC");
    const [url, init] = f.mock.calls[0];
    expect(url).toContain("/111/messages");
    expect((init as any).headers.Authorization).toBe("Bearer T");
    const sent = JSON.parse((init as any).body);
    expect(sent.to).toBe("+919876543210");
    expect(sent.type).toBe("text");
  });

  it("subscribes the app to a WABA", async () => {
    const f = mockFetchOnce(200, { success: true });
    await subscribeAppToWaba("waba-1", "T");
    expect(f.mock.calls[0][0]).toContain("/waba-1/subscribed_apps");
  });

  it("fetches WABA details", async () => {
    mockFetchOnce(200, {
      name: "Greenfield",
      phone_numbers: { data: [{ id: "111", display_phone_number: "+91 98765 43210", verified_name: "Greenfield Intl" }] },
    });
    const d = await fetchWabaDetails("waba-1", "T");
    expect(d.businessName).toBe("Greenfield");
    expect(d.phoneNumberId).toBe("111");
    expect(d.displayPhoneNumber).toBe("+91 98765 43210");
    expect(d.verifiedName).toBe("Greenfield Intl");
  });

  it("throws MetaApiError on non-2xx", async () => {
    mockFetchOnce(400, { error: { message: "Invalid OAuth code" } });
    await expect(exchangeCodeForToken("bad")).rejects.toThrow(MetaApiError);
    await expect(exchangeCodeForToken("bad")).rejects.toThrow("Invalid OAuth code");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run tests/convex/meta.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `convex/lib/meta.ts`**

```ts
const GRAPH = "https://graph.facebook.com";

function apiVersion(): string {
  return process.env.META_GRAPH_API_VERSION ?? "v22.0";
}

export class MetaApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "MetaApiError";
    this.status = status;
  }
}

async function metaFetch(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message ?? `Meta API error ${res.status}`;
    throw new MetaApiError(res.status, msg);
  }
  return json;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("META_APP_ID / META_APP_SECRET not set");
  const url =
    `${GRAPH}/${apiVersion()}/oauth/access_token` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&client_secret=${encodeURIComponent(appSecret)}` +
    `&code=${encodeURIComponent(code)}`;
  const json = await metaFetch(url);
  return json.access_token as string;
}

export async function subscribeAppToWaba(wabaId: string, token: string): Promise<void> {
  await metaFetch(`${GRAPH}/${apiVersion()}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface WabaDetails {
  businessName: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
}

export async function fetchWabaDetails(wabaId: string, token: string): Promise<WabaDetails> {
  const json = await metaFetch(
    `${GRAPH}/${apiVersion()}/${wabaId}?fields=name,phone_numbers{id,display_phone_number,verified_name}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const phone = json.phone_numbers?.data?.[0] ?? {};
  return {
    businessName: json.name ?? "",
    phoneNumberId: phone.id ?? "",
    displayPhoneNumber: phone.display_phone_number ?? "",
    verifiedName: phone.verified_name ?? "",
  };
}

export async function sendCloudText(args: {
  phoneNumberId: string;
  token: string;
  to: string;
  body: string;
}): Promise<string> {
  const json = await metaFetch(`${GRAPH}/${apiVersion()}/${args.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: args.to,
      type: "text",
      text: { body: args.body },
    }),
  });
  return json.messages?.[0]?.id ?? "";
}

export async function sendCloudTemplate(args: {
  phoneNumberId: string;
  token: string;
  to: string;
  templateName: string;
  languageCode: string;
  bodyParams: string[];
}): Promise<string> {
  const json = await metaFetch(`${GRAPH}/${apiVersion()}/${args.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: args.to,
      type: "template",
      template: {
        name: args.templateName,
        language: { code: args.languageCode },
        components: args.bodyParams.length
          ? [{ type: "body", parameters: args.bodyParams.map((t) => ({ type: "text", text: t })) }]
          : [],
      },
    }),
  });
  return json.messages?.[0]?.id ?? "";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run tests/convex/meta.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/lib/meta.ts tests/convex/meta.test.ts
git commit -m "feat(whatsapp): Meta Graph API client (token exchange, send, WABA details)"
```

---

### Task 5: Webhook signature verification + payload parsing (`metaWebhook.ts`)

**Files:**
- Create: `convex/lib/metaWebhook.ts`
- Test: `tests/convex/metaWebhook.test.ts`

- [ ] **Step 1: Write the failing test** (node env for `crypto.subtle`)

`tests/convex/metaWebhook.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run tests/convex/metaWebhook.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `convex/lib/metaWebhook.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run tests/convex/metaWebhook.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/lib/metaWebhook.ts tests/convex/metaWebhook.test.ts
git commit -m "feat(whatsapp): Meta webhook signature verification + payload parser"
```

---

### Phase 1 checkpoint

Run the whole new suite:
```bash
bunx vitest run tests/convex/crypto.test.ts tests/convex/metaPricing.test.ts tests/convex/meta.test.ts tests/convex/metaWebhook.test.ts
```
Expected: all green. No production behavior has changed yet.

---

## Phase 2 — Integration lifecycle (connect / disconnect / markup)

Builds `convex/whatsappIntegration.ts`. Nothing calls it from the send path yet.

### Task 6: Integration storage — internal queries/mutations + public read query

**Files:**
- Create: `convex/whatsappIntegration.ts`
- Test: `tests/convex/whatsappIntegration.test.ts`

- [ ] **Step 1: Write the failing test** (node env — later tasks in this file use crypto)

`tests/convex/whatsappIntegration.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as whatsappIntegration from "../../convex/whatsappIntegration";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "whatsappIntegration.ts": async () => whatsappIntegration,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

async function seedSchool(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" }),
  );
}

describe("whatsappIntegration storage", () => {
  it("upsert creates an active row with default 20% markup, hiding the token", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await seedSchool(t);

    await t.mutation(apiModule.internal.whatsappIntegration.upsertActiveIntegration, {
      schoolId, wabaId: "waba-1", phoneNumberId: "111",
      displayPhoneNumber: "+91 98765 43210", businessName: "Greenfield", verifiedName: "Greenfield Intl",
      accessTokenCipher: "cipher", accessTokenIv: "iv",
    });

    const view = await t.query(apiModule.api.whatsappIntegration.getIntegration, { schoolId });
    expect(view?.status).toBe("active");
    expect(view?.displayPhoneNumber).toBe("+91 98765 43210");
    expect(view?.markupPct).toBe(20);
    expect((view as any)?.accessTokenCipher).toBeUndefined();
  });

  it("upsert twice updates the same row and preserves markup", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await seedSchool(t);
    await t.mutation(apiModule.internal.whatsappIntegration.upsertActiveIntegration, {
      schoolId, wabaId: "w", phoneNumberId: "111", displayPhoneNumber: "+1", businessName: "B", verifiedName: "B", accessTokenCipher: "c", accessTokenIv: "i",
    });
    await t.mutation(apiModule.api.whatsappIntegration.updateMarkup, { schoolId, markupPct: 35 });
    await t.mutation(apiModule.internal.whatsappIntegration.upsertActiveIntegration, {
      schoolId, wabaId: "w", phoneNumberId: "222", displayPhoneNumber: "+2", businessName: "B", verifiedName: "B", accessTokenCipher: "c2", accessTokenIv: "i2",
    });
    const rows = await t.run(async (ctx) =>
      ctx.db.query("whatsappIntegrations").withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId)).collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].phoneNumberId).toBe("222");
    expect(rows[0].markupPct).toBe(35);
  });

  it("getByPhoneNumberId returns the integration", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await seedSchool(t);
    await t.mutation(apiModule.internal.whatsappIntegration.upsertActiveIntegration, {
      schoolId, wabaId: "w", phoneNumberId: "999", displayPhoneNumber: "+9", businessName: "B", verifiedName: "B", accessTokenCipher: "c", accessTokenIv: "i",
    });
    const found = await t.query(apiModule.internal.whatsappIntegration.getByPhoneNumberId, { phoneNumberId: "999" });
    expect(found?.schoolId).toBe(schoolId);
  });

  it("setIntegrationError flips status to error", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await seedSchool(t);
    await t.mutation(apiModule.internal.whatsappIntegration.upsertActiveIntegration, {
      schoolId, wabaId: "w", phoneNumberId: "111", displayPhoneNumber: "+1", businessName: "B", verifiedName: "B", accessTokenCipher: "c", accessTokenIv: "i",
    });
    await t.mutation(apiModule.internal.whatsappIntegration.setIntegrationError, { schoolId, message: "token expired" });
    const view = await t.query(apiModule.api.whatsappIntegration.getIntegration, { schoolId });
    expect(view?.status).toBe("error");
    expect(view?.lastErrorMessage).toBe("token expired");
  });

  it("disconnect clears credentials and sets status disconnected", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await seedSchool(t);
    await t.mutation(apiModule.internal.whatsappIntegration.upsertActiveIntegration, {
      schoolId, wabaId: "w", phoneNumberId: "111", displayPhoneNumber: "+1", businessName: "B", verifiedName: "B", accessTokenCipher: "c", accessTokenIv: "i",
    });
    await t.mutation(apiModule.api.whatsappIntegration.disconnect, { schoolId });
    const row = await t.run(async (ctx) =>
      (await ctx.db.query("whatsappIntegrations").withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId)).first()),
    );
    expect(row?.status).toBe("disconnected");
    expect(row?.accessTokenCipher).toBeUndefined();
    expect(row?.phoneNumberId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run tests/convex/whatsappIntegration.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the storage layer in `convex/whatsappIntegration.ts`**

```ts
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_MARKUP_PCT = 20;

export const getBySchoolInternal = internalQuery({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
  },
});

export const getByPhoneNumberId = internalQuery({
  args: { phoneNumberId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_phoneNumberId", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .first();
  },
});

export const upsertActiveIntegration = internalMutation({
  args: {
    schoolId: v.id("schools"),
    wabaId: v.string(),
    phoneNumberId: v.string(),
    displayPhoneNumber: v.string(),
    businessName: v.string(),
    verifiedName: v.string(),
    accessTokenCipher: v.string(),
    accessTokenIv: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
    const fields = {
      status: "active" as const,
      wabaId: args.wabaId,
      phoneNumberId: args.phoneNumberId,
      displayPhoneNumber: args.displayPhoneNumber,
      businessName: args.businessName,
      verifiedName: args.verifiedName,
      accessTokenCipher: args.accessTokenCipher,
      accessTokenIv: args.accessTokenIv,
      connectedAt: Date.now(),
      disconnectedAt: undefined,
      lastErrorAt: undefined,
      lastErrorMessage: undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("whatsappIntegrations", {
      schoolId: args.schoolId,
      markupPct: DEFAULT_MARKUP_PCT,
      ...fields,
    });
  },
});

export const setIntegrationError = internalMutation({
  args: { schoolId: v.id("schools"), message: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
    const fields = { status: "error" as const, lastErrorAt: Date.now(), lastErrorMessage: args.message };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("whatsappIntegrations", { schoolId: args.schoolId, markupPct: DEFAULT_MARKUP_PCT, ...fields });
    }
  },
});

export const getIntegration = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
    if (!row) return { status: "not_connected" as const, markupPct: DEFAULT_MARKUP_PCT };
    // Never expose the encrypted token to the client.
    return {
      status: row.status,
      displayPhoneNumber: row.displayPhoneNumber,
      businessName: row.businessName,
      verifiedName: row.verifiedName,
      markupPct: row.markupPct,
      connectedAt: row.connectedAt,
      lastErrorMessage: row.lastErrorMessage,
    };
  },
});

export const updateMarkup = mutation({
  args: { schoolId: v.id("schools"), markupPct: v.number() },
  handler: async (ctx, args) => {
    if (args.markupPct < 0 || args.markupPct > 500) throw new Error("markupPct out of range");
    const row = await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
    if (!row) throw new Error("No WhatsApp integration for this school");
    await ctx.db.patch(row._id, { markupPct: args.markupPct });
  },
});

export const disconnect = mutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
    if (!row) return;
    await ctx.db.patch(row._id, {
      status: "disconnected",
      disconnectedAt: Date.now(),
      accessTokenCipher: undefined,
      accessTokenIv: undefined,
      phoneNumberId: undefined,
      wabaId: undefined,
    });
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run tests/convex/whatsappIntegration.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/whatsappIntegration.ts tests/convex/whatsappIntegration.test.ts
git commit -m "feat(whatsapp): integration storage (upsert/disconnect/markup) + safe read query"
```

---

### Task 7: `completeEmbeddedSignup` action

**Files:**
- Modify: `convex/whatsappIntegration.ts` (add the action + imports)
- Test: `tests/convex/whatsappIntegration.test.ts` (add a describe block)

- [ ] **Step 1: Write the failing test** — append to `tests/convex/whatsappIntegration.test.ts`

Add these imports at the top (with the others) and a `beforeAll` to set env:

```ts
import { vi, afterEach, beforeAll } from "vitest";

beforeAll(() => {
  process.env.META_APP_ID = "app-1";
  process.env.META_APP_SECRET = "secret-1";
  process.env.META_GRAPH_API_VERSION = "v22.0";
  process.env.WHATSAPP_ENCRYPTION_KEY = Buffer.from(new Uint8Array(32).fill(9)).toString("base64");
});
afterEach(() => vi.restoreAllMocks());
```

Add this describe block:

```ts
describe("completeEmbeddedSignup", () => {
  it("exchanges code, subscribes, fetches details, stores encrypted token, sets active", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")
      // 1. oauth/access_token
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "EAAG-live" }) } as any)
      // 2. subscribed_apps
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) } as any)
      // 3. waba details
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({
        name: "Greenfield",
        phone_numbers: { data: [{ id: "111", display_phone_number: "+91 98765 43210", verified_name: "Greenfield Intl" }] },
      }) } as any);

    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) =>
      ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" }),
    );

    const res = await t.action(apiModule.api.whatsappIntegration.completeEmbeddedSignup, {
      schoolId, code: "auth-code", wabaId: "waba-1",
    });
    expect(res.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    const row = await t.run(async (ctx) =>
      ctx.db.query("whatsappIntegrations").withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId)).first(),
    );
    expect(row?.status).toBe("active");
    expect(row?.phoneNumberId).toBe("111");
    expect(row?.accessTokenCipher).toBeTruthy();
    expect(row?.accessTokenCipher).not.toContain("EAAG");
    expect(row?.accessTokenIv).toBeTruthy();
  });

  it("records an error when token exchange fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false, status: 400, json: async () => ({ error: { message: "bad code" } }),
    } as any);
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) =>
      ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" }),
    );
    const res = await t.action(apiModule.api.whatsappIntegration.completeEmbeddedSignup, {
      schoolId, code: "bad", wabaId: "waba-1",
    });
    expect(res.ok).toBe(false);
    const view = await t.query(apiModule.api.whatsappIntegration.getIntegration, { schoolId });
    expect(view?.status).toBe("error");
    expect(view?.lastErrorMessage).toContain("bad code");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run tests/convex/whatsappIntegration.test.ts -t completeEmbeddedSignup`
Expected: FAIL — `completeEmbeddedSignup` is not a function.

- [ ] **Step 3: Implement the action** — add to `convex/whatsappIntegration.ts`

Add to the imports at the top:

```ts
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { exchangeCodeForToken, subscribeAppToWaba, fetchWabaDetails } from "./lib/meta";
import { encryptSecret } from "./lib/crypto";
```

Add the action:

```ts
export const completeEmbeddedSignup = action({
  args: {
    schoolId: v.id("schools"),
    code: v.string(),
    wabaId: v.string(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; error?: string }> => {
    try {
      const token = await exchangeCodeForToken(args.code);
      await subscribeAppToWaba(args.wabaId, token);
      const details = await fetchWabaDetails(args.wabaId, token);
      if (!details.phoneNumberId) throw new Error("WABA has no phone number");
      const { cipher, iv } = await encryptSecret(token);
      await ctx.runMutation(internal.whatsappIntegration.upsertActiveIntegration, {
        schoolId: args.schoolId,
        wabaId: args.wabaId,
        phoneNumberId: details.phoneNumberId,
        displayPhoneNumber: details.displayPhoneNumber,
        businessName: details.businessName,
        verifiedName: details.verifiedName,
        accessTokenCipher: cipher,
        accessTokenIv: iv,
      });
      return { ok: true };
    } catch (err: any) {
      await ctx.runMutation(internal.whatsappIntegration.setIntegrationError, {
        schoolId: args.schoolId,
        message: err?.message ?? "Embedded Signup failed",
      });
      return { ok: false, error: err?.message };
    }
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run tests/convex/whatsappIntegration.test.ts`
Expected: PASS (all 8 tests in the file).

- [ ] **Step 5: Commit**

```bash
git add convex/whatsappIntegration.ts tests/convex/whatsappIntegration.test.ts
git commit -m "feat(whatsapp): completeEmbeddedSignup action (token exchange + encrypted storage)"
```

### Phase 2 checkpoint

`bunx vitest run tests/convex/whatsappIntegration.test.ts` is green. You can now connect a dev WABA end-to-end from a Convex function (UI comes in Phase 5).

---

## Phase 3 — Send path (Meta Cloud API)

New module `convex/whatsappCloud.ts`. Kept separate from the live `convex/whatsapp.ts` (Gupshup) until the Phase 6 cutover renames it. Nothing in production calls it yet — these functions are referenced as `api.whatsappCloud.*` / `internal.whatsappCloud.*`.

> **Why a temp filename:** existing UI calls `api.whatsapp.sendWhatsAppMessage` (Gupshup). We keep that working until cutover, then rename `whatsappCloud.ts` → `whatsapp.ts` in one commit so the public API names are unchanged for callers.

### Task 8: Send context + `cloudSend` helper + `sendWhatsAppMessage` (text)

**Files:**
- Create: `convex/whatsappCloud.ts`
- Test: `tests/convex/whatsappCloud.test.ts`

- [ ] **Step 1: Write the failing test** (node env — uses crypto to seed an encrypted token)

`tests/convex/whatsappCloud.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run tests/convex/whatsappCloud.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `convex/whatsappCloud.ts`**

```ts
import { action, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { decryptSecret } from "./lib/crypto";
import { sendCloudText, sendCloudTemplate } from "./lib/meta";

export const getSendContextByApplication = internalQuery({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");
    const integ = await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", app.schoolId))
      .first();
    if (
      !integ || integ.status !== "active" ||
      !integ.phoneNumberId || !integ.accessTokenCipher || !integ.accessTokenIv
    ) {
      throw new Error("WHATSAPP_NOT_CONNECTED");
    }
    return {
      schoolId: app.schoolId,
      phoneNumberId: integ.phoneNumberId,
      accessTokenCipher: integ.accessTokenCipher,
      accessTokenIv: integ.accessTokenIv,
      markupPct: integ.markupPct,
    };
  },
});

type SendArgs =
  | { kind: "text"; body: string }
  | { kind: "template"; templateName: string; languageCode: string; bodyParams: string[] };

// Plain helper (see draftOutreach in outreach.ts for the ctx-passing pattern).
// Sends via Graph API only — persistence is the caller's job.
export async function cloudSend(
  ctx: any,
  args: { applicationId: Id<"applications">; to: string } & SendArgs,
): Promise<{ metaMessageId: string; markupPct: number; schoolId: Id<"schools"> }> {
  const cxt = await ctx.runQuery(internal.whatsappCloud.getSendContextByApplication, {
    applicationId: args.applicationId,
  });
  const token = await decryptSecret({ cipher: cxt.accessTokenCipher, iv: cxt.accessTokenIv });
  let metaMessageId: string;
  if (args.kind === "text") {
    metaMessageId = await sendCloudText({ phoneNumberId: cxt.phoneNumberId, token, to: args.to, body: args.body });
  } else {
    metaMessageId = await sendCloudTemplate({
      phoneNumberId: cxt.phoneNumberId, token, to: args.to,
      templateName: args.templateName, languageCode: args.languageCode, bodyParams: args.bodyParams,
    });
  }
  return { metaMessageId, markupPct: cxt.markupPct, schoolId: cxt.schoolId };
}

export const insertCloudSentMessage = internalMutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    schoolId: v.id("schools"),
    type: v.string(),
    body: v.string(),
    metaMessageId: v.string(),
    markupPct: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachMessages", {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      schoolId: args.schoolId,
      type: args.type as any,
      channel: "whatsapp",
      body: args.body,
      status: "sent",
      direction: "outbound",
      sentAt: Date.now(),
      metaMessageId: args.metaMessageId,
      markupPct: args.markupPct,
      costCurrency: "USD",
    });
  },
});

export const sendWhatsAppMessage = action({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    type: v.union(
      v.literal("shortlist"),
      v.literal("demo_schedule"),
      v.literal("feedback_request"),
      v.literal("offer"),
      v.literal("rejection"),
      v.literal("custom"),
    ),
    channel: v.literal("whatsapp"),
    body: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      const { metaMessageId, markupPct, schoolId } = await cloudSend(ctx, {
        applicationId: args.applicationId, to: args.phone, kind: "text", body: args.body,
      });
      await ctx.runMutation(internal.whatsappCloud.insertCloudSentMessage, {
        applicationId: args.applicationId, candidateId: args.candidateId, schoolId,
        type: args.type, body: args.body, metaMessageId, markupPct,
      });
      return { success: true, messageId: metaMessageId };
    } catch (err: any) {
      await ctx.runMutation(internal.outreach.saveFailedMessage as any, {
        applicationId: args.applicationId, candidateId: args.candidateId,
        type: args.type, channel: "whatsapp", body: args.body, error: err?.message ?? "Unknown error",
      });
      return { success: false, error: err?.message };
    }
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run tests/convex/whatsappCloud.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/whatsappCloud.ts tests/convex/whatsappCloud.test.ts
git commit -m "feat(whatsapp): Cloud API text send with per-school routing + markup snapshot"
```

---

### Task 9: `sendWhatsAppTemplate` (business-initiated via approved templates)

**Files:**
- Modify: `convex/whatsappCloud.ts`
- Test: `tests/convex/whatsappCloud.test.ts` (add a describe block)

> The Meta template names in `TEMPLATE_REGISTRY` below MUST match the templates you created in pre-flight step 3. The `params` arrays define the order in which `templateParams` keys map to the template's `{{1}}`, `{{2}}`, … body variables.

- [ ] **Step 1: Write the failing test** — append to `tests/convex/whatsappCloud.test.ts`

```ts
describe("sendWhatsAppTemplate (Cloud API)", () => {
  it("sends a template with ordered body params", async () => {
    const f = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.TPL" }] }),
    } as any);
    const t = convexTest(schema, modules);
    const { applicationId, candidateId } = await seedConnected(t);

    const res = await t.action(apiModule.api.whatsappCloud.sendWhatsAppTemplate, {
      applicationId, candidateId, templateName: "shortlist_notification",
      templateParams: { name: "Asha", position: "TGT Math", school: "Greenfield" },
      phone: "+919876543210",
    });
    expect(res.success).toBe(true);
    const sent = JSON.parse((f.mock.calls[0][1] as any).body);
    expect(sent.type).toBe("template");
    expect(sent.template.name).toBe("shortlist_notification");
    expect(sent.template.components[0].parameters.map((p: any) => p.text)).toEqual(["Asha", "TGT Math", "Greenfield"]);

    const rows = await t.run(async (ctx) =>
      ctx.db.query("outreachMessages").withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId)).collect(),
    );
    expect(rows[0].type).toBe("shortlist");
    expect(rows[0].metaMessageId).toBe("wamid.TPL");
  });

  it("throws on an unknown template", async () => {
    const t = convexTest(schema, modules);
    const { applicationId, candidateId } = await seedConnected(t);
    await expect(
      t.action(apiModule.api.whatsappCloud.sendWhatsAppTemplate, {
        applicationId, candidateId, templateName: "nope", templateParams: {}, phone: "+919876543210",
      }),
    ).rejects.toThrow("Unknown template");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run tests/convex/whatsappCloud.test.ts -t sendWhatsAppTemplate`
Expected: FAIL — `sendWhatsAppTemplate` is not a function.

- [ ] **Step 3: Implement `sendWhatsAppTemplate`** — add to `convex/whatsappCloud.ts`

```ts
// Maps internal outreach template keys -> approved Meta templates (created in Meta Business Manager).
// `params` is the ordered list of templateParams keys that fill the template body variables {{1}}, {{2}}, ...
const TEMPLATE_REGISTRY: Record<string, { metaName: string; languageCode: string; params: string[] }> = {
  shortlist_notification: { metaName: "shortlist_notification", languageCode: "en", params: ["name", "position", "school"] },
  demo_schedule: { metaName: "demo_schedule", languageCode: "en", params: ["name", "date", "time", "topic", "classLevel", "address", "school"] },
  feedback_request: { metaName: "feedback_request", languageCode: "en", params: ["name", "feedbackUrl"] },
  offer_notification: { metaName: "offer_notification", languageCode: "en", params: ["name", "position", "school", "deadline"] },
  rejection_notification: { metaName: "rejection_notification", languageCode: "en", params: ["name", "position", "school"] },
};

export const sendWhatsAppTemplate = action({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    templateName: v.string(),
    templateParams: v.any(),
    phone: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    const spec = TEMPLATE_REGISTRY[args.templateName];
    if (!spec) throw new Error(`Unknown template: ${args.templateName}`);
    const p = (args.templateParams ?? {}) as Record<string, string>;
    const bodyParams = spec.params.map((k) => p[k] ?? "");
    try {
      const { metaMessageId, markupPct, schoolId } = await cloudSend(ctx, {
        applicationId: args.applicationId, to: args.phone,
        kind: "template", templateName: spec.metaName, languageCode: spec.languageCode, bodyParams,
      });
      await ctx.runMutation(internal.whatsappCloud.insertCloudSentMessage, {
        applicationId: args.applicationId, candidateId: args.candidateId, schoolId,
        type: args.templateName.replace("_notification", ""), body: bodyParams.join(" | "),
        metaMessageId, markupPct,
      });
      return { success: true, messageId: metaMessageId };
    } catch (err: any) {
      await ctx.runMutation(internal.outreach.saveFailedMessage as any, {
        applicationId: args.applicationId, candidateId: args.candidateId,
        type: args.templateName, channel: "whatsapp", body: bodyParams.join(" | "), error: err?.message ?? "Unknown error",
      });
      return { success: false, error: err?.message };
    }
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run tests/convex/whatsappCloud.test.ts`
Expected: PASS (4 tests in the file).

- [ ] **Step 5: Commit**

```bash
git add convex/whatsappCloud.ts tests/convex/whatsappCloud.test.ts
git commit -m "feat(whatsapp): Cloud API template send with template registry"
```

### Phase 3 checkpoint

`bunx vitest run tests/convex/whatsappCloud.test.ts` green. The send path exists but is not wired to any caller yet (still `whatsappCloud.*`).

---

## Phase 4 — Receive path: usage rollup + inbound/status webhook

### Task 10: Usage rollup (`whatsappUsage.ts`)

**Files:**
- Create: `convex/whatsappUsage.ts`
- Test: `tests/convex/whatsappUsage.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/convex/whatsappUsage.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { monthStartUtc } from "../../convex/whatsappUsage";
import * as whatsappUsage from "../../convex/whatsappUsage";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "whatsappUsage.ts": async () => whatsappUsage,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("monthStartUtc", () => {
  it("returns the first ms of the UTC month", () => {
    const ts = Date.UTC(2026, 4, 28, 13, 45, 0); // 2026-05-28
    expect(monthStartUtc(ts)).toBe(Date.UTC(2026, 4, 1));
  });
});

describe("usage queries", () => {
  it("getCurrentUsage returns this month's row; getUsageHistory sorts desc", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) =>
      ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" }),
    );
    const thisMonth = monthStartUtc(Date.now());
    const lastMonth = monthStartUtc(thisMonth - 1);
    await t.run(async (ctx) => {
      for (const [periodStart, count] of [[lastMonth, 3], [thisMonth, 7]] as const) {
        await ctx.db.insert("whatsappUsage", {
          schoolId, periodStart, messageCount: count,
          utilityCount: count, marketingCount: 0, authenticationCount: 0, serviceCount: 0,
          metaCostUsdTotal: 0.01 * count, billableUsdTotal: 0.012 * count, updatedAt: Date.now(),
        });
      }
    });

    const current = await t.query(apiModule.api.whatsappUsage.getCurrentUsage, { schoolId });
    expect(current?.messageCount).toBe(7);

    const history = await t.query(apiModule.api.whatsappUsage.getUsageHistory, { schoolId, months: 6 });
    expect(history.map((h: any) => h.periodStart)).toEqual([thisMonth, lastMonth]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run tests/convex/whatsappUsage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `convex/whatsappUsage.ts`**

```ts
import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MessageCategory } from "./lib/metaPricing";

export function monthStartUtc(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

const CATEGORY_COLUMN: Record<MessageCategory, "utilityCount" | "marketingCount" | "authenticationCount" | "serviceCount"> = {
  utility: "utilityCount",
  marketing: "marketingCount",
  authentication: "authenticationCount",
  service: "serviceCount",
};

// Plain helper called from recordStatus (a mutation cannot call another mutation).
export async function bumpUsage(
  ctx: any,
  args: { schoolId: Id<"schools">; category: MessageCategory; metaCostUsd: number; billableUsd: number },
): Promise<void> {
  const periodStart = monthStartUtc(Date.now());
  const existing = await ctx.db
    .query("whatsappUsage")
    .withIndex("by_schoolId_periodStart", (q: any) => q.eq("schoolId", args.schoolId).eq("periodStart", periodStart))
    .first();
  const col = CATEGORY_COLUMN[args.category];
  if (!existing) {
    const counts = { utilityCount: 0, marketingCount: 0, authenticationCount: 0, serviceCount: 0 };
    counts[col] = 1;
    await ctx.db.insert("whatsappUsage", {
      schoolId: args.schoolId, periodStart, messageCount: 1, ...counts,
      metaCostUsdTotal: args.metaCostUsd, billableUsdTotal: args.billableUsd, updatedAt: Date.now(),
    });
    return;
  }
  await ctx.db.patch(existing._id, {
    messageCount: existing.messageCount + 1,
    [col]: existing[col] + 1,
    metaCostUsdTotal: existing.metaCostUsdTotal + args.metaCostUsd,
    billableUsdTotal: existing.billableUsdTotal + args.billableUsd,
    updatedAt: Date.now(),
  });
}

export const getCurrentUsage = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const periodStart = monthStartUtc(Date.now());
    return await ctx.db
      .query("whatsappUsage")
      .withIndex("by_schoolId_periodStart", (q) => q.eq("schoolId", args.schoolId).eq("periodStart", periodStart))
      .first();
  },
});

export const getUsageHistory = query({
  args: { schoolId: v.id("schools"), months: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("whatsappUsage")
      .withIndex("by_schoolId_periodStart", (q) => q.eq("schoolId", args.schoolId))
      .collect();
    return rows.sort((a, b) => b.periodStart - a.periodStart).slice(0, args.months ?? 6);
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run tests/convex/whatsappUsage.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/whatsappUsage.ts tests/convex/whatsappUsage.test.ts
git commit -m "feat(whatsapp): monthly usage rollup helper + usage queries"
```

---

### Task 11: `recordStatus` — apply delivery status + cost to a message

**Files:**
- Create: `convex/whatsappWebhook.ts`
- Test: `tests/convex/whatsappWebhook.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/convex/whatsappWebhook.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run tests/convex/whatsappWebhook.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `recordStatus` in `convex/whatsappWebhook.ts`**

```ts
import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { normalizeToE164, countryFromPhone } from "./lib/phone";
import { lookupMetaCostUsd, computeBillableUsd, type MessageCategory } from "./lib/metaPricing";
import { bumpUsage } from "./whatsappUsage";
import { verifyMetaSignature, parseMetaWebhook } from "./lib/metaWebhook";

function mapStatus(metaStatus: string): "sent" | "delivered" | "failed" | undefined {
  if (metaStatus === "sent") return "sent";
  if (metaStatus === "delivered" || metaStatus === "read") return "delivered";
  if (metaStatus === "failed") return "failed";
  return undefined;
}

export const recordStatus = internalMutation({
  args: {
    phoneNumberId: v.string(),
    metaMessageId: v.string(),
    status: v.string(),
    recipientPhone: v.optional(v.string()),
    category: v.optional(v.string()),
    pricingModel: v.optional(v.string()),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("outreachMessages")
      .withIndex("by_metaMessageId", (q) => q.eq("metaMessageId", args.metaMessageId))
      .first();
    if (!row) {
      console.log(`[whatsapp] status for unknown message ${args.metaMessageId}`);
      return;
    }

    const patch: Record<string, unknown> = {};
    const mapped = mapStatus(args.status);
    if (mapped) patch.status = mapped;

    // Record cost exactly once — when pricing first arrives and we haven't priced this row yet.
    if (args.category && row.metaCostUsd === undefined) {
      const integ = await ctx.db
        .query("whatsappIntegrations")
        .withIndex("by_phoneNumberId", (q) => q.eq("phoneNumberId", args.phoneNumberId))
        .first();
      const markupPct = row.markupPct ?? integ?.markupPct ?? 20;
      const category = args.category as MessageCategory;
      const countryCode = countryFromPhone(args.recipientPhone);
      const metaCostUsd = lookupMetaCostUsd({ countryCode, category });
      const billableUsd = computeBillableUsd(metaCostUsd, markupPct);
      patch.metaCategory = category;
      patch.metaPricingModel = args.pricingModel;
      patch.metaConversationId = args.conversationId;
      patch.metaCostUsd = metaCostUsd;
      patch.billableUsd = billableUsd;
      patch.markupPct = markupPct;
      patch.costCurrency = "USD";
      await ctx.db.patch(row._id, patch);
      if (row.schoolId) {
        await bumpUsage(ctx, { schoolId: row.schoolId, category, metaCostUsd, billableUsd });
      }
      return;
    }

    if (Object.keys(patch).length > 0) await ctx.db.patch(row._id, patch);
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run tests/convex/whatsappWebhook.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/whatsappWebhook.ts tests/convex/whatsappWebhook.test.ts
git commit -m "feat(whatsapp): recordStatus applies delivery status, cost, and usage rollup"
```

---

### Task 12: `recordInbound` — route candidate replies into the conversation agent

**Files:**
- Modify: `convex/whatsappWebhook.ts`
- Test: `tests/convex/whatsappWebhook.test.ts` (add a describe block)

- [ ] **Step 1: Write the failing test** — append to `tests/convex/whatsappWebhook.test.ts`

```ts
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
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run tests/convex/whatsappWebhook.test.ts -t recordInbound`
Expected: FAIL — `recordInbound` is not a function.

- [ ] **Step 3: Implement `recordInbound`** — add to `convex/whatsappWebhook.ts`

```ts
export const recordInbound = internalMutation({
  args: {
    phoneNumberId: v.string(),
    fromPhone: v.string(),
    text: v.string(),
    metaMessageId: v.string(),
  },
  handler: async (ctx, args): Promise<{ matched: boolean }> => {
    const integ = await ctx.db
      .query("whatsappIntegrations")
      .withIndex("by_phoneNumberId", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .first();
    if (!integ) {
      console.log(`[whatsapp] inbound for unknown phoneNumberId ${args.phoneNumberId}`);
      return { matched: false };
    }
    const target = normalizeToE164(args.fromPhone);
    if (!target) return { matched: false };

    const candidates = await ctx.db.query("candidates").collect();
    const candidate = candidates.find((c) => normalizeToE164(c.phone) === target);
    if (!candidate) {
      console.log(`[whatsapp] inbound from unknown candidate ${args.fromPhone}`);
      return { matched: false };
    }

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const schoolMessages = await ctx.db
      .query("outreachMessages")
      .withIndex("by_schoolId_sentAt", (q) => q.eq("schoolId", integ.schoolId))
      .collect();
    const outbounds = schoolMessages
      .filter((m) =>
        m.candidateId === candidate._id &&
        m.direction !== "inbound" &&
        m.type !== "rejection" &&
        typeof m.sentAt === "number" &&
        (m.sentAt as number) >= cutoff,
      )
      .sort((a, b) => (b.sentAt as number) - (a.sentAt as number));
    if (outbounds.length === 0) return { matched: false };
    const parent = outbounds[0];

    const inboundId = await ctx.db.insert("outreachMessages", {
      applicationId: parent.applicationId,
      candidateId: candidate._id,
      schoolId: integ.schoolId,
      type: "candidate_reply",
      channel: "whatsapp",
      body: args.text,
      status: "sent",
      direction: "inbound",
      inReplyToMessageId: parent._id,
      metaMessageId: args.metaMessageId,
      sentAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.conversation.handleInbound, { messageId: inboundId });
    return { matched: true };
  },
});
```

> The test does not advance the scheduler, so `conversation.ts` need not be registered in `modules` — `convex-test` resolves the scheduled reference lazily.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run tests/convex/whatsappWebhook.test.ts`
Expected: PASS (5 tests in the file).

- [ ] **Step 5: Commit**

```bash
git add convex/whatsappWebhook.ts tests/convex/whatsappWebhook.test.ts
git commit -m "feat(whatsapp): recordInbound routes Cloud API replies to the conversation agent"
```

---

### Task 13: `processWebhook` — verify signature, parse, dispatch

**Files:**
- Modify: `convex/whatsappWebhook.ts`
- Test: `tests/convex/whatsappWebhook.test.ts` (add a describe block; needs node env for HMAC)

> Split the file: the existing describe blocks don't need crypto. This new block does. Add `// @vitest-environment node` is per-FILE only — so move the signed-body test into its OWN file `tests/convex/whatsappWebhook_process.test.ts` to keep the node pragma isolated.

- [ ] **Step 1: Write the failing test** in a new file `tests/convex/whatsappWebhook_process.test.ts`

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run tests/convex/whatsappWebhook_process.test.ts`
Expected: FAIL — `processWebhook` is not a function.

- [ ] **Step 3: Implement `processWebhook`** — add to `convex/whatsappWebhook.ts`

```ts
export const processWebhook = internalAction({
  args: { rawBody: v.string(), signature: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args): Promise<{ verified: boolean; inbound: number; statuses: number }> => {
    const verified = await verifyMetaSignature(args.rawBody, args.signature ?? null);
    if (!verified) return { verified: false, inbound: 0, statuses: 0 };

    let payload: any;
    try {
      payload = JSON.parse(args.rawBody);
    } catch {
      return { verified: true, inbound: 0, statuses: 0 };
    }
    const { inbound, statuses } = parseMetaWebhook(payload);

    for (const s of statuses) {
      await ctx.runMutation(internal.whatsappWebhook.recordStatus, {
        phoneNumberId: s.phoneNumberId,
        metaMessageId: s.metaMessageId,
        status: s.status,
        recipientPhone: s.recipientPhone,
        category: s.category,
        pricingModel: s.pricingModel,
        conversationId: s.conversationId,
      });
    }
    for (const m of inbound) {
      await ctx.runMutation(internal.whatsappWebhook.recordInbound, {
        phoneNumberId: m.phoneNumberId,
        fromPhone: m.fromPhone,
        text: m.text,
        metaMessageId: m.metaMessageId,
      });
    }
    return { verified: true, inbound: inbound.length, statuses: statuses.length };
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run tests/convex/whatsappWebhook_process.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/whatsappWebhook.ts tests/convex/whatsappWebhook_process.test.ts
git commit -m "feat(whatsapp): processWebhook verifies signature, parses, and dispatches events"
```

---

### Task 14: Register the `/whatsapp/webhook` HTTP route

**Files:**
- Modify: `convex/http.ts` (add the route; the existing Gupshup `/whatsapp/inbound` stays until Phase 6)

> This route is thin glue over the unit-tested `processWebhook`. Verified manually against `bunx convex dev` (convex-test's `t.fetch` is awkward with the registered Better Auth routes).

- [ ] **Step 1: Add the route to `convex/http.ts`**

Add after the existing `/whatsapp/inbound` block (after `convex/http.ts:51`), and add `internal` to the import on line 3:

Change line 3 from:
```ts
import { api } from "./_generated/api";
```
to:
```ts
import { api, internal } from "./_generated/api";
```

Add the route:

```ts
http.route({
  path: "/whatsapp/webhook",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }),
});

http.route({
  path: "/whatsapp/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const result = await ctx.runAction(internal.whatsappWebhook.processWebhook, { rawBody, signature });
    if (!result.verified) {
      return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
    }
    return new Response(JSON.stringify({ success: true, ...result }), { status: 200 });
  }),
});
```

- [ ] **Step 2: Deploy and verify the handshake manually**

Run: `bunx convex dev` (leave running), then in another shell:
```bash
SITE=$(bunx convex env get CONVEX_SITE_URL 2>/dev/null || echo "https://<your-deployment>.convex.site")
curl -s "$SITE/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=$(bunx convex env get META_WEBHOOK_VERIFY_TOKEN)&hub.challenge=test123"
```
Expected: prints `test123`. A wrong token returns `forbidden`.

- [ ] **Step 3: Point Meta at the webhook**

In the Meta App dashboard → WhatsApp → Configuration, set the Callback URL to `<CONVEX_SITE_URL>/whatsapp/webhook` and the Verify Token to your `META_WEBHOOK_VERIFY_TOKEN`. Subscribe to `messages`. (Already auto-subscribed per-WABA by `subscribeAppToWaba` during connect.)

- [ ] **Step 4: Commit**

```bash
git add convex/http.ts
git commit -m "feat(whatsapp): register /whatsapp/webhook GET verify + POST event route"
```

### Phase 4 checkpoint

```bash
bunx vitest run tests/convex/whatsappUsage.test.ts tests/convex/whatsappWebhook.test.ts tests/convex/whatsappWebhook_process.test.ts
```
All green. Inbound replies and delivery/cost statuses now flow end-to-end from a Meta dev WABA (sends still route through Gupshup until cutover).

---

## Phase 5 — Embedded Signup UI

New settings page at `/dashboard/settings/messaging/whatsapp`. The Facebook JS SDK and `window.postMessage` flow can't be meaningfully unit-tested, so these tasks are verified manually in the browser; only the pure `formatUsd` helper is TDD'd.

### Task 15: Settings nav + page + orchestrator + connect button

**Files:**
- Modify: `components/settings/settings-nav.tsx` (add a nav item)
- Create: `app/dashboard/settings/messaging/whatsapp/page.tsx`
- Create: `app/dashboard/settings/messaging/whatsapp/_components/whatsapp-settings.tsx`
- Create: `app/dashboard/settings/messaging/whatsapp/_components/connect-button.tsx`

- [ ] **Step 1: Add the nav item** in `components/settings/settings-nav.tsx`

Insert into the `ITEMS` array after the `messaging` entry (after `components/settings/settings-nav.tsx:19`):

```ts
  { href: "/dashboard/settings/messaging/whatsapp", label: "WhatsApp", icon: "MessageSquare" },
```

> `MessageSquare` is already used and known-valid in the `IconName` union. If you prefer a distinct icon, confirm it exists in `components/ui` before using it.

- [ ] **Step 2: Create the server page** `app/dashboard/settings/messaging/whatsapp/page.tsx`

```tsx
import { requireProfile } from "@/lib/auth";
import { WhatsAppSettings } from "./_components/whatsapp-settings";

export default async function WhatsAppSettingsPage() {
  const { profile } = await requireProfile();
  return <WhatsAppSettings schoolId={profile.schoolId} />;
}
```

- [ ] **Step 3: Create the orchestrator** `app/dashboard/settings/messaging/whatsapp/_components/whatsapp-settings.tsx`

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui";
import { ConnectButton } from "./connect-button";
import { ConnectedCard } from "./connected-card";
import { UsageSummary } from "./usage-summary";

export function WhatsAppSettings({ schoolId }: { schoolId: Id<"schools"> }) {
  const integration = useQuery(api.whatsappIntegration.getIntegration, { schoolId });
  if (integration === undefined) return null;

  return (
    <div className="space-y-6">
      <Card padding="md" elevation={1}>
        <h2 className="text-body-s font-semibold text-ink mb-1">WhatsApp Business Account</h2>
        <p className="text-body-s text-ink-secondary mb-4">
          Connect your school&apos;s own WhatsApp number to send candidate outreach from your brand.
        </p>
        {integration.status === "active" ? (
          <ConnectedCard schoolId={schoolId} integration={integration} />
        ) : integration.status === "error" ? (
          <div className="space-y-3">
            <p className="text-body-s text-danger">{integration.lastErrorMessage ?? "Connection error"}</p>
            <ConnectButton schoolId={schoolId} label="Reconnect" />
          </div>
        ) : (
          <ConnectButton schoolId={schoolId} label="Connect WhatsApp Business" />
        )}
      </Card>

      {integration.status === "active" && (
        <UsageSummary schoolId={schoolId} markupPct={integration.markupPct} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create the connect button** `app/dashboard/settings/messaging/whatsapp/_components/connect-button.tsx`

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui";

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

export function ConnectButton({ schoolId, label }: { schoolId: Id<"schools">; label: string }) {
  const complete = useAction(api.whatsappIntegration.completeEmbeddedSignup);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wabaIdRef = useRef<string | null>(null);
  const codeRef = useRef<string | null>(null);

  // Embedded Signup delivers the WABA id via postMessage; FB.login delivers the code.
  // Fire the Convex action only once both are present.
  async function maybeComplete() {
    if (!wabaIdRef.current || !codeRef.current) return;
    setBusy(true);
    setError(null);
    const res = await complete({ schoolId, code: codeRef.current, wabaId: wabaIdRef.current });
    setBusy(false);
    wabaIdRef.current = null;
    codeRef.current = null;
    if (!res.ok) setError(res.error ?? "Connection failed");
  }

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof event.origin !== "string" || !event.origin.endsWith("facebook.com")) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH") {
          wabaIdRef.current = data.data.waba_id;
          void maybeComplete();
        }
      } catch {
        /* non-JSON messages from the SDK are expected; ignore */
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const launch = () => {
    setError(null);
    window.FB?.login(
      (response: any) => {
        if (response?.authResponse?.code) {
          codeRef.current = response.authResponse.code;
          void maybeComplete();
        }
      },
      {
        config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { feature: "whatsapp_embedded_signup", sessionInfoVersion: "3" },
      },
    );
  };

  return (
    <div className="space-y-2">
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="lazyOnload"
        onLoad={() => window.FB?.init({ appId: process.env.NEXT_PUBLIC_META_APP_ID, version: "v22.0", xfbml: false })}
      />
      <Button variant="primary" onClick={launch} loading={busy} disabled={busy}>
        {label}
      </Button>
      {error && <p className="text-caption text-danger">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Commit** (UI compiles; full flow verified after Task 17)

```bash
git add components/settings/settings-nav.tsx app/dashboard/settings/messaging/whatsapp/page.tsx app/dashboard/settings/messaging/whatsapp/_components/whatsapp-settings.tsx app/dashboard/settings/messaging/whatsapp/_components/connect-button.tsx
git commit -m "feat(whatsapp): settings page + Embedded Signup connect button"
```

---

### Task 16: Connected card (markup editor + disconnect)

**Files:**
- Create: `app/dashboard/settings/messaging/whatsapp/_components/connected-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Input } from "@/components/ui";

interface IntegrationView {
  displayPhoneNumber?: string;
  businessName?: string;
  verifiedName?: string;
  markupPct: number;
  connectedAt?: number;
}

export function ConnectedCard({ schoolId, integration }: { schoolId: Id<"schools">; integration: IntegrationView }) {
  const updateMarkup = useMutation(api.whatsappIntegration.updateMarkup);
  const disconnect = useMutation(api.whatsappIntegration.disconnect);
  const [markup, setMarkup] = useState(integration.markupPct);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-sm bg-surface-canvas px-4 py-3">
        <div>
          <p className="text-body-s font-medium text-ink flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            {integration.businessName ?? integration.verifiedName ?? "Connected"}
          </p>
          <p className="text-caption text-ink-secondary">{integration.displayPhoneNumber}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => disconnect({ schoolId })}>
          Disconnect
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_160px] gap-6 items-center">
        <div>
          <div className="text-body-s font-medium text-ink">Message markup</div>
          <div className="text-caption text-ink-secondary mt-0.5">
            Percentage added on top of Meta&apos;s per-message cost when billing this client.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={500}
            value={markup}
            onChange={(e) => setMarkup(Number(e.target.value))}
            onBlur={() => updateMarkup({ schoolId, markupPct: markup })}
          />
          <span className="text-body-s text-ink-secondary">%</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/settings/messaging/whatsapp/_components/connected-card.tsx
git commit -m "feat(whatsapp): connected-account card with markup editor and disconnect"
```

---

### Task 17: Usage summary (+ `formatUsd` TDD) and full browser verification

**Files:**
- Create: `app/dashboard/settings/messaging/whatsapp/_components/format.ts`
- Create: `app/dashboard/settings/messaging/whatsapp/_components/usage-summary.tsx`
- Test: `tests/components/whatsapp-format.test.ts`

- [ ] **Step 1: Write the failing test** `tests/components/whatsapp-format.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { formatUsd } from "../../app/dashboard/settings/messaging/whatsapp/_components/format";

describe("formatUsd", () => {
  it("formats to 2 dp with a dollar sign", () => {
    expect(formatUsd(20.954)).toBe("$20.95");
    expect(formatUsd(0)).toBe("$0.00");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run tests/components/whatsapp-format.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `format.ts`**

```ts
export function formatUsd(amount: number): string {
  return "$" + amount.toFixed(2);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run tests/components/whatsapp-format.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `usage-summary.tsx`**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui";
import { formatUsd } from "./format";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-secondary">{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  );
}

export function UsageSummary({ schoolId, markupPct }: { schoolId: Id<"schools">; markupPct: number }) {
  const usage = useQuery(api.whatsappUsage.getCurrentUsage, { schoolId });

  return (
    <Card padding="md" elevation={1}>
      <h2 className="text-body-s font-semibold text-ink mb-3">Usage this month</h2>
      {!usage ? (
        <p className="text-body-s text-ink-secondary">No messages sent yet this month.</p>
      ) : (
        <div className="space-y-2 text-body-s">
          <Row label="Messages sent" value={String(usage.messageCount)} />
          <Row label="Meta cost" value={formatUsd(usage.metaCostUsdTotal)} />
          <Row label={`Billable (${markupPct}% markup)`} value={formatUsd(usage.billableUsdTotal)} />
          <div className="pt-2 border-t border-hairline text-caption text-ink-secondary">
            Utility {usage.utilityCount} · Marketing {usage.marketingCount} · Auth {usage.authenticationCount} · Service {usage.serviceCount} (free)
          </div>
        </div>
      )}
      <p className="mt-4 text-caption text-ink-secondary">
        Billing will be available once a payment provider is integrated.
      </p>
    </Card>
  );
}
```

- [ ] **Step 6: Manual browser verification of the whole flow**

Start both servers:
```bash
bunx convex dev    # shell 1
bun run dev        # shell 2
```
Then:
1. Visit `http://localhost:3000/dashboard/settings/messaging/whatsapp`. Expect the "Connect WhatsApp Business" card.
2. Click Connect → the Meta popup opens → complete signup with your dev WABA.
3. On success the card flips to "Connected — <business name>" with the phone number and a markup field. Confirm the Convex dashboard shows a `whatsappIntegrations` row with `status: "active"` and a non-empty `accessTokenCipher`.
4. Change the markup to `30`, blur the field, reload — it persists.
5. Click Disconnect → card returns to the connect state; the row's `accessTokenCipher` is cleared and `status` is `disconnected`.

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/settings/messaging/whatsapp/_components/format.ts app/dashboard/settings/messaging/whatsapp/_components/usage-summary.tsx tests/components/whatsapp-format.test.ts
git commit -m "feat(whatsapp): usage summary card + USD formatting helper"
```

### Phase 5 checkpoint

The full connect → store → display → disconnect loop works in the browser against a dev WABA. Sends still go through Gupshup — cutover is next.

---

## Phase 6 — Clean cutover (delete Gupshup)

Swap the send path to Meta and remove every Gupshup reference. After this phase, `api.whatsapp.sendWhatsAppMessage` and `api.whatsapp.sendWhatsAppTemplate` are the Cloud API versions — callers in [components/outreach/message-composer.tsx:90](components/outreach/message-composer.tsx:90) and [components/outreach/demo-scheduler.tsx:23](components/outreach/demo-scheduler.tsx:23) keep working because the function names and arg shapes are unchanged.

### Task 18: Rename the send module `whatsappCloud.ts` → `whatsapp.ts`

**Files:**
- Delete: `convex/whatsapp.ts` (Gupshup)
- Rename: `convex/whatsappCloud.ts` → `convex/whatsapp.ts`
- Delete: `tests/convex/whatsapp_inbound.test.ts` (tested the removed Gupshup `handleInboundMessage`; inbound is now covered by `whatsappWebhook.test.ts`)
- Rename: `tests/convex/whatsappCloud.test.ts` → `tests/convex/whatsapp.test.ts`

- [ ] **Step 1: Delete the Gupshup module and its inbound test, then rename**

```bash
git rm convex/whatsapp.ts tests/convex/whatsapp_inbound.test.ts
git mv convex/whatsappCloud.ts convex/whatsapp.ts
git mv tests/convex/whatsappCloud.test.ts tests/convex/whatsapp.test.ts
```

- [ ] **Step 2: Fix internal self-references inside `convex/whatsapp.ts`**

In `convex/whatsapp.ts`, replace both occurrences:
- `internal.whatsappCloud.getSendContextByApplication` → `internal.whatsapp.getSendContextByApplication`
- `internal.whatsappCloud.insertCloudSentMessage` → `internal.whatsapp.insertCloudSentMessage`

- [ ] **Step 3: Fix the test imports in `tests/convex/whatsapp.test.ts`**

Replace:
- `import * as whatsappCloud from "../../convex/whatsappCloud";` → `import * as whatsapp from "../../convex/whatsapp";`
- module map key `"whatsappCloud.ts": async () => whatsappCloud,` → `"whatsapp.ts": async () => whatsapp,`
- every `apiModule.api.whatsappCloud.` → `apiModule.api.whatsapp.`

- [ ] **Step 4: Regenerate the Convex API types and run the suite**

Run: `bunx convex dev --once && bunx vitest run tests/convex/whatsapp.test.ts`
Expected: PASS (4 tests). `_generated/api.d.ts` now exposes `api.whatsapp.sendWhatsAppMessage` again.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(whatsapp): cut over send module from Gupshup to Meta Cloud API"
```

---

### Task 19: Route the scheduled dispatcher through the Cloud API

**Files:**
- Modify: `convex/outreach.ts` (`markSent` at `convex/outreach.ts:206-218`; `dispatchScheduledOutreach` whatsapp branch at `convex/outreach.ts:246-273`)

- [ ] **Step 1: Extend `markSent` to persist Meta fields**

Replace `markSent` (`convex/outreach.ts:206-218`) with:

```ts
export const markSent = internalMutation({
  args: {
    messageId: v.id("outreachMessages"),
    externalId: v.optional(v.string()),
    metaMessageId: v.optional(v.string()),
    markupPct: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      status: "sent" as any,
      sentAt: Date.now(),
      externalId: args.externalId,
    };
    if (args.metaMessageId !== undefined) patch.metaMessageId = args.metaMessageId;
    if (args.markupPct !== undefined) {
      patch.markupPct = args.markupPct;
      patch.costCurrency = "USD";
    }
    await ctx.db.patch(args.messageId, patch);
  },
});
```

- [ ] **Step 2: Replace the inline Gupshup call in the whatsapp branch**

Add the import near the top of `convex/outreach.ts` (after the existing imports, e.g. after `convex/outreach.ts:6`):

```ts
import { cloudSend } from "./whatsapp";
```

Replace the whatsapp branch (`convex/outreach.ts:246-273`, the block starting `if (msg.channel === "whatsapp") {` up to the closing `}` before `} else if (msg.channel === "email") {`) with:

```ts
        let metaMessageId: string | undefined;
        let markupPct: number | undefined;

        if (msg.channel === "whatsapp") {
          if (!candidate.phone) {
            await ctx.runMutation(internal.outreach.markFailed, { messageId: msg._id });
            failed++;
            continue;
          }
          const result = await cloudSend(ctx, {
            applicationId: msg.applicationId,
            to: candidate.phone,
            kind: "text",
            body: msg.body,
          });
          externalId = result.metaMessageId;
          metaMessageId = result.metaMessageId;
          markupPct = result.markupPct;

        } else if (msg.channel === "email") {
```

- [ ] **Step 3: Pass the Meta fields to the shared `markSent` call**

Replace the existing shared `markSent` call (`convex/outreach.ts:304-307`) with:

```ts
        await ctx.runMutation(internal.outreach.markSent, {
          messageId: msg._id,
          externalId,
          metaMessageId,
          markupPct,
        });
```

> The `let metaMessageId` / `let markupPct` declarations live just inside the `for (const msg of due)` loop body (added in Step 2 at the top of the whatsapp branch). Confirm they are declared before the `if (msg.channel === ...)` chain so the email branch leaves them `undefined`.

- [ ] **Step 4: Verify the existing suite still passes**

Run: `bunx convex dev --once && bunx vitest run`
Expected: full suite green (the conversation/outreach tests still pass; the dispatcher now uses `cloudSend`).

- [ ] **Step 5: Commit**

```bash
git add convex/outreach.ts
git commit -m "refactor(outreach): scheduled WhatsApp dispatch via Cloud API with cost capture"
```

---

### Task 20: Remove remaining Gupshup remnants

**Files:**
- Modify: `convex/http.ts` (remove the Gupshup `/whatsapp/inbound` route at `convex/http.ts:32-51`)
- Delete: `components/settings/whatsapp-config.tsx`
- Modify: `app/dashboard/settings/page.tsx` (remove the `WhatsAppConfig` import + usage)
- Modify: `.env.local.example`

- [ ] **Step 1: Remove the Gupshup inbound route**

Delete the entire `http.route({ path: "/whatsapp/inbound", ... })` block (`convex/http.ts:32-51`). Keep the new `/whatsapp/webhook` GET and POST routes. The `api` import may now be unused if `/email/inbound` is the only other `api.*` caller — keep `api` since `/email/inbound` uses `api.email_reply_router.dispatch`.

- [ ] **Step 2: Remove the Gupshup config UI from the General settings page**

Run `grep -n "WhatsAppConfig\|whatsapp-config" app/dashboard/settings/page.tsx` to find the import and JSX usage, then delete both lines. Then delete the component file:

```bash
git rm components/settings/whatsapp-config.tsx
```

> The new WhatsApp settings live at `/dashboard/settings/messaging/whatsapp` (Phase 5), reachable from the settings nav. The old toggle-only Gupshup card on the General page is obsolete. Note: `schools.whatsappEnabled` (the "use WhatsApp for this school" preference, edited elsewhere) is unrelated and stays.

- [ ] **Step 3: Update `.env.local.example`**

Replace the Gupshup block:

```bash
# Gupshup WhatsApp
GUPSHUP_API_KEY=
GUPSHUP_APP_NAME=
GUPSHUP_SOURCE_NUMBER=
```

with:

```bash
# Meta WhatsApp Cloud API (server-side; also set in Convex via `bunx convex env set`)
META_APP_ID=
META_APP_SECRET=
META_CONFIG_ID=
META_GRAPH_API_VERSION=v22.0
META_WEBHOOK_VERIFY_TOKEN=
# AES-256-GCM key for encrypting per-school access tokens. `openssl rand -base64 32`.
# Set in Convex env ONLY (bunx convex env set WHATSAPP_ENCRYPTION_KEY ...), never client-side.
WHATSAPP_ENCRYPTION_KEY=

# Embedded Signup (browser-side FB SDK)
NEXT_PUBLIC_META_APP_ID=
NEXT_PUBLIC_META_CONFIG_ID=
```

- [ ] **Step 4: Remove the stale Gupshup vars from the Convex deployment**

```bash
bunx convex env remove GUPSHUP_API_KEY
bunx convex env remove GUPSHUP_APP_NAME
bunx convex env remove GUPSHUP_SOURCE_NUMBER
```

- [ ] **Step 5: Full verification**

Run: `bunx convex dev --once && bunx vitest run`
Expected: entire suite green. Then `grep -rn "gupshup\|GUPSHUP" convex app components --include="*.ts" --include="*.tsx"` returns nothing.

- [ ] **Step 6: End-to-end browser smoke test**

With `bunx convex dev` + `bun run dev` running, and a dev WABA connected (Phase 5):
1. From a candidate/application, trigger a WhatsApp send (message-composer or the scheduled dispatcher). Confirm delivery on a real phone via the school's number.
2. Reply from the phone → the reply appears in the inbox (conversation agent flow), inserted by `recordInbound`.
3. After ~30s the delivery/pricing status webhook fires → the `outreachMessages` row gets `metaCostUsd` + `billableUsd`, and `whatsappUsage` for the month increments.
4. The WhatsApp settings page shows updated usage.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(whatsapp): remove Gupshup routes, config UI, and env vars"
```

### Phase 6 checkpoint — DONE

Multi-tenant WhatsApp Cloud API is live: clients connect their own WABA, sends route through their number with a per-school markup snapshot, inbound + cost flow through the webhook, and Gupshup is gone. Billing is one query away (`outreachMessages.billableUsd` + `whatsappUsage`) when the payment provider lands.

---

## Self-review

**Spec coverage:**
- Per-school WABA + encrypted token → Tasks 1, 6, 7 ✓
- Embedded Signup → Tasks 7, 15 ✓
- Clean cutover (no flag) → Phase 6 ✓
- Percentage markup captured per message → Tasks 8, 11 (`markupPct` + `billableUsd`) ✓
- Webhook routing by `phoneNumberId`, signature verification → Tasks 5, 11–14 ✓
- Static price table + quarterly refresh doc → Task 3 ✓
- Usage rollup for billing-later → Tasks 10, 11 ✓
- UI states (not_connected/active/error) + usage → Tasks 15–17 ✓
- Free service window = $0 → Task 3 (`service` → 0) ✓

**Deviations from spec (deliberate, noted in-line):** Web Crypto instead of `node:crypto`; webhook as a Convex `httpAction` (`/whatsapp/webhook`) instead of a Next.js route — both to match existing codebase patterns and avoid an extra network hop. Dropped the separate `accessTokenTag` field (Web Crypto GCM appends the tag to the ciphertext).

**Type consistency:** `MessageCategory` defined once in `metaPricing.ts`, imported by `whatsappUsage.ts` and `whatsappWebhook.ts`. `cloudSend` returns `{ metaMessageId, markupPct, schoolId }` and every caller destructures those exact names. `markSent` args are a superset of the original (additive optional fields) so no existing caller breaks.

**Placeholder scan:** No TBD/TODO. The only values the engineer must supply from outside the repo are the real Meta credentials (pre-flight) and the `TEMPLATE_REGISTRY` Meta template names (Task 9) — both are concrete instructions, not placeholders.

**Known follow-ups (out of scope, do not block):** the `sendEmail` placeholder in `message-composer.tsx:91` still aliases the WhatsApp action — pre-existing, untouched. Permanent-token refresh is deferred until a token actually expires (spec risk #1).
