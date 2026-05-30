# Back-and-Forth Interview Scheduling Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the conversation agent negotiate an interview time over email/WhatsApp — parse times the candidate proposes, check them against the merged availability of all interviewers, confirm or counter-propose until agreement, then create a real Google Calendar event (with Meet link + attendees) and advance the pipeline.

**Architecture:** Three layers. (1) Pure, LLM-mockable helpers do time extraction, availability matching, and reply drafting — each one file, unit-tested with vitest. (2) Convex actions own all network I/O: a token-refresh wrapper for Google OAuth, a calendar read across interviewers, and a `events.insert` write-back. (3) An orchestration action (`scheduling.negotiate`) drives the state machine, persisting per-application progress in a new `schedulingNegotiations` table and capping rounds before escalating to a human. `conversation.handleInbound` routes `reschedule`/`negotiation` intents into this orchestrator instead of escalating.

**Tech Stack:** Convex (TypeScript), OpenAI SDK pointed at Gemini 2.5 Flash-Lite (`convex/lib/llmClient.ts`), Google Calendar REST v3, Resend + WhatsApp Cloud for delivery (already wired in `convex/outreach.ts`), vitest + convex-test for tests, bun for package management.

**Conventions to follow (from `.commandcode/taste/taste.md`):**
- Strict red-green TDD: failing test first, minimum code to pass.
- `bun` for any package commands. Run tests with `bun run test -- <path>`.
- New optional fields on existing tables use `v.optional(...)`. New tables may have required fields.
- No em-dash or `--` in code. No `Co-authored-by` trailer in commits.
- Single Responsibility per file. Simplicity first — no speculative flexibility.

**Design assumptions (stated explicitly):**
1. **Timezone:** No timezone exists in the schema today. We add `timezone` (IANA string, optional, default `"Asia/Kolkata"`) to `slotConfigs`. The extraction LLM is given the timezone + current time and returns offset-qualified ISO 8601 datetimes, so `new Date(iso).getTime()` is unambiguous and helpers stay pure.
2. **Organizer:** The Google event is created on the *first* interviewer calendar for the school (organizer); other interviewers + the candidate are attendees.
3. **Round cap:** Hard constant `MAX_NEGOTIATION_ROUNDS = 4`. Exceeding it escalates to the human inbox (reusing the existing `escalated` flow).
4. **Channel:** Negotiation replies go on whatever channel the candidate used (`inbound.channel`), matching existing agent behavior.
5. **Counter-proposals:** When no proposed time is free, offer the 3 nearest available slots.

---

## File Structure

**New files:**
- `convex/lib/googleToken.ts` — pure token-expiry check + refresh (fetch injected).
- `convex/scheduling_extract.ts` — LLM helper: candidate message -> proposed time windows (epoch ms).
- `convex/prompts/schedulingExtract.ts` — system prompt for extraction.
- `convex/scheduling_match.ts` — pure: match proposals to free slots; pick counter-proposals.
- `convex/scheduling_reply.ts` — pure: confirmation / counter-proposal / no-availability reply text.
- `convex/scheduling.ts` — orchestration action + state mutations + auto-book mutation.

**Modified files:**
- `convex/schema.ts` — add `timezone` to `slotConfigs`; add `schedulingNegotiations` table.
- `convex/calendar.ts` — add `ensureFreshToken` internal action; add `createGoogleEvent` action.
- `convex/slot_calculator.ts` — use refreshed token when reading calendars; add `getAvailableSlotsInRange` internal action.
- `convex/conversation.ts` — route `reschedule`/`negotiation` into `scheduling.negotiate`.

---

## Task 1: Schema — timezone + negotiation state

**Files:**
- Modify: `convex/schema.ts` (the `slotConfigs` table near line 703; add a new table)
- Test: `tests/convex/scheduling_schema.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/convex/scheduling_schema.test.ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("scheduling schema", () => {
  it("allows an optional timezone on slotConfigs", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      return ctx.db.insert("slotConfigs", {
        schoolId, advanceDays: 7, workingHoursStart: "09:00",
        workingHoursEnd: "17:00", slotDuration: 45, timezone: "Asia/Kolkata",
      });
    });
    expect(id).toBeDefined();
  });

  it("stores a schedulingNegotiations row with rounds and status", async () => {
    const t = convexTest(schema, modules);
    const row = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      const candidateId = await ctx.db.insert("candidates", {
        name: "A", qualifications: [], certifications: [], boardExperience: [],
        subjects: [], talentBankFlag: false,
      });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE",
        qualifications: [], naturalLanguageDescription: "d", status: "active",
        createdAt: Date.now(),
      });
      const applicationId = await ctx.db.insert("applications", {
        schoolId, candidateId, jobPostingId: jobId, stage: "applied",
        appliedAt: Date.now(),
      });
      const negId = await ctx.db.insert("schedulingNegotiations", {
        applicationId, schoolId, rounds: 1, status: "negotiating",
        updatedAt: Date.now(),
      });
      return ctx.db.get(negId);
    });
    expect(row?.status).toBe("negotiating");
    expect(row?.rounds).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/convex/scheduling_schema.test.ts`
Expected: FAIL — `timezone` rejected by validator and `schedulingNegotiations` table does not exist.

- [ ] **Step 3: Add the `timezone` field to `slotConfigs`**

In `convex/schema.ts`, change the `slotConfigs` table definition to:

```typescript
  slotConfigs: defineTable({
    schoolId: v.id("schools"),
    advanceDays: v.number(),
    workingHoursStart: v.string(),
    workingHoursEnd: v.string(),
    slotDuration: v.number(),
    timezone: v.optional(v.string()),
  }).index("by_schoolId", ["schoolId"]),
```

- [ ] **Step 4: Add the `schedulingNegotiations` table**

In `convex/schema.ts`, add this table next to `bookingTokens`/`calendarEvents`:

```typescript
  schedulingNegotiations: defineTable({
    applicationId: v.id("applications"),
    schoolId: v.id("schools"),
    rounds: v.number(),
    status: v.union(
      v.literal("negotiating"),
      v.literal("booked"),
      v.literal("escalated"),
    ),
    lastProposedSlots: v.optional(
      v.array(v.object({ startMs: v.number(), endMs: v.number() })),
    ),
    updatedAt: v.number(),
  })
    .index("by_applicationId", ["applicationId"]),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test -- tests/convex/scheduling_schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts tests/convex/scheduling_schema.test.ts
git commit -m "feat(scheduling): add timezone config and negotiation state table"
```

