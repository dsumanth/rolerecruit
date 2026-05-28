# Conversation Agent + Morning Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Outreach Conversation Agent (#2) and Pipeline Concierge / Morning Brief (#4) from the design spec at `docs/superpowers/specs/2026-05-28-conversation-agent-and-morning-brief-design.md`.

**Architecture:** Three phases. Phase 0 lands the shared schema migration. Phase 1 ships the Morning Brief end to end (smaller, proves the pipeline pattern, immediately visible). Phase 2 ships the Conversation Agent. Each backend file owns one responsibility (classify, draft, render, send) and is tested in isolation with `convex-test`.

**Tech Stack:** Convex (Node + TS), Next.js 14 App Router, Resend (email), Gupshup (WhatsApp), OpenAI-compatible LLM via `convex/lib/llmClient.ts`. Tests: Vitest + `convex-test`. Package manager: bun.

---

## Conventions used in every task

- Tests live in `tests/convex/` (not `convex/__tests__/`). Existing pattern: see `tests/convex/outreach.test.ts`.
- Run a single test file: `bun run vitest run tests/convex/<file>.test.ts`.
- Run all tests: `bun run test`.
- Commit messages follow the existing style: `feat(scope): ...`, `fix(scope): ...`, `refactor(scope): ...`, `test(scope): ...`, `docs(scope): ...`. NEVER add `Co-Authored-By` (project rule).
- TDD discipline (project rule): write failing test → run to confirm failure → minimum implementation → run to confirm pass → commit.
- All new schema fields use `v.optional()` (project rule).

---

# PHASE 0: Shared schema migration

### Task 1: Extend `outreachMessages` and `schools` schemas

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Open `convex/schema.ts` and extend the `outreachMessages` table definition**

In `convex/schema.ts`, locate the `outreachMessages: defineTable({ ... })` block (around line 396). Extend the `type` and `draftedBy` unions, then add the new optional fields, then add the new indexes.

Replace the entire `outreachMessages` table definition with:

```ts
  outreachMessages: defineTable({
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    type: v.union(
      v.literal("shortlist"),
      v.literal("demo_schedule"),
      v.literal("feedback_request"),
      v.literal("offer"),
      v.literal("rejection"),
      v.literal("custom"),
      v.literal("cross_role_suggestion"),
      v.literal("candidate_reply"),
      v.literal("agent_reply"),
    ),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    body: v.string(),
    sentAt: v.optional(v.number()),
    status: v.union(
      v.literal("draft_pending_approval"),
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("failed"),
    ),
    draftedBy: v.optional(v.union(
      v.literal("triage_agent"),
      v.literal("reverse_match_agent"),
      v.literal("conversation_agent"),
      v.literal("manual"),
    )),
    scheduledSendAt: v.optional(v.number()),
    externalId: v.optional(v.string()),
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
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_status_scheduledSendAt", ["status", "scheduledSendAt"])
    .index("by_replyToken", ["replyToken"])
    .index("by_schoolId_escalated", ["schoolId", "escalated"]),
```

- [ ] **Step 2: Extend the `schools` table with the four new fields**

In the same file, locate the `schools: defineTable({ ... })` block (around line 18). Inside the object literal (before the closing `})` and the indexes), add these four fields:

```ts
    faqContent: v.optional(v.string()),
    morningBriefRecipientUserIds: v.optional(v.array(v.string())),
    conversationAgentEnabled: v.optional(v.boolean()),
    morningBriefEnabled: v.optional(v.boolean()),
```

- [ ] **Step 3: Run typecheck to confirm the schema compiles**

Run: `bun run typecheck` (or `bun run build` if typecheck is not a script — check `package.json`).
Expected: PASS. If `typecheck` is not defined, run `bunx tsc --noEmit -p convex/tsconfig.json`.

- [ ] **Step 4: Run the existing convex test suite to confirm no regressions**

Run: `bun run test`
Expected: PASS. No existing test should break because all new fields are optional and we only added cases to unions.

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): extend outreachMessages + schools for conversation agent and morning brief"
```

---

# PHASE 1: Morning Brief

### Task 2: Create `convex/lib/stalled.ts` (pure function)

**Files:**
- Create: `convex/lib/stalled.ts`
- Test: `tests/convex/stalled.test.ts`

The "stalled" definition lives in one place so the morning brief and any future per-candidate badge stay consistent. Pure function, no I/O.

- [ ] **Step 1: Write the failing test**

Create `tests/convex/stalled.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isStalled, STALLED_DAYS } from "../../convex/lib/stalled";

const DAY = 24 * 60 * 60 * 1000;

describe("isStalled", () => {
  const now = 1_700_000_000_000;

  it("returns false for an application with no outbound messages", () => {
    expect(isStalled({ now, lastOutboundAt: null, lastInboundAt: null, stage: "shortlisted" })).toBe(false);
  });

  it("returns false at 4 days since last outbound (under threshold)", () => {
    expect(isStalled({ now, lastOutboundAt: now - 4 * DAY, lastInboundAt: null, stage: "shortlisted" })).toBe(false);
  });

  it("returns true at exactly 5 days since last outbound", () => {
    expect(isStalled({ now, lastOutboundAt: now - 5 * DAY, lastInboundAt: null, stage: "shortlisted" })).toBe(true);
  });

  it("returns false when an inbound reply landed after the outbound", () => {
    expect(isStalled({
      now,
      lastOutboundAt: now - 6 * DAY,
      lastInboundAt: now - 3 * DAY,
      stage: "shortlisted",
    })).toBe(false);
  });

  it("returns false for terminal stages", () => {
    expect(isStalled({ now, lastOutboundAt: now - 10 * DAY, lastInboundAt: null, stage: "rejected" })).toBe(false);
    expect(isStalled({ now, lastOutboundAt: now - 10 * DAY, lastInboundAt: null, stage: "hired" })).toBe(false);
    expect(isStalled({ now, lastOutboundAt: now - 10 * DAY, lastInboundAt: null, stage: "withdrawn" })).toBe(false);
  });

  it("exposes STALLED_DAYS as 5", () => {
    expect(STALLED_DAYS).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/convex/stalled.test.ts`
Expected: FAIL with "Cannot find module '../../convex/lib/stalled'".

- [ ] **Step 3: Write the minimal implementation**

Create `convex/lib/stalled.ts`:

```ts
export const STALLED_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const TERMINAL_STAGES = new Set(["rejected", "hired", "withdrawn"]);

export interface StalledInput {
  now: number;
  lastOutboundAt: number | null;
  lastInboundAt: number | null;
  stage: string;
}

export function isStalled(input: StalledInput): boolean {
  if (TERMINAL_STAGES.has(input.stage)) return false;
  if (input.lastOutboundAt == null) return false;
  if (input.lastInboundAt != null && input.lastInboundAt >= input.lastOutboundAt) return false;
  const ageMs = input.now - input.lastOutboundAt;
  return ageMs >= STALLED_DAYS * DAY_MS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run tests/convex/stalled.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/stalled.ts tests/convex/stalled.test.ts
git commit -m "feat(morning-brief): stalled definition lib"
```

---

### Task 3: Create `convex/morningBrief_stats.ts` (data layer)

**Files:**
- Create: `convex/morningBrief_stats.ts`
- Test: `tests/convex/morningBrief_stats.test.ts`

Pure data layer that produces the numbers the brief renders. Reads `applications`, `outreachMessages`, `bookings`, `schools`.

- [ ] **Step 1: Write the failing test**

Create `tests/convex/morningBrief_stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as outreach from "../../convex/outreach";
import * as morningBriefStats from "../../convex/morningBrief_stats";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "outreach.ts": async () => outreach,
  "morningBrief_stats.ts": async () => morningBriefStats,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("collectStats", () => {
  it("returns zeros for an empty school", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Empty", board: "CBSE", city: "X", state: "X",
    });
    const stats = await t.query("morningBrief_stats:collectStats", { schoolId });
    expect(stats.newApps24h.count).toBe(0);
    expect(stats.strongAvailable).toEqual([]);
    expect(stats.stalled).toEqual([]);
    expect(stats.demosToday).toBe(0);
    expect(stats.escalatedInboxCount).toBe(0);
  });

  it("counts applications created in the last 24h as newApps24h", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "X", state: "X" });
    const jobId = await t.mutation("jobs:create", {
      schoolId, title: "Math", subject: "Math", level: "TGT", board: "CBSE",
      qualifications: ["B.Ed"], naturalLanguageDescription: "d",
    });
    const candidateId = await t.mutation("candidates:create", {
      name: "Asha", qualifications: ["B.Ed"], subjects: ["Math"],
    });
    await t.mutation("applications:create", {
      candidateId, jobPostingId: jobId, schoolId,
    });
    const stats = await t.query("morningBrief_stats:collectStats", { schoolId });
    expect(stats.newApps24h.count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/convex/morningBrief_stats.test.ts`
Expected: FAIL with "Cannot find module '../../convex/morningBrief_stats'".

- [ ] **Step 3: Write the minimal implementation**

Create `convex/morningBrief_stats.ts`:

```ts
import { query } from "./_generated/server";
import { v } from "convex/values";
import { isStalled } from "./lib/stalled";

const DAY_MS = 24 * 60 * 60 * 1000;
const TERMINAL_STAGES = new Set(["rejected", "hired", "withdrawn"]);

export interface BriefStats {
  newApps24h: { count: number; top: Array<{ candidateName: string; score: number | null }> };
  strongAvailable: Array<{ applicationId: string; candidateName: string; score: number }>;
  stalled: Array<{ applicationId: string; candidateName: string; lastOutboundAt: number }>;
  demosToday: number;
  escalatedInboxCount: number;
}

export const collectStats = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args): Promise<BriefStats> => {
    const now = Date.now();
    const cutoff24h = now - DAY_MS;

    const school = await ctx.db.get(args.schoolId);
    const threshold = school?.autoShortlistThreshold ?? 75;

    const apps = await ctx.db
      .query("applications")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    // newApps24h
    const recent = apps.filter((a) => a.createdAt >= cutoff24h);
    const recentWithCandidates = await Promise.all(
      recent.map(async (a) => {
        const c = await ctx.db.get(a.candidateId);
        return { app: a, name: c?.name ?? "Unknown", score: a.aiMatchScore ?? null };
      }),
    );
    recentWithCandidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const newApps24h = {
      count: recent.length,
      top: recentWithCandidates.slice(0, 3).map((r) => ({ candidateName: r.name, score: r.score })),
    };

    // strongAvailable: score >= threshold, non-terminal stage, no demo_schedule or offer message yet
    const strongCandidates: BriefStats["strongAvailable"] = [];
    for (const app of apps) {
      if (TERMINAL_STAGES.has(app.stage)) continue;
      const score = app.aiMatchScore ?? 0;
      if (score < threshold) continue;
      const msgs = await ctx.db
        .query("outreachMessages")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", app._id))
        .collect();
      const contacted = msgs.some((m) => m.type === "demo_schedule" || m.type === "offer");
      if (contacted) continue;
      const c = await ctx.db.get(app.candidateId);
      strongCandidates.push({
        applicationId: app._id,
        candidateName: c?.name ?? "Unknown",
        score,
      });
    }
    strongCandidates.sort((a, b) => b.score - a.score);
    const strongAvailable = strongCandidates.slice(0, 5);

    // stalled: see isStalled() for the rule
    const stalledRows: BriefStats["stalled"] = [];
    for (const app of apps) {
      const msgs = await ctx.db
        .query("outreachMessages")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", app._id))
        .collect();
      const outbounds = msgs
        .filter((m) => m.direction !== "inbound" && typeof m.sentAt === "number")
        .map((m) => m.sentAt as number);
      const inbounds = msgs
        .filter((m) => m.direction === "inbound" && typeof m.sentAt === "number")
        .map((m) => m.sentAt as number);
      const lastOutboundAt = outbounds.length ? Math.max(...outbounds) : null;
      const lastInboundAt = inbounds.length ? Math.max(...inbounds) : null;
      if (!isStalled({ now, lastOutboundAt, lastInboundAt, stage: app.stage })) continue;
      const c = await ctx.db.get(app.candidateId);
      stalledRows.push({
        applicationId: app._id,
        candidateName: c?.name ?? "Unknown",
        lastOutboundAt: lastOutboundAt as number,
      });
    }
    stalledRows.sort((a, b) => a.lastOutboundAt - b.lastOutboundAt);
    const stalled = stalledRows.slice(0, 5);

    // demosToday: bookings between today 00:00 IST and 23:59 IST.
    // IST offset = +5:30 = 5.5 hours. Compute IST midnight in UTC ms.
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const istNow = now + IST_OFFSET_MS;
    const istMidnight = istNow - (istNow % DAY_MS);
    const istStart = istMidnight - IST_OFFSET_MS;
    const istEnd = istStart + DAY_MS;
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();
    const demosToday = bookings.filter((b) => b.startMs >= istStart && b.startMs < istEnd).length;

    // escalatedInboxCount: distinct applicationIds with at least one unresolved escalated inbound
    const escalated = await ctx.db
      .query("outreachMessages")
      .withIndex("by_schoolId_escalated", (q) =>
        q.eq("schoolId", args.schoolId).eq("escalated", true),
      )
      .collect();
    const unresolved = escalated.filter((m) => m.resolvedAt == null);
    const distinctApps = new Set(unresolved.map((m) => m.applicationId));
    const escalatedInboxCount = distinctApps.size;

    return { newApps24h, strongAvailable, stalled, demosToday, escalatedInboxCount };
  },
});
```

- [ ] **Step 4: Verify the bookings index exists**

Run: `grep -n "bookings:\|by_schoolId" convex/schema.ts | head -20`
Expected: `bookings` table is defined with a `by_schoolId` index. If the index does not exist, add `.index("by_schoolId", ["schoolId"])` to the bookings table definition in `convex/schema.ts` and commit that schema change in a separate `feat(schema)` commit before continuing.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run vitest run tests/convex/morningBrief_stats.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 6: Commit**

```bash
git add convex/morningBrief_stats.ts tests/convex/morningBrief_stats.test.ts
git commit -m "feat(morning-brief): collectStats query"
```

---

### Task 4: Create `convex/morningBrief_render.ts` (pure renderer)

**Files:**
- Create: `convex/morningBrief_render.ts`
- Test: `tests/convex/morningBrief_render.test.ts`

Pure function. Stats in, `{ subject, htmlBody, textBody }` out. Zero I/O.

- [ ] **Step 1: Write the failing test**

Create `tests/convex/morningBrief_render.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderBrief } from "../../convex/morningBrief_render";

