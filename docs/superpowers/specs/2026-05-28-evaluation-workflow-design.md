# Demo + Evaluation Workflow, Mobile First

**Date:** 2026-05-28
**Status:** Draft

## Problem

The current demo and evaluation experience has three structural gaps:

1. **No demo entity.** Demos are implicit, inferred from a calendar event plus an application stage. There is no row that says "this candidate has a demo on Tuesday at 11:30, in classroom 12B, with these four evaluators." This makes orchestration across multiple evaluators impossible.

2. **Single evaluator per evaluation.** `convex/evaluations.ts` mints one token per evaluator with `evaluations.create(applicationId, evaluatorRole)`. Each call is independent. There is no concept of "all the evaluators for this demo," so there is no aggregation, no completion tracking, and no shared scheduling context. Evaluator roles are hardcoded to `principal`, `hod`, `hr_admin`. Teachers cannot currently be evaluators.

3. **No mobile app.** Evaluators submit feedback by tapping a magic-link in their email and filling a web form (`app/feedback/[token]/page.tsx`). The web form is responsive but is not a native experience and supports no offline behavior, no push notifications, no dictation.

The user goal is a single coherent workflow where one demo carries multiple evaluators across roles (Principal, HOD, HR, Teacher), where the demo and the evaluations are visibly the same thing, and where the entire flow lives natively on iOS and Android as the first feature in a Rolerecruit mobile app.

## Goals

- Make the **demo a first-class entity** that owns scheduling metadata, format, mode, and the set of invited evaluators.
- Support **multiple evaluators per demo**, each with role-aware form templates, independent status tracking, and aggregated rollup.
- Add **Teacher** as an evaluator role alongside the existing Principal / HOD / HR Admin.
- Ship **native iOS and Android apps** via Expo, with Better Auth, push notifications, and role-aware navigation.
- Support **voice dictation** for evaluation comments using on-device speech-to-text, with Claude summarizing the transcript into 3-5 bullet points. No audio leaves the device.
- Maintain **full web parity** so evaluators and HR can do every action on the web as well.
- Provide a **decision rule engine** that can auto-advance, auto-reject, schedule re-demos, or fall through to manual review when invites complete.
- Allow **school-level customization** of form templates per role, layered on top of built-in defaults.

## Non-Goals

- Production data migration. The project is dev-only at this point; existing dev evaluation rows are dropped on cutover, not migrated.
- Audio storage and playback. On-device STT means audio never leaves the device; there is nothing to store or play back.
- Cloud Whisper fallback. On-device only. Schools needing regional language support beyond what device STT covers will be handled in a later spec.
- Realtime co-evaluation (multiple evaluators editing the same form). Each evaluator owns their own invite + evaluation row; aggregation happens only after submission.
- Video recording of demos within the app. The system stores a `videoUrl` reference for recorded-format demos, but recording UI is outside scope.
- Replacement of Clerk auth as part of this spec. Auth migration to Better Auth proceeds independently (see existing in-progress migration). This spec assumes Better Auth is in place for the mobile app's login flow.

---

## Domain model recap

Four new tables, one refactored table, one enum extension.

- **Demo session** (`demoSessions`, new): the unit of work. One row per scheduled demo. Owns when, where, format, mode, and status. Links to one `application`.
- **Evaluation invite** (`evaluationInvites`, new): one row per (demo × evaluator). Owns the assignment state machine, the role, the template to render, and the optional magic-link token for guest access.
- **Form template** (`formTemplates`, new): the structure of fields shown to a given role. Built-in defaults shipped in code seed; per-school overrides editable via admin UI.
- **Decision rule** (`decisionRules`, new): the auto-decision logic per school. List of conditional branches plus a fallback. Optional; demos without a rule resolve manually.
- **Evaluation** (`evaluations`, refactored): the submitted response. Now linked to an invite instead of directly to an application. Carries the structured `responses` map plus optional voice inputs.
- **Evaluator role enum**: adds `teacher` literal. Existing `roles` table (per-school RBAC) gets a seeded system role for teacher.

