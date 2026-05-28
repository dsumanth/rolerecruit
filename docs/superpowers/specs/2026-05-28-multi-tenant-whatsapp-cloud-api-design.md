# Multi-tenant WhatsApp Cloud API (Embedded Signup + per-message cost tracking)

**Status:** Draft for review
**Date:** 2026-05-28
**Scope:** UI + backend. Billing infrastructure deferred (lands when payment provider is integrated).

---

## Context

Today we send WhatsApp from a single Gupshup number shared across all schools (`GUPSHUP_API_KEY`, `GUPSHUP_APP_NAME`, `GUPSHUP_SOURCE_NUMBER` in env). This blocks signing multiple clients because:

1. Every school's outbound messages come from the same `+91XXXXX` — recipients see "RoleRecruit" not "Greenfield International School".
2. We pay Gupshup's per-number platform fee + per-message markup; at scale (10+ clients) those fees compound while giving us no leverage.
3. We have no visibility into Meta's actual per-message cost (utility vs marketing vs free service window) because Gupshup abstracts pricing into their own rate card.
4. Compliance: each school's candidates legitimately belong on that school's WABA, not on a third party's shared infra.

We want each school to bring their own WhatsApp Business Account (WABA) + phone number, connect it once via Meta's Embedded Signup popup, and have all outreach flow through `graph.facebook.com` using their access token. We persist Meta's per-message cost + our markup per row so that when a payment provider lands, invoicing is a join away.

Decisions locked from brainstorming:
- **Onboarding:** Embedded Signup (popup). Manual paste-token is not a fallback — we'll wait on Meta Tech Provider app review.
- **Migration:** Clean cutover. Gupshup goes away in the same change.
- **Markup model:** Percentage on top of Meta cost, configurable per school (default 20%). Each `outreachMessages` row stores `metaCostUsd`, `markupPct`, `billableUsd`.

---

## Out-of-band gating dependency (call out first)

**You must register as a Meta Tech Provider before any of this works in production.** This is a 1–3 week review by Meta and cannot be parallelized with shipping. Steps (do in parallel with Phase 1 engineering):

1. Create/use a Meta Business Manager account.
2. Apply for **Tech Provider** status (Business Manager → Business Info → Add new role).
3. Create a Meta Developer App with the **WhatsApp Business Platform** product.
4. Request permissions: `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management`.
5. Submit App Review with verified business + privacy policy URL.
6. Create an **Embedded Signup Configuration** in the WhatsApp product (saves a `config_id`).
7. Capture: `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID`, `META_GRAPH_API_VERSION` (pin to `v22.0`).

A test WABA on the developer's own Meta account works for Phase 1–3 development.

---

## Architecture

### Tenant model (existing, no change)

- **Tenant unit:** `schools` table ([convex/schema.ts:19](convex/schema.ts:19)).
- **User → tenant:** `userProfiles.schoolId` ([convex/schema.ts:85](convex/schema.ts:85)).
- **Auth:** Better Auth via `@convex-dev/better-auth` ([convex/auth.ts:1](convex/auth.ts:1)). Identity in actions comes from passing `userId` from the client; tenant resolution = `userProfiles.by_userId` lookup.

### New tables

**`whatsappIntegrations`** (1:1 with schools, separate table because of credential lifecycle):