describe("renderBrief", () => {
  it("returns a subject line that includes the school name and date", () => {
    const out = renderBrief({
      schoolName: "Acme School",
      stats: {
        newApps24h: { count: 0, top: [] },
        strongAvailable: [],
        stalled: [],
        demosToday: 0,
        escalatedInboxCount: 0,
      },
      todayLabel: "May 28",
    });
    expect(out.subject).toContain("Acme School");
    expect(out.subject).toContain("May 28");
  });

  it("textBody is non-empty even for an empty day", () => {
    const out = renderBrief({
      schoolName: "Empty",
      stats: {
        newApps24h: { count: 0, top: [] },
        strongAvailable: [],
        stalled: [],
        demosToday: 0,
        escalatedInboxCount: 0,
      },
      todayLabel: "May 28",
    });
    expect(out.textBody.length).toBeGreaterThan(0);
    expect(out.htmlBody.length).toBeGreaterThan(0);
  });

  it("includes counts and candidate names in the text body", () => {
    const out = renderBrief({
      schoolName: "Acme",
      stats: {
        newApps24h: { count: 3, top: [{ candidateName: "Asha", score: 82 }] },
        strongAvailable: [{ applicationId: "a1" as any, candidateName: "Bina", score: 88 }],
        stalled: [{ applicationId: "a2" as any, candidateName: "Carl", lastOutboundAt: 0 }],
        demosToday: 2,
        escalatedInboxCount: 1,
      },
      todayLabel: "May 28",
    });
    expect(out.textBody).toContain("3 new");
    expect(out.textBody).toContain("Asha");
    expect(out.textBody).toContain("Bina");
    expect(out.textBody).toContain("Carl");
    expect(out.textBody).toContain("2 demo");
    expect(out.textBody).toContain("1 conversation");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/convex/morningBrief_render.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the minimal implementation**

Create `convex/morningBrief_render.ts`:

```ts
import type { BriefStats } from "./morningBrief_stats";

export interface RenderInput {
  schoolName: string;
  stats: BriefStats;
  todayLabel: string;
}

export interface RenderOutput {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export function renderBrief(input: RenderInput): RenderOutput {
  const { schoolName, stats, todayLabel } = input;

  const subject = `${schoolName} hiring brief, ${todayLabel}`;

  const lines: string[] = [];
  lines.push(`${schoolName} hiring brief, ${todayLabel}`);
  lines.push("");

  lines.push(`${stats.newApps24h.count} new application${stats.newApps24h.count === 1 ? "" : "s"} in the last 24h.`);
  if (stats.newApps24h.top.length > 0) {
    for (const t of stats.newApps24h.top) {
      lines.push(`  - ${t.candidateName}${t.score != null ? ` (score ${t.score})` : ""}`);
    }
  }
  lines.push("");

  lines.push(`${stats.strongAvailable.length} strong candidate${stats.strongAvailable.length === 1 ? "" : "s"} not yet contacted:`);
  for (const s of stats.strongAvailable) {
    lines.push(`  - ${s.candidateName} (score ${s.score})`);
  }
  lines.push("");

  lines.push(`${stats.stalled.length} stalled candidate${stats.stalled.length === 1 ? "" : "s"} (no reply in 5+ days):`);
  for (const s of stats.stalled) {
    lines.push(`  - ${s.candidateName}`);
  }
  lines.push("");

  lines.push(`${stats.demosToday} demo${stats.demosToday === 1 ? "" : "s"} scheduled for today.`);
  lines.push(`${stats.escalatedInboxCount} conversation${stats.escalatedInboxCount === 1 ? "" : "s"} need your attention.`);

  const textBody = lines.join("\n");

  // Minimal HTML: same content with <br> joins. Wrap top sections in <p>.
  const htmlBody = lines
    .map((l) => (l === "" ? "" : `<div>${escapeHtml(l)}</div>`))
    .join("\n");

  return { subject, htmlBody, textBody };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run tests/convex/morningBrief_render.test.ts`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add convex/morningBrief_render.ts tests/convex/morningBrief_render.test.ts
git commit -m "feat(morning-brief): renderBrief pure function"
```

---

### Task 5: Create `convex/morningBrief.ts` (orchestrator + cron target)

**Files:**
- Create: `convex/morningBrief.ts`
- Test: `tests/convex/morningBrief.test.ts`

Orchestrates: load school + recipients → collect stats → render → send via Resend, one email per recipient.

- [ ] **Step 1: Write the failing test**

Create `tests/convex/morningBrief.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as users from "../../convex/users";
import * as morningBrief from "../../convex/morningBrief";
import * as morningBriefStats from "../../convex/morningBrief_stats";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "users.ts": async () => users,
  "morningBrief.ts": async () => morningBrief,
  "morningBrief_stats.ts": async () => morningBriefStats,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

const sendMock = vi.fn().mockResolvedValue({ data: { id: "test-id" }, error: null });

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

beforeEach(() => {
  sendMock.mockClear();
  process.env.RESEND_API_KEY = "test-key";
});

describe("sendBriefForSchool", () => {
  it("skips send when recipient list is empty", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "X", state: "X",
    });
    const result = await t.action("morningBrief:sendBriefForSchool", { schoolId });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no_recipients");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("skips send when morningBriefEnabled is false", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "X", state: "X",
    });
    // populate recipient list but leave morningBriefEnabled unset (defaults to false)
    await t.run(async (ctx) => {
      await ctx.db.patch(schoolId, { morningBriefRecipientUserIds: ["user1"] });
      await ctx.db.insert("userProfiles", {
        userId: "user1", name: "Recruiter", email: "r@example.com", schoolId, role: "recruiter",
      });
    });
    const result = await t.action("morningBrief:sendBriefForSchool", { schoolId });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("disabled");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends one email per recipient when enabled with recipients", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Acme", board: "CBSE", city: "X", state: "X",
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(schoolId, {
        morningBriefRecipientUserIds: ["user1", "user2"],
        morningBriefEnabled: true,
      });
      await ctx.db.insert("userProfiles", {
        userId: "user1", name: "A", email: "a@example.com", schoolId, role: "recruiter",
      });
      await ctx.db.insert("userProfiles", {
        userId: "user2", name: "B", email: "b@example.com", schoolId, role: "owner",
      });
    });
    const result = await t.action("morningBrief:sendBriefForSchool", { schoolId });
    expect(result.skipped).toBe(false);
    expect(result.recipientsSent).toBe(2);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("silently skips stale recipient userIds whose profile no longer exists", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Acme", board: "CBSE", city: "X", state: "X",
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(schoolId, {
        morningBriefRecipientUserIds: ["ghost", "real"],
        morningBriefEnabled: true,
      });
      await ctx.db.insert("userProfiles", {
        userId: "real", name: "Real", email: "real@example.com", schoolId, role: "recruiter",
      });
    });
    const result = await t.action("morningBrief:sendBriefForSchool", { schoolId });
    expect(result.recipientsSent).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/convex/morningBrief.test.ts`
Expected: FAIL with "Cannot find module '../../convex/morningBrief'".

- [ ] **Step 3: Write the minimal implementation**

Create `convex/morningBrief.ts`:

```ts
import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { renderBrief } from "./morningBrief_render";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istTodayLabel(now: number): string {
  const istNow = new Date(now + IST_OFFSET_MS);
  const month = istNow.toUTCString().slice(8, 11); // e.g., "May"
  const day = istNow.getUTCDate();
  return `${month} ${day}`;
}

export const getSchoolWithRecipients = internalQuery({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) return null;
    const recipientIds = school.morningBriefRecipientUserIds ?? [];
    const recipients: Array<{ userId: string; email: string; name: string }> = [];
    for (const userId of recipientIds) {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (!profile) continue;
      recipients.push({ userId, email: profile.email, name: profile.name });
    }
    return {
      schoolId: school._id,
      schoolName: school.name,
      enabled: school.morningBriefEnabled === true,
      recipients,
    };
  },
});

export const listAllSchoolIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const schools = await ctx.db.query("schools").collect();
    return schools.map((s) => s._id);
  },
});

export const sendBriefForSchool = internalAction({
  args: { schoolId: v.id("schools") },
  handler: async (
    ctx,
    args,
  ): Promise<{ skipped: boolean; reason?: string; recipientsSent: number }> => {
    const info = await ctx.runQuery(internal.morningBrief.getSchoolWithRecipients, {
      schoolId: args.schoolId,
    });
    if (!info) return { skipped: true, reason: "school_not_found", recipientsSent: 0 };
    if (!info.enabled) return { skipped: true, reason: "disabled", recipientsSent: 0 };
    if (info.recipients.length === 0) return { skipped: true, reason: "no_recipients", recipientsSent: 0 };

    const stats = await ctx.runQuery(api.morningBrief_stats.collectStats, { schoolId: args.schoolId });
    const { subject, htmlBody, textBody } = renderBrief({
      schoolName: info.schoolName,
      stats,
      todayLabel: istTodayLabel(Date.now()),
    });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[morningBrief] RESEND_API_KEY missing, skipping send");
      return { skipped: true, reason: "no_api_key", recipientsSent: 0 };
    }
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    let sent = 0;
    for (const r of info.recipients) {
      try {
        await resend.emails.send({
          from: "RoleRecruit <noreply@rolerecruit.com>",
          to: r.email,
          subject,
          text: textBody,
          html: htmlBody,
        });
        sent++;
      } catch (err) {
        console.error(`[morningBrief] failed to send to ${r.email}:`, err);
      }
    }
    return { skipped: false, recipientsSent: sent };
  },
});