The relational shape:

```
applications (existing)
   └── demoSessions (1:N over lifetime, typically 1 active at a time)
          └── evaluationInvites (1:N, one per invited evaluator)
                 └── evaluations (1:1 if submitted, 0 otherwise)
```

This shape is the answer to the cohesion gap. A single query rooted at a `demoSession` returns the demo plus every invite plus their submission state plus the response payload.

---

## Section 0: On-device STT pipeline (cross-cutting)

Used in both mobile and web. Stated up front because every dictation-capable form field invokes this path.

### Mobile (Expo)

- Library: `expo-speech-recognition` (community lib wrapping `SFSpeechRecognizer` on iOS and `SpeechRecognizer` on Android).
- Permission prompt at first use of the mic button.
- Listening modes: continuous, with interim results streaming live. The dictation overlay shows the partial transcript as the user speaks so they can see it being captured correctly.
- On stop: finalized transcript is captured locally. No audio file is recorded or uploaded.
- Network call: only the transcript text plus the language code is sent to a Convex action.

### Web (Next.js)

- Library: native browser `SpeechRecognition` API (where supported: Chrome, Edge, Safari).
- Firefox and any unsupported browser see the mic button disabled with a tooltip ("Dictation requires Chrome, Edge, or Safari"). Users can still type comments manually.
- Same Convex action consumed.

### Convex action: `voiceProcessing.summarizeTranscript`

```ts
// args
{
  transcript: string,
  fieldKey: string,
  language: string,        // e.g. "en-IN", "hi-IN"
  durationSec: number,
}

// returns
{
  summaryPoints: string[],  // 3 to 5 bullet strings, each <= 120 chars
  language: string,
}
```

- Calls Claude (via existing `convex/ai.ts` infrastructure) with a fixed prompt: "Summarize this evaluator's feedback into 3 to 5 concise bullet points. Each bullet is a single observation or judgment. Preserve specifics. Do not invent."
- Prompt is parameterized by `fieldKey` so a "Comments on classroom management" field gets a slightly tuned variant of the prompt.
- Cost: roughly 1-2 cents per call (input ~500 tokens, output ~150 tokens). No per-school caching needed.
- The action returns; the caller persists the result into the evaluation row.

### What gets stored

On the `evaluations` row, each dictated field becomes one entry in `voiceInputs[]`:

```ts
{
  fieldKey: "comments",
  transcript: "Priya was strong on fractions...",     // raw STT output
  summaryPoints: [                                     // what the user sees
    "Strong command of fractions concept with real world examples",
    "Engaged quieter students by name in last 10 minutes",
    "Should slow pacing for word problems",
  ],
  language: "en-IN",
  durationSec: 43,
  processedAt: 1716889200000,
}
```

No `audioStorageId`. No file storage usage. Bullets are persisted as both `summaryPoints` (raw AI output) and copied into `responses[fieldKey]` (which the user can edit before submitting).

---

## Section 1: Schema

### New: `demoSessions`

```ts
demoSessions: defineTable({
  applicationId: v.id("applications"),
  schoolId: v.id("schools"),
  parentDemoId: v.optional(v.id("demoSessions")),   // for re-demos

  scheduledAt: v.number(),
  durationMinutes: v.number(),

  mode: v.union(v.literal("live"), v.literal("post"), v.literal("async")),
  format: v.union(v.literal("classroom"), v.literal("mock"), v.literal("recorded")),

  location: v.optional(v.string()),
  videoUrl: v.optional(v.string()),

  status: v.union(
    v.literal("scheduled"),
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("cancelled"),
  ),

  formOpenWindowMinutes: v.optional(v.number()),      // for "post" mode, default 60
  formCloseDueDays: v.optional(v.number()),           // for "async" mode, default 3

  decisionRuleId: v.optional(v.id("decisionRules")),  // null = manual decision only

  createdBy: v.id("userProfiles"),
  createdAt: v.number(),
  cancelledAt: v.optional(v.number()),
  cancellationReason: v.optional(v.string()),
})
  .index("by_applicationId", ["applicationId"])
  .index("by_schoolId_scheduledAt", ["schoolId", "scheduledAt"])
  .index("by_status_scheduledAt", ["status", "scheduledAt"]);
```