```ts
whatsappIntegrations: defineTable({
  schoolId: v.id("schools"),
  status: v.union(
    v.literal("not_connected"),
    v.literal("pending"),       // user clicked Connect, awaiting Meta callback
    v.literal("active"),
    v.literal("disconnected"),
    v.literal("error"),
  ),
  // Meta identifiers
  wabaId: v.optional(v.string()),              // WhatsApp Business Account ID
  phoneNumberId: v.optional(v.string()),       // used in Graph API URLs
  displayPhoneNumber: v.optional(v.string()),  // E.164 for UI
  businessName: v.optional(v.string()),
  verifiedName: v.optional(v.string()),
  // Encrypted system user access token (AES-256-GCM)
  accessTokenCipher: v.optional(v.string()),   // base64
  accessTokenIv: v.optional(v.string()),       // base64
  accessTokenTag: v.optional(v.string()),      // base64 (GCM auth tag)
  // Lifecycle
  connectedAt: v.optional(v.number()),
  disconnectedAt: v.optional(v.number()),
  lastErrorAt: v.optional(v.number()),
  lastErrorMessage: v.optional(v.string()),
  // Markup config
  markupPct: v.number(),                       // default 20 (= 20%)
})
  .index("by_schoolId", ["schoolId"])
  .index("by_phoneNumberId", ["phoneNumberId"])  // critical for webhook routing
  .index("by_wabaId", ["wabaId"]),
```

**`whatsappUsage`** (rolling monthly aggregates for billing-later):

```ts
whatsappUsage: defineTable({
  schoolId: v.id("schools"),
  periodStart: v.number(),       // first day of UTC month, unix ms
  messageCount: v.number(),
  utilityCount: v.number(),
  marketingCount: v.number(),
  authenticationCount: v.number(),
  serviceCount: v.number(),      // free 24h-window messages
  metaCostUsdTotal: v.number(),
  billableUsdTotal: v.number(),
  updatedAt: v.number(),
})
  .index("by_schoolId_periodStart", ["schoolId", "periodStart"]),
```

### Extend `outreachMessages`

Add to existing table ([convex/schema.ts:526](convex/schema.ts:526)):

```ts
// Meta-specific
metaMessageId: v.optional(v.string()),       // wamid.HBgN...
metaConversationId: v.optional(v.string()),  // from pricing webhook
metaCategory: v.optional(v.union(
  v.literal("utility"),
  v.literal("marketing"),
  v.literal("authentication"),
  v.literal("service"),
)),
metaPricingModel: v.optional(v.string()),    // e.g. "CBP", "PMP"
// Cost snapshot at send + status time
metaCostUsd: v.optional(v.number()),         // 0 for free service window
markupPct: v.optional(v.number()),           // stored as percent integer, e.g. 20 means +20%
billableUsd: v.optional(v.number()),         // = metaCostUsd * (1 + markupPct/100)
costCurrency: v.optional(v.string()),        // "USD"
```

Add indexes: `by_metaMessageId`, `by_schoolId_sentAt` (the latter for usage rollup queries).

### Code layout

```
convex/
├── whatsapp.ts              # rewrite — Meta Cloud API send only
├── whatsappIntegration.ts   # new — embedded signup completion, connect/disconnect, status query
├── whatsappWebhook.ts       # new — internal mutations called from Next API route
├── whatsappUsage.ts         # new — period rollup, usage queries
├── lib/
│   ├── meta.ts              # new — Graph API client (fetch wrapper + error mapping)
│   ├── metaPricing.ts       # new — static price table by category × country
│   ├── crypto.ts            # new — AES-256-GCM encrypt/decrypt for tokens
│   └── phone.ts             # existing (no change)
├── outreach.ts              # refactor — delete inline Gupshup call at lines 246–273; delegate to whatsapp.ts
├── http.ts                  # remove /whatsapp/inbound (Gupshup route)
└── schema.ts                # extend (above)

app/api/webhooks/meta/whatsapp/route.ts   # new — GET verify + POST signature check + dispatch

app/dashboard/settings/messaging/whatsapp/
├── page.tsx                  # new — Connect card, connected state, usage summary
└── _components/
    ├── ConnectButton.tsx     # FB SDK + completion flow
    ├── ConnectedCard.tsx     # business name, phone, markup editor, Disconnect
    └── UsageSummary.tsx      # current period + last 6 months

components/settings/whatsapp-config.tsx   # delete (replaced)
```

### Embedded Signup runtime flow