---

## Task 2: Google token expiry check (pure helper)

**Files:**
- Create: `convex/lib/googleToken.ts`
- Test: `tests/convex/googleToken.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/convex/googleToken.test.ts
import { describe, it, expect } from "vitest";
import { needsRefresh } from "../../convex/lib/googleToken";

describe("needsRefresh", () => {
  it("is true when expiry is in the past", () => {
    expect(needsRefresh(1000, 2000)).toBe(true);
  });
  it("is true within the 60s safety window before expiry", () => {
    expect(needsRefresh(100_000, 100_000 - 30_000)).toBe(true);
  });
  it("is false when expiry is comfortably in the future", () => {
    expect(needsRefresh(100_000, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/convex/googleToken.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// convex/lib/googleToken.ts
const SAFETY_WINDOW_MS = 60_000;

export function needsRefresh(expiryMs: number, nowMs: number): boolean {
  return expiryMs - SAFETY_WINDOW_MS <= nowMs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/convex/googleToken.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/lib/googleToken.ts tests/convex/googleToken.test.ts
git commit -m "feat(scheduling): add google token expiry check"
```

---

## Task 3: Google token refresh (fetch-injected helper)

**Files:**
- Modify: `convex/lib/googleToken.ts`
- Test: `tests/convex/googleToken.test.ts`

- [ ] **Step 1: Write the failing test (append to existing file)**

```typescript
// append to tests/convex/googleToken.test.ts
import { refreshAccessToken } from "../../convex/lib/googleToken";

describe("refreshAccessToken", () => {
  it("posts the refresh token and returns new access token + expiry", async () => {
    let captured: { url: string; body: string } | null = null;
    const fakeFetch = (async (url: string, init: { body: string }) => {
      captured = { url, body: init.body };
      return {
        ok: true,
        json: async () => ({ access_token: "new-at", expires_in: 3600 }),
      };
    }) as unknown as typeof fetch;

    const result = await refreshAccessToken(
      { refreshToken: "rt", clientId: "cid", clientSecret: "sec", nowMs: 1_000 },
      fakeFetch,
    );

    expect(result.access_token).toBe("new-at");
    expect(result.expiry).toBe(1_000 + 3600 * 1000);
    expect(captured!.url).toBe("https://oauth2.googleapis.com/token");
    expect(captured!.body).toContain("grant_type=refresh_token");
    expect(captured!.body).toContain("refresh_token=rt");
  });

  it("throws when the refresh request fails", async () => {
    const fakeFetch = (async () => ({ ok: false, text: async () => "boom" })) as unknown as typeof fetch;
    await expect(
      refreshAccessToken(
        { refreshToken: "rt", clientId: "cid", clientSecret: "sec", nowMs: 0 },
        fakeFetch,
      ),
    ).rejects.toThrow("token refresh failed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/convex/googleToken.test.ts`
Expected: FAIL — `refreshAccessToken` not exported.

- [ ] **Step 3: Add the implementation to `convex/lib/googleToken.ts`**

```typescript
// append to convex/lib/googleToken.ts
export interface RefreshInput {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  nowMs: number;
}

export interface RefreshedToken {
  access_token: string;
  expiry: number;
}

export async function refreshAccessToken(
  input: RefreshInput,
  fetchImpl: typeof fetch,
): Promise<RefreshedToken> {
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`token refresh failed: ${await res.text()}`);
  }
  const data = await res.json();
  return {
    access_token: data.access_token,
    expiry: input.nowMs + (data.expires_in ?? 3600) * 1000,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/convex/googleToken.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/lib/googleToken.ts tests/convex/googleToken.test.ts
git commit -m "feat(scheduling): add google access-token refresh helper"
```

---

## Task 4: Wire token refresh into calendar reads

**Files:**
- Modify: `convex/calendar.ts` (add `ensureFreshToken` internal action + a patch mutation)
- Modify: `convex/slot_calculator.ts` (use fresh token before reading)
- Test: `tests/convex/calendar_refresh.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/convex/calendar_refresh.test.ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as calendar from "../../convex/calendar";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "calendar.ts": async () => calendar,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("persistRefreshedToken", () => {
  it("updates the stored access token and expiry for a calendar", async () => {
    const t = convexTest(schema, modules);
    const calId = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      return ctx.db.insert("interviewerCalendars", {
        userId: "u1", schoolId,
        googleTokens: { access_token: "old", refresh_token: "rt", expiry: 1 },
        googleEmail: "i@s.com", calendarId: "primary",
      });
    });

    await t.mutation(apiModule.internal.calendar.persistRefreshedToken, {
      calendarId: calId, accessToken: "fresh", expiry: 999_999,
    });

    const updated = await t.run((ctx) => ctx.db.get(calId));
    expect(updated?.googleTokens.access_token).toBe("fresh");
    expect(updated?.googleTokens.expiry).toBe(999_999);
    expect(updated?.googleTokens.refresh_token).toBe("rt");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/convex/calendar_refresh.test.ts`
Expected: FAIL — `persistRefreshedToken` not defined.

- [ ] **Step 3: Add `persistRefreshedToken` and `ensureFreshToken` to `convex/calendar.ts`**

Add imports at the top of `convex/calendar.ts` (alongside existing imports):

```typescript
import { internalAction } from "./_generated/server";
import { needsRefresh, refreshAccessToken } from "./lib/googleToken";
```

Append these exports:

```typescript
export const persistRefreshedToken = internalMutation({
  args: {
    calendarId: v.id("interviewerCalendars"),
    accessToken: v.string(),
    expiry: v.number(),
  },
  handler: async (ctx, args) => {
    const cal = await ctx.db.get(args.calendarId);
    if (!cal) return;
    await ctx.db.patch(args.calendarId, {
      googleTokens: {
        access_token: args.accessToken,
        refresh_token: cal.googleTokens.refresh_token,
        expiry: args.expiry,
      },
    });
  },
});

// Returns a non-expired access token for a stored calendar, refreshing if needed.
export const ensureFreshToken = internalAction({
  args: {
    calendarId: v.id("interviewerCalendars"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiry: v.number(),
  },
  handler: async (ctx, args): Promise<string> => {
    if (!needsRefresh(args.expiry, Date.now())) return args.accessToken;
    const refreshed = await refreshAccessToken(
      {
        refreshToken: args.refreshToken,
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        nowMs: Date.now(),
      },
      fetch,
    );
    await ctx.runMutation(internal.calendar.persistRefreshedToken, {
      calendarId: args.calendarId,
      accessToken: refreshed.access_token,
      expiry: refreshed.expiry,
    });
    return refreshed.access_token;
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/convex/calendar_refresh.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Use the fresh token in `slot_calculator.ts`**

In `convex/slot_calculator.ts`, the `getAvailableSlotsForDate` loop currently reads `cal.googleTokens.access_token` directly. The `getInterviewerCalendarsForSchool` query returns documents that include `_id`. Replace the body of the `for (const cal of interviewerCalendars)` loop so it refreshes first:

```typescript
    for (const cal of interviewerCalendars) {
      try {
        const accessToken: string = await ctx.runAction(
          internal.calendar.ensureFreshToken,
          {
            calendarId: cal._id,
            accessToken: cal.googleTokens.access_token,
            refreshToken: cal.googleTokens.refresh_token,
            expiry: cal.googleTokens.expiry,
          },
        );
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendarId)}/events?timeMin=${new Date(dateStart).toISOString()}&timeMax=${new Date(dateEnd).toISOString()}&singleEvents=true&orderBy=startTime`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (response.ok) {
          const data = await response.json();
          for (const event of data.items ?? []) {
            if (event.start?.dateTime && event.end?.dateTime) {
              busyBlocks.push({
                start: new Date(event.start.dateTime).getTime(),
                end: new Date(event.end.dateTime).getTime(),
              });
            }
          }
        }
      } catch {
        // Skip unavailable calendars
      }
    }
```

- [ ] **Step 6: Run the existing calendar/slot tests to confirm no regression**

Run: `bun run test -- tests/convex/calendar_refresh.test.ts tests/convex/scheduling_schema.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add convex/calendar.ts convex/slot_calculator.ts tests/convex/calendar_refresh.test.ts
git commit -m "fix(scheduling): refresh expired google tokens before reading calendars"
```

---

## Task 5: Create Google Calendar event with attendees + Meet link

**Files:**
- Modify: `convex/calendar.ts` (add `createGoogleEvent` action)
- Test: `tests/convex/calendar_create_event.test.ts`

- [ ] **Step 1: Write the failing test**

This test injects a fake `fetch` via a module-level override hook so no network call happens. We expose the request-builder as a pure function and test it directly.

```typescript
// tests/convex/calendar_create_event.test.ts
import { describe, it, expect } from "vitest";
import { buildEventInsertBody } from "../../convex/calendar";

describe("buildEventInsertBody", () => {
  it("includes summary, start/end ISO, all attendees, and a Meet conference request", () => {
    const body = buildEventInsertBody({
      summary: "Demo Lesson - Math",
      startMs: Date.UTC(2026, 5, 1, 9, 0),
      endMs: Date.UTC(2026, 5, 1, 9, 45),
      attendeeEmails: ["i1@s.com", "i2@s.com", "cand@x.com"],
    });
    expect(body.summary).toBe("Demo Lesson - Math");
    expect(body.start.dateTime).toBe(new Date(Date.UTC(2026, 5, 1, 9, 0)).toISOString());
    expect(body.end.dateTime).toBe(new Date(Date.UTC(2026, 5, 1, 9, 45)).toISOString());
    expect(body.attendees.map((a) => a.email)).toEqual(["i1@s.com", "i2@s.com", "cand@x.com"]);
    expect(body.conferenceData.createRequest.requestId).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/convex/calendar_create_event.test.ts`
Expected: FAIL — `buildEventInsertBody` not exported.

- [ ] **Step 3: Add the pure builder + the action to `convex/calendar.ts`**

```typescript
// append to convex/calendar.ts
export interface EventInsertInput {
  summary: string;
  startMs: number;
  endMs: number;
  attendeeEmails: string[];
}

export function buildEventInsertBody(input: EventInsertInput) {
  return {
    summary: input.summary,
    start: { dateTime: new Date(input.startMs).toISOString() },
    end: { dateTime: new Date(input.endMs).toISOString() },
    attendees: input.attendeeEmails.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: `rr-${input.startMs}-${Math.floor(Math.random() * 1e9)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
}