### New: `evaluationInvites`

```ts
evaluationInvites: defineTable({
  demoSessionId: v.id("demoSessions"),
  evaluatorUserId: v.id("userProfiles"),
  evaluatorRole: v.union(
    v.literal("principal"),
    v.literal("hod"),
    v.literal("hr_admin"),
    v.literal("teacher"),
  ),
  formTemplateId: v.id("formTemplates"),

  status: v.union(
    v.literal("invited"),
    v.literal("viewed"),
    v.literal("in_progress"),
    v.literal("submitted"),
    v.literal("declined"),
  ),

  token: v.string(),                             // universal access mechanism; app/auth path preferred for logged-in users, token-link path always works (email/SMS fallback, guest evaluators)

  invitedAt: v.number(),
  viewedAt: v.optional(v.number()),
  submittedAt: v.optional(v.number()),
  declinedAt: v.optional(v.number()),
  declineReason: v.optional(v.string()),

  cancelledAt: v.optional(v.number()),           // for swapped-out invites
  replacedBy: v.optional(v.id("evaluationInvites")),
})
  .index("by_demoSessionId", ["demoSessionId"])
  .index("by_evaluatorUserId_status", ["evaluatorUserId", "status"])
  .index("by_token", ["token"]);
```

### New: `formTemplates`

```ts
formTemplates: defineTable({
  schoolId: v.optional(v.id("schools")),  // null = built-in default
  role: v.union(
    v.literal("principal"),
    v.literal("hod"),
    v.literal("hr_admin"),
    v.literal("teacher"),
  ),

  name: v.string(),
  fields: v.array(v.object({
    key: v.string(),
    label: v.string(),
    type: v.union(
      v.literal("score_1_5"),
      v.literal("score_1_10"),
      v.literal("text"),
      v.literal("choice"),
    ),
    choices: v.optional(v.array(v.string())),  // for type=choice
    weight: v.optional(v.number()),            // for aggregation
    allowDictation: v.optional(v.boolean()),   // true for text fields by default
    required: v.optional(v.boolean()),
  })),

  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_schoolId_role", ["schoolId", "role"])
  .index("by_isActive", ["isActive"]);
```

### New: `decisionRules`

```ts
decisionRules: defineTable({
  schoolId: v.id("schools"),
  name: v.string(),

  // The rule is a small DSL of conditions evaluated when all invites resolve
  // (submitted or declined). First matching branch wins; falls through to manual.
  branches: v.array(v.object({
    condition: v.object({
      minHire: v.optional(v.number()),       // at least N recommendations of "hire"
      maxReject: v.optional(v.number()),     // at most N recommendations of "reject"
      minAverage: v.optional(v.object({      // average across all submitted >= X for field
        fieldKey: v.string(),
        minValue: v.number(),
      })),
      requiredRoles: v.optional(v.array(v.string())),  // these roles must have submitted
    }),
    action: v.union(
      v.literal("advance"),
      v.literal("reject"),
      v.literal("redemo"),
      v.literal("manual"),
    ),
  })),

  fallback: v.union(
    v.literal("advance"),
    v.literal("reject"),
    v.literal("redemo"),
    v.literal("manual"),
  ),

  isActive: v.boolean(),
  createdAt: v.number(),
})
  .index("by_schoolId", ["schoolId"]);
```

### Refactored: `evaluations`