```
[Client]                           [Convex action]              [Meta Graph]
   │                                     │                            │
   │ FB.login({config_id, response_type=code, extras: {              │
   │   feature: "whatsapp_embedded_signup", sessionInfoVersion:"3"}})│
   │ user picks WABA + phone number in Meta popup                    │
   │ ◀──────── { code, sessionInfo: { wabaId, phoneNumberId } } ─────┤
   │                                                                  │
   │ ──── completeEmbeddedSignup({code, wabaId, phoneNumberId}) ────▶ │
   │                                     │                            │
   │                                     │ GET /v22.0/oauth/access_token
   │                                     │   ?client_id&client_secret&code
   │                                     │ ─────────────────────────▶│
   │                                     │ ◀────── {access_token} ───┤
   │                                     │                            │
   │                                     │ POST /v22.0/{waba}/subscribed_apps
   │                                     │   (Bearer access_token)   │
   │                                     │ ─────────────────────────▶│
   │                                     │                            │
   │                                     │ GET /v22.0/{wabaId}        │
   │                                     │   ?fields=name,id,phone_numbers
   │                                     │ ─────────────────────────▶│
   │                                     │ ◀── {name, phone_numbers}─┤
   │                                     │                            │
   │                                     │ encrypt(access_token)      │
   │                                     │ db.insert(whatsappIntegrations,
   │                                     │   status="active", ...)    │
   │ ◀──────────── { ok: true } ─────────┤                            │
```

The client opens the FB SDK only on the settings/messaging/whatsapp page (lazy-loaded `<Script>`). The Convex action does all token exchange + storage — the raw `code` is never persisted, the access token never leaves Convex unencrypted.

### Send flow (replaces Gupshup)

`convex/whatsapp.ts` `sendWhatsAppMessage` action:

1. Resolve school: `userProfiles.by_userId` → `schoolId`. (Or `applicationId → application.schoolId` for system-triggered sends.)
2. Fetch `whatsappIntegrations.by_schoolId`. If `status !== "active"`, throw `WHATSAPP_NOT_CONNECTED`.
3. Decrypt access token in-memory.
4. `POST https://graph.facebook.com/v22.0/{phoneNumberId}/messages`
   - Body: `{ messaging_product: "whatsapp", to, type: "text", text: { body } }` for free-form (inside 24h reply window) or `{ type: "template", template: {...} }` for outbound-initiated.
   - Header: `Authorization: Bearer {accessToken}`
5. Insert `outreachMessages` with `metaMessageId`, `markupPct` (snapshot from integration), cost fields left undefined.
6. Cost fields get populated by the status webhook (see below).

`convex/outreach.ts:246–273` currently inlines a duplicate Gupshup fetch. Delete that, route through `internal.whatsapp.sendMessage`.

### Receive + status flow (webhook)

`app/api/webhooks/meta/whatsapp/route.ts`:

- **GET** (verification handshake):
  ```
  if (searchParams.get("hub.mode") === "subscribe" &&
      searchParams.get("hub.verify_token") === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(searchParams.get("hub.challenge"), { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
  ```
- **POST** (events):
  1. Read raw body.
  2. Verify `x-hub-signature-256` HMAC-SHA256 against `META_APP_SECRET`. Reject 401 on mismatch.
  3. Parse `entry[].changes[].value`. For each change:
     - `messages[]` (inbound text/media): call `internal.whatsappWebhook.handleInbound` with `phoneNumberId` + message payload.
     - `statuses[]` (delivery/pricing): call `internal.whatsappWebhook.handleStatus` with `phoneNumberId` + `metaMessageId` + `pricing` object.
  4. Return `200` immediately. Meta retries on non-2xx, so failures fan into the mutation, not the HTTP handler.

`internal.whatsappWebhook.handleStatus` resolves the school via `whatsappIntegrations.by_phoneNumberId`, looks up the row by `metaMessageId`, computes cost via `metaPricing.lookup({ category, countryFromPhone, pricingModel })`, writes `metaCostUsd / markupPct / billableUsd`, and increments the current-month `whatsappUsage` aggregate.