export const sendAllSchools = internalAction({
  args: {},
  handler: async (ctx): Promise<{ schoolsProcessed: number }> => {
    const ids = await ctx.runQuery(internal.morningBrief.listAllSchoolIds, {});
    for (const id of ids) {
      try {
        await ctx.runAction(internal.morningBrief.sendBriefForSchool, { schoolId: id });
      } catch (err) {
        console.error(`[morningBrief] school ${id} failed:`, err);
      }
    }
    return { schoolsProcessed: ids.length };
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run tests/convex/morningBrief.test.ts`
Expected: PASS, all 4 tests green. If the convex-test framework cannot call `internalAction` directly via `t.action("morningBrief:sendBriefForSchool", ...)`, switch the test to use `t.run(async (ctx) => ctx.runAction(internal.morningBrief.sendBriefForSchool, ...))` instead.

- [ ] **Step 5: Commit**

```bash
git add convex/morningBrief.ts tests/convex/morningBrief.test.ts
git commit -m "feat(morning-brief): sendBriefForSchool + sendAllSchools orchestrators"
```

---

### Task 6: Wire morning brief cron in `convex/crons.ts`

**Files:**
- Modify: `convex/crons.ts`

- [ ] **Step 1: Add the daily cron**

Open `convex/crons.ts` and append before `export default crons;`:

```ts
crons.daily(
  "morning-brief",
  { hourUTC: 2, minuteUTC: 30 }, // 02:30 UTC = 08:00 IST
  internal.morningBrief.sendAllSchools,
  {},
);
```

- [ ] **Step 2: Run typecheck and tests**

Run: `bun run test`
Expected: PASS. The cron registration is type-checked at module load.

- [ ] **Step 3: Commit**

```bash
git add convex/crons.ts
git commit -m "feat(morning-brief): daily cron at 08:00 IST"
```

---

### Task 7: Expose `getMorningBriefStats` query for the dashboard widget

**Files:**
- Modify: `convex/dashboard.ts`

- [ ] **Step 1: Add the query**

Open `convex/dashboard.ts`. Append:

```ts
import { collectStats } from "./morningBrief_stats";

export const getMorningBriefStats = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    // Delegate to the same query the email pipeline uses.
    // collectStats is itself a `query`, so we re-export its handler logic here.
    // We can't call a query from a query directly; instead, inline the handler
    // by importing the shared function. To keep DRY, we factor collectStats's
    // body into a helper and call it from both surfaces.
    //
    // Implementation note: see Step 2 below — we refactor collectStats first.
    throw new Error("see Step 2: refactor collectStats body into a shared helper");
  },
});
```

This is intentionally a temporary stub. Step 2 refactors `morningBrief_stats.ts` to expose a reusable async function.

- [ ] **Step 2: Refactor `morningBrief_stats.ts` to expose a helper function**

Open `convex/morningBrief_stats.ts`. Above the `export const collectStats = query(...)` line, extract the handler body into an exported async function:

```ts
export async function collectStatsHandler(
  ctx: { db: any },
  schoolId: any,
): Promise<BriefStats> {
  // ... move the ENTIRE existing handler body here, replacing `args.schoolId` with `schoolId` ...
}

export const collectStats = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args): Promise<BriefStats> => collectStatsHandler(ctx, args.schoolId),
});
```

Then update `convex/dashboard.ts`:

```ts
import { query } from "./_generated/server";
import { v } from "convex/values";
import { collectStatsHandler } from "./morningBrief_stats";

// ... existing getStats, getPipelineBreakdown unchanged ...

export const getMorningBriefStats = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => collectStatsHandler(ctx, args.schoolId),
});
```

- [ ] **Step 3: Re-run all tests to confirm no regression**

Run: `bun run test`
Expected: PASS. Existing `morningBrief_stats.test.ts` continues to pass because the public surface (the `collectStats` query) is unchanged.

- [ ] **Step 4: Commit**

```bash
git add convex/dashboard.ts convex/morningBrief_stats.ts
git commit -m "feat(dashboard): expose morning brief stats query for widget"
```

---

### Task 8: Build the dashboard widget UI

**Files:**
- Create: `components/dashboard/morning-brief-widget.tsx`
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Find the school context hook used on the dashboard**

Run: `grep -rn "schoolId\|useSchool\|useCurrentSchool" app/dashboard/page.tsx components/dashboard/stats-bar.tsx | head -10`
Take note of how existing dashboard components obtain `schoolId`. The widget will follow the same pattern.

- [ ] **Step 2: Create the widget component**

Create `components/dashboard/morning-brief-widget.tsx`:

```tsx
"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface Props {
  schoolId: Id<"schools">;
  schoolEnabledFlag: boolean | undefined;
  recipientCount: number;
}

