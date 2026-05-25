# Pipeline Customization, Messaging Routing, and Calendar Integration — Design Spec

**Date:** 2026-05-25
**Status:** Draft

## Overview

Three interconnected subsystems to make the hiring pipeline flexible, automated, and connected to real-world scheduling tools:

1. **Pipeline Customization** — Schools define their own stages, transitions, and automation rules instead of using a fixed pipeline.
2. **Calendar Integration** — Google Calendar OAuth for self-booking and manual scheduling, with interviewer availability driving available slots.
3. **Messaging Routing** — Smart channel selection (WhatsApp vs Email) per message type with cost controls and fallback logic.

These three systems share infrastructure (school settings pages, pipeline drawer, message composer) but are functionally independent.

---

## Data Model Changes

### New Tables

```typescript
pipelineConfigs: defineTable({
  schoolId: v.id("schools"),
  stages: v.array(v.object({
    id: v.string(),           // "stage_app_review", "stage_phone"
    name: v.string(),         // "Application Review", "Phone Screen"
    order: v.number(),        // 0-based display order
    isTerminal: v.optional(v.boolean()),
    color: v.optional(v.string()),
  })),
  transitions: v.array(v.object({
    fromStageId: v.string(),
    toStageId: v.string(),
  })),
  version: v.number(),        // incremented on edit, for cache-busting
}).index("by_schoolId", ["schoolId"]),

pipelineAutomations: defineTable({
  schoolId: v.id("schools"),
  fromStageId: v.string(),
  toStageId: v.string(),
  messageTemplate: v.optional(v.string()),
  messageChannel: v.optional(v.union(
    v.literal("whatsapp"), v.literal("email"), v.literal("both")
  )),
  includeBookingLink: v.optional(v.boolean()),
  createCalendarEvent: v.optional(v.boolean()),
}).index("by_schoolId", ["schoolId"]),

bookingTokens: defineTable({
  token: v.string(),
  applicationId: v.id("applications"),
  schoolId: v.id("schools"),
  expiresAt: v.number(),
  used: v.boolean(),
}).index("by_token", ["token"]),

calendarEvents: defineTable({
  applicationId: v.id("applications"),
  schoolId: v.id("schools"),
  googleEventId: v.string(),
  summary: v.string(),
  start: v.number(),
  end: v.number(),
  attendees: v.array(v.string()),
  meetLink: v.optional(v.string()),
}).index("by_applicationId", ["applicationId"]),

slotConfigs: defineTable({
  schoolId: v.id("schools"),
  advanceDays: v.number(),      // how many days ahead candidates can book
  workingHoursStart: v.string(), // "09:00"
  workingHoursEnd: v.string(),   // "17:00"
  slotDuration: v.number(),      // 30, 45, or 60 minutes
}).index("by_schoolId", ["schoolId"]),

interviewerCalendars: defineTable({
  userId: v.string(),
  schoolId: v.id("schools"),
  googleTokens: v.object({
    access_token: v.string(),
    refresh_token: v.string(),
    expiry: v.number(),
  }),
  googleEmail: v.string(),
  calendarId: v.string(),
}).index("by_userId", ["userId"])
  .index("by_schoolId", ["schoolId"]),
```

### Modified Tables

**`schools`** — add:
```typescript
googleCalendarConnected: v.optional(v.boolean()),
messageChannelPrefs: v.optional(v.object({
  shortlist: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none")),
  demo_schedule: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none")),
  feedback_request: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none")),
  offer: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none")),
  rejection: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none")),
  custom: v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none")),
})),
```

**`applications`** — `stage` field becomes a `v.string()` referencing `pipelineConfigs.stages[].id` instead of the hardcoded union. Existing applications get migrated to a default pipeline config.

---

## Subsystem 1: Pipeline Customization

### How It Works

Every school starts with a **default pipeline** (the current 6-stage pipeline: sourced → screened → demo_scheduled → demo_completed → offer_sent → hired, plus rejected and on_hold). This default is seeded during school creation. Schools that don't customize never see any change.

When a school edits their pipeline:
1. They visit `/dashboard/settings/pipeline`
2. They see a visual stage builder — draggable stage cards in a horizontal flow
3. Adding a stage: click "+ Add Stage", type a name, it appears at the end
4. Reordering: drag stages to reorder
5. Connecting stages: click any stage card to open a panel showing its possible next stages, check/uncheck which stages it flows to
6. Deleting a stage: removes it and all transitions involving it
7. Editing a transition: click the arrow between two stages to open the automation panel

### Transition Automation Panel (per from→to transition)

Presented as a simple form with clear sections, not a raw code editor:

**Message Section:**
- Toggle: "Send a message to the candidate when they reach this stage"
- If on: a pre-filled message template appears with dropdowns to insert variables
- Variables shown as clickable chips: {candidate_name}, {school_name}, {job_title}, {booking_link}
- User edits the template text directly — it's plain text, not code
- Channel selector: WhatsApp / Email / Both (defaults to school's messageChannelPrefs for this message type)

**Scheduling Section:**
- Toggle: "Let the candidate book a time slot"
- If on: "Include booking link in the message" (auto-checked)
- Toggle: "Create a Google Calendar event after booking" (requires Google Calendar connected)

**Notification Section:**
- Toggle: "Notify HR team when a candidate reaches this stage"
- Shown as simple checkboxes — no recipient configuration, uses the school's HR role

### Default Pipeline Seeding

When a school is created, insert a default `pipelineConfigs` record with all 8 stages:

| Stage ID | Name | Order | Terminal |
|---|---|---|---|
| `sourced` | Sourced | 0 | No |
| `screened` | Screened | 1 | No |
| `demo_scheduled` | Demo Scheduled | 2 | No |
| `demo_completed` | Demo Completed | 3 | No |
| `offer_sent` | Offer Sent | 4 | No |
| `hired` | Hired | 5 | Yes |
| `rejected` | Rejected | 6 | Yes |
| `on_hold` | On Hold | 7 | No |

Default transitions match the current `VALID_TRANSITIONS` mapping from `convex/applications.ts`:
- sourced → screened, rejected, on_hold
- screened → demo_scheduled, rejected, on_hold
- demo_scheduled → demo_completed, rejected
- demo_completed → offer_sent, rejected
- offer_sent → hired, rejected
- hired → (none, terminal)
- rejected → (none, terminal)
- on_hold → screened, rejected

Only the 6 non-terminal, non-rejected, non-on_hold stages appear in the pipeline kanban/list view. The `rejected` and `on_hold` stages are shown in filtered views outside the main pipeline.

### Backward Compatibility

Existing `applications.stage` values are strings that match the default pipeline's stage IDs. Migration:
1. Create default pipelineConfigs for all existing schools
2. No data migration needed — existing stage values match default stage IDs
3. The `moveStage` mutation continues to work, reading transitions from `pipelineConfigs` instead of the hardcoded `VALID_TRANSITIONS`

### Candidate Movement UX

In the pipeline kanban/list view:
- Drag-and-drop between columns (existing behavior)
- Right-click or dropdown on candidate card: "Move to →" shows available next stages
- The "Demo" tab in the drawer: scheduling moves to next stage automatically
- When moving, if an automation exists: execute it (send message, generate booking link, etc.)

---

## Subsystem 2: Calendar Integration

### Google Calendar OAuth

**Connection flow (per interviewer, from Settings page):**
1. School admin goes to Settings → Calendar
2. Clicks "Connect Google Calendar" → OAuth consent screen
3. On callback: store access + refresh tokens in `interviewerCalendars`
4. System shows "Connected as principal@dps.edu"

**Token refresh:** A Convex scheduled job runs every 30 minutes, refreshes tokens expiring within 1 hour.

**For MVP:** Only the school admin connects their calendar. The system uses their availability as the interviewer's availability. Multi-interviewer availability (combining multiple calendars) is a future feature.

### Calendar Settings (per school, in `slotConfigs`)

A simple form on the Settings page:
- **Advance booking window:** Number input, default 7 days. Candidates can only book slots within this window.
- **Working hours:** Start and end time pickers, default 9:00 AM - 5:00 PM.
- **Slot duration:** Segmented control [30 min | 45 min | 60 min], default 45 min.
- **Buffer between slots:** None for MVP (add later).

### Slot Calculation Engine

Pure Convex query/action:
```
Input: schoolId, date (YYYY-MM-DD)
1. Get slotConfigs for school → workingHours, slotDuration
2. Get interviewer calendars → fetch free/busy from Google Calendar API for that date
3. Generate all possible slots within working hours at slotDuration intervals
4. Remove slots that overlap with busy blocks
5. Remove slots in the past
6. Return available slots[]
```

### Self-Booking Flow

1. Recruiter moves candidate to a stage that has "includeBookingLink" automation
2. System generates a `bookingToken` (128-bit random, 7-day expiry, single-use)
3. Message template's `{booking_link}` variable resolves to `{appUrl}/book/{token}`
4. Candidate clicks link → public booking page (no auth, token-secured)
5. Booking page shows:
   - Job title, school name, position
   - Date picker: horizontal scroll of next N days (up to advanceDays), with slot count badges
   - Time picker: grid of available time slots for selected date
   - Confirm button
6. On confirm:
   - Create Google Calendar event with Meet link
   - Update `calendarEvents` table
   - Mark `bookingTokens.used = true`
   - Move application to the next stage
   - Send confirmation message to candidate (via channel routing)
   - Show "Booking confirmed!" with event details

### Manual Scheduling Flow

Available in the pipeline drawer's Demo tab, for when there's no lead time for self-booking:
1. Recruiter opens the scheduling form
2. A compact availability sidebar shows interviewer free/busy for the selected date (fetched in real-time)
3. Time slots are color-coded: green (all interviewers free), amber (some busy), red (all busy), gray (outside working hours)
4. Recruiter picks date, time, and optionally description
5. On schedule: creates Google Calendar event, moves application stage, sends message

### Calendar Event Template

```
Summary:  Demo Lesson: {jobTitle} — {candidateName}
When:     {date} at {startTime} - {endTime}
Guests:   {candidateEmail}, {interviewerEmail}
Meet:     Auto-generated Google Meet link
Location: {schoolName} (or virtual)
```

---

## Subsystem 3: Messaging Routing

### Button Label Change

The `MessageComposer` component's send button changes from `"Send via WhatsApp"` to `"Send Message"`. This is a single-line change in `components/outreach/message-composer.tsx`.

### Channel Routing Logic

When composing a message:

```
1. Read school.messageChannelPrefs[messageType] → preference
2. If preference = "none": message type is disabled (auto-send off)
3. If preference = "whatsapp":
   - If candidate has phone number → send via WhatsApp, show "Via: WhatsApp"
   - If no phone → show warning "No WhatsApp number. Cannot send."
4. If preference = "email":
   - If candidate has email → send via email, show "Via: Email"
   - If no email → show warning "No email address. Cannot send."
5. If preference = "both":
   - If candidate has WhatsApp → send via WhatsApp, show "Via: WhatsApp"
   - If no WhatsApp but has email → send via email, show "Via: Email (fallback)"
   - If neither → show warning
```

The channel indicator is shown ABOVE the message body as a non-editable badge (not a dropdown in the default view). A small "Change" link next to it opens a per-candidate override dropdown for that single message.

### Settings Page

`/dashboard/settings/messaging` — a simple table:

| Message Type | WhatsApp | Email |
|---|---|---|
| Shortlist | [✓] | [✓] |
| Demo Schedule | [✓] | [✓] |
| Feedback Request | [ ] | [✓] |
| Offer | [✓] | [✓] |
| Rejection | [ ] | [✓] |
| Custom | [✓] | [✓] |

Both checkboxes per row. At least one must be checked per type (except "none" which is both unchecked). A footer explains:
> "When both are enabled, WhatsApp is tried first. Email is used as fallback if the candidate has no WhatsApp number."

### WhatsApp Template Updates

The 5 templates in `convex/whatsapp.ts` remain as defaults. When a pipeline automation has a custom message template, that template text is used instead of the default. The Gupshup API call remains the same — just the body text changes.

### Fallback and Error Handling

- If WhatsApp send fails (Gupshup API error): if "both" is configured AND candidate has email, automatically retry via email. Log both attempts in `outreachMessages`.
- If email send fails: log failure, show error in UI. No further fallback.
- All sent/failed messages are recorded in `outreachMessages` with the channel used.

---

## UI/UX Design Principles

### "Dumbest User" Requirement

Every configuration interface must follow these rules:

1. **Sensible defaults everywhere.** No blank slates. Schools get a working default pipeline, default message templates, and no configuration required to use the product.
2. **Visual over textual.** Stage editor is drag-and-drop cards, not JSON. Transitions are checkbox connections, not code. Templates use variable chips, not curly-brace syntax they have to memorize.
3. **One concept per screen.** Pipeline editor has one job. Automation panel has one job. Calendar settings has one job. No multi-tab monstrosities.
4. **Preview before save.** Message templates show a live preview with a sample candidate name. Changes to pipeline stages show a mini kanban preview.
5. **Undo-friendly.** Deleting a stage shows a confirmation with a list of affected candidates. Nothing is destructive without warning.
6. **No raw template editing.** Templates are edited in a rich text area with variable insertion buttons. The raw `{variable}` syntax is never exposed to the user — they click "Insert Variable" and pick from a dropdown.
7. **One-click OAuth.** "Connect Google Calendar" is a single button. No manual API key entry, no redirect URI configuration. The system handles all OAuth complexity.

### New Pages

- `/dashboard/settings/pipeline` — Stage builder + automation config
- `/dashboard/settings/messaging` — Channel routing table
- `/dashboard/settings/calendar` — Google OAuth + slot config
- `/book/[token]` — Public booking page (no auth, token-secured)

### New Settings Nav

A collapsible "Settings" section in the sidebar (under existing nav items):
```
Settings
  ├── Pipeline
  ├── Messaging
  └── Calendar
```

### Modified Components

| Component | Change |
|---|---|
| `MessageComposer` | "Send Message" label, channel indicator badge, per-candidate override link |
| `ApplicationDrawer` | Manual scheduling gets availability mini-calendar |
| `InlineExpansion` | Same as ApplicationDrawer |
| `KanbanBoard` | Columns use dynamic stages from pipelineConfigs |
| `PipelineControls` | Stage filter pills use dynamic stages |
| `ApplicationTable` | Stage column uses stage names from config |
| Sidebar | Add Settings section with Pipeline/Messaging/Calendar links |

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Settings Pages                          │
│  Pipeline Editor  │  Messaging Prefs  │  Calendar Config     │
│  (stages, trans)  │  (channel toggles)│  (OAuth, slot cfg)  │
└────────┬──────────┴────────┬──────────┴──────────┬──────────┘
         │                   │                     │
         ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      Convex Backend                          │
│                                                              │
│  pipeline.ts          outreach.ts         calendar.ts        │
│  - create/get/update   - sendMessage       - connectOAuth    │
│    pipelineConfigs     - getMessageHistory  - getFreeBusy    │
│  - getTransitions      - saveSentMessage    - createEvent    │
│  - executeAutomation                        - getSlots       │
│  - seedDefaults                              - refreshTokens │
│                                                              │
│  booking.ts           whatsapp.ts          resend.ts         │
│  - generateToken       - sendTemplate      - sendEmail       │
│  - confirmBooking      - sendMessage       - sendMagicLink   │
│  - cancelBooking                                             │
└────────┬──────────────────┬──────────────────┬──────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
    ┌─────────┐      ┌──────────┐       ┌────────────┐
    │ Google  │      │ Gupshup  │       │   Resend   │
    │Calendar │      │(WhatsApp)│       │  (Email)   │
    └─────────┘      └──────────┘       └────────────┘
```

---

## Edge Cases

- **School deletes a stage with candidates in it:** Candidates are moved to the nearest previous stage. Show warning with candidate count before confirming.
- **Stage renamed but candidates reference old name:** Stage is referenced by ID, not name. Renaming is safe.
- **Google Calendar token expires:** Scheduled job refreshes. If refresh fails, admin sees "Reconnect Google Calendar" banner on the Calendar settings page.
- **Candidate booking token expires before use:** Candidate sees "This booking link has expired. Please contact the school." page.
- **Candidate tries to use a booking token twice:** Second attempt shows "You've already booked a slot for this position."
- **No interviewers connected to calendar:** Self-booking shows all working-hour slots as available (no busy filtering). Manual scheduling shows all slots as available.
- **WhatsApp configured but Gupshup API fails:** Message falls back to email if "both" is configured. If WhatsApp-only, show error and don't send.
- **School has no pipeline customization:** Everything uses the default pipeline. The pipeline editor page shows the default with an "Edit Pipeline" button.

---

## Migration Strategy

1. Add new tables to `convex/schema.ts` (all fields use `v.optional()` for new fields on existing tables)
2. Create defaults module: `convex/pipeline_defaults.ts` with the default pipeline config
3. Add a migration mutation that:
   - Creates default `pipelineConfigs` for all existing schools that don't have one
   - Sets default `messageChannelPrefs` for all schools (all types = "both")
4. Update `applications.moveStage` to read transitions from `pipelineConfigs` with fallback to the hardcoded `VALID_TRANSITIONS`
5. Update all UI components to read stages from `pipelineConfigs` with fallback to `PIPELINE_STAGES` constant
6. Deprecate but don't remove `lib/constants.ts` pipeline constants (they become the fallback/default)

---

## What's Out of Scope

- Microsoft Calendar / Calendly integration (architecture supports plugging them in later)
- Multi-interviewer availability combining (MVP: one calendar per school)
- Buffer time between slots
- Recurring event support
- Bulk stage moves (select multiple candidates, move all)
- Email template customization (use WhatsApp templates for both channels for now)
- Custom notification recipients (notify specific people, not just "HR team")
- Pipeline version history / rollback
- Per-job pipeline overrides (one pipeline per school for MVP)
- Rescheduling/cancellation flow for booked slots
- SMS channel for messaging
- WhatsApp template approval flow (using pre-approved Gupshup templates)