```ts
evaluations: defineTable({
  inviteId: v.id("evaluationInvites"),
  formTemplateId: v.id("formTemplates"),

  // Flexible per-template field responses.
  // Keys are template field `key`s. Numeric for score fields, string for text/choice.
  responses: v.record(v.string(), v.union(v.number(), v.string())),

  recommendation: v.optional(v.union(
    v.literal("hire"),
    v.literal("maybe"),
    v.literal("reject"),
  )),

  voiceInputs: v.optional(v.array(v.object({
    fieldKey: v.string(),
    transcript: v.string(),
    summaryPoints: v.array(v.string()),
    language: v.string(),
    durationSec: v.number(),
    processedAt: v.number(),
  }))),

  submittedAt: v.number(),
  submittedFromPlatform: v.union(
    v.literal("mobile_ios"),
    v.literal("mobile_android"),
    v.literal("web"),
  ),
})
  .index("by_inviteId", ["inviteId"]);
```

Old denormalized fields (`subjectKnowledge`, `classroomManagement`, `communication`, `overallFit`, `evaluatorUserId`, `evaluatorRole`, `applicationId`, `token`, `submitted`, `comments`) are removed. All reachable via the invite chain.

### Enum and roles table

The hardcoded role union (in `convex/evaluations.ts` and elsewhere) is updated to include `"teacher"`. The existing `roles` table receives one new seed row per school for the teacher system role with default permissions (can be tagged as evaluator, cannot schedule demos by default).

---

## Section 2: End-to-end lifecycle

Six phases. State transitions noted on each.

### Phase 1: Schedule (web or mobile, HR/Principal)

1. Orchestrator opens an application detail screen.
2. Clicks **Schedule Demo**. Wizard opens (web modal or mobile full-screen flow).
3. Steps:
   - Date and time + duration
   - Mode (`live` / `post` / `async`)
   - Format (`classroom` / `mock` / `recorded`)
   - Location (for in-person) or video URL (for recorded)
   - Pick evaluators from staff directory (multi-select). System auto-selects each evaluator's form template based on their role and the school's active template for that role.
   - Optionally pick a `decisionRule`.
   - Review and confirm.
4. On confirm: one `demoSessions` row inserted, N `evaluationInvites` rows inserted in the same transaction. Invite state: `invited`.

### Phase 2: Invite (system)

- A token is minted for every invite at creation time (universal access mechanism).
- Push notifications fire for each evaluator with an Expo push token registered.
- Email goes to every evaluator via Resend (existing wiring in `convex/resend.ts`) with both a deep-link into the app and the token URL as a fallback.
- For guest evaluators (no Better Auth account), the token URL is their only path; their `evaluationInvites.evaluatorUserId` is set to a placeholder profile created at invite time.

### Phase 3: Pre-demo (mobile/web, evaluators)

- Demo appears in the evaluator's Inbox (Upcoming section) and Calendar.
- Form is **locked** until the form-open window starts.
- Evaluator can decline from the notification or the demo detail screen. Decline frees up HR to swap (Section 7).
- Evaluator can view candidate metadata but cannot score yet.

### Phase 4: Form open (mode-dependent)

| Mode | Form opens | Form closes |
|---|---|---|
| `live` | `scheduledAt` | `scheduledAt + durationMinutes` |
| `post` | `scheduledAt + durationMinutes` | + `formOpenWindowMinutes` (default 60) |
| `async` | At creation | `scheduledAt + formCloseDueDays` (default 3 days) |

- Push notification fires when form opens.
- Invite state transitions: `invited` → `viewed` on first open, `viewed` → `in_progress` on first field edit.
- Demo `status` transitions: `scheduled` → `in_progress` at first form open across all invites.

### Phase 5: Submit (mobile/web, evaluator)

- Evaluator fills the form (scores, recommendation, optional dictated comments).
- On submit: `evaluations` row inserted; invite state → `submitted`.
- Late submission (after form-close window) is allowed but the evaluation is flagged with `isLate: true` in aggregation (a derived field, not stored).

### Phase 6: Aggregate and decide (web/mobile, HR/Principal)

- A live Convex query (`demoSessions.aggregate`) returns rollup as invites resolve.
- Demo `status` transitions to `completed` when all invites are in a terminal state (`submitted` or `declined`) OR the latest form-close window has passed.
- On `completed`:
  - If `decisionRuleId` is set: rule engine evaluates and applies the matching action.
  - Else: HR/Principal notified to review manually.
