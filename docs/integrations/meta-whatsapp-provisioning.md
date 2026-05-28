# Meta WhatsApp Cloud API — External Provisioning Guide

Everything you must set up **on Meta's side** (and the env vars to wire back) before the multi-tenant WhatsApp feature works in production. The code is already shipped; this is the out-of-band configuration it depends on.

**Who does this:** whoever owns the company's Meta Business account (a developer + someone with Business Admin rights).
**Time:** ~1–3 weeks, gated almost entirely on Meta **App Review**. Start Phase 1 immediately; Phases 2–4 can be built/tested against a test WABA while review is pending.
**Outcome:** clients can click "Connect WhatsApp Business" in Settings → Messaging → WhatsApp, complete Meta's popup, and the app sends/receives on their own number.

---

## How the code uses Meta (so the setup makes sense)

| Code touchpoint | File | What it calls |
|---|---|---|
| Embedded Signup popup | `app/dashboard/settings/messaging/whatsapp/_components/connect-button.tsx` | FB JS SDK `FB.login` with `config_id`, `feature: "whatsapp_embedded_signup"`, `sessionInfoVersion: "3"`, SDK `version: "v22.0"` |
| Token exchange + long-lived upgrade | `convex/lib/meta.ts` → `exchangeCodeForToken`, `exchangeForLongLivedToken` | `GET /{v}/oauth/access_token` (code grant, then `fb_exchange_token`) |
| Subscribe app to the client's WABA | `convex/lib/meta.ts` → `subscribeAppToWaba` | `POST /{v}/{waba-id}/subscribed_apps` |
| Read WABA + phone details | `convex/lib/meta.ts` → `fetchWabaDetails` | `GET /{v}/{waba-id}?fields=name,phone_numbers{...}` |
| Send messages | `convex/lib/meta.ts` → `sendCloudText` / `sendCloudTemplate` | `POST /{v}/{phone-number-id}/messages` |
| Receive inbound + delivery/cost | `convex/http.ts` → route `/whatsapp/webhook` | Meta calls **our** webhook (GET verify, POST events) |

`{v}` is the Graph API version, default **`v22.0`** (`META_GRAPH_API_VERSION`).

Required permissions: **`whatsapp_business_management`**, **`whatsapp_business_messaging`**, **`business_management`**.

---

## Phase 1 — Business Manager, Tech Provider, and the App (start now)

1. **Meta Business Manager** — use or create one at <https://business.facebook.com>. Complete **Business Verification** (Business Settings → Security Center). Unverified businesses are capped at very low messaging limits and cannot get Advanced Access.
2. **Tech Provider status** — because clients bring *their own* WABA via Embedded Signup, your business acts as a Solution/Tech Provider. In Business Settings this is implicit once your app uses Embedded Signup; no separate "Tech Provider" toggle is required, but your **business must be verified**.
3. **Create a Developer App** — <https://developers.facebook.com/apps> → Create App → type **Business**. Note the **App ID** and **App Secret** (App Settings → Basic). The App Secret is sensitive — server-side only.
4. Add a **Privacy Policy URL** and **App Domains** (App Settings → Basic). Required for App Review.

➜ Captures: `META_APP_ID`, `META_APP_SECRET`.

---

## Phase 2 — Add WhatsApp + request permissions

1. In the App dashboard → **Add Product** → **WhatsApp** (WhatsApp Business Platform).
2. The product gives you a **test WABA + test number** automatically — use this for development before review completes.
3. Go to **App Review → Permissions and Features** and request **Advanced Access** for:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `business_management`
4. Submit for **App Review** with screencasts/notes describing the Embedded Signup onboarding and message-sending flows. This is the ~1–3 week gate. Until approved you have **Standard Access** (works only with your own test WABA and admins of the app).

> You can build and test Phases 3–6 against the test WABA with Standard Access. Real client onboarding needs Advanced Access (post-approval).

---

## Phase 3 — Embedded Signup configuration

1. App dashboard → **WhatsApp → Embedded Signup** (a.k.a. "Configurations").
2. Create a **configuration**. Set it up for businesses to **create or connect their own WABA + phone number**, and grant your app `whatsapp_business_management` + `whatsapp_business_messaging`.
3. Copy the generated **Configuration ID**.

➜ Captures: `META_CONFIG_ID` (and its public twin `NEXT_PUBLIC_META_CONFIG_ID` — same value, exposed to the browser for the FB SDK).

The browser calls (already coded):
```js
FB.login(cb, {
  config_id: NEXT_PUBLIC_META_CONFIG_ID,
  response_type: "code",
  override_default_response_type: true,
  extras: { feature: "whatsapp_embedded_signup", sessionInfoVersion: "3" },
});
```
Add your app's domain to **Allowed Domains** for the JS SDK (App Settings → Basic → App Domains, and Facebook Login settings if prompted), including `http://localhost:3000` for local dev.

---