`internal.whatsappWebhook.handleInbound` mirrors today's `findCandidateLatestOutbound` + `handleInboundMessage` flow ([convex/whatsapp.ts:106](convex/whatsapp.ts:106), [convex/whatsapp.ts:161](convex/whatsapp.ts:161)) — but resolves school context from `phoneNumberId` first instead of phone-scanning all candidates.

### Encryption

`convex/lib/crypto.ts` — Convex Node runtime gives us `node:crypto`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALG = "aes-256-gcm";
const keyB64 = process.env.WHATSAPP_ENCRYPTION_KEY!;  // 32 bytes base64

export function encrypt(plaintext: string) {
  const key = Buffer.from(keyB64, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { cipher: enc.toString("base64"), iv: iv.toString("base64"), tag: tag.toString("base64") };
}

export function decrypt({ cipher, iv, tag }: ReturnType<typeof encrypt>) {
  const key = Buffer.from(keyB64, "base64");
  const d = createDecipheriv(ALG, key, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(cipher, "base64")), d.final()]).toString("utf8");
}
```

Key is generated once: `openssl rand -base64 32` → set as `WHATSAPP_ENCRYPTION_KEY` in Convex env (NOT Next.js env — it never goes client-side).

### Pricing lookup (no live API)

Meta doesn't return raw cost in webhooks — only `pricing.category` + `pricing.pricing_model`. We maintain a static table in `convex/lib/metaPricing.ts`:

```ts
// USD per message, sourced from Meta WhatsApp Pricing docs (refresh quarterly)
export const META_PRICES_USD: Record<string, Record<string, number>> = {
  US: { utility: 0.014, marketing: 0.025, authentication: 0.0135, service: 0 },
  IN: { utility: 0.0014, marketing: 0.0073, authentication: 0.0014, service: 0 },
  // ... add countries as schools onboard
};

export function lookupCost({ countryCode, category }: { countryCode: string; category: string }): number {
  return META_PRICES_USD[countryCode]?.[category] ?? META_PRICES_USD.US[category] ?? 0;
}
```

Service (`pricing.category === "service"`) is always `0` since Meta's Nov 2024 free-window change. Country is derived from the recipient's E.164 country code via `libphonenumber-js` (already a dep, used in [convex/lib/phone.ts:1](convex/lib/phone.ts:1)).

A **`docs/integrations/meta-pricing.md`** file documents the refresh process: when Meta announces a price change (their developer changelog), update the table + bump a `META_PRICES_VERSION` comment.

---

## UI

Add a new settings section. Follow the existing pattern from [components/settings/calendar-config-form.tsx:34](components/settings/calendar-config-form.tsx:34) (OAuth connect) and [components/settings/custom-domain-manager.tsx:85](components/settings/custom-domain-manager.tsx:85) (multi-state lifecycle).

### `app/dashboard/settings/messaging/whatsapp/page.tsx`

Three states, one page:

**Not connected:**
```
┌─ Card ────────────────────────────────────────────┐
│  WhatsApp Business Account                        │
│  Connect your school's WhatsApp number to send    │
│  candidate outreach from your own brand.          │
│                                                   │
│  [ Connect WhatsApp Business ]   ← FB.login()    │
└───────────────────────────────────────────────────┘
```

**Pending (callback in flight):**
```
┌─ Card ────────────────────────────────────────────┐
│  ◐  Completing setup with Meta...                 │
└───────────────────────────────────────────────────┘
```

**Active:**
```
┌─ Card ────────────────────────────────────────────┐
│  ● Connected — Greenfield International School    │
│    +91 98765 43210                                │
│    Connected May 28, 2026                         │
│                                                   │
│    Markup [ 20 ]%  ← editable, mutation on blur  │
│                                                   │
│    [ Send test message ]    [ Disconnect ]        │
└───────────────────────────────────────────────────┘

