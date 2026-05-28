# Outreach Conversation Agent and Pipeline Concierge (Morning Brief)

**Date:** 2026-05-28
**Status:** Approved
**Scope:** Two related backend agents shipped together because they share the same `outreachMessages` and `schools` schema extensions.

## Problem

Two gaps in the current recruiter workflow:

1. **No agent owns inbound candidate replies.** `convex/outreach.ts` only dispatches outbound (Resend + Gupshup). When a candidate replies, the message either lands in a generic inbox somewhere or, for email, gets routed through `convex/email_ingestion.ts` and treated as a brand new resume application. Recruiters end up answering FAQs ("what's the salary?", "is it CBSE?", "can we reschedule?") by hand, every time.
2. **No proactive daily summary.** `convex/dashboard.ts` exposes counts but nothing pushes a summary to the recruiter at the start of the day, and stalled candidates go silently unfollowed.

## Goals

- Ingest inbound candidate replies on both email and WhatsApp, link them to the correct application, and persist them in `outreachMessages` alongside outbound history.
- Classify each inbound reply into one of `faq`, `reschedule`, `negotiation`, `unclear`. Auto-reply on the first two when confidence is high; escalate the rest to a human Inbox.
- Send a per-school morning brief at 08:00 IST to an admin-curated list of recipients, summarising new applications, strong candidates, stalled candidates, demos today, and the Inbox queue.
- Mirror the same brief content in a dashboard widget so users in-app see the live state.
- Surface escalated conversations in two places: a dedicated Inbox tab in the dashboard, and inline on the candidate detail page.

## Non-Goals

- Slack/Teams notifications (deferred).
- Multi-language reply (English only in v1).
- Voice notes or image attachments on inbound WhatsApp.
- Auto-rescheduling that picks a new slot on the candidate's behalf. We send the booking link and let the candidate self-serve via the existing booking flow.
- Auto-sending follow-up messages to stalled candidates. v1 reports them; the recruiter clicks send.
- A separate `escalations` table. A boolean + timestamp on `outreachMessages` is sufficient at v1 scale.
- A separate `schoolFaqs` key/value table. A single markdown text field on `schools` is sufficient; the LLM handles the unstructured shape.
- Sentiment analysis or NPS scoring.
- Per-school timezone configuration. India-only product in v1, IST hardcoded.
- Per-school customisation of brief content. One template for all schools.
- Persisting morning brief emails to the DB. Convex function logs are sufficient.

---

## Decisions locked in during brainstorming

| Question | Decision |
|---|---|
| Inbound channels for v1 | Email + WhatsApp |
| FAQ knowledge source | Per-school FAQ doc (single markdown text field on `schools`) |
| Reply policy | Auto-reply when confident, escalate otherwise |
| Escalation UX | Dedicated Inbox tab + inline thread on candidate page |
| Morning brief delivery | Email + dashboard widget |
| Morning brief recipients | Admin-curated list per school (multi-select of school users) |
| Brief send time | 08:00 IST (= 02:30 UTC), daily |
| Stalled follow-up | Detect and report only, no auto-send. One-click send button in the brief and widget |

---

## Section 1: Schema changes