- Decision actions: **Advance** moves application stage forward; **Reject** moves it to rejected; **Re-demo** opens the Schedule Demo wizard prefilled (Section 7); **Manual** is a no-op (decision-maker eyes only).

---

## Section 3: Mobile app (Expo)

### Stack

- Expo SDK (latest stable at start of build).
- React Native + TypeScript.
- Convex React Native client (first-party).
- Better Auth Expo client.
- `expo-speech-recognition` for dictation.
- `expo-notifications` for push.
- `react-navigation` (bottom tabs + native stack).
- Single codebase, ships to App Store and Play Store.

### Role-aware bottom navigation

**Evaluator-only roles (e.g., Teacher):**

| Tab | Purpose |
|---|---|
| Inbox | Pending and upcoming evaluations |
| Calendar | Demos calendar |
| Profile | Account, notification settings, logout |

**HR / Principal:**

| Tab | Purpose |
|---|---|
| Inbox | Their own pending evaluations |
| Calendar | All school demos |
| Candidates | Search and browse candidates |
| Pipeline | Application pipeline view |
| Profile | Includes Settings link (templates, retention, decision rules) |

Role gating reads from the existing `roles` table (per-school RBAC). Tab structure is computed at app boot based on the user's effective permissions.

### Screens

**Inbox** (`/inbox`)
- Two sections: *Open now* (form accepting submissions, deadline countdown), *Upcoming* (form not yet open, "opens at" timestamp).
- Card per pending eval: candidate name, subject/grade, demo time, mode badge color-coded (LIVE=red, POST=orange, ASYNC=indigo), deadline countdown.
- Pull-to-refresh.
- Push notification deep-links here when form opens.

**Calendar** (`/calendar`)
- Month view at top, list of demos below.
- Demo card per item: time, candidate, mode, evaluator's own status.
- Toggle: *My demos* / *All school demos* (HR/Principal only).

**Demo detail** (`/demo/[id]`)
- Candidate hero (photo, subject, experience).
- Demo metadata (when, format, location/video link, mode).
- Other evaluators visible by **name and submission status only**. Their scores and comments are hidden until the viewer has also submitted (or until the demo completes, whichever comes first). Prevents anchoring bias.
- Primary CTA: *Start evaluation* (when form open) / *View later* (when not).
- Secondary: *Decline this invite* (with reason text).

**Evaluation form** (`/demo/[id]/evaluate`)
- Score fields rendered dynamically from the role's `formTemplate`.
  - `score_1_5` and `score_1_10` rendered as star/number selectors.
  - `text` rendered as a textarea with mic button (when `allowDictation`).
  - `recommendation` rendered as three large tap-targets.
  - `choice` rendered as chips.
- Sticky *Submit* at bottom.
- Optimistic state: mark `in_progress` on first field interaction.

**Dictation overlay** (modal)
- Dark full-screen.
- Pulsing mic icon, live waveform from device mic input, timer.
- Interim transcript renders below the timer as it streams.
- Detected language line at the bottom.
- *Tap to stop* triggers: finalize transcript → call `voiceProcessing.summarizeTranscript` → return to form with bullets populated.
- Cancel discards everything.

**Candidates** (`/candidates`, HR/Principal only)
- Search bar, list of candidates, filter chips (active applications, recently scheduled, etc.).
- Tap to open candidate detail.

**Candidate detail** (`/candidates/[id]`, HR/Principal only)
- Resume preview, parsed facets, application history.
- Demos timeline (parent and re-demos linked).
- Quick action: *Schedule new demo* (opens wizard prefilled with this candidate).

**Pipeline** (`/pipeline`, HR/Principal only)
- Kanban view of applications for a selected role.
- Demo status visible on each card (Scheduled / In progress / Completed / None).

**Schedule Demo wizard** (`/schedule-demo`, HR/Principal only)
- Multi-step modal (3-4 steps depending on mode).
- Step 1: Candidate (prefilled if entered from candidate detail).
- Step 2: When, mode, format, location/video.
- Step 3: Pick evaluators (multi-select from staff directory). System resolves form template per role.
- Step 4: Optional decision rule, review, confirm.