export function MorningBriefWidget({ schoolId, schoolEnabledFlag, recipientCount }: Props) {
  const stats = useQuery(api.dashboard.getMorningBriefStats, { schoolId });
  if (!stats) {
    return <div className="rounded-2xl border border-neutral-200 p-6">Loading today's brief...</div>;
  }

  const showRecipientWarning = recipientCount === 0;
  const showDisabledWarning = schoolEnabledFlag === false || schoolEnabledFlag === undefined;

  return (
    <div className="rounded-2xl border border-neutral-200 p-6 space-y-4 bg-white">
      <h2 className="text-xl font-medium">Today's hiring brief</h2>

      {showRecipientWarning && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          Morning brief recipients not configured.{" "}
          <a href="/dashboard/settings/notifications" className="underline">Set them in Settings</a>.
        </div>
      )}
      {!showRecipientWarning && showDisabledWarning && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          Daily email sending is off.{" "}
          <a href="/dashboard/settings/notifications" className="underline">Enable in Settings</a>.
        </div>
      )}

      <ul className="space-y-1 text-sm">
        <li><span className="font-medium">{stats.newApps24h.count}</span> new application{stats.newApps24h.count === 1 ? "" : "s"} in the last 24h</li>
        <li><span className="font-medium">{stats.strongAvailable.length}</span> strong candidate{stats.strongAvailable.length === 1 ? "" : "s"} not yet contacted</li>
        <li><span className="font-medium">{stats.stalled.length}</span> stalled candidate{stats.stalled.length === 1 ? "" : "s"} (no reply in 5+ days)</li>
        <li><span className="font-medium">{stats.demosToday}</span> demo{stats.demosToday === 1 ? "" : "s"} scheduled for today</li>
        <li><span className="font-medium">{stats.escalatedInboxCount}</span> conversation{stats.escalatedInboxCount === 1 ? "" : "s"} need your attention</li>
      </ul>

      {stats.strongAvailable.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-neutral-700 mb-1">Strong candidates</h3>
          <ul className="space-y-1 text-sm">
            {stats.strongAvailable.map((s) => (
              <li key={s.applicationId}>
                <a href={`/dashboard/pipeline?app=${s.applicationId}`} className="underline">{s.candidateName}</a>
                <span className="text-neutral-500"> (score {s.score})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.stalled.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-neutral-700 mb-1">Stalled</h3>
          <ul className="space-y-1 text-sm">
            {stats.stalled.map((s) => (
              <li key={s.applicationId}>
                <a href={`/dashboard/pipeline?app=${s.applicationId}`} className="underline">{s.candidateName}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Mount the widget on the dashboard page**

Open `app/dashboard/page.tsx`. Find where the existing stats-bar / dashboard cards are rendered. Above (or in the first visible content slot) mount:

```tsx
import { MorningBriefWidget } from "@/components/dashboard/morning-brief-widget";

// inside the JSX where schoolId is available:
<MorningBriefWidget
  schoolId={schoolId}
  schoolEnabledFlag={school?.morningBriefEnabled}
  recipientCount={school?.morningBriefRecipientUserIds?.length ?? 0}
/>
```

If the page does not currently load the `school` object, use the existing `api.schools.getById` query (or whatever it's named, check via `grep -n "schools:get" convex/schools.ts`). Add the query call near the top of the component.

- [ ] **Step 4: Manual smoke test**

Run: `bun run dev` (or whatever the project's dev script is). Open `http://localhost:3000/dashboard` while signed in to a school with no morning brief config. Confirm:
1. Widget renders.
2. "Configure recipients" amber notice shows.
3. Counts are present (likely all zero on a fresh dev env).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/morning-brief-widget.tsx app/dashboard/page.tsx
git commit -m "feat(dashboard): morning brief widget"
```

---

### Task 9: Add the Notifications settings page (recipient picker)

**Files:**
- Create: `app/dashboard/settings/notifications/page.tsx`
- Modify: `convex/schools.ts` (add a mutation if one does not exist for patching these fields)
- Modify: `components/dashboard/sidebar.tsx` (add Notifications link)

- [ ] **Step 1: Add a mutation to update the brief settings**

Open `convex/schools.ts`. Add (if no equivalent mutation exists):

```ts
export const updateBriefSettings = mutation({
  args: {
    schoolId: v.id("schools"),
    recipientUserIds: v.array(v.string()),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.schoolId, {
      morningBriefRecipientUserIds: args.recipientUserIds,
      morningBriefEnabled: args.enabled,
    });
  },
});
```

Make sure `mutation` and `v` are imported at the top of `schools.ts` (they likely already are).

- [ ] **Step 2: Find the existing settings page pattern**

Run: `cat app/dashboard/settings/messaging/page.tsx | head -60`
Note the layout patterns (page header, form components, button styles) so the new page matches.

- [ ] **Step 3: Build the page**

Create `app/dashboard/settings/notifications/page.tsx`:

```tsx
"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function NotificationsSettingsPage() {
  // Resolve current school: use the same hook pattern used elsewhere in settings pages.
  // If a hook like useSchool() exists, use it; otherwise read from a context.
  const school = useQuery(api.schools.getCurrentSchool, {});
  const users = useQuery(api.users.listForSchool, school ? { schoolId: school._id } : "skip");
  const update = useMutation(api.schools.updateBriefSettings);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (school) {
      setSelected(new Set(school.morningBriefRecipientUserIds ?? []));
      setEnabled(school.morningBriefEnabled === true);
    }
  }, [school]);

  if (!school || !users) return <div className="p-6">Loading...</div>;

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  async function save() {
    await update({
      schoolId: school._id,
      recipientUserIds: Array.from(selected),
      enabled,
    });
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Notifications</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Daily hiring brief</h2>
        <p className="text-sm text-neutral-600">
          A morning summary of new applications, strong candidates, stalled threads, and demos for today.
          Sent at 8:00 IST.
        </p>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>Send daily email</span>
        </label>

        <div className="space-y-2">
          <div className="text-sm font-medium">Recipients</div>
          <ul className="space-y-1">
            {users.map((u: any) => (
              <li key={u.userId}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(u.userId)}
                    onChange={() => toggle(u.userId)}
                  />
                  <span>{u.name} <span className="text-neutral-500">({u.email})</span></span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={save}
          className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm"
        >
          Save
        </button>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Verify the queries `api.schools.getCurrentSchool` and `api.users.listForSchool` exist**

Run: `grep -n "getCurrentSchool\|listForSchool" convex/schools.ts convex/users.ts`
If they do not exist with these exact names, find the closest equivalents (e.g., `getById`, `listByUser`, etc.) and update the page to use them. Common names: `api.schools.getById`, `api.users.listBySchool`. Adjust the page imports and arguments accordingly.

- [ ] **Step 5: Add sidebar link**

Open `components/dashboard/sidebar.tsx`. Find the existing settings link list. Add a sub-entry "Notifications" pointing to `/dashboard/settings/notifications`. Match the existing pattern (use the same `<Link>` component, same className).

- [ ] **Step 6: Manual smoke test**

Run: `bun run dev`. Navigate to `/dashboard/settings/notifications`. Confirm:
1. Page loads with the user list.
2. Toggling checkboxes and clicking Save persists (refresh the page, selections survive).
3. Dashboard widget's amber notice disappears when at least one recipient is selected and enabled.

- [ ] **Step 7: Commit**

```bash
git add convex/schools.ts app/dashboard/settings/notifications/page.tsx components/dashboard/sidebar.tsx
git commit -m "feat(settings): notifications page for morning brief recipients"
```

---

### Task 10: End-to-end morning brief smoke test (manual + cron trigger)

**Files:**
- (No code changes)

- [ ] **Step 1: Trigger the cron manually via the Convex dashboard**

Open the project's Convex dashboard (`bunx convex dashboard`). Navigate to Functions → `morningBrief:sendBriefForSchool`. Click Run, paste:

```json
{ "schoolId": "<a real schoolId from your dev env>" }
```

- [ ] **Step 2: Verify the result**

The action returns one of:
- `{ skipped: true, reason: "no_recipients" }` — expected if you haven't configured Notifications yet.
- `{ skipped: false, recipientsSent: N }` — expected after configuration.

- [ ] **Step 3: Verify the email lands**

If using a real Resend API key, check the inbox for each configured recipient. If using a test key, check the Resend dashboard's Emails log.

- [ ] **Step 4: Take note of any anomalies**

If the email looks wrong (broken HTML, missing data), fix `morningBrief_render.ts` and add a regression test in `morningBrief_render.test.ts` before re-running.

(No commit needed for this task — it's manual verification.)

---

# PHASE 2: Conversation Agent

### Task 11: Generate `replyToken` on outbound email + persist `schoolId` and `direction` on every outbound

**Files:**
- Modify: `convex/outreach.ts`
- Test: `tests/convex/outreach_replyToken.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/convex/outreach_replyToken.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as outreach from "../../convex/outreach";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "outreach.ts": async () => outreach,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

async function setup(t: ReturnType<typeof convexTest>) {
  const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "X", state: "X" });
  const jobId = await t.mutation("jobs:create", {
    schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE",
    qualifications: ["B.Ed"], naturalLanguageDescription: "d",
  });
  const candidateId = await t.mutation("candidates:create", { name: "A", qualifications: [], subjects: [] });
  const appId = await t.mutation("applications:create", { candidateId, jobPostingId: jobId, schoolId });
  return { schoolId, candidateId, appId };
}

describe("outreach createDraft", () => {
  it("sets direction='outbound' and schoolId on a new email draft", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, candidateId, appId } = await setup(t);
    const msgId = await t.run(async (ctx) => {
      return await ctx.runMutation((await import("../../convex/_generated/api")).internal.outreach.createDraft, {
        applicationId: appId,
        candidateId,
        type: "shortlist",
        channel: "email",
        body: "Subject: Hi\n\nHello",
      });
    });
    const row = await t.run(async (ctx) => ctx.db.get(msgId));
    expect(row?.direction).toBe("outbound");
    expect(row?.schoolId).toBe(schoolId);
    expect(typeof row?.replyToken).toBe("string");
    expect(row?.replyToken?.length).toBe(32);
  });

  it("does NOT generate a replyToken for whatsapp channel", async () => {
    const t = convexTest(schema, modules);
    const { candidateId, appId } = await setup(t);
    const msgId = await t.run(async (ctx) => {
      return await ctx.runMutation((await import("../../convex/_generated/api")).internal.outreach.createDraft, {
        applicationId: appId,
        candidateId,
        type: "shortlist",
        channel: "whatsapp",
        body: "Hi",
      });
    });
    const row = await t.run(async (ctx) => ctx.db.get(msgId));
    expect(row?.direction).toBe("outbound");
    expect(row?.replyToken).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/convex/outreach_replyToken.test.ts`
Expected: FAIL — `direction`, `schoolId`, `replyToken` will all be undefined since `createDraft` does not set them yet.

- [ ] **Step 3: Update `createDraft` to set the three new fields**

Open `convex/outreach.ts`. Find `export const createDraft = internalMutation({...})`. Replace its handler body:

```ts
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");
    const replyToken = args.channel === "email" ? generateReplyToken() : undefined;
    return await ctx.db.insert("outreachMessages", {
      ...args,
      status: args.scheduledSendAt ? "scheduled" : "draft_pending_approval",
      draftedBy: "triage_agent",
      direction: "outbound",
      schoolId: app.schoolId,
      replyToken,
    });
  },
```

Add a top-level helper (above `createDraft` or near the bottom of the file):

```ts
function generateReplyToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run tests/convex/outreach_replyToken.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 5: Run the existing outreach tests too**

Run: `bun run vitest run tests/convex/outreach.test.ts`
Expected: PASS. Existing flows should be unaffected (we only added fields, not changed semantics).

- [ ] **Step 6: Commit**

```bash
git add convex/outreach.ts tests/convex/outreach_replyToken.test.ts
git commit -m "feat(outreach): generate replyToken + denormalize schoolId on outbound"
```

---

### Task 12: Email reply router (split out from `email_ingestion.ts`)

**Files:**
- Create: `convex/email_reply_router.ts`
- Modify: `convex/http.ts`
- Test: `tests/convex/email_reply_router.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/convex/email_reply_router.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as outreach from "../../convex/outreach";
import * as emailReplyRouter from "../../convex/email_reply_router";
import * as emailIngestion from "../../convex/email_ingestion";
import * as careers from "../../convex/careers";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "outreach.ts": async () => outreach,
  "email_reply_router.ts": async () => emailReplyRouter,
  "email_ingestion.ts": async () => emailIngestion,
  "careers.ts": async () => careers,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("email_reply_router.dispatch", () => {
  it("routes a tokenized reply to an existing application as inbound", async () => {
    const t = convexTest(schema, modules);
    // Setup: create a school, candidate, application, and an outbound message with a replyToken.
    const setupIds = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" });
      const candidateId = await ctx.db.insert("candidates", {
        name: "Asha", email: "asha@example.com", qualifications: [], certifications: [], boardExperience: [], subjects: [],
      });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: ["B.Ed"],
        naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
      });
      const appId = await ctx.db.insert("applications", {
        candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now(),
      });
      const outboundId = await ctx.db.insert("outreachMessages", {
        applicationId: appId,
        candidateId,
        type: "shortlist",
        channel: "email",
        body: "Hi Asha",
        status: "sent",
        direction: "outbound",
        schoolId,
        replyToken: "abc123token",
        sentAt: Date.now(),
      });
      return { appId, candidateId, schoolId, outboundId };
    });

    const result = await t.action("email_reply_router:dispatch", {
      to: "reply+abc123token@rolerecruit.com",
      from: "Asha <asha@example.com>",
      subject: "Re: Hi",
      text: "Yes, I'm interested.",
      attachments: [],
    });

    expect(result.routed).toBe("reply");
    expect(result.applicationId).toBe(setupIds.appId);

    const inboundRow = await t.run(async (ctx) =>
      ctx.db.query("outreachMessages")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", setupIds.appId))
        .filter((q) => q.eq(q.field("direction"), "inbound"))
        .first(),
    );
    expect(inboundRow).not.toBeNull();
    expect(inboundRow?.body).toContain("Yes, I'm interested.");
    expect(inboundRow?.inReplyToMessageId).toBe(setupIds.outboundId);
  });

  it("falls through to new-resume path when there is no token", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("schools", { name: "Demo", board: "CBSE", city: "X", state: "X", planTier: "free", slug: "demo" });
    });
    const result = await t.action("email_reply_router:dispatch", {
      to: "demo@rolerecruit.com",
      from: "candidate@example.com",
      subject: "Application",
      text: "Hi, I'm applying",
      attachments: [],
    });
    expect(result.routed).toBe("new_resume");
  });

  it("falls through to new-resume path when the token does not match", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("schools", { name: "Demo", board: "CBSE", city: "X", state: "X", planTier: "free", slug: "demo" });
    });
    const result = await t.action("email_reply_router:dispatch", {
      to: "reply+nonexistenttoken@rolerecruit.com",
      from: "candidate@example.com",
      subject: "Re:",
      text: "test",
      attachments: [],
    });
    expect(result.routed).toBe("new_resume");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/convex/email_reply_router.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Create the router**

Create `convex/email_reply_router.ts`:

```ts
import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

const REPLY_TOKEN_REGEX = /^reply\+([a-z0-9]{32})@/i;

export const dispatch = action({
  args: {
    to: v.string(),
    from: v.string(),
    subject: v.optional(v.string()),
    text: v.optional(v.string()),
    html: v.optional(v.string()),
    attachments: v.optional(v.array(v.any())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ routed: "reply" | "new_resume"; applicationId?: string }> => {
    const match = args.to.match(REPLY_TOKEN_REGEX);
    if (!match) {
      const result = await ctx.runAction(api.email_ingestion.receiveEmailAction, args);
      return { routed: "new_resume", ...result };
    }
    const token = match[1];
    const parent = await ctx.runQuery(internal.email_reply_router.findByReplyToken, { token });
    if (!parent) {
      const result = await ctx.runAction(api.email_ingestion.receiveEmailAction, args);
      return { routed: "new_resume", ...result };
    }
    const inboundId = await ctx.runMutation(internal.email_reply_router.insertInbound, {
      parentMessageId: parent._id,
      applicationId: parent.applicationId,
      candidateId: parent.candidateId,
      schoolId: parent.schoolId!,
      body: (args.text ?? args.html ?? "").trim(),
    });
    await ctx.scheduler.runAfter(0, internal.conversation.handleInbound, { messageId: inboundId });
    return { routed: "reply", applicationId: parent.applicationId };
  },
});

export const findByReplyToken = internalMutation({
  // We use internalMutation here because internalQuery has the same shape but
  // we want to keep the call surface uniform. Read-only OK.
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("outreachMessages")
      .withIndex("by_replyToken", (q) => q.eq("replyToken", args.token))
      .first();
  },
});

export const insertInbound = internalMutation({
  args: {
    parentMessageId: v.id("outreachMessages"),
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    schoolId: v.id("schools"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachMessages", {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      schoolId: args.schoolId,
      type: "candidate_reply",
      channel: "email",
      body: args.body,
      status: "sent",
      direction: "inbound",
      inReplyToMessageId: args.parentMessageId,
      sentAt: Date.now(),
    });
  },
});
```

- [ ] **Step 4: Wrap the existing `receiveEmail` httpAction as a reusable action**

Currently `convex/email_ingestion.ts` exports `receiveEmail` as an `httpAction`. We need its logic callable from `email_reply_router.dispatch`. Open `convex/email_ingestion.ts` and:

1. Extract the body of `receiveEmail` into a new `export const receiveEmailAction = action({ args: { to, from, subject, text, html, attachments }, handler: ... })`. Move the existing logic into the handler unchanged, except it returns the JSON shape `{ success: true, candidateId? }` instead of a `Response`.
2. Rewrite `receiveEmail` (the httpAction) to: parse the request JSON, call `receiveEmailAction` via `ctx.runAction(api.email_ingestion.receiveEmailAction, body)`, and wrap the result in a `Response`.

This refactor keeps the HTTP entry point and makes the logic reusable from the router.

- [ ] **Step 5: Rewire `http.ts` to route inbound emails through the dispatcher**

Open `convex/http.ts`. Replace the existing `/email/inbound` route with:

```ts
import { httpAction } from "convex/server";
import { api } from "./_generated/api";

http.route({
  path: "/email/inbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: any;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }
    const result = await ctx.runAction(api.email_reply_router.dispatch, {
      to: body.to ?? "",
      from: body.from ?? "",
      subject: body.subject,
      text: body.text,
      html: body.html,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    });
    return new Response(JSON.stringify({ success: true, ...result }), { status: 200 });
  }),
});
```

Remove the old `import { receiveEmail } from "./email_ingestion";` from `http.ts`.

- [ ] **Step 6: Run tests**

Run: `bun run vitest run tests/convex/email_reply_router.test.ts`
Expected: PASS, all 3 tests green.

Also run: `bun run test` to confirm nothing else broke (email_ingestion's existing tests, if any).

- [ ] **Step 7: Commit**

```bash
git add convex/email_reply_router.ts convex/email_ingestion.ts convex/http.ts tests/convex/email_reply_router.test.ts
git commit -m "feat(conversation): email reply router with token-based threading"
```

---

### Task 13: WhatsApp inbound webhook

**Files:**
- Modify: `convex/whatsapp.ts`
- Modify: `convex/http.ts`
- Test: `tests/convex/whatsapp_inbound.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/convex/whatsapp_inbound.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as outreach from "../../convex/outreach";
import * as whatsapp from "../../convex/whatsapp";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "outreach.ts": async () => outreach,
  "whatsapp.ts": async () => whatsapp,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("whatsapp.handleInboundMessage", () => {
  it("matches phone to candidate's most recent active outbound", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" });
      const candidateId = await ctx.db.insert("candidates", {
        name: "Asha", phone: "+919876543210", qualifications: [], certifications: [], boardExperience: [], subjects: [],
      });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: ["B.Ed"],
        naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
      });
      const appId = await ctx.db.insert("applications", {
        candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now(),
      });
      const outboundId = await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId, schoolId, type: "shortlist", channel: "whatsapp",
        body: "Hi", status: "sent", direction: "outbound", sentAt: Date.now() - 1000,
      });
      return { schoolId, candidateId, appId, outboundId };
    });

    const result = await t.action("whatsapp:handleInboundMessage", {
      fromPhone: "+919876543210",
      body: "Yes, interested",
    });

    expect(result.matched).toBe(true);
    expect(result.applicationId).toBe(ids.appId);

    const inbound = await t.run(async (ctx) =>
      ctx.db.query("outreachMessages")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", ids.appId))
        .filter((q) => q.eq(q.field("direction"), "inbound"))
        .first(),
    );
    expect(inbound?.body).toContain("Yes, interested");
  });

  it("returns matched=false when phone is unknown", async () => {
    const t = convexTest(schema, modules);
    const result = await t.action("whatsapp:handleInboundMessage", {
      fromPhone: "+910000000000",
      body: "test",
    });
    expect(result.matched).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/convex/whatsapp_inbound.test.ts`
Expected: FAIL with "Function not found" or similar.

- [ ] **Step 3: Implement the inbound handler**

Open `convex/whatsapp.ts`. Append:

```ts
import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const findCandidateLatestOutbound = internalQuery({
  args: { fromPhone: v.string() },
  handler: async (ctx, args) => {
    // Normalize: strip non-digits except leading +
    const normalize = (s: string) => s.replace(/[^\d+]/g, "");
    const target = normalize(args.fromPhone);
    const allCandidates = await ctx.db.query("candidates").collect();
    const candidate = allCandidates.find((c) => c.phone && normalize(c.phone) === target);
    if (!candidate) return null;

    // Find most recent outbound message to this candidate within the last 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const messages = await ctx.db.query("outreachMessages").collect();
    const candidateOutbounds = messages
      .filter((m) =>
        m.candidateId === candidate._id &&
        m.direction !== "inbound" &&
        m.type !== "rejection" &&
        typeof m.sentAt === "number" &&
        (m.sentAt as number) >= cutoff,
      )
      .sort((a, b) => (b.sentAt as number) - (a.sentAt as number));
    if (candidateOutbounds.length === 0) return null;
    const parent = candidateOutbounds[0];
    return {
      candidateId: candidate._id,
      applicationId: parent.applicationId,
      schoolId: parent.schoolId,
      parentMessageId: parent._id,
    };
  },
});

export const insertWhatsappInbound = internalMutation({
  args: {
    parentMessageId: v.id("outreachMessages"),
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    schoolId: v.id("schools"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachMessages", {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      schoolId: args.schoolId,
      type: "candidate_reply",
      channel: "whatsapp",
      body: args.body,
      status: "sent",
      direction: "inbound",
      inReplyToMessageId: args.parentMessageId,
      sentAt: Date.now(),
    });
  },
});

export const handleInboundMessage = action({
  args: { fromPhone: v.string(), body: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ matched: boolean; applicationId?: string }> => {
    const match = await ctx.runQuery(internal.whatsapp.findCandidateLatestOutbound, {
      fromPhone: args.fromPhone,
    });
    if (!match || !match.schoolId) {
      console.log(`[whatsapp] dropped inbound from unknown/inactive phone: ${args.fromPhone}`);
      return { matched: false };
    }
    const inboundId = await ctx.runMutation(internal.whatsapp.insertWhatsappInbound, {
      parentMessageId: match.parentMessageId,
      applicationId: match.applicationId,
      candidateId: match.candidateId,
      schoolId: match.schoolId,
      body: args.body,
    });
    await ctx.scheduler.runAfter(0, internal.conversation.handleInbound, { messageId: inboundId });
    return { matched: true, applicationId: match.applicationId };
  },
});
```

- [ ] **Step 4: Register the HTTP route**

Open `convex/http.ts`. Add:

```ts
http.route({
  path: "/whatsapp/inbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: any;
    try { body = await request.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }
    // Gupshup webhook shape: { type: "message", payload: { source: "+91...", payload: { text: "..." } } }
    const fromPhone = body?.payload?.source ?? "";
    const text = body?.payload?.payload?.text ?? body?.payload?.text ?? "";
    if (!fromPhone || !text) {
      return new Response(JSON.stringify({ success: true, ignored: true }), { status: 200 });
    }
    const result = await ctx.runAction(api.whatsapp.handleInboundMessage, {
      fromPhone,
      body: text,
    });
    return new Response(JSON.stringify({ success: true, ...result }), { status: 200 });
  }),
});
```

- [ ] **Step 5: Run tests**

Run: `bun run vitest run tests/convex/whatsapp_inbound.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 6: Commit**

```bash
git add convex/whatsapp.ts convex/http.ts tests/convex/whatsapp_inbound.test.ts
git commit -m "feat(conversation): whatsapp inbound webhook"
```

---

### Task 14: Conversation classifier

**Files:**
- Create: `convex/conversation_classify.ts`
- Create: `convex/prompts/conversationClassify.ts`
- Test: `tests/convex/conversation_classify.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/convex/conversation_classify.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
vi.mock("../../convex/lib/llmClient", () => ({
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
  LLM_MODEL: "test-model",
}));

import { classifyReply } from "../../convex/conversation_classify";

beforeEach(() => mockCreate.mockReset());

describe("classifyReply", () => {
  it("returns parsed intent + confidence from the LLM response", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ intent: "faq", confidence: 0.9, summary: "salary q" }) } }],
    });
    const result = await classifyReply({
      replyText: "What's the salary?",
      threadContext: [{ role: "agent", body: "We'd like to invite you" }],
    });
    expect(result.intent).toBe("faq");
    expect(result.confidence).toBe(0.9);
  });

  it("returns intent='unclear' with confidence 0 when LLM client is unavailable", async () => {
    vi.doMock("../../convex/lib/llmClient", () => ({ getLlmClient: () => null, LLM_MODEL: "test" }));
    const { classifyReply: classify2 } = await import("../../convex/conversation_classify?nocache" as any);
    const result = await classify2({ replyText: "test", threadContext: [] });
    expect(result.intent).toBe("unclear");
    expect(result.confidence).toBe(0);
    vi.doUnmock("../../convex/lib/llmClient");
  });

  it("returns intent='unclear' when the LLM response is unparseable JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "not json at all" } }],
    });
    const result = await classifyReply({ replyText: "test", threadContext: [] });
    expect(result.intent).toBe("unclear");
    expect(result.confidence).toBe(0);
  });
});
```

Note: the second test requires re-importing the module. If that proves flaky in vitest, replace it with a separate test file that mocks differently.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/convex/conversation_classify.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Create the prompt**

Create `convex/prompts/conversationClassify.ts`:

```ts
export const CONVERSATION_CLASSIFY_SYSTEM = `You classify a candidate's reply in a recruiter conversation.

Output strict JSON: {"intent": "faq" | "reschedule" | "negotiation" | "unclear", "confidence": 0..1, "summary": string}

Definitions:
- faq: candidate asks about salary, board, location, timings, perks, school details, or any factual question about the role/school.
- reschedule: candidate asks to change a scheduled demo/interview time, or asks to book a new slot.
- negotiation: candidate is negotiating salary, role, or terms.
- unclear: anything else (greetings only, vague reply, multi-intent that doesn't fit cleanly).

Confidence is your honesty about the classification. 0.9+ means very sure. 0.5 means coin flip. Be conservative.`;
```

- [ ] **Step 4: Create the classifier**

Create `convex/conversation_classify.ts`:

```ts
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";
import { CONVERSATION_CLASSIFY_SYSTEM } from "./prompts/conversationClassify";