All additions use `v.optional()` so existing rows continue to validate (per the project's schema migration rule).

### `outreachMessages` extensions
```ts
direction: v.optional(v.union(v.literal("outbound"), v.literal("inbound"))),
schoolId: v.optional(v.id("schools")),
replyToken: v.optional(v.string()),
inReplyToMessageId: v.optional(v.id("outreachMessages")),
intent: v.optional(v.union(
  v.literal("faq"),
  v.literal("reschedule"),
  v.literal("negotiation"),
  v.literal("unclear"),
)),
confidence: v.optional(v.number()),
escalated: v.optional(v.boolean()),
escalationReason: v.optional(v.string()),
resolvedAt: v.optional(v.number()),
processedAt: v.optional(v.number()),
```

Extend `type` union: add `"candidate_reply"`, `"agent_reply"`.
Extend `draftedBy` union: add `"conversation_agent"`.

New indexes:
- `by_replyToken` on `["replyToken"]` for inbound email matching.
- `by_schoolId_escalated` on `["schoolId", "escalated"]` for the Inbox tab listing.

Rationale for denormalising `schoolId` onto every row: the Inbox query needs to be cheap and per-school. Joining through `applications` on every page load is wasteful when the field is immutable per row.

### `schools` extensions
```ts
faqContent: v.optional(v.string()),
morningBriefRecipientUserIds: v.optional(v.array(v.string())),
conversationAgentEnabled: v.optional(v.boolean()),
morningBriefEnabled: v.optional(v.boolean()),
```

`faqContent` is freeform markdown. The school admin writes whatever they want (school timings, leave policy, transport, joining bonus, hostel). The LLM uses it as context for the FAQ branch.

`morningBriefRecipientUserIds` matches `userProfiles.userId` (string, not Id). Admin-managed list. Defaults to empty, which means no email is sent and the dashboard widget shows a "configure recipients" notice.

### Reply-To token format
`reply+<32-char-lowercase-alphanumeric>@rolerecruit.com`. Token is generated per outbound email and stored in `outreachMessages.replyToken`. Inbound webhook extracts the token from the `to` field via regex, looks up the parent message, copies `applicationId/candidateId/schoolId` onto the inbound row.

---

## Section 2: File breakdown

### Feature: Conversation Agent

**New backend files** (`convex/`):

| File | Responsibility |
|---|---|
| `conversation.ts` | Top-level orchestrator. Exports `handleInbound(ctx, { messageId })`. Loads the inbound row, calls classifier, branches to handlers, persists result. |
| `conversation_classify.ts` | Single LLM call. Input: inbound text + recent thread context (last 5 messages). Output: `{ intent, confidence, summary }`. |
| `conversation_faq.ts` | FAQ branch. Pulls job + school + `faqContent`. Drafts reply with LLM. Confidence gate decides send vs escalate. |
| `conversation_reschedule.ts` | Calls existing `generateBookingToken`. Returns a templated reply with the booking URL. No LLM in the body. |
| `inbox.ts` | Queries (`listEscalated(schoolId)`, `getThread(applicationId)`) and mutations (`resolveEscalation(messageId)`, `humanReply(applicationId, body, channel)`). |
| `email_reply_router.ts` | Splits inbound email path: reply-token routes through Conversation Agent; no-token falls through to existing new-resume PDF flow in `email_ingestion.ts`. |
| `prompts/conversationClassify.ts` | System prompt for classifier. |
| `prompts/conversationFaqDraft.ts` | System prompt for FAQ drafter. |

**Edited backend files:**

| File | Change |
|---|---|
| `schema.ts` | Schema additions per Section 1. |
| `http.ts` | Add `/whatsapp/inbound` route. Re-point `/email/inbound` at the new dispatcher. |
| `email_ingestion.ts` | Keep the new-resume PDF path. Move the no-token routing decision out to `email_reply_router.ts`. |
| `whatsapp.ts` | Add `receiveWhatsApp` httpAction (Gupshup webhook shape). Phone match against `candidates`, disambiguate to most recent active outbound. |
| `outreach.ts` | Extend `createDraft` and `dispatchScheduledOutreach` to generate and persist `replyToken` on outbound email rows. Set `direction: "outbound"` and `schoolId` on every new row. |

**New frontend files:**

| File | Responsibility |
|---|---|
| `app/dashboard/inbox/page.tsx` | Inbox listing for the school. |
| `app/dashboard/inbox/[applicationId]/page.tsx` | Single thread view with reply box. |
| `components/dashboard/inbox-thread.tsx` | Reusable thread component, used by both the Inbox page and inline on the candidate detail page. |

**Edited frontend files:**

| File | Change |
|---|---|
| `components/dashboard/sidebar.tsx` | Add Inbox link with unread badge count. |
| Candidate detail page (locate during impl: under `app/dashboard/pipeline` or `app/dashboard/jobs/[id]/pipeline`) | Mount `<InboxThread>` inline when the application has any escalated messages. |
| `app/dashboard/settings/messaging/page.tsx` | Add a "FAQ content" markdown textarea field. |

### Feature: Morning Brief

**New backend files** (`convex/`):

| File | Responsibility |
|---|---|
| `morningBrief.ts` | Top-level orchestrator. Exports `sendBriefForSchool(schoolId)` and `sendAllSchools()` (cron target). |
| `morningBrief_stats.ts` | Pure data layer. Exports `collectStats(schoolId)`. Returns `{ newApps24h, strongAvailable, stalled, demosToday, escalatedInboxCount }`. |
| `morningBrief_render.ts` | Pure function. Stats in, `{ subject, htmlBody, textBody }` out. No I/O so trivially testable. |
| `prompts/morningBriefSummary.ts` | Optional one-line LLM narrative for the email opener. |

**Edited backend files:**

| File | Change |
|---|---|
| `crons.ts` | Add daily cron at 02:30 UTC calling `internal.morningBrief.sendAllSchools`. |
| `schema.ts` | Covered in Section 1. |
| `dashboard.ts` | Add `getMorningBriefStats(schoolId)` query reusing `collectStats` so the widget pulls the same data. |

**New frontend files:**

| File | Responsibility |
|---|---|
| `components/dashboard/morning-brief-widget.tsx` | In-app version of the brief. Renders the same stats. Shows "configure recipients" notice when the list is empty. |
| `app/dashboard/settings/notifications/page.tsx` | Multi-select of school users for brief recipients. (Alternative: extend `app/dashboard/settings/messaging/page.tsx` if it fits the existing nav better. Decided during implementation.) |

**Edited frontend files:**

| File | Change |
|---|---|
| `app/dashboard/page.tsx` | Mount the morning-brief widget at the top. |
| `components/dashboard/sidebar.tsx` | Add Notifications settings link. |

### Shared

| File | Responsibility |
|---|---|
| `convex/lib/stalled.ts` | Single source of truth for "stalled" definition. Used by `morningBrief_stats` and any future per-candidate badge. |

---

## Section 3: Data flow

### Inbound email reply (golden path)

1. Resend POSTs to `/email/inbound` with `to: "reply+<token>@rolerecruit.com"`.
2. `email_reply_router.ts` extracts token via regex. If no token, falls through to existing new-resume PDF path (`email_ingestion.ts`, untouched).
3. If token present, looks up parent message by `by_replyToken`.
4. Inserts a new `outreachMessages` row: `direction: "inbound"`, `type: "candidate_reply"`, copies `applicationId/candidateId/schoolId` from parent, sets `inReplyToMessageId`.
5. Schedules `internal.conversation.handleInbound({ messageId })` async. Webhook returns 200 immediately so Resend does not retry.
6. `handleInbound` loads the row, calls classifier, branches.

### Inbound WhatsApp reply

Same shape with two differences:
- Matching is phone lookup in `candidates` then most recent active outbound (`type != rejection`, app stage not in `["rejected","hired"]`, within last 30 days). If zero matches, log and drop (probably someone messaging the WhatsApp number unprompted). If 2+, most recent wins; the ambiguity is logged.
- No token. Matching is purely phone + recency.

### Agent branches

| Intent | Behaviour |
|---|---|
| `faq` (confidence >= 0.75) | Draft via LLM with job + school + FAQ context. Insert outbound row with `draftedBy: "conversation_agent"`, `type: "agent_reply"`, `status: "scheduled"`, `scheduledSendAt: Date.now()`. Existing dispatcher sends it within 1 minute. |
| `faq` (confidence < 0.75) | Insert outbound row with `status: "draft_pending_approval"` (existing status). Set inbound row `escalated: true`, `escalationReason: "low_confidence_faq"`. Surfaces in Inbox with draft pre-filled. |
| `reschedule` | Call `generateBookingToken`. Templated reply: "Sure, please pick a new slot here: \<link\>". No LLM in body. Send immediately. Mark `processedAt`. |
| `reschedule` (candidate already rejected) | Templated polite "this role is closed for new bookings" reply. No booking link. Do not escalate. |
| `negotiation` | No reply. Inbound row: `escalated: true`, `escalationReason: "negotiation"`. Surfaces in Inbox. |
| `unclear` | No reply. Inbound row: `escalated: true`, `escalationReason: "unclear_intent"`. Surfaces in Inbox. |

### Human reply from Inbox

1. Recruiter types in the Inbox thread view, hits send.
2. `inbox.humanReply` inserts an outbound row (`direction: "outbound"`, `draftedBy: "manual"`, `type: "custom"`).
3. Schedules via existing dispatch path (1-minute cron picks it up).
4. Patches every prior escalated inbound message in the thread: `resolvedAt: Date.now()`.
5. Inbox count for the school drops.

### Morning brief flow (golden path)

1. Cron fires at 02:30 UTC (= 08:00 IST).
2. `sendAllSchools` iterates schools in batches of 10 (parallel).
3. For each school: `collectStats(schoolId)`.
4. If `morningBriefRecipientUserIds` is empty: skip email. Dashboard widget shows "configure recipients" notice.
5. `renderBrief(stats)` returns `{ subject, htmlBody, textBody }`.
6. Fetch each recipient's email from `userProfiles`. Filter out IDs no longer present (silent skip for stale entries).
7. One Resend call per recipient. Easier to track per-user delivery than batching.
8. Log success/failure to console. No DB persistence of the email in v1.

---

## Section 4: Definitions

| Metric | Definition |
|---|---|
| **Terminal stages** | `rejected`, `hired`, `withdrawn`. All other stages (per-school custom + defaults like `new`, `triaged`, `shortlisted`, `demo_scheduled`) are non-terminal. Hardcoded list, not data-driven, because terminal-vs-non-terminal is a product concept, not a configurable one. |
| **Strong** | Application with score >= `school.autoShortlistThreshold` (default 75 if unset), stage is non-terminal, not yet contacted with a `demo_schedule` or `offer` message. Top 5 per brief. |
| **Stalled** | Application with at least one outbound message >= 5 calendar days ago, no inbound `candidate_reply` since, stage is non-terminal. Top 5 per brief. |
| **New apps 24h** | Count + top 3 by score, `createdAt >= now - 24h`. |
| **Demos today** | `bookings` rows with `startMs` between today 00:00 IST and 23:59 IST. |
| **Escalated inbox count** | Distinct `applicationId` from `outreachMessages` where `escalated=true && resolvedAt=null` for the school. |
| **Confidence threshold for auto-reply** | 0.75. Chosen conservative. Tunable from logs since every classification persists `confidence`. |

---

## Section 5: Error handling

| Failure mode | Behaviour |
|---|---|
| LLM classifier call fails | Persist inbound. Set `intent: "unclear"`, `escalated: true`, `escalationReason: "classifier_error"`. |
| LLM FAQ draft fails | Escalate with reason `"faq_draft_error"`. |
| FAQ confidence < 0.75 | Draft saved as `status: "draft_pending_approval"`. Escalate. Surfaces in Inbox with draft pre-filled. |
| Resend or Gupshup send fails | Mark message `status: "failed"`. Existing dispatcher handles this. No retry in v1. |
| Inbound WhatsApp from unknown phone | Log and drop. Not an error, it's noise. |
| Inbound email with no token | Falls through to existing new-resume PDF path. Already handled. |
| Reschedule for an already-rejected application | Polite "role is closed for new bookings" templated reply. No booking link. Do not escalate. |
| Cron sees a school with stale recipient userIds | Silently filter. If remainder is empty, skip send and dashboard shows notice. |
| Cron throws on one school | Catch and log. Continue with the next school. Do not block the whole batch. |

---

## Section 6: Testing strategy

Red-green TDD per the project taste rule.

### Conversation Agent
- `conversation_classify.test.ts`: given thread + reply, returns expected intent at expected confidence.
- `conversation_faq.test.ts`: given school FAQ, drafts plausible reply; low confidence triggers escalation.
- `conversation_reschedule.test.ts`: generates a booking URL + templated message. Already-rejected case returns the closed-role reply.
- `email_reply_router.test.ts`: tokenized to-address routes to existing application; missing token falls back to new-resume path.
- `whatsapp_inbound.test.ts`: phone matches single candidate; multi-match disambiguates to latest outbound; unknown phone drops silently.
- `inbox.test.ts`: `humanReply` clears `resolvedAt` on prior escalated messages in the thread.

### Morning Brief
- `morningBrief_stats.test.ts`: seeded apps produce correct counts and lists for newApps/strong/stalled. Edge cases: zero apps, all apps stalled, no recipients.
- `morningBrief_render.test.ts`: deterministic subject + body shape for known stats input.
- `morningBrief_send.test.ts`: empty recipient list produces no email. Populated list produces one email per recipient. Stale userId in list is silently skipped.
- `stalled.test.ts`: 5-day boundary case (4 days = not stalled, 5 = stalled). Inbound reply resets the clock.

---

## Section 7: Rollout

Ship behind two feature flags on the `schools` table (`conversationAgentEnabled`, `morningBriefEnabled`, see Section 1). Pattern already exists in the codebase (`triageEnabled`, `whatsappEnabled`).

| Flag | When false |
|---|---|
| `conversationAgentEnabled` | `handleInbound` skips the classifier and escalates every inbound straight to the Inbox. The webhook plumbing still runs so we capture all inbound messages from day one. |
| `morningBriefEnabled` | Cron skips email send for this school. Widget still renders if the user opens the dashboard. |

Both default to false. Enable per school as they're onboarded.

---

## Open questions for implementation

These are not blockers for the plan, but should be resolved by the implementer:

1. Exact path of the candidate detail page where `<InboxThread>` mounts inline. Find during impl.
2. Whether to extend `app/dashboard/settings/messaging` or create a sibling `settings/notifications` page for brief recipients. Decide based on nav fit.
3. LLM model choice for classifier vs FAQ drafter. Default to the existing `LLM_MODEL` from `convex/lib/llmClient.ts`. Revisit if cost or latency becomes an issue.

---

## Out of scope (deferred)

- Auto-send of stalled-candidate follow-ups.
- Slack/Teams escalation channel.
- Multi-language reply.
- Customizable brief content per school.
- Per-school timezone.
- Inbound attachments (voice, image) on WhatsApp.
- Sentiment / NPS in the brief.
- Audit log table for sent briefs.