**Demo Summary** (`/demo/[id]/summary`, HR/Principal only after demo completes)
- Per-dimension averages.
- Recommendation tally (e.g., "3 hire, 1 maybe, 0 reject").
- Per-evaluator panel: scores, recommendation, comments bullets, raw transcript (collapsed).
- Decision row at bottom: *Advance* / *Reject* / *Re-demo* / *Cancel*.

**Settings** (`/settings`, HR/Principal only)
- Form templates: list per role, edit (opens template editor), preview.
- Decision rules: list, edit, create.
- Notification preferences.
- School metadata (read-only here; managed elsewhere).

**Template editor** (`/settings/templates/[role]`, HR admin only)
- Add/remove/reorder fields.
- Per-field: label, type, weight, dictation flag, required flag.
- Live preview pane.
- Save activates the template school-wide.

### Push notifications

- Expo push tokens stored on `userProfiles.expoPushTokens[]`.
- Triggers:
  - Invite created → push to evaluator: "You've been invited to evaluate [Candidate] for [Subject]"
  - Form opens → push to all invites in `invited`/`viewed` state: "Form is now open for [Candidate]'s demo"
  - Demo completed → push to decision-makers
  - Demo cancelled → push to all invitees
  - Evaluator swap → push to old evaluator (cancellation) and new evaluator (new invite)
- All triggers go through a single Convex action `notifications.sendDemoEvent` invoked from the relevant mutation.

---

## Section 4: Web parity (Next.js)

### Routes

| Route | Purpose |
|---|---|
| `/evaluations` | Inbox for logged-in evaluators (mirrors mobile Inbox) |
| `/evaluations/[inviteId]` | Eval form (auth or `?token=` query for guest fallback) |
| `/feedback/[token]` | Thin redirect into `/evaluations/[inviteId]?token=…` for legacy email links |
| `/dashboard/applications/[id]` | Existing route; gains the *Schedule Demo* CTA and the Demo Summary panel |
| `/dashboard/demos/[id]` | New: full demo detail page with summary |
| `/dashboard/settings/templates` | Form template management |
| `/dashboard/settings/decision-rules` | Decision rule management |

### Dictation on web

- Browser `SpeechRecognition` API for Chrome/Edge/Safari.
- Same Convex action consumed.
- Firefox shows the mic disabled with a tooltip.

### Web nav

- New top-level **Evaluations** entry in dashboard nav, visible to anyone with at least one `evaluationInvite` (or with the `evaluation_orchestrate` permission). Counter badge mirrors mobile.

### Dashboard surface changes

- `dashboard/applications/[id]` page: adds a "Demos" panel above the existing evaluations list, showing scheduled and past demos. Each demo card links to `/dashboard/demos/[id]`.
- Existing evaluations list is removed (replaced by demo-rooted view).

---

## Section 5: Form templates

### Built-in defaults

Shipped in code (`convex/seed.ts` or a dedicated `convex/formTemplates.seed.ts`). One default per role, marked `schoolId: undefined`.

**Principal default fields**: Subject knowledge (score 1-5), Classroom management (score 1-5), Communication (score 1-5), Overall fit (score 1-5), Comments (text, dictation).

**HOD default fields**: Subject knowledge (1-5, weight 2), Pedagogy (1-5, weight 2), Curriculum alignment (1-5), Communication (1-5), Comments (text, dictation).

**HR Admin default fields**: Communication (1-5), Professionalism (1-5), Cultural fit (1-5, weight 2), Comments (text, dictation).

**Teacher default fields**: Peer compatibility (1-5), Subject knowledge (1-5), Teaching style alignment (1-5), Comments (text, dictation).

The **recommendation widget** (Hire / Maybe / Reject) renders at the bottom of every form as a fixed UI element, not part of the template `fields[]`. It writes directly to `evaluations.recommendation`. Customizing the label set is out of scope for V1.

### School overrides