export type Intent = "faq" | "reschedule" | "negotiation" | "unclear";

export interface ClassifyInput {
  replyText: string;
  threadContext: Array<{ role: "agent" | "candidate"; body: string }>;
}

export interface ClassifyOutput {
  intent: Intent;
  confidence: number;
  summary: string;
}

export async function classifyReply(input: ClassifyInput): Promise<ClassifyOutput> {
  const client = getLlmClient();
  if (!client) return { intent: "unclear", confidence: 0, summary: "no_llm" };
  try {
    const res = await client.chat.completions.create({
      model: LLM_MODEL,
      max_tokens: 256,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CONVERSATION_CLASSIFY_SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            reply: input.replyText,
            recentContext: input.threadContext.slice(-5),
          }),
        },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    const intent = (["faq", "reschedule", "negotiation", "unclear"] as const).includes(parsed.intent)
      ? (parsed.intent as Intent)
      : "unclear";
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
    const summary = typeof parsed.summary === "string" ? parsed.summary : "";
    return { intent, confidence, summary };
  } catch {
    return { intent: "unclear", confidence: 0, summary: "parse_error" };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run vitest run tests/convex/conversation_classify.test.ts`
Expected: PASS. If the second test (re-import after re-mock) fails due to vitest module caching, remove it. The first and third tests cover the critical paths.

- [ ] **Step 6: Commit**

```bash
git add convex/conversation_classify.ts convex/prompts/conversationClassify.ts tests/convex/conversation_classify.test.ts
git commit -m "feat(conversation): reply classifier"
```

---

### Task 15: FAQ branch

**Files:**
- Create: `convex/conversation_faq.ts`
- Create: `convex/prompts/conversationFaqDraft.ts`
- Test: `tests/convex/conversation_faq.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/convex/conversation_faq.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
vi.mock("../../convex/lib/llmClient", () => ({
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
  LLM_MODEL: "test-model",
}));

import { draftFaqReply } from "../../convex/conversation_faq";

beforeEach(() => mockCreate.mockReset());

describe("draftFaqReply", () => {
  it("returns the draft + confidence from the LLM", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({ draft: "The salary range is INR 4-6 LPA.", confidence: 0.85 }),
        },
      }],
    });
    const result = await draftFaqReply({
      replyText: "What's the salary?",
      job: { title: "Math TGT", salaryRange: "4-6 LPA", board: "CBSE" } as any,
      school: { name: "Acme", city: "Pune", state: "MH", board: "CBSE" } as any,
      faqContent: "School timings: 8am-3pm. Transport provided.",
    });
    expect(result.draft).toContain("4-6 LPA");
    expect(result.confidence).toBe(0.85);
  });

  it("returns confidence 0 and empty draft when LLM fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("llm down"));
    const result = await draftFaqReply({
      replyText: "test",
      job: { title: "T" } as any,
      school: { name: "S" } as any,
      faqContent: "",
    });
    expect(result.draft).toBe("");
    expect(result.confidence).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/convex/conversation_faq.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Create the prompt**

Create `convex/prompts/conversationFaqDraft.ts`:

```ts
export const CONVERSATION_FAQ_DRAFT_SYSTEM = `You draft a short, friendly reply to a teacher candidate's question about a job opening.

Output strict JSON: {"draft": string, "confidence": 0..1}

Rules:
- Use only the information in the provided context. Do not invent salary numbers, dates, perks, etc.
- If the context does not contain the answer, set confidence below 0.5 and write a draft that says you'll check with the team and get back.
- Keep replies under 3 short sentences. Conversational tone (Indian English).
- Always include a clear next step or sign-off.

Confidence reflects how well the context covered the question. 0.9+ means the answer is fully supported by context.`;
```

- [ ] **Step 4: Create the drafter**

Create `convex/conversation_faq.ts`:

```ts
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";
import { CONVERSATION_FAQ_DRAFT_SYSTEM } from "./prompts/conversationFaqDraft";

export interface FaqDraftInput {
  replyText: string;
  job: { title?: string; subject?: string; level?: string; board?: string; salaryRange?: string; qualifications?: string[] };
  school: { name?: string; city?: string; state?: string; board?: string; about?: string; perks?: Array<{ label: string; description: string }> };
  faqContent: string;
}

export interface FaqDraftOutput {
  draft: string;
  confidence: number;
}

export async function draftFaqReply(input: FaqDraftInput): Promise<FaqDraftOutput> {
  const client = getLlmClient();
  if (!client) return { draft: "", confidence: 0 };
  try {
    const res = await client.chat.completions.create({
      model: LLM_MODEL,
      max_tokens: 400,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CONVERSATION_FAQ_DRAFT_SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            question: input.replyText,
            jobContext: {
              title: input.job.title,
              subject: input.job.subject,
              level: input.job.level,
              board: input.job.board,
              salaryRange: input.job.salaryRange,
              qualifications: input.job.qualifications,
            },
            schoolContext: {
              name: input.school.name,
              city: input.school.city,
              state: input.school.state,
              board: input.school.board,
              about: input.school.about,
              perks: input.school.perks,
            },
            schoolFaq: input.faqContent,
          }),
        },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    const draft = typeof parsed.draft === "string" ? parsed.draft : "";
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
    return { draft, confidence };
  } catch {
    return { draft: "", confidence: 0 };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run vitest run tests/convex/conversation_faq.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add convex/conversation_faq.ts convex/prompts/conversationFaqDraft.ts tests/convex/conversation_faq.test.ts
git commit -m "feat(conversation): FAQ branch drafter"
```

---

### Task 16: Reschedule branch

**Files:**
- Create: `convex/conversation_reschedule.ts`
- Test: `tests/convex/conversation_reschedule.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/convex/conversation_reschedule.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildRescheduleReply } from "../../convex/conversation_reschedule";

describe("buildRescheduleReply", () => {
  it("returns a polite reply with the booking link", () => {
    const reply = buildRescheduleReply({
      candidateName: "Asha",
      bookingUrl: "https://rolerecruit.com/book/abc",
      schoolName: "Acme",
      rejected: false,
    });
    expect(reply).toContain("Asha");
    expect(reply).toContain("https://rolerecruit.com/book/abc");
  });

  it("returns the closed-role template when the application is rejected", () => {
    const reply = buildRescheduleReply({
      candidateName: "Asha",
      bookingUrl: "",
      schoolName: "Acme",
      rejected: true,
    });
    expect(reply.toLowerCase()).toContain("closed");
    expect(reply).not.toContain("http");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/convex/conversation_reschedule.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the minimal implementation**

Create `convex/conversation_reschedule.ts`:

```ts
export interface RescheduleInput {
  candidateName: string;
  bookingUrl: string;
  schoolName: string;
  rejected: boolean;
}

export function buildRescheduleReply(input: RescheduleInput): string {
  if (input.rejected) {
    return `Hi ${input.candidateName}, thanks for reaching out. Unfortunately this role at ${input.schoolName} is currently closed for new bookings. We'll keep your details on file for future openings.`;
  }
  return `Hi ${input.candidateName}, sure, please pick a new slot here: ${input.bookingUrl}. Looking forward to meeting you.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run tests/convex/conversation_reschedule.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/conversation_reschedule.ts tests/convex/conversation_reschedule.test.ts
git commit -m "feat(conversation): reschedule branch template"
```

---

### Task 17: Orchestrator `convex/conversation.ts`

**Files:**
- Create: `convex/conversation.ts`
- Test: `tests/convex/conversation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/convex/conversation.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

// Mock all three branch + classifier modules so we test only orchestration.
vi.mock("../../convex/conversation_classify", () => ({
  classifyReply: vi.fn(),
}));
vi.mock("../../convex/conversation_faq", () => ({
  draftFaqReply: vi.fn(),
}));
vi.mock("../../convex/conversation_reschedule", () => ({
  buildRescheduleReply: vi.fn().mockReturnValue("Reschedule reply"),
}));

import { classifyReply } from "../../convex/conversation_classify";
import { draftFaqReply } from "../../convex/conversation_faq";
import * as conversation from "../../convex/conversation";
import * as schools from "../../convex/schools";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as outreach from "../../convex/outreach";
import * as booking from "../../convex/booking";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "outreach.ts": async () => outreach,
  "booking.ts": async () => booking,
  "conversation.ts": async () => conversation,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

async function seedInbound(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" });
    const candidateId = await ctx.db.insert("candidates", { name: "Asha", qualifications: [], certifications: [], boardExperience: [], subjects: [] });
    const jobId = await ctx.db.insert("jobPostings", {
      schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: ["B.Ed"],
      naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
    });
    const appId = await ctx.db.insert("applications", {
      candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now(),
    });
    const inboundId = await ctx.db.insert("outreachMessages", {
      applicationId: appId, candidateId, schoolId, type: "candidate_reply", channel: "email",
      body: "What's the salary?", status: "sent", direction: "inbound", sentAt: Date.now(),
    });
    return { schoolId, candidateId, appId, inboundId };
  });
}

beforeEach(() => vi.clearAllMocks());

describe("handleInbound", () => {
  it("FAQ high-confidence path: drafts and schedules an outbound agent reply, no escalation", async () => {
    (classifyReply as any).mockResolvedValueOnce({ intent: "faq", confidence: 0.9, summary: "salary" });
    (draftFaqReply as any).mockResolvedValueOnce({ draft: "The salary range is 4-6 LPA.", confidence: 0.85 });
    const t = convexTest(schema, modules);
    const { inboundId, appId } = await seedInbound(t);

    await t.run(async (ctx) =>
      ctx.runAction(apiModule.internal.conversation.handleInbound, { messageId: inboundId }),
    );

    const messages = await t.run(async (ctx) =>
      ctx.db.query("outreachMessages")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", appId))
        .collect(),
    );
    const agentReply = messages.find((m: any) => m.type === "agent_reply");
    expect(agentReply).toBeDefined();
    expect(agentReply?.body).toContain("4-6 LPA");
    expect(agentReply?.status).toBe("scheduled");

    const inbound = messages.find((m: any) => m._id === inboundId);
    expect(inbound?.escalated).not.toBe(true);
    expect(inbound?.intent).toBe("faq");
  });

  it("FAQ low-confidence path: escalates and saves draft for human review", async () => {
    (classifyReply as any).mockResolvedValueOnce({ intent: "faq", confidence: 0.6, summary: "hostel?" });
    (draftFaqReply as any).mockResolvedValueOnce({ draft: "Not sure, will check.", confidence: 0.4 });
    const t = convexTest(schema, modules);
    const { inboundId } = await seedInbound(t);

    await t.run(async (ctx) =>
      ctx.runAction(apiModule.internal.conversation.handleInbound, { messageId: inboundId }),
    );

    const inbound = await t.run(async (ctx) => ctx.db.get(inboundId));
    expect(inbound?.escalated).toBe(true);
    expect(inbound?.escalationReason).toBe("low_confidence_faq");
  });

  it("negotiation: escalates with no reply sent", async () => {
    (classifyReply as any).mockResolvedValueOnce({ intent: "negotiation", confidence: 0.95, summary: "wants more salary" });
    const t = convexTest(schema, modules);
    const { inboundId, appId } = await seedInbound(t);

    await t.run(async (ctx) =>
      ctx.runAction(apiModule.internal.conversation.handleInbound, { messageId: inboundId }),
    );

    const inbound = await t.run(async (ctx) => ctx.db.get(inboundId));
    expect(inbound?.escalated).toBe(true);
    expect(inbound?.escalationReason).toBe("negotiation");
    const messages = await t.run(async (ctx) =>
      ctx.db.query("outreachMessages")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", appId))
        .collect(),
    );
    const replies = messages.filter((m: any) => m.type === "agent_reply");
    expect(replies.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/convex/conversation.test.ts`
Expected: FAIL with "Cannot find module '../../convex/conversation'".

- [ ] **Step 3: Write the orchestrator**

Create `convex/conversation.ts`:

```ts
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { classifyReply } from "./conversation_classify";
import { draftFaqReply } from "./conversation_faq";
import { buildRescheduleReply } from "./conversation_reschedule";

const CONFIDENCE_THRESHOLD = 0.75;

export const loadContext = internalQuery({
  args: { messageId: v.id("outreachMessages") },
  handler: async (ctx, args) => {
    const inbound = await ctx.db.get(args.messageId);
    if (!inbound) return null;
    const app = await ctx.db.get(inbound.applicationId);
    if (!app) return null;
    const school = await ctx.db.get(app.schoolId);
    const job = app.jobPostingId ? await ctx.db.get(app.jobPostingId) : null;
    const candidate = await ctx.db.get(inbound.candidateId);
    const threadRaw = await ctx.db
      .query("outreachMessages")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", inbound.applicationId))
      .collect();
    const thread = threadRaw
      .sort((a, b) => (a.sentAt ?? 0) - (b.sentAt ?? 0))
      .map((m) => ({
        role: (m.direction === "inbound" ? "candidate" : "agent") as "agent" | "candidate",
        body: m.body,
      }));
    return { inbound, app, school, job, candidate, thread };
  },
});

export const persistClassification = internalMutation({
  args: {
    messageId: v.id("outreachMessages"),
    intent: v.union(
      v.literal("faq"), v.literal("reschedule"), v.literal("negotiation"), v.literal("unclear"),
    ),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { intent: args.intent, confidence: args.confidence });
  },
});

export const escalate = internalMutation({
  args: { messageId: v.id("outreachMessages"), reason: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      escalated: true,
      escalationReason: args.reason,
      processedAt: Date.now(),
    });
  },
});

export const insertAgentReply = internalMutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    schoolId: v.id("schools"),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    body: v.string(),
    schedule: v.boolean(),
    inReplyToMessageId: v.id("outreachMessages"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachMessages", {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      schoolId: args.schoolId,
      type: "agent_reply",
      channel: args.channel,
      body: args.body,
      status: args.schedule ? "scheduled" : "draft_pending_approval",
      scheduledSendAt: args.schedule ? Date.now() : undefined,
      direction: "outbound",
      draftedBy: "conversation_agent",
      inReplyToMessageId: args.inReplyToMessageId,
    });
  },
});

export const markProcessed = internalMutation({
  args: { messageId: v.id("outreachMessages") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { processedAt: Date.now() });
  },
});

export const handleInbound = internalAction({
  args: { messageId: v.id("outreachMessages") },
  handler: async (ctx, args): Promise<void> => {
    const ctxData = await ctx.runQuery(internal.conversation.loadContext, { messageId: args.messageId });
    if (!ctxData) return;
    const { inbound, app, school, job, candidate, thread } = ctxData;
    if (!school) {
      await ctx.runMutation(internal.conversation.escalate, {
        messageId: args.messageId,
        reason: "missing_school",
      });
      return;
    }

    // Feature flag: when off, escalate everything without classifier work.
    if (school.conversationAgentEnabled !== true) {
      await ctx.runMutation(internal.conversation.escalate, {
        messageId: args.messageId,
        reason: "agent_disabled",
      });
      return;
    }

    // Classify
    const classified = await classifyReply({
      replyText: inbound.body,
      threadContext: thread.slice(0, -1), // exclude the inbound itself
    });
    await ctx.runMutation(internal.conversation.persistClassification, {
      messageId: args.messageId,
      intent: classified.intent,
      confidence: classified.confidence,
    });

    // Branch
    if (classified.intent === "negotiation" || classified.intent === "unclear") {
      await ctx.runMutation(internal.conversation.escalate, {
        messageId: args.messageId,
        reason: classified.intent,
      });
      return;
    }

    if (classified.intent === "reschedule") {
      const rejected = app.stage === "rejected";
      let bookingUrl = "";
      if (!rejected) {
        const token = await ctx.runMutation(api.booking.generateBookingToken, {
          applicationId: app._id,
          schoolId: school._id,
        });
        bookingUrl = `${process.env.PUBLIC_BASE_URL ?? "https://rolerecruit.com"}/book/${token}`;
      }
      const body = buildRescheduleReply({
        candidateName: candidate?.name ?? "there",
        bookingUrl,
        schoolName: school.name,
        rejected,
      });
      await ctx.runMutation(internal.conversation.insertAgentReply, {
        applicationId: app._id,
        candidateId: inbound.candidateId,
        schoolId: school._id,
        channel: inbound.channel,
        body,
        schedule: true,
        inReplyToMessageId: args.messageId,
      });
      await ctx.runMutation(internal.conversation.markProcessed, { messageId: args.messageId });
      return;
    }

    // FAQ branch
    const draft = await draftFaqReply({
      replyText: inbound.body,
      job: job ?? {},
      school,
      faqContent: school.faqContent ?? "",
    });
    if (draft.confidence >= CONFIDENCE_THRESHOLD && draft.draft.length > 0) {
      await ctx.runMutation(internal.conversation.insertAgentReply, {
        applicationId: app._id,
        candidateId: inbound.candidateId,
        schoolId: school._id,
        channel: inbound.channel,
        body: draft.draft,
        schedule: true,
        inReplyToMessageId: args.messageId,
      });
      await ctx.runMutation(internal.conversation.markProcessed, { messageId: args.messageId });
    } else {
      // Save the draft alongside the escalation for the human to use as a starting point.
      if (draft.draft.length > 0) {
        await ctx.runMutation(internal.conversation.insertAgentReply, {
          applicationId: app._id,
          candidateId: inbound.candidateId,
          schoolId: school._id,
          channel: inbound.channel,
          body: draft.draft,
          schedule: false,
          inReplyToMessageId: args.messageId,
        });
      }
      await ctx.runMutation(internal.conversation.escalate, {
        messageId: args.messageId,
        reason: "low_confidence_faq",
      });
    }
  },
});
```

- [ ] **Step 4: Update the test seed to set `conversationAgentEnabled: true`**

The test seeded the school without the feature flag. The orchestrator we just wrote requires it. Either:
- Add `conversationAgentEnabled: true` to the `db.insert("schools", { ... })` in `seedInbound`, OR
- Add a fourth test that asserts the flag-off path escalates with `"agent_disabled"`.

Do both. Update `seedInbound` to include `conversationAgentEnabled: true`, then add this test:

```ts
it("escalates with reason='agent_disabled' when the feature flag is off", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" });
    const candidateId = await ctx.db.insert("candidates", { name: "Asha", qualifications: [], certifications: [], boardExperience: [], subjects: [] });
    const jobId = await ctx.db.insert("jobPostings", {
      schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: ["B.Ed"],
      naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
    });
    const appId = await ctx.db.insert("applications", { candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now() });
    const inboundId = await ctx.db.insert("outreachMessages", {
      applicationId: appId, candidateId, schoolId, type: "candidate_reply", channel: "email",
      body: "test", status: "sent", direction: "inbound", sentAt: Date.now(),
    });
    return { inboundId };
  });
  await t.run(async (ctx) => ctx.runAction(apiModule.internal.conversation.handleInbound, { messageId: ids.inboundId }));
  const inbound = await t.run(async (ctx) => ctx.db.get(ids.inboundId));
  expect(inbound?.escalated).toBe(true);
  expect(inbound?.escalationReason).toBe("agent_disabled");
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run vitest run tests/convex/conversation.test.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 6: Commit**

```bash
git add convex/conversation.ts tests/convex/conversation.test.ts
git commit -m "feat(conversation): handleInbound orchestrator"
```

---

### Task 18: Inbox queries and mutations

**Files:**
- Create: `convex/inbox.ts`
- Test: `tests/convex/inbox.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/convex/inbox.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as outreach from "../../convex/outreach";
import * as inbox from "../../convex/inbox";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "outreach.ts": async () => outreach,
  "inbox.ts": async () => inbox,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("inbox", () => {
  it("listEscalated returns one entry per applicationId, newest first", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" });
      const candidateId = await ctx.db.insert("candidates", { name: "A", qualifications: [], certifications: [], boardExperience: [], subjects: [] });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: [],
        naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
      });
      const appId = await ctx.db.insert("applications", { candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now() });
      // two escalated inbound messages on the same application
      await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId, schoolId, type: "candidate_reply", channel: "email",
        body: "msg1", status: "sent", direction: "inbound", escalated: true,
        escalationReason: "negotiation", sentAt: Date.now() - 1000,
      });
      await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId, schoolId, type: "candidate_reply", channel: "email",
        body: "msg2", status: "sent", direction: "inbound", escalated: true,
        escalationReason: "negotiation", sentAt: Date.now(),
      });
      return { schoolId, appId };
    });

    const result = await t.query("inbox:listEscalated", { schoolId: ids.schoolId });
    expect(result.length).toBe(1);
    expect(result[0].applicationId).toBe(ids.appId);
    expect(result[0].latestEscalationReason).toBe("negotiation");
  });

  it("humanReply clears resolvedAt on all prior escalated messages in the thread", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" });
      const candidateId = await ctx.db.insert("candidates", { name: "A", qualifications: [], certifications: [], boardExperience: [], subjects: [] });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: [],
        naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
      });
      const appId = await ctx.db.insert("applications", { candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now() });
      const escId = await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId, schoolId, type: "candidate_reply", channel: "email",
        body: "x", status: "sent", direction: "inbound", escalated: true,
        escalationReason: "negotiation", sentAt: Date.now(),
      });
      return { appId, candidateId, escId };
    });

    await t.mutation("inbox:humanReply", {
      applicationId: ids.appId,
      candidateId: ids.candidateId,
      channel: "email",
      body: "Replying directly",
    });
    const esc = await t.run(async (ctx) => ctx.db.get(ids.escId));
    expect(esc?.resolvedAt).toBeTypeOf("number");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/convex/inbox.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the implementation**