┌─ Card ─ Usage this month ─────────────────────────┐
│  Messages sent     1,247                          │
│  Meta cost         $17.46                         │
│  Billable          $20.95   (20% markup)          │
│  Free service      312 (25%)                      │
│                                                   │
│  By category:                                     │
│   Utility    819   $11.47                         │
│   Marketing   89   $2.23                          │
│   Auth        27   $0.36                          │
│   Service    312   $0.00 (free window)            │
│                                                   │
│  Last 6 months ▾                                  │
│                                                   │
│  ⓘ Billing will be available once payment        │
│    provider is integrated.                        │
└───────────────────────────────────────────────────┘
```

**Error:**
```
┌─ Card ────────────────────────────────────────────┐
│  ⚠ Connection error                               │
│    {lastErrorMessage}                             │
│    [ Reconnect ]                                  │
└───────────────────────────────────────────────────┘
```

Wire into existing nav via `components/settings/settings-nav.tsx` ITEMS array — add `{ href: "/dashboard/settings/messaging/whatsapp", label: "WhatsApp", icon: "MessageCircle" }`.

### FB SDK integration (`ConnectButton.tsx`)

```tsx
"use client";
import Script from "next/script";

declare global { interface Window { FB: any; fbAsyncInit: any; } }

export function ConnectButton({ schoolId }: { schoolId: Id<"schools"> }) {
  const complete = useAction(api.whatsappIntegration.completeEmbeddedSignup);

  const onClick = () => {
    window.FB.login(
      (response: any) => {
        if (response.authResponse?.code) {
          // sessionInfo arrives via window.addEventListener("message", ...) — see Meta docs
          complete({ schoolId, code: response.authResponse.code, sessionInfo });
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
    <>
      <Script src="https://connect.facebook.net/en_US/sdk.js" strategy="lazyOnload"
        onLoad={() => window.FB.init({ appId: process.env.NEXT_PUBLIC_META_APP_ID, version: "v22.0", xfbml: false })} />
      <Button onClick={onClick}>Connect WhatsApp Business</Button>
    </>
  );
}
```

The `sessionInfo` payload (wabaId, phoneNumberId, businessId) arrives asynchronously via `postMessage` from the popup — listen in a `useEffect` and merge into the `complete` call.

---

## Error handling

| Failure | Behavior |
|---|---|
| FB.login user cancels | No-op, button stays as "Connect" |
| Token exchange fails | `status = "error"`, `lastErrorMessage = err.message`, UI shows Reconnect |
| Token expired during send | Catch 401 from Graph, set `status = "error"`, fail the send, return user-facing "Reconnect WhatsApp" |
| Webhook signature mismatch | 401, no DB write, logged for monitoring |
| Webhook missing `phoneNumberId` mapping | Log warning, 200 (don't make Meta retry indefinitely) |
| Status webhook for unknown `metaMessageId` | Log, 200 — message may have been sent outside our system |
| `metaPricing.lookup` returns 0 for non-service category | Use `US` fallback, log warning so we can extend the table |

---

## Testing

**Unit (Vitest, follows existing `tests/convex/*.test.ts` pattern):**

- `tests/convex/crypto.test.ts` — encrypt/decrypt roundtrip; tampered ciphertext throws; wrong key throws.
- `tests/convex/metaPricing.test.ts` — lookup by category × country, US fallback, service = 0.
- `tests/convex/whatsappWebhook.test.ts` — signature verify (good + tampered), handleStatus updates row + usage rollup, handleInbound resolves school via phoneNumberId.
- `tests/convex/whatsappIntegration.test.ts` — completeEmbeddedSignup with mocked Graph (`vi.spyOn(global, "fetch")`): exchanges code, subscribes apps, persists encrypted token, sets `status = "active"`. Disconnect path clears credentials.
- `tests/convex/whatsapp.test.ts` — send path: requires active integration, posts to correct URL with bearer, inserts outreachMessages with markupPct snapshot.

**Integration (manual until we have a sandbox):**

1. Set up Meta dev WABA, point webhook at ngrok tunnel.
2. Click Connect → complete Embedded Signup → confirm `whatsappIntegrations` row with `status = "active"`.
3. Send template message from app → confirm WhatsApp delivery on a real phone.
4. Confirm status webhook arrives → row in `outreachMessages` has `metaCostUsd`, `billableUsd` populated.
5. Reply from phone → confirm inbound message persists → conversation agent triggers (existing behavior).
6. Inspect `whatsappUsage` for current month — counts match.

---

## Verification end-to-end

After implementation, run from `apps/Rolerecruit`:

```bash
bun test tests/convex/crypto.test.ts \
         tests/convex/metaPricing.test.ts \
         tests/convex/whatsappWebhook.test.ts \
         tests/convex/whatsappIntegration.test.ts \
         tests/convex/whatsapp.test.ts
bun run dev   # spin up Next.js
bunx convex dev   # spin up Convex
```

In a browser at `localhost:3000/dashboard/settings/messaging/whatsapp`:
1. Connect a Meta dev WABA via the popup (uses sandbox config_id).
2. Open Convex dashboard → `whatsappIntegrations` row exists with `status: "active"`.
3. Trigger a send from the candidates page → message arrives on test phone.
4. Reply from phone → reply appears in inbox (existing `conversation.ts` flow).
5. After ~30s, status webhook fires → re-open the `outreachMessages` row → `metaCostUsd` and `billableUsd` are populated.

---

## Phasing

Six phases. Clean cutover (no feature flag) — phases 1–3 build new modules in isolation while the existing Gupshup send path in `convex/outreach.ts:246–273` and `convex/whatsapp.ts` stays untouched. Phase 6 swaps the call site at `outreach.ts` over to the new path and deletes Gupshup in a single commit.

1. **Schema + crypto + pricing + Meta client.** Adds new tables + libs, no behavior change. Tests pass.
2. **Send path** (`convex/whatsapp.ts` rewrite preserved as `convex/whatsappCloud.ts` until phase 6 to keep the existing `whatsapp.ts` Gupshup callable). New module isn't called from anywhere yet.
3. **Webhook + receive path** (`app/api/webhooks/meta/whatsapp/route.ts`, `convex/whatsappWebhook.ts`). New route, not yet exercised by any connected WABA.
4. **Embedded Signup UI.** Settings page + ConnectButton + ConnectedCard. Connecting works end-to-end in dev (your own WABA can connect; sends still go via Gupshup because outreach.ts hasn't been swapped yet — dev verifies the connect/webhook plumbing).
5. **Usage UI.** UsageSummary card, markup editor. Wired to `whatsappUsage` rows which won't accumulate until phase 6, so the dev experience here is empty-state-first.
6. **Cutover (single commit).** Rename `whatsappCloud.ts` → `whatsapp.ts` (replacing old file), swap `convex/outreach.ts:246–273` to call the new send path, delete `convex/http.ts` `/whatsapp/inbound` Gupshup route, remove `GUPSHUP_*` env vars from `.env.local.example`, delete `components/settings/whatsapp-config.tsx`.

Billing comes later as a separate spec — when payment provider lands, it's a query over `outreachMessages.billableUsd` joined to `whatsappUsage`.

---

## Open risks / decisions deferred

1. **Permanent token expiry.** System User tokens via Embedded Signup are supposed to be non-expiring, but Meta has changed this before. If a token does expire mid-flight, surface as `status = "error"` and require Reconnect. Don't build refresh until we see it happen.
2. **Multi-region pricing.** We default to US prices and add countries as schools onboard. If a school onboards from a country missing from the table, we log + use US prices, then update the table. Acceptable for v1.
3. **Per-template categorization.** Meta auto-categorizes templates as utility/marketing/auth, but allows appeals. We don't expose that flow in v1 — clients just see the category Meta assigned via the status webhook.
4. **Phone number registration PIN.** New WABAs may require a 2FA PIN on the phone number. Embedded Signup *usually* handles this in the popup, but if it doesn't we'll need a follow-up "Enter PIN" UI. Treat as known-unknown — handle if it surfaces in dev.