## Phase 4 — Create the message templates

Business-initiated outreach must use **pre-approved templates** (free-form text only delivers inside the 24-hour customer-service window). The code maps internal types to Meta templates in `TEMPLATE_REGISTRY` (`convex/whatsapp.ts`). **The template `name` and `language` in Meta must match the registry exactly, and the body's numbered variables must match the param order.**

Create each below in **WhatsApp Manager → Message Templates → Create** (or App dashboard → WhatsApp → Manage templates). Language: **English → code `en`** (see the language gotcha below). Variables are `{{1}}`, `{{2}}`, … in the param order shown.

| Template name (exact) | Params in order → variables | Suggested body |
|---|---|---|
| `shortlist_notification` | name {{1}}, position {{2}}, school {{3}} | `Dear {{1}}, your profile has been shortlisted for the {{2}} position at {{3}}. Our team will contact you shortly with next steps.` |
| `demo_schedule` | name {{1}}, date {{2}}, time {{3}}, topic {{4}}, classLevel {{5}}, address {{6}}, school {{7}} | `Dear {{1}}, your demo lesson is scheduled.\nDate: {{2}}  Time: {{3}}\nTopic: {{4}}  Class: {{5}}\nAddress: {{6}}\nRegards, {{7}}` |
| `feedback_request` | name {{1}}, feedbackUrl {{2}} | `Dear {{1}}, please share feedback on the demo lesson here: {{2}}` |
| `offer_notification` | name {{1}}, position {{2}}, school {{3}}, deadline {{4}} | `Dear {{1}}, congratulations! We are pleased to offer you the {{2}} position at {{3}}. Please respond by {{4}}.` |
| `rejection_notification` | name {{1}}, position {{2}}, school {{3}} | `Dear {{1}}, thank you for your interest in the {{2}} role at {{3}}. We have decided to proceed with other candidates and wish you the best.` |

Notes:
- You may reword the bodies freely **as long as the number and order of `{{n}}` variables match the param list** — the code fills them positionally.
- Meta auto-assigns each template a **category** (utility / marketing / authentication). These transactional messages should land as **utility**; if Meta flags one as marketing, it still works but bills at the higher marketing rate (see `docs/integrations/meta-pricing.md`).
- Templates need their own Meta approval (usually minutes to a few hours), separate from App Review.
- **Per-client caveat:** templates live on each WABA. With Embedded Signup, each client connects their own WABA, so these templates must exist on **each client's** WABA. If you self-onboard clients you create them; otherwise document the required template set for clients, or script template creation via `POST /{waba-id}/message_templates` after connect (future enhancement — not yet in code).

### Language gotcha
The code sends `language: { code: "en" }`. If you create templates as **"English (US)"** (code `en_US`) instead of **"English"** (`en`), sends will fail with a template-language mismatch. Either create them as plain **English (`en`)**, or update `languageCode` in `TEMPLATE_REGISTRY` (`convex/whatsapp.ts`) to match.

---

## Phase 5 — Environment variables

Two homes: **Convex** (server runtime — never exposed) and **Next.js / Vercel** (`NEXT_PUBLIC_*` reach the browser). The canonical list is in `.env.local.example`.

### 5a. Generate the encryption key
```bash
openssl rand -base64 32
```
This is `WHATSAPP_ENCRYPTION_KEY` — AES-256-GCM key for the per-school access tokens. **Convex only. Never put it in `NEXT_PUBLIC_*` or client env.** Losing/rotating it makes existing stored tokens undecryptable (every school must reconnect).

### 5b. Set Convex env (server side)
```bash
bunx convex env set META_APP_ID "<app-id>"
bunx convex env set META_APP_SECRET "<app-secret>"
bunx convex env set META_CONFIG_ID "<embedded-signup-config-id>"
bunx convex env set META_GRAPH_API_VERSION "v22.0"
bunx convex env set META_WEBHOOK_VERIFY_TOKEN "<random-string-you-invent>"
bunx convex env set WHATSAPP_ENCRYPTION_KEY "<output-of-openssl-above>"
```
`META_WEBHOOK_VERIFY_TOKEN` is any random string you choose; you'll paste the same value into Meta's webhook config in Phase 6.

### 5c. Set Next.js / Vercel env (client side)
Add to `.env.local` (dev) and the Vercel project (prod):
```bash
NEXT_PUBLIC_META_APP_ID=<app-id>
NEXT_PUBLIC_META_CONFIG_ID=<embedded-signup-config-id>
```
(Same values as `META_APP_ID` / `META_CONFIG_ID`; the public copies are what the browser FB SDK reads. The App **Secret** is never public.)

### Reference: every variable