Create `convex/inbox.ts`:

```ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listEscalated = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const escalated = await ctx.db
      .query("outreachMessages")
      .withIndex("by_schoolId_escalated", (q) => q.eq("schoolId", args.schoolId).eq("escalated", true))
      .collect();
    const unresolved = escalated.filter((m) => m.resolvedAt == null);
    // Group by applicationId, take the most recent per app
    const byApp = new Map<string, typeof unresolved[0]>();
    for (const m of unresolved) {
      const existing = byApp.get(m.applicationId as string);
      if (!existing || (m.sentAt ?? 0) > (existing.sentAt ?? 0)) {
        byApp.set(m.applicationId as string, m);
      }
    }
    // Enrich with candidate name
    const rows: Array<{
      applicationId: string;
      candidateName: string;
      latestBody: string;
      latestEscalationReason: string;
      latestAt: number;
    }> = [];
    for (const m of byApp.values()) {
      const c = await ctx.db.get(m.candidateId);
      rows.push({
        applicationId: m.applicationId as string,
        candidateName: c?.name ?? "Unknown",
        latestBody: m.body,
        latestEscalationReason: m.escalationReason ?? "",
        latestAt: m.sentAt ?? 0,
      });
    }
    rows.sort((a, b) => b.latestAt - a.latestAt);
    return rows;
  },
});

export const getThread = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("outreachMessages")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", args.applicationId))
      .collect();
    return messages.sort((a, b) => (a.sentAt ?? 0) - (b.sentAt ?? 0));
  },
});

export const humanReply = mutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");
    const newId = await ctx.db.insert("outreachMessages", {
      applicationId: args.applicationId,
      candidateId: args.candidateId,
      schoolId: app.schoolId,
      type: "custom",
      channel: args.channel,
      body: args.body,
      status: "scheduled",
      scheduledSendAt: Date.now(),
      direction: "outbound",
      draftedBy: "manual",
    });
    // Resolve all prior escalated messages in this thread
    const escalated = await ctx.db
      .query("outreachMessages")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", args.applicationId))
      .collect();
    const now = Date.now();
    for (const m of escalated) {
      if (m.escalated === true && m.resolvedAt == null) {
        await ctx.db.patch(m._id, { resolvedAt: now });
      }
    }
    return newId;
  },
});

export const resolveEscalation = mutation({
  args: { messageId: v.id("outreachMessages") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { resolvedAt: Date.now() });
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run tests/convex/inbox.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/inbox.ts tests/convex/inbox.test.ts
git commit -m "feat(conversation): inbox queries + humanReply mutation"
```