- School admin edits a template via the template editor.
- Save creates a `formTemplates` row with `schoolId` set and `isActive: true` for that role.
- `formTemplates.getForRole(schoolId, role)` query: returns the school's active override if present; else returns the built-in default.

### Resolution at invite time

- When `demoSessions.create` mints an invite, it calls `formTemplates.getForRole` once per invited evaluator and stores the resolved `formTemplateId` on the invite.
- This pins the template at invite time. Subsequent template edits by the school do not retroactively change form structure for already-issued invites.

---

## Section 6: Decision rule engine

### Rule shape

A `decisionRule` is a list of `branches`, each with a `condition` and an `action`. Branches are evaluated in order; first match wins. Falls through to `fallback` if no branch matches.

### Condition vocabulary

- `minHire: N`: at least N invites have `recommendation: "hire"`
- `maxReject: N`: at most N invites have `recommendation: "reject"`
- `minAverage: { fieldKey, minValue }`: the average of `responses[fieldKey]` across submitted evaluations is at least `minValue`
- `requiredRoles: ["principal", "hod"]`: at least one submitted evaluation exists for each role in the list

A condition's clauses are AND-ed together. A branch matches when all its clauses match.

### Evaluation timing

- Triggered by `evaluationInvites.submit` and `evaluationInvites.decline` mutations.
- Only runs when **all** invites for the demo are in a terminal state (`submitted` or `declined`), OR when the last form-close window has elapsed.
- Result is persisted on `demoSessions.appliedDecision` (optional field; documents what the engine did and when).

### Actions