export const createGoogleEvent = internalAction({
  args: {
    schoolId: v.id("schools"),
    summary: v.string(),
    startMs: v.number(),
    endMs: v.number(),
    candidateEmail: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ googleEventId: string | null; meetLink: string | null }> => {
    const calendars = await ctx.runQuery(
      internal.calendar.getInterviewerCalendarsForSchool,
      { schoolId: args.schoolId },
    );
    if (calendars.length === 0) return { googleEventId: null, meetLink: null };

    const organizer = calendars[0];
    const accessToken = await ctx.runAction(internal.calendar.ensureFreshToken, {
      calendarId: organizer._id,
      accessToken: organizer.googleTokens.access_token,
      refreshToken: organizer.googleTokens.refresh_token,
      expiry: organizer.googleTokens.expiry,
    });

    const attendeeEmails = [
      ...calendars.map((c) => c.googleEmail),
      args.candidateEmail,
    ];

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(organizer.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildEventInsertBody({
            summary: args.summary,
            startMs: args.startMs,
            endMs: args.endMs,
            attendeeEmails,
          }),
        ),
      },
    );

    if (!res.ok) return { googleEventId: null, meetLink: null };
    const data = await res.json();
    return {
      googleEventId: data.id ?? null,
      meetLink: data.hangoutLink ?? null,
    };
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/convex/calendar_create_event.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add convex/calendar.ts tests/convex/calendar_create_event.test.ts
git commit -m "feat(scheduling): create google calendar event with attendees and meet link"
```

---

## Task 6: Availability matching (pure helpers)

**Files:**
- Create: `convex/scheduling_match.ts`
- Test: `tests/convex/scheduling_match.test.ts`

A "slot" is `{ startMs: number; endMs: number }`. A "proposal" is also `{ startMs, endMs }`. A proposal *matches* a free slot if the slot fully contains the proposal start (slot.startMs <= proposal.startMs < slot.endMs). We return the first free slot whose start equals a proposed slot start, else null.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/convex/scheduling_match.test.ts
import { describe, it, expect } from "vitest";
import { matchProposalToSlots, pickCounterProposals } from "../../convex/scheduling_match";

const slot = (startMs: number, endMs: number) => ({ startMs, endMs });

describe("matchProposalToSlots", () => {
  it("returns the free slot whose start matches a proposal", () => {
    const free = [slot(100, 200), slot(300, 400)];
    const proposals = [slot(300, 400)];
    expect(matchProposalToSlots(proposals, free)).toEqual(slot(300, 400));
  });

  it("returns null when no proposal lines up with a free slot", () => {
    const free = [slot(100, 200)];
    const proposals = [slot(500, 600)];
    expect(matchProposalToSlots(proposals, free)).toBeNull();
  });

  it("matches on the earliest proposal that is free", () => {
    const free = [slot(300, 400)];
    const proposals = [slot(500, 600), slot(300, 400)];
    expect(matchProposalToSlots(proposals, free)).toEqual(slot(300, 400));
  });
});

describe("pickCounterProposals", () => {
  it("returns the N earliest free slots sorted by start", () => {
    const free = [slot(500, 600), slot(100, 200), slot(300, 400)];
    expect(pickCounterProposals(free, 2)).toEqual([slot(100, 200), slot(300, 400)]);
  });

  it("returns all slots when fewer than N exist", () => {
    const free = [slot(100, 200)];
    expect(pickCounterProposals(free, 3)).toEqual([slot(100, 200)]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/convex/scheduling_match.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// convex/scheduling_match.ts
export interface Slot {
  startMs: number;
  endMs: number;
}

export function matchProposalToSlots(
  proposals: Slot[],
  freeSlots: Slot[],
): Slot | null {
  for (const proposal of proposals) {
    const hit = freeSlots.find((s) => s.startMs === proposal.startMs);
    if (hit) return hit;
  }
  return null;
}

export function pickCounterProposals(freeSlots: Slot[], n: number): Slot[] {
  return [...freeSlots].sort((a, b) => a.startMs - b.startMs).slice(0, n);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/convex/scheduling_match.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/scheduling_match.ts tests/convex/scheduling_match.test.ts
git commit -m "feat(scheduling): add availability matching helpers"
```

---

## Task 7: Reply text builders (pure helpers)

**Files:**
- Create: `convex/scheduling_reply.ts`
- Test: `tests/convex/scheduling_reply.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/convex/scheduling_reply.test.ts
import { describe, it, expect } from "vitest";
import {
  buildConfirmationReply,
  buildCounterProposalReply,
  buildNoAvailabilityReply,
  formatSlotLabel,
} from "../../convex/scheduling_reply";

describe("formatSlotLabel", () => {
  it("formats a slot in the given IANA timezone", () => {
    const label = formatSlotLabel(Date.UTC(2026, 5, 1, 3, 30), "Asia/Kolkata");
    // 03:30 UTC == 09:00 IST
    expect(label).toContain("9:00");
  });
});

describe("buildConfirmationReply", () => {
  it("confirms the booked time and includes the meet link when present", () => {
    const text = buildConfirmationReply({
      candidateName: "Asha",
      slotLabel: "Mon, 1 Jun, 9:00 AM",
      meetLink: "https://meet.google.com/abc",
    });
    expect(text).toContain("Asha");
    expect(text).toContain("Mon, 1 Jun, 9:00 AM");
    expect(text).toContain("https://meet.google.com/abc");
  });

  it("omits the meet line when there is no link", () => {
    const text = buildConfirmationReply({
      candidateName: "Asha", slotLabel: "Mon, 1 Jun, 9:00 AM", meetLink: null,
    });
    expect(text).not.toContain("meet.google.com");
  });
});

describe("buildCounterProposalReply", () => {
  it("lists the offered slots", () => {
    const text = buildCounterProposalReply({
      candidateName: "Asha",
      slotLabels: ["Mon 9:00 AM", "Tue 10:00 AM"],
    });
    expect(text).toContain("Mon 9:00 AM");
    expect(text).toContain("Tue 10:00 AM");
  });
});

describe("buildNoAvailabilityReply", () => {
  it("includes the booking url fallback", () => {
    const text = buildNoAvailabilityReply({
      candidateName: "Asha", bookingUrl: "https://r.com/book/xyz",
    });
    expect(text).toContain("https://r.com/book/xyz");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/convex/scheduling_reply.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// convex/scheduling_reply.ts
export function formatSlotLabel(startMs: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(startMs));
}

export function buildConfirmationReply(input: {
  candidateName: string;
  slotLabel: string;
  meetLink: string | null;
}): string {
  const lines = [
    `Hi ${input.candidateName}, you are confirmed for ${input.slotLabel}.`,
  ];
  if (input.meetLink) {
    lines.push(`Join here: ${input.meetLink}`);
  }
  lines.push("Looking forward to it.");
  return lines.join(" ");
}

export function buildCounterProposalReply(input: {
  candidateName: string;
  slotLabels: string[];
}): string {
  const options = input.slotLabels.map((l, i) => `${i + 1}. ${l}`).join("\n");
  return `Hi ${input.candidateName}, those times are taken. Here are the closest open slots:\n${options}\nReply with the one that works and I will lock it in.`;
}

export function buildNoAvailabilityReply(input: {
  candidateName: string;
  bookingUrl: string;
}): string {
  return `Hi ${input.candidateName}, I could not find an open slot matching that. Please pick any available time here: ${input.bookingUrl}.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/convex/scheduling_reply.test.ts`
Expected: PASS (6 tests). Note: the `formatSlotLabel` assertion checks for `"9:00"`; if the runtime locale renders a narrow no-break space, the substring `9:00` still matches.

- [ ] **Step 5: Commit**

```bash
git add convex/scheduling_reply.ts tests/convex/scheduling_reply.test.ts
git commit -m "feat(scheduling): add negotiation reply builders"
```

---

## Task 8: Extract proposed times from a candidate message (LLM helper)

**Files:**
- Create: `convex/prompts/schedulingExtract.ts`
- Create: `convex/scheduling_extract.ts`
- Test: `tests/convex/scheduling_extract.test.ts`

The LLM receives the candidate message, the school timezone, and the current ISO time, and returns JSON: `{ proposals: [{ start: ISO, end: ISO }] }`. The helper converts ISO -> epoch ms and drops malformed entries. If the model returns nothing parseable, `proposals` is `[]`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/convex/scheduling_extract.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
vi.mock("../../convex/lib/llmClient", () => ({
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
  LLM_MODEL: "test-model",
}));

import { extractProposedTimes } from "../../convex/scheduling_extract";

beforeEach(() => mockCreate.mockReset());

describe("extractProposedTimes", () => {
  it("converts ISO proposals to epoch ms", async () => {
    const startIso = "2026-06-01T09:00:00+05:30";
    const endIso = "2026-06-01T09:45:00+05:30";
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ proposals: [{ start: startIso, end: endIso }] }) } }],
    });
    const result = await extractProposedTimes({
      replyText: "Can we do 9am on June 1?",
      timezone: "Asia/Kolkata",
      nowMs: Date.UTC(2026, 4, 29),
    });
    expect(result.proposals).toEqual([
      { startMs: new Date(startIso).getTime(), endMs: new Date(endIso).getTime() },
    ]);
  });

  it("returns no proposals when the model gives unparseable JSON", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: "nope" } }] });
    const result = await extractProposedTimes({
      replyText: "hi", timezone: "Asia/Kolkata", nowMs: 0,
    });
    expect(result.proposals).toEqual([]);
  });

  it("drops entries with invalid dates", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ proposals: [{ start: "not-a-date", end: "also-bad" }] }) } }],
    });
    const result = await extractProposedTimes({
      replyText: "x", timezone: "Asia/Kolkata", nowMs: 0,
    });
    expect(result.proposals).toEqual([]);
  });

  it("returns no proposals when there is no LLM client", async () => {
    vi.resetModules();
    vi.doMock("../../convex/lib/llmClient", () => ({ getLlmClient: () => null, LLM_MODEL: "test-model" }));
    const { extractProposedTimes: fn } = await import("../../convex/scheduling_extract");
    const result = await fn({ replyText: "x", timezone: "Asia/Kolkata", nowMs: 0 });
    expect(result.proposals).toEqual([]);
    vi.doUnmock("../../convex/lib/llmClient");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/convex/scheduling_extract.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the prompt**

```typescript
// convex/prompts/schedulingExtract.ts
export const SCHEDULING_EXTRACT_SYSTEM = `You extract proposed interview times from a candidate's reply.
You are given the candidate's message, an IANA timezone, and the current time in ISO 8601.
Return STRICT JSON: {"proposals":[{"start":"<ISO 8601 with offset>","end":"<ISO 8601 with offset>"}]}.
Rules:
- Resolve relative phrases ("tomorrow afternoon", "Tuesday at 3") against the current time and timezone.
- Always emit offset-qualified ISO 8601 (e.g. 2026-06-01T09:00:00+05:30) in the given timezone.
- If a duration is not stated, make each proposal 45 minutes long.
- If the message proposes no concrete time, return {"proposals":[]}.
- Output JSON only, no prose.`;
```

- [ ] **Step 4: Write the helper**

```typescript
// convex/scheduling_extract.ts
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";
import { SCHEDULING_EXTRACT_SYSTEM } from "./prompts/schedulingExtract";

export interface ExtractInput {
  replyText: string;
  timezone: string;
  nowMs: number;
}

export interface ExtractOutput {
  proposals: Array<{ startMs: number; endMs: number }>;
}

export async function extractProposedTimes(input: ExtractInput): Promise<ExtractOutput> {
  const client = getLlmClient();
  if (!client) return { proposals: [] };
  try {
    const res = await client.chat.completions.create({
      model: LLM_MODEL,
      max_tokens: 300,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SCHEDULING_EXTRACT_SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            message: input.replyText,
            timezone: input.timezone,
            now: new Date(input.nowMs).toISOString(),
          }),
        },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed.proposals) ? parsed.proposals : [];
    const proposals: Array<{ startMs: number; endMs: number }> = [];
    for (const p of list) {
      const startMs = new Date(p.start).getTime();
      const endMs = new Date(p.end).getTime();
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
        proposals.push({ startMs, endMs });
      }
    }
    return { proposals };
  } catch {
    return { proposals: [] };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test -- tests/convex/scheduling_extract.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add convex/scheduling_extract.ts convex/prompts/schedulingExtract.ts tests/convex/scheduling_extract.test.ts
git commit -m "feat(scheduling): extract proposed interview times from candidate replies"
```

---

## Task 9: Available slots across a date range (internal action)

**Files:**
- Modify: `convex/slot_calculator.ts` (add `getAvailableSlotsInRange`)
- Test: `tests/convex/slot_range.test.ts`

`getAvailableSlotsForDate` already computes free slots for one date. We add an internal action that, given a set of `dateStrings` (the distinct calendar days of the candidate's proposals plus the next few days for counter-proposals), returns the flattened free slots. It reuses `getAvailableSlotsForDate` per day to avoid duplicating the Google-read logic.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/convex/slot_range.test.ts
import { describe, it, expect } from "vitest";
import { distinctDateStrings } from "../../convex/slot_calculator";

describe("distinctDateStrings", () => {
  it("returns the unique YYYY-MM-DD days covering the given proposal starts", () => {
    const d1 = Date.UTC(2026, 5, 1, 9, 0);
    const d2 = Date.UTC(2026, 5, 1, 14, 0); // same day
    const d3 = Date.UTC(2026, 5, 3, 9, 0);
    const days = distinctDateStrings([d1, d2, d3], "UTC");
    expect(days).toEqual(["2026-06-01", "2026-06-03"]);
  });

  it("returns an empty array for no inputs", () => {
    expect(distinctDateStrings([], "UTC")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/convex/slot_range.test.ts`
Expected: FAIL — `distinctDateStrings` not exported.

- [ ] **Step 3: Add `distinctDateStrings` and `getAvailableSlotsInRange` to `convex/slot_calculator.ts`**

Add the pure helper near the top (after the existing `minutesToTime`):

```typescript
export function distinctDateStrings(startMsList: number[], timezone: string): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone,
  });
  const seen = new Set<string>();
  for (const ms of startMsList) {
    seen.add(fmt.format(new Date(ms))); // en-CA gives YYYY-MM-DD
  }
  return [...seen].sort();
}
```

Append the action (after `getAvailableSlotsForDate`):

```typescript
export const getAvailableSlotsInRange = action({
  args: { schoolId: v.id("schools"), dates: v.array(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<{ start: string; end: string; startMs: number; endMs: number }[]> => {
    const all: { start: string; end: string; startMs: number; endMs: number }[] = [];
    for (const date of args.dates) {
      const slots = await ctx.runAction(api.slot_calculator.getAvailableSlotsForDate, {
        schoolId: args.schoolId,
        date,
      });
      all.push(...slots);
    }
    return all.sort((a, b) => a.startMs - b.startMs);
  },
});
```

Add `api` to the imports at the top of `convex/slot_calculator.ts`:

```typescript
import { internal, api } from "./_generated/api";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/convex/slot_range.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add convex/slot_calculator.ts tests/convex/slot_range.test.ts
git commit -m "feat(scheduling): compute available slots across multiple dates"
```

---

## Task 10: Orchestration — negotiate, book, escalate

**Files:**
- Create: `convex/scheduling.ts`
- Test: `tests/convex/scheduling_negotiate.test.ts`

This is the state machine. `negotiate` is an internal action invoked by `conversation.handleInbound`. Flow:

1. Load/create the `schedulingNegotiations` row for the application; if `rounds >= MAX_NEGOTIATION_ROUNDS`, escalate and stop.
2. Extract proposed times from the candidate message.
3. Compute candidate days (from proposals) plus a fallback window of the next `advanceDays` (capped at 5 days) for counter-proposals; fetch free slots in range.
4. If a proposal matches a free slot: auto-book (create the calendar event, advance the pipeline stage, mark negotiation `booked`) and queue a confirmation reply.
5. Else: pick up to 3 counter-proposals and queue a counter-proposal reply; if there are zero free slots at all, queue the booking-link fallback. Increment `rounds`.

We split the network/DB into small internal mutations/queries so the action stays thin, and we expose `decideNextStep` as a pure function for unit testing the branching.

- [ ] **Step 1: Write the failing test for the pure decision function**

```typescript
// tests/convex/scheduling_negotiate.test.ts
import { describe, it, expect } from "vitest";
import { decideNextStep } from "../../convex/scheduling";

const slot = (startMs: number, endMs: number) => ({ startMs, endMs });

describe("decideNextStep", () => {
  it("escalates when the round cap is reached", () => {
    const d = decideNextStep({ rounds: 4, proposals: [], freeSlots: [] });
    expect(d.action).toBe("escalate");
  });

  it("books when a proposal matches a free slot", () => {
    const d = decideNextStep({
      rounds: 1, proposals: [slot(300, 400)], freeSlots: [slot(300, 400)],
    });
    expect(d.action).toBe("book");
    if (d.action === "book") expect(d.slot).toEqual(slot(300, 400));
  });

  it("counter-proposes the nearest free slots when nothing matches", () => {
    const d = decideNextStep({
      rounds: 1, proposals: [slot(900, 1000)], freeSlots: [slot(300, 400), slot(500, 600)],
    });
    expect(d.action).toBe("counter");
    if (d.action === "counter") expect(d.slots).toEqual([slot(300, 400), slot(500, 600)]);
  });

  it("falls back to a booking link when there is no availability at all", () => {
    const d = decideNextStep({ rounds: 1, proposals: [slot(900, 1000)], freeSlots: [] });
    expect(d.action).toBe("fallback");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/convex/scheduling_negotiate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `decideNextStep` and the surrounding orchestration in `convex/scheduling.ts`**

```typescript
// convex/scheduling.ts
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { extractProposedTimes } from "./scheduling_extract";
import { matchProposalToSlots, pickCounterProposals, type Slot } from "./scheduling_match";
import {
  buildConfirmationReply,
  buildCounterProposalReply,
  buildNoAvailabilityReply,
  formatSlotLabel,
} from "./scheduling_reply";
import { distinctDateStrings } from "./slot_calculator";

export const MAX_NEGOTIATION_ROUNDS = 4;
const COUNTER_PROPOSAL_COUNT = 3;
const FALLBACK_WINDOW_DAYS = 5;

export type Decision =
  | { action: "escalate" }
  | { action: "book"; slot: Slot }
  | { action: "counter"; slots: Slot[] }
  | { action: "fallback" };

export function decideNextStep(input: {
  rounds: number;
  proposals: Slot[];
  freeSlots: Slot[];
}): Decision {
  if (input.rounds >= MAX_NEGOTIATION_ROUNDS) return { action: "escalate" };
  const match = matchProposalToSlots(input.proposals, input.freeSlots);
  if (match) return { action: "book", slot: match };
  if (input.freeSlots.length === 0) return { action: "fallback" };
  return {
    action: "counter",
    slots: pickCounterProposals(input.freeSlots, COUNTER_PROPOSAL_COUNT),
  };
}

export const loadOrCreateNegotiation = internalMutation({
  args: { applicationId: v.id("applications"), schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("schedulingNegotiations")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", args.applicationId))
      .first();
    if (existing) return existing;
    const id = await ctx.db.insert("schedulingNegotiations", {
      applicationId: args.applicationId,
      schoolId: args.schoolId,
      rounds: 0,
      status: "negotiating",
      updatedAt: Date.now(),
    });
    return (await ctx.db.get(id))!;
  },
});

export const recordRound = internalMutation({
  args: {
    negotiationId: v.id("schedulingNegotiations"),
    rounds: v.number(),
    status: v.union(v.literal("negotiating"), v.literal("booked"), v.literal("escalated")),
    lastProposedSlots: v.optional(
      v.array(v.object({ startMs: v.number(), endMs: v.number() })),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.negotiationId, {
      rounds: args.rounds,
      status: args.status,
      lastProposedSlots: args.lastProposedSlots,
      updatedAt: Date.now(),
    });
  },
});

export const bookAgreedSlot = internalMutation({
  args: {
    applicationId: v.id("applications"),
    schoolId: v.id("schools"),
    startMs: v.number(),
    endMs: v.number(),
    googleEventId: v.optional(v.string()),
    meetLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("calendarEvents", {
      applicationId: args.applicationId,
      schoolId: args.schoolId,
      googleEventId: args.googleEventId ?? `rr_${args.applicationId}_${args.startMs}`,
      summary: "Demo Lesson",
      start: args.startMs,
      end: args.endMs,
      attendees: [],
      meetLink: args.meetLink,
    });
    const app = await ctx.db.get(args.applicationId);
    if (!app) return;
    const config = await ctx.db
      .query("pipelineConfigs")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
    if (config) {
      const transition = config.transitions.find((t) => t.fromStageId === app.stage);
      if (transition) await ctx.db.patch(args.applicationId, { stage: transition.toStageId });
    }
  },
});

export const negotiate = internalAction({
  args: {
    messageId: v.id("outreachMessages"),
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    schoolId: v.id("schools"),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    replyText: v.string(),
    candidateName: v.string(),
    candidateEmail: v.optional(v.string()),
    schoolName: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const negotiation = await ctx.runMutation(internal.scheduling.loadOrCreateNegotiation, {
      applicationId: args.applicationId,
      schoolId: args.schoolId,
    });

    const slotConfig = await ctx.runQuery(internal.slot_calculator.getSlotConfigInternal, {
      schoolId: args.schoolId,
    });
    const timezone = slotConfig?.timezone ?? "Asia/Kolkata";

    const { proposals } = await extractProposedTimes({
      replyText: args.replyText,
      timezone,
      nowMs: Date.now(),
    });

    // Days to check: the candidate's proposed days, plus a fallback window.
    const proposalStarts = proposals.map((p) => p.startMs);
    const fallbackStarts: number[] = [];
    for (let i = 1; i <= FALLBACK_WINDOW_DAYS; i++) {
      fallbackStarts.push(Date.now() + i * 24 * 60 * 60 * 1000);
    }
    const dates = distinctDateStrings([...proposalStarts, ...fallbackStarts], timezone);
    const freeRaw = await ctx.runAction(api.slot_calculator.getAvailableSlotsInRange, {
      schoolId: args.schoolId,
      dates,
    });
    const freeSlots: Slot[] = freeRaw.map((s) => ({ startMs: s.startMs, endMs: s.endMs }));

    const decision = decideNextStep({ rounds: negotiation.rounds, proposals, freeSlots });

    if (decision.action === "escalate") {
      await ctx.runMutation(internal.scheduling.recordRound, {
        negotiationId: negotiation._id,
        rounds: negotiation.rounds,
        status: "escalated",
      });
      await ctx.runMutation(internal.conversation.escalate, {
        messageId: args.messageId,
        reason: "scheduling_max_rounds",
      });
      return;
    }

    if (decision.action === "book") {
      let googleEventId: string | undefined;
      let meetLink: string | undefined;
      if (args.candidateEmail) {
        const ev = await ctx.runAction(internal.calendar.createGoogleEvent, {
          schoolId: args.schoolId,
          summary: `Demo Lesson - ${args.schoolName}`,
          startMs: decision.slot.startMs,
          endMs: decision.slot.endMs,
          candidateEmail: args.candidateEmail,
        });
        googleEventId = ev.googleEventId ?? undefined;
        meetLink = ev.meetLink ?? undefined;
      }
      await ctx.runMutation(internal.scheduling.bookAgreedSlot, {
        applicationId: args.applicationId,
        schoolId: args.schoolId,
        startMs: decision.slot.startMs,
        endMs: decision.slot.endMs,
        googleEventId,
        meetLink,
      });
      await ctx.runMutation(internal.scheduling.recordRound, {
        negotiationId: negotiation._id,
        rounds: negotiation.rounds + 1,
        status: "booked",
      });
      const body = buildConfirmationReply({
        candidateName: args.candidateName,
        slotLabel: formatSlotLabel(decision.slot.startMs, timezone),
        meetLink: meetLink ?? null,
      });
      await ctx.runMutation(internal.conversation.insertAgentReply, {
        applicationId: args.applicationId,
        candidateId: args.candidateId,
        schoolId: args.schoolId,
        channel: args.channel,
        body,
        schedule: true,
        inReplyToMessageId: args.messageId,
      });
      await ctx.runMutation(internal.conversation.markProcessed, { messageId: args.messageId });
      return;
    }

    if (decision.action === "fallback") {
      const token: string = await ctx.runMutation(api.booking.generateBookingToken, {
        applicationId: args.applicationId,
        schoolId: args.schoolId,
      });
      const bookingUrl = `${process.env.PUBLIC_BASE_URL ?? "https://rolerecruit.com"}/book/${token}`;
      const body = buildNoAvailabilityReply({ candidateName: args.candidateName, bookingUrl });
      await ctx.runMutation(internal.scheduling.recordRound, {
        negotiationId: negotiation._id,
        rounds: negotiation.rounds + 1,
        status: "negotiating",
      });
      await ctx.runMutation(internal.conversation.insertAgentReply, {
        applicationId: args.applicationId,
        candidateId: args.candidateId,
        schoolId: args.schoolId,
        channel: args.channel,
        body,
        schedule: true,
        inReplyToMessageId: args.messageId,
      });
      await ctx.runMutation(internal.conversation.markProcessed, { messageId: args.messageId });
      return;
    }

    // counter
    const body = buildCounterProposalReply({
      candidateName: args.candidateName,
      slotLabels: decision.slots.map((s) => formatSlotLabel(s.startMs, timezone)),
    });
    await ctx.runMutation(internal.scheduling.recordRound, {
      negotiationId: negotiation._id,
      rounds: negotiation.rounds + 1,
      status: "negotiating",
      lastProposedSlots: decision.slots,
    });
    await ctx.runMutation(internal.conversation.insertAgentReply, {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      schoolId: args.schoolId,
      channel: args.channel,
      body,
      schedule: true,
      inReplyToMessageId: args.messageId,
    });
    await ctx.runMutation(internal.conversation.markProcessed, { messageId: args.messageId });
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/convex/scheduling_negotiate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add an integration test for `bookAgreedSlot` (state + stage advance)**

```typescript
// append to tests/convex/scheduling_negotiate.test.ts
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as scheduling from "../../convex/scheduling";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "scheduling.ts": async () => scheduling,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("bookAgreedSlot", () => {
  it("inserts a calendar event and advances the pipeline stage", async () => {
    const t = convexTest(schema, modules);
    const { applicationId, schoolId } = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      const candidateId = await ctx.db.insert("candidates", {
        name: "A", qualifications: [], certifications: [], boardExperience: [],
        subjects: [], talentBankFlag: false,
      });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE",
        qualifications: [], naturalLanguageDescription: "d", status: "active",
        createdAt: Date.now(),
      });
      const applicationId = await ctx.db.insert("applications", {
        schoolId, candidateId, jobPostingId: jobId, stage: "shortlisted",
        appliedAt: Date.now(),
      });
      await ctx.db.insert("pipelineConfigs", {
        schoolId,
        transitions: [{ fromStageId: "shortlisted", toStageId: "demo_scheduled" }],
      });
      return { applicationId, schoolId };
    });

    await t.mutation(apiModule.internal.scheduling.bookAgreedSlot, {
      applicationId, schoolId, startMs: 1000, endMs: 2000,
      googleEventId: "ev123", meetLink: "https://meet.google.com/x",
    });

    const { app, events } = await t.run(async (ctx) => {
      const app = await ctx.db.get(applicationId);
      const events = await ctx.db
        .query("calendarEvents")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
        .collect();
      return { app, events };
    });
    expect(app?.stage).toBe("demo_scheduled");
    expect(events).toHaveLength(1);
    expect(events[0].meetLink).toBe("https://meet.google.com/x");
  });
});
```

NOTE: Confirm the `pipelineConfigs` table shape (fields `schoolId` and `transitions: [{ fromStageId, toStageId }]`) matches `convex/schema.ts` before running; adjust the insert in the test to match the real required fields if they differ.

- [ ] **Step 6: Run the integration test**

Run: `bun run test -- tests/convex/scheduling_negotiate.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 7: Commit**

```bash
git add convex/scheduling.ts tests/convex/scheduling_negotiate.test.ts
git commit -m "feat(scheduling): orchestrate negotiate/book/counter/escalate flow"
```

---

## Task 11: Route reschedule/negotiation intents into the scheduler

**Files:**
- Modify: `convex/conversation.ts` (the `reschedule`/`negotiation` branches in `handleInbound`)
- Test: `tests/convex/conversation_routing.test.ts`

Currently `handleInbound` escalates on `negotiation` and emits a static booking link on `reschedule`. We change both to delegate to `scheduling.negotiate`, passing the candidate context. The scheduler itself decides whether to book, counter, fall back, or escalate.

- [ ] **Step 1: Write the failing test**

This verifies the routing decision via a small exported pure function `shouldDelegateToScheduler(intent)` so we do not need to mock the entire action graph.

```typescript
// tests/convex/conversation_routing.test.ts
import { describe, it, expect } from "vitest";
import { shouldDelegateToScheduler } from "../../convex/conversation";

describe("shouldDelegateToScheduler", () => {
  it("delegates reschedule and negotiation", () => {
    expect(shouldDelegateToScheduler("reschedule")).toBe(true);
    expect(shouldDelegateToScheduler("negotiation")).toBe(true);
  });
  it("does not delegate faq or unclear", () => {
    expect(shouldDelegateToScheduler("faq")).toBe(false);
    expect(shouldDelegateToScheduler("unclear")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/convex/conversation_routing.test.ts`
Expected: FAIL — `shouldDelegateToScheduler` not exported.

- [ ] **Step 3: Add the pure router + rewire `handleInbound`**

In `convex/conversation.ts`, add near the top (after imports):

```typescript
export function shouldDelegateToScheduler(
  intent: "faq" | "reschedule" | "negotiation" | "unclear",
): boolean {
  return intent === "reschedule" || intent === "negotiation";
}
```

Replace the current `negotiation`/`unclear` escalation block and the `reschedule` block with this single delegation (keep `unclear` escalating):

```typescript
    if (classified.intent === "unclear") {
      await ctx.runMutation(internal.conversation.escalate, {
        messageId: args.messageId,
        reason: classified.intent,
      });
      return;
    }

    if (shouldDelegateToScheduler(classified.intent)) {
      if (app.stage === "rejected") {
        await ctx.runMutation(internal.conversation.escalate, {
          messageId: args.messageId,
          reason: "reschedule_on_rejected",
        });
        return;
      }
      await ctx.runAction(internal.scheduling.negotiate, {
        messageId: args.messageId,
        applicationId: app._id,
        candidateId: inbound.candidateId,
        schoolId: school._id,
        channel: inbound.channel,
        replyText: inbound.body,
        candidateName: candidate?.name ?? "there",
        candidateEmail: candidate?.email,
        schoolName: school.name,
      });
      return;
    }
```

Remove the now-dead import of `buildRescheduleReply` and the `api.booking.generateBookingToken` call from `conversation.ts` (the booking-link fallback now lives in `scheduling.ts`). Leave the FAQ branch untouched.

- [ ] **Step 4: Run the routing test**

Run: `bun run test -- tests/convex/conversation_routing.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full conversation + scheduling test set**

Run: `bun run test -- tests/convex/conversation_classify.test.ts tests/convex/conversation_routing.test.ts tests/convex/scheduling_negotiate.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck the whole convex surface**

Run: `bunx convex codegen && bunx tsc --noEmit`
Expected: No type errors. (Confirms `internal.scheduling.negotiate`, `api.slot_calculator.getAvailableSlotsInRange`, and the new mutations are all wired.)

- [ ] **Step 7: Commit**

```bash
git add convex/conversation.ts tests/convex/conversation_routing.test.ts
git commit -m "feat(scheduling): route reschedule and negotiation replies to the scheduler"
```

---

## Task 12: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the entire test suite**

Run: `bun run test`
Expected: All tests pass, including pre-existing suites (`conversation_classify`, `inbox`, `triage`, etc.).

- [ ] **Step 2: If anything fails, fix forward**

Investigate and fix the root cause (do not delete or skip tests). Re-run `bun run test` until green.

- [ ] **Step 3: Final commit if fixes were needed**

```bash
git add -A
git commit -m "test(scheduling): fix regressions surfaced by full suite"
```

---

## Self-Review Checklist (completed during authoring)

**Spec coverage:**
- Back-and-forth negotiation: Tasks 8 (extract), 9 (range availability), 10 (decide/counter loop), 11 (routing). ✓
- Based on interviewer schedules: Task 4 reads all interviewer calendars with refreshed tokens; Task 9 merges them. ✓
- Linked to Google Calendar (write-back with invite + Meet): Task 5. ✓
- Multiple people: Task 4 merges all interviewer busy blocks; Task 5 adds every interviewer + candidate as attendees. ✓
- Token-refresh latent bug: Tasks 2-4. ✓
- Round cap / escalation safety: Task 10 (`MAX_NEGOTIATION_ROUNDS`) + Task 11. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; every test step shows full test. ✓

**Type consistency:** `Slot = {startMs,endMs}` is defined in `scheduling_match.ts` and reused everywhere. `decideNextStep` returns a discriminated `Decision` union consumed in `negotiate`. `extractProposedTimes` returns `{proposals:{startMs,endMs}[]}` consumed by `decideNextStep`. `createGoogleEvent` returns `{googleEventId,meetLink}` consumed by `negotiate` -> `bookAgreedSlot`. ✓

**Open verification flag for the executor:** Task 10 Step 5 assumes the `pipelineConfigs` table has `{schoolId, transitions:[{fromStageId,toStageId}]}` (mirrored from the existing `confirmBooking` logic in `convex/booking.ts`). Confirm against `convex/schema.ts` before running and adjust the test insert if the required fields differ.