---

### Task 19: Inbox thread component (reusable)

**Files:**
- Create: `components/dashboard/inbox-thread.tsx`

- [ ] **Step 1: Build the component**

Create `components/dashboard/inbox-thread.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface Props {
  applicationId: Id<"applications">;
  candidateId: Id<"candidates">;
}

export function InboxThread({ applicationId, candidateId }: Props) {
  const messages = useQuery(api.inbox.getThread, { applicationId });
  const humanReply = useMutation(api.inbox.humanReply);
  const [draft, setDraft] = useState("");
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [sending, setSending] = useState(false);

  if (!messages) return <div className="text-sm text-neutral-500">Loading thread...</div>;

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await humanReply({ applicationId, candidateId, channel, body: draft });
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
      <ul className="space-y-2 max-h-96 overflow-y-auto">
        {messages.map((m: any) => (
          <li
            key={m._id}
            className={`rounded-lg p-3 text-sm ${
              m.direction === "inbound"
                ? "bg-neutral-100"
                : m.draftedBy === "conversation_agent"
                ? "bg-blue-50"
                : "bg-emerald-50"
            }`}
          >
            <div className="text-xs text-neutral-500 mb-1">
              {m.direction === "inbound" ? "Candidate" : m.draftedBy === "conversation_agent" ? "Agent" : "You"}
              {" - "}
              {m.channel}
              {m.escalated && m.resolvedAt == null ? " - needs reply" : ""}
            </div>
            <div className="whitespace-pre-wrap">{m.body}</div>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as any)}
          className="rounded-md border px-2 py-1 text-sm"
        >
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your reply..."
          className="w-full rounded-md border p-2 text-sm"
          rows={4}
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/inbox-thread.tsx
git commit -m "feat(inbox): reusable thread component"
```