| Action | Effect |
|---|---|
| `advance` | Move `application.stage` forward (according to the school's pipeline definition) |
| `reject` | Move `application.stage` to "rejected" |
| `redemo` | Open a new `demoSessions` row with `parentDemoId` pointing back; copy evaluator list by default; notify HR to confirm before sending invites |
| `manual` | No-op; just notify decision-makers |

### Editor UI

- List of branches as draggable cards.
- Per-branch: condition builder (add/remove clauses, pick field for `minAverage`), action selector.
- Live preview: "Given 4 invites, if X submits hire, this rule would..."

---

## Section 7: Re-demo and evaluator swap

### Re-demo

- Triggered by a *Re-demo* decision (rule-based or manual).
- Opens Schedule Demo wizard prefilled with: same candidate, same evaluators (HR can deselect or add), recommended next slot (default: 3 business days later, configurable per school).
- New `demoSessions` row inserted with `parentDemoId` set to the previous demo.
- Old demo remains `completed` (immutable history).
- Candidate detail page Demos timeline shows parent and child demos linked.

### Evaluator swap

- From Demo Summary panel, HR can swap any invite still in `invited` / `viewed` / `in_progress` state.
- Action: pick a replacement evaluator from staff directory.
- Effect:
  - Old invite: `status` → `cancelled`, `cancelledAt` set, `replacedBy` set to the new invite's id.
  - New invite: created with same role and a freshly resolved form template.
  - Push notifications fire to both parties.
- Submitted invites cannot be swapped. (Their submission already exists; swap would lose it.)
- Bulk swap: select multiple invites, pick replacements.

---

## Section 8: Testing strategy

Strict red-green TDD per project taste rules. Four test layers.

### Convex (unit + integration with `convex-test`)

- One test per mutation. Each starts with a failing test asserting the happy path, plus targeted tests for: auth, validation, state machine guards, idempotency, edge cases (declined invites, cancelled demos, out-of-window submissions).
- Decision rule engine: pure function with table-driven cases (rule + invites → expected action).
- Voice action: mock Claude client; assert the right prompt is built and the response is parsed into a string array.
- Form template resolution: assert that a school override beats a built-in default, and that pinning at invite time survives subsequent template edits.

### Web (Playwright E2E)

- Reuse existing `playwright.config.ts`.
- Critical flows:
  - HR schedules a demo with 3 evaluators across roles → assertions on invites, notifications fired, application updated.
  - Logged-in evaluator: navigate to `/evaluations` → tap demo → form opens at the right moment → submit → invite state advances → Demo Summary updates.
  - Magic-link guest flow: open token URL → form → submit → invite state advances.
  - Dictation on web: mock `SpeechRecognition`, assert transcript is sent to action, bullets render.
  - Decision: complete a demo → HR clicks Advance → application stage transitions; same flow with a decision rule that auto-advances.
  - Re-demo: from Decision modal → wizard prefilled → confirm → new demo with `parentDemoId`.
  - Evaluator swap: cancel old invite, create new invite, notifications fire.

### Mobile (Expo)

- Unit: Jest + React Native Testing Library. Every screen has snapshot + interaction tests. Form rendering is template-driven, so test that a template with N fields renders N inputs.
- E2E: Maestro YAML flows (lighter than Detox, cross-platform).
  - Sign in → Inbox loads with assigned demos.
  - Tap demo → detail screen → start evaluation → form renders from template → submit.
  - Dictation: mock `expo-speech-recognition`, assert bullets render in comments.
  - HR flow: Candidates list → tap candidate → Schedule Demo wizard → confirm → Inbox shows the demo as orchestrator.
  - Push notification deep-link: opens directly to form when form-open window fires.

### Cross-cutting

- Type safety: `tsc --noEmit` for web, mobile, and Convex in CI.
- Schema-shape tests: each new table has a test asserting required indexes and field shapes.
- RBAC: a teacher cannot see HR-only screens; an evaluator cannot see other evaluators' scores until they submit theirs (or until the demo completes, depending on school config).

---

## Section 9: Migration

Dev-only project per the auth migration memo; clean cutover.

1. Drop existing `evaluations` rows in dev.
2. Apply schema changes to `convex/schema.ts` (new tables, refactored evaluations).
3. Add `teacher` to the role union in `convex/types.ts` and anywhere else the enum is hardcoded.
4. Seed `roles` table with a teacher system role per school.
5. Seed built-in `formTemplates` (4 default templates).
6. Rewrite `convex/evaluations.ts` against the new schema.
7. Replace `components/feedback/feedback-form.tsx` with a new template-rendering component.
8. Convert `/feedback/[token]` route to a thin redirect.
9. Build `convex/demoSessions.ts`, `convex/evaluationInvites.ts`, `convex/formTemplates.ts`, `convex/decisionRules.ts`, `convex/voiceProcessing.ts`.
10. Web routes and dashboard panels.
11. Expo app scaffold, auth, screens, dictation, push.

Each step is a separate task in the implementation plan.

---

## Open questions and risks

1. **Better Auth Expo client maturity.** The mobile login flow depends on Better Auth working cleanly on Expo. If it lags, fall back to a webview-based auth bridge for V1; revisit when the native flow is stable. Track separately.

2. **Push notification delivery reliability on iOS.** Expo push is a hop on top of APNs; non-trivial delivery edge cases (silent push, kill state) exist. Plan: add a "missed notifications" fallback that re-fetches inbox state on app foreground.

3. **Form template versioning.** Pinning template id at invite time prevents in-flight breakage, but it means audit views need to render historic templates. Acceptable for now; flag if template churn becomes high.

4. **Decision rule complexity creep.** The condition vocabulary is intentionally small. Resist adding boolean operators (OR, NOT) or nested groups until clear demand. If demand emerges, revisit as a separate spec.

5. **Maestro vs Detox for mobile E2E.** Maestro is chosen for speed but is less powerful than Detox. If complex interaction sequences (long-press, custom gestures) become necessary, swap.

6. **Audio privacy on web.** Browser `SpeechRecognition` API on Chrome routes audio through Google's servers (the API is a cloud STT in disguise on some browsers). Disclose this in the dictation modal: "Web dictation processes audio in your browser; on Chrome this may use Google's speech service." Mobile remains fully on-device.

7. **Late submission policy.** Currently: late submissions are allowed and flagged. Confirm this is what schools want, or whether late submissions should be hard-blocked when the form-close window passes.