| Variable | Home | Purpose |
|---|---|---|
| `META_APP_ID` | Convex | OAuth client id for token exchange |
| `META_APP_SECRET` | Convex | OAuth client secret + webhook HMAC verification |
| `META_CONFIG_ID` | Convex | (kept for parity; signup uses the public copy) |
| `META_GRAPH_API_VERSION` | Convex | Graph version, `v22.0` |
| `META_WEBHOOK_VERIFY_TOKEN` | Convex | Echoed back on the GET webhook handshake |
| `WHATSAPP_ENCRYPTION_KEY` | Convex **only** | AES-256-GCM key for stored tokens |
| `NEXT_PUBLIC_META_APP_ID` | Next/Vercel | FB SDK `FB.init({ appId })` |
| `NEXT_PUBLIC_META_CONFIG_ID` | Next/Vercel | FB SDK `config_id` for Embedded Signup |

---

## Phase 6 — Configure the webhook

Meta must call our Convex HTTP endpoint. The route is registered at **`/whatsapp/webhook`** (`convex/http.ts`), served from the Convex **`.convex.site`** domain (not `.convex.cloud`).

1. **Find your Convex site URL.** Convex dashboard → your deployment → **Settings → URL and Deploy Key → HTTP Actions URL**. It looks like `https://<deployment-name>.convex.site`. (Dev and prod deployments each have their own.)
   - Full callback URL: `https://<deployment-name>.convex.site/whatsapp/webhook`
2. App dashboard → **WhatsApp → Configuration → Webhook → Edit**:
   - **Callback URL:** the URL above.
   - **Verify token:** the exact `META_WEBHOOK_VERIFY_TOKEN` you set in Phase 5b.
   - Click **Verify and Save**. Meta sends a GET handshake; our route echoes `hub.challenge` when the token matches.
3. **Subscribe to webhook fields:** subscribe to **`messages`** (covers inbound messages + delivery/read/pricing statuses).

> Per-WABA subscription is automatic: when a client connects, `subscribeAppToWaba` calls `POST /{waba-id}/subscribed_apps` so their WABA forwards events to your app. You still must configure the **app-level callback URL** once, here.

Quick manual handshake check (after env is set + deployed):
```bash
SITE="https://<deployment-name>.convex.site"
TOKEN="<your META_WEBHOOK_VERIFY_TOKEN>"
curl -s "$SITE/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=$TOKEN&hub.challenge=ping123"
# expect: ping123   (a wrong token returns "forbidden")
```

---

## Phase 7 — End-to-end verification

With Convex + Next running (`bunx convex dev`, `bun run dev`) and the above in place:

1. **Connect:** Settings → Messaging → WhatsApp → **Connect WhatsApp Business**. Complete the Meta popup with a (test or real) WABA. The card should flip to "Connected — <business name>" with the number.
   - Convex dashboard → `whatsappIntegrations`: a row with `status: "active"`, a non-empty `accessTokenCipher`, and the `phoneNumberId`.
2. **Send:** trigger outreach to a candidate (e.g. a shortlist) whose phone is a real WhatsApp number. Confirm it arrives **from the connected number**. Business-initiated sends use the templates from Phase 4.
3. **Receive:** reply from the phone. Within ~the 24h window the reply appears in the inbox (conversation agent), inserted by `recordInbound`.
4. **Cost:** after ~30s the delivery/pricing status webhook fires → the `outreachMessages` row gains `metaCostUsd` + `billableUsd`, and `whatsappUsage` for the month increments. The Usage card on the settings page reflects it.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Webhook "Verify and Save" fails | Token mismatch (env vs Meta), or wrong domain — must be `.convex.site`, not `.convex.cloud`. Re-check `META_WEBHOOK_VERIFY_TOKEN`. |
| Connect popup opens then nothing stored | `NEXT_PUBLIC_META_CONFIG_ID` / `NEXT_PUBLIC_META_APP_ID` unset or app domain not allow-listed. Check the browser console. |
| Connect fails server-side; integration shows `error` | Token exchange failed — verify `META_APP_ID` / `META_APP_SECRET` in **Convex** env, and that the app has WhatsApp product + (for real WABAs) Advanced Access. The error text is on `whatsappIntegrations.lastErrorMessage`. |
| Sends fail with template errors | Template not approved, name mismatch, or language mismatch (`en` vs `en_US`). Cross-check `TEMPLATE_REGISTRY`. |
| Inbound replies never appear | App-level webhook callback not configured, or `messages` field not subscribed, or the reply came outside any matched outbound window. |
| Costs never populate | `messages` field not subscribed (status events ride the same field), or recipient country missing from the price table (it logs a warning and bills at US rates — see `docs/integrations/meta-pricing.md`). |
| Token expired after weeks | Tokens are upgraded to long-lived best-effort; if one still expires, sends fail and the integration flips to `error` — the client just reconnects. |

## Related
- Pricing table + refresh process: `docs/integrations/meta-pricing.md`
- Design + rationale: `docs/superpowers/specs/2026-05-28-multi-tenant-whatsapp-cloud-api-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-28-multi-tenant-whatsapp-cloud-api.md`