---

### Task 20: Inbox pages

**Files:**
- Create: `app/dashboard/inbox/page.tsx`
- Create: `app/dashboard/inbox/[applicationId]/page.tsx`

- [ ] **Step 1: Inbox list page**

Create `app/dashboard/inbox/page.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function InboxPage() {
  const school = useQuery(api.schools.getCurrentSchool, {});
  const rows = useQuery(api.inbox.listEscalated, school ? { schoolId: school._id } : "skip");

  if (!school || !rows) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Inbox</h1>
      <p className="text-sm text-neutral-600">Conversations the agent escalated for your reply.</p>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 p-6 text-sm text-neutral-500">
          No conversations need your attention.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r: any) => (
            <li key={r.applicationId} className="rounded-2xl border border-neutral-200 bg-white p-4">
              <Link href={`/dashboard/inbox/${r.applicationId}`} className="block">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{r.candidateName}</div>
                  <div className="text-xs text-neutral-500">
                    {new Date(r.latestAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-amber-700 mt-1">
                  Reason: {r.latestEscalationReason}
                </div>
                <div className="text-sm text-neutral-700 mt-2 line-clamp-2">{r.latestBody}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Inbox thread page**

Create `app/dashboard/inbox/[applicationId]/page.tsx`:

```tsx
"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InboxThread } from "@/components/dashboard/inbox-thread";
import type { Id } from "@/convex/_generated/dataModel";

export default function InboxThreadPage({ params }: { params: { applicationId: string } }) {
  const appId = params.applicationId as Id<"applications">;
  const app = useQuery(api.applications.get, { applicationId: appId });
  if (!app) return <div className="p-6">Loading...</div>;
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Thread</h1>
      <InboxThread applicationId={appId} candidateId={app.candidateId} />
    </div>
  );
}
```

If `api.applications.get` does not exist with that signature, check `convex/applications.ts` for the equivalent (it does at line 79 of the current codebase). Adjust args if needed.

- [ ] **Step 3: Manual smoke test**

Run: `bun run dev`. Visit `/dashboard/inbox`. Confirm:
1. Empty state renders when no escalations exist.
2. With a seeded escalated message (via the Convex dashboard), the list shows it.
3. Clicking through opens the thread view.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/inbox/page.tsx app/dashboard/inbox/[applicationId]/page.tsx
git commit -m "feat(inbox): list page + thread page"
```

---

### Task 21: Sidebar nav with Inbox link and badge

**Files:**
- Modify: `components/dashboard/sidebar.tsx`
- Modify: `convex/inbox.ts` (add a count query)

- [ ] **Step 1: Add the count query**

Open `convex/inbox.ts`. Append:

```ts
export const countEscalated = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const escalated = await ctx.db
      .query("outreachMessages")
      .withIndex("by_schoolId_escalated", (q) => q.eq("schoolId", args.schoolId).eq("escalated", true))
      .collect();
    const unresolved = escalated.filter((m) => m.resolvedAt == null);
    const distinctApps = new Set(unresolved.map((m) => m.applicationId));
    return distinctApps.size;
  },
});
```

- [ ] **Step 2: Add Inbox link with badge to sidebar**

Open `components/dashboard/sidebar.tsx`. Find the navigation links list. Add an Inbox entry that uses the count query:

```tsx
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// inside the component, with the existing schoolId in scope:
const inboxCount = useQuery(api.inbox.countEscalated, schoolId ? { schoolId } : "skip");

// in the JSX, add a new <Link> next to the existing ones:
<Link href="/dashboard/inbox" className="...existing-link-classes...">
  Inbox
  {inboxCount && inboxCount > 0 ? (
    <span className="ml-2 inline-flex items-center rounded-full bg-amber-500 text-white text-xs px-2 py-0.5">
      {inboxCount}
    </span>
  ) : null}
</Link>
```

Match the styling of existing nav links (read the file first to see the actual classnames used).

- [ ] **Step 3: Manual smoke test**

Run: `bun run dev`. Confirm the Inbox link appears in the sidebar, with no badge when count is 0 and with a number when escalations exist.

- [ ] **Step 4: Commit**

```bash
git add convex/inbox.ts components/dashboard/sidebar.tsx
git commit -m "feat(inbox): sidebar link with unread badge"
```

---

### Task 22: Mount InboxThread inline on the candidate detail page

**Files:**
- Modify: the candidate detail page

- [ ] **Step 1: Find the candidate detail page**

Run: `grep -rn "useQuery.*applications.get\|applicationId.*params" app/dashboard/ | head -10`
This locates the file that already loads an application by ID. Likely under `app/dashboard/pipeline/[id]/page.tsx` or `app/dashboard/jobs/[id]/pipeline/[appId]/page.tsx`.

- [ ] **Step 2: Add a conditional InboxThread mount**

Open the located file. Import the component:

```tsx
import { InboxThread } from "@/components/dashboard/inbox-thread";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
```

Inside the JSX, where the existing candidate detail sections render, add:

```tsx
{(() => {
  const thread = useQuery(api.inbox.getThread, { applicationId });
  const hasEscalated = thread?.some((m: any) => m.escalated === true && m.resolvedAt == null);
  if (!hasEscalated) return null;
  return (
    <div className="my-4">
      <h3 className="text-sm font-medium text-amber-700 mb-2">Conversation needs your attention</h3>
      <InboxThread applicationId={applicationId} candidateId={candidateId} />
    </div>
  );
})()}
```

(Replace `applicationId` and `candidateId` with the variables already in scope on that page.)

- [ ] **Step 3: Manual smoke test**

Run: `bun run dev`. Open a candidate detail page. With no escalation, the InboxThread does not render. After seeding an escalated message, it appears inline.

- [ ] **Step 4: Commit**

```bash
git add <the-file-you-edited>
git commit -m "feat(inbox): inline thread on candidate detail page"
```

---

### Task 23: Add FAQ content field to messaging settings

**Files:**
- Modify: `app/dashboard/settings/messaging/page.tsx`
- Modify: `convex/schools.ts` (add a mutation if needed)

- [ ] **Step 1: Add the mutation**

Open `convex/schools.ts`. Add (if no equivalent exists):

```ts
export const updateFaqContent = mutation({
  args: { schoolId: v.id("schools"), faqContent: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.schoolId, { faqContent: args.faqContent });
  },
});
```

- [ ] **Step 2: Add a textarea to the messaging settings page**

Open `app/dashboard/settings/messaging/page.tsx`. Add a new section:

```tsx
// At the top of the component:
import { useMutation } from "convex/react";
import { useState, useEffect } from "react";

// inside the component (school is presumably already loaded):
const [faq, setFaq] = useState(school?.faqContent ?? "");
useEffect(() => setFaq(school?.faqContent ?? ""), [school]);
const saveFaq = useMutation(api.schools.updateFaqContent);

// in the JSX:
<section className="space-y-3">
  <h2 className="text-lg font-medium">FAQ knowledge</h2>
  <p className="text-sm text-neutral-600">
    The conversation agent uses this content (plus the role + school details) to answer candidate FAQs.
    Free text or markdown. Cover school timings, leave policy, transport, hostel, joining bonus, anything
    candidates typically ask about.
  </p>
  <textarea
    value={faq}
    onChange={(e) => setFaq(e.target.value)}
    placeholder="School timings: 8am - 3pm. Transport: subsidized routes from..."
    className="w-full rounded-md border p-3 text-sm font-mono"
    rows={12}
  />
  <button
    onClick={() => saveFaq({ schoolId: school._id, faqContent: faq })}
    className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm"
  >
    Save FAQ
  </button>
</section>
```

- [ ] **Step 3: Manual smoke test**

Run: `bun run dev`. Navigate to messaging settings. Edit + save the FAQ. Refresh. Confirm it persists.

- [ ] **Step 4: Commit**

```bash
git add convex/schools.ts app/dashboard/settings/messaging/page.tsx
git commit -m "feat(conversation): FAQ content field in messaging settings"
```

---

### Task 24: End-to-end conversation agent smoke test

**Files:**
- (No code changes)

- [ ] **Step 1: Enable the feature flag on a test school**

Open the Convex dashboard. Run a quick patch on a school doc:

```js
// In the Convex dashboard data browser, find your test school and patch:
{ "conversationAgentEnabled": true, "faqContent": "School timings 8am-3pm. Transport provided." }
```

- [ ] **Step 2: Trigger an inbound email manually**

Run this in a terminal (replace HOST with your Convex deployment URL, and TOKEN with a real `replyToken` from an outbound message in the DB):

```bash
curl -X POST https://HOST.convex.site/email/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "to": "reply+TOKEN@rolerecruit.com",
    "from": "Asha <asha@example.com>",
    "subject": "Re: shortlist",
    "text": "What is the salary?"
  }'
```

- [ ] **Step 3: Verify in the Convex dashboard**

Look at the `outreachMessages` table. Confirm:
1. A new row exists with `direction: "inbound"`, `type: "candidate_reply"`, `intent: "faq"`, `confidence` populated.
2. A second new row exists with `direction: "outbound"`, `type: "agent_reply"`, `draftedBy: "conversation_agent"`, `status: "scheduled"`.
3. Within ~1 minute, the cron dispatches the outbound row and its `status` flips to `"sent"`.

- [ ] **Step 4: Trigger an inbound WhatsApp manually**

```bash
curl -X POST https://HOST.convex.site/whatsapp/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message",
    "payload": {
      "source": "+919876543210",
      "payload": { "text": "what is the board" }
    }
  }'
```

(Use a phone number that matches a real candidate with a recent outbound.)

- [ ] **Step 5: Verify the Inbox tab**

If you sent an inbound that the classifier returns `negotiation` for (e.g., text "can you increase the salary?"), it should appear in `/dashboard/inbox` with the candidate's name.

- [ ] **Step 6: Test the human reply path**

In the Inbox thread view, type a reply and send. Confirm:
1. New outbound row appears with `draftedBy: "manual"`.
2. The escalated inbound's `resolvedAt` is now a timestamp.
3. The Inbox sidebar badge count decreases.

(No commit needed for this task — it's manual verification.)

---

## Self-review checklist (run after writing the plan)

- [x] Spec section "Conversation Agent inbound channels" → covered by Tasks 12, 13.
- [x] Spec section "FAQ knowledge source" → covered by Tasks 15, 23.
- [x] Spec section "Reply policy with confidence threshold" → covered by Task 17 (CONFIDENCE_THRESHOLD = 0.75).
- [x] Spec section "Inbox tab + inline on candidate page" → covered by Tasks 18-22.
- [x] Spec section "Morning brief email + widget" → covered by Tasks 5, 8.
- [x] Spec section "Admin-curated recipient list" → covered by Task 9.
- [x] Spec section "Detect + report stalled, no auto-send" → covered by Tasks 2, 3 (stalled definition + collectStats).
- [x] Spec section "8:00 IST cron" → covered by Task 6.
- [x] Spec section "feature flags conversationAgentEnabled + morningBriefEnabled" → covered by Tasks 1, 5, 17.
- [x] Spec section "schema additions" → covered by Task 1.
- [x] All test commands use `bun run vitest run tests/convex/<file>.test.ts`.
- [x] No placeholders ("TBD", "implement later"). The `dashboard.ts` stub in Task 7 Step 1 is explicitly labeled as temporary and replaced in Step 2.
- [x] Type names consistent: `BriefStats`, `ClassifyOutput`, `FaqDraftOutput`, `RescheduleInput`, `Intent` defined once and referenced consistently.
- [x] Function names consistent: `collectStats` query + `collectStatsHandler` helper, `handleInbound`, `dispatch`, `handleInboundMessage`, `sendBriefForSchool`, `sendAllSchools`.

---

## Execution

Plan complete. Hand-off to the user for choice of execution mode.
