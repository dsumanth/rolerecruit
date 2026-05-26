# Phase 2 — Dynamic Facet Promotion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 2 of the three-phase Talent Bank design — automatic graduation of frequently-occurring `parsedFacets.extras` keys into typed first-class facets, with no manual schema migration. Plus a one-click admin UI to promote/dismiss/demote.

**Architecture:** A nightly cron walks recently-parsed candidates, aggregates `parsedFacets.extras` keys into a new `facetPromotionCandidates` table (with occurrenceCount + sampleEvidence + status). Keys that cross a threshold (≥25 candidates OR ≥5% of 90-day intake) surface in an admin UI. One-click promote: marks status, triggers a backfill action that re-extracts the now-typed facet from preserved `rawChunks` for every carrying candidate, and registers the key in a runtime-readable list that Phase 1's `parseProfileFromText` consults each call. Demotion reverses the move — values shift from a typed slot back to the extras bag. No data loss in either direction.

**Tech Stack:** Convex 1.17 (DB + cron + scheduled actions), DeepSeek v4-flash via existing `convex/ai.ts` client, Next.js 14 App Router, Vitest + `convex-test`, Playwright.

**Depends on Phase 1:** Specifically, this plan assumes `candidates.parsedFacets.extras`, `candidates.rawChunks`, `candidates.parsedAt`, `candidates.parsedVersion`, and the existing `parseProfileFromText` shape are already in place. If Phase 1 hasn't shipped, stop and ship that first.

**Source spec:** `/Users/sumanthdaggubati/.claude/plans/the-agentic-ai-async-shannon.md`

---

## Reference Reading (Required Before Task 1)

- `convex/schema.ts` — confirm the post-Phase-1 schema, especially `candidates.parsedFacets.extras: v.record(v.string(), facetArrayValidator)` and the `facetArrayValidator` helper
- `convex/ai.ts` — current `parseProfileFromText` reads `FACET_EXTRACTION_SYSTEM` statically; Phase 2 makes the prompt data-driven
- `convex/prompts/facetExtraction.ts` — system prompt; will become a function that takes a promoted-key list
- `convex/intake.ts` — `parseAndStoreCandidate` orchestrator; no change needed for Phase 2 but useful to understand
- `convex/crons.ts` — existing cron file (registered `dispatch-scheduled-outreach`); we add a second cron here
- `convex/backfill.ts` — Phase 1 backfill action; we add a sibling for facet-promotion backfill
- `convex/versions.ts` — version stamps; we'll bump `PARSED_FACETS_VERSION` on every promotion so backfill re-extracts other candidates
- `tests/convex/candidates.test.ts`, `tests/convex/intake.test.ts` — convex-test pattern

---

## Naming Conventions

- **Table:** `facetPromotionCandidates`. NOT `promotedFacets` — the table holds candidates at any status (pending/promoted/dismissed/demoted).
- **Status flow:** `pending → promoted → demoted` and `pending → dismissed`. Demoted is terminal-ish; manual re-promotion possible.
- **`key`** is the snake_case extras key as emitted by the intake prompt (`AI_curriculum_design`, `STEM_lab_setup`). NEVER spaces, NEVER capitals beyond the snake-case convention.
- **Version bump:** Every promote OR demote bumps `PARSED_FACETS_VERSION` in `convex/versions.ts` to `facets-v<N>`, triggering Phase 1's existing backfill machinery to also re-process unrelated stale rows over time.
- **Threshold defaults:** `PROMOTION_OCCURRENCE_THRESHOLD = 25`, `PROMOTION_PERCENT_THRESHOLD = 0.05`, `PROMOTION_WINDOW_DAYS = 90` — all live in `convex/versions.ts` (yes, the constants file expands).

---

## File Structure

### New files

```
convex/
  facetPromotion.ts                 — frequency tracker action + promote/demote + backfill
  prompts/facetExtraction.ts        — REPLACED with a function that takes typed-key list

app/dashboard/settings/
  facets/page.tsx                   — admin UI: pending promotions, sample evidence, buttons

components/facets/
  promotion-card.tsx                — one card per pending promotion candidate

tests/convex/
  facetPromotion.test.ts            — frequency tracker + promote + demote + backfill
```

### Modified files

```
convex/versions.ts                  — add thresholds + bump version constant pattern
convex/schema.ts                    — add facetPromotionCandidates table + index
convex/ai.ts                        — parseProfileFromText calls promoted-key query before LLM
convex/crons.ts                     — register nightly facet-frequency cron
convex/backfill.ts                  — (optional) cross-link to the facet-promotion backfill
convex/candidates.ts                — helper mutations to move facet values between typed/extras slots
components/dashboard/sidebar.tsx    — add "Facets" link under Settings
```

---

# BLOCK A — Foundation (Tasks 1–3)

## Task 1: Extend `versions.ts` with promotion thresholds

**Files:**
- Modify: `convex/versions.ts`

- [ ] **Step 1: Append the new constants**

```ts
// Phase 2 — Dynamic Facet Promotion
export const PROMOTION_OCCURRENCE_THRESHOLD = 25;
export const PROMOTION_PERCENT_THRESHOLD = 0.05;
export const PROMOTION_WINDOW_DAYS = 90;

// Cron heartbeat for the nightly frequency tracker (millis since last run)
export const FACET_TRACKER_LOOKBACK_MS = 25 * 60 * 60 * 1000; // 25h — slightly > 24 to catch overlap
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && npx tsc --noEmit -p tsconfig.json
git add convex/versions.ts
git commit -m "feat(convex): Phase 2 — promotion thresholds + tracker lookback"
```

---

## Task 2: Schema — add `facetPromotionCandidates` table

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the table**

Inside `defineSchema({ ... })`, add (next to the other tables):

```ts
facetPromotionCandidates: defineTable({
  key: v.string(),                 // snake_case extras key, e.g. "AI_curriculum_design"
  occurrenceCount: v.number(),     // candidates carrying this key
  firstSeenAt: v.number(),
  lastSeenAt: v.number(),
  sampleEvidence: v.array(v.object({
    candidateId: v.id("candidates"),
    quote: v.string(),
    offset: v.number(),
    context: v.string(),
  })),                              // up to 5 distinct samples
  status: v.union(
    v.literal("pending"),
    v.literal("promoted"),
    v.literal("dismissed"),
    v.literal("demoted"),
  ),
  promotedAt: v.optional(v.number()),
  dismissedAt: v.optional(v.number()),
  demotedAt: v.optional(v.number()),
})
  .index("by_key", ["key"])
  .index("by_status", ["status"])
  .index("by_status_occurrenceCount", ["status", "occurrenceCount"]),
```

- [ ] **Step 2: Typecheck + tests + commit**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && npx tsc --noEmit -p tsconfig.json && npm test
git add convex/schema.ts
git commit -m "feat(schema): facetPromotionCandidates table"
```

---

## Task 3: Schema push

- [ ] **Step 1: Push schema** to Convex dev

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npx convex dev --once`
Expected: clean push. The `convex/_generated/` is gitignored so no commit step.

---

# BLOCK B — Frequency tracker (Tasks 4–6)

## Task 4: Frequency tracker — write failing test

**Files:**
- Create: `tests/convex/facetPromotion.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/convex/facetPromotion.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as facetPromotion from "../../convex/facetPromotion";
import * as candidates from "../../convex/candidates";
import * as ai from "../../convex/ai";
import * as embeddings from "../../convex/embeddings";
import * as intake from "../../convex/intake";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "facetPromotion.ts": async () => facetPromotion,
  "candidates.ts": async () => candidates,
  "ai.ts": async () => ai,
  "embeddings.ts": async () => embeddings,
  "intake.ts": async () => intake,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
});

async function seedCandidateWithExtras(t: any, key: string, valueText: string) {
  const id = await t.mutation("candidates:create", {
    name: "X", qualifications: [], certifications: [],
    boardExperience: [], subjects: ["Physics"],
  });
  await t.run(async (ctx: any) => {
    await ctx.db.patch(id, {
      parsedFacets: {
        specializations: [], gradeLevels: [], pedagogicalApproach: [],
        leadershipRoles: [], extracurricular: [], languages: [],
        schoolTypes: [], keyAchievements: [], redFlags: [],
        extras: {
          [key]: [{ value: valueText, evidence: { quote: valueText, offset: 0, context: "" } }],
        },
      },
      rawChunks: [{ text: valueText, section: "experience", offset: 0 }],
      parsedAt: Date.now(),
      parsedVersion: "facets-v1",
    });
  });
  return id;
}

describe("facetPromotion", () => {
  it("trackExtrasFrequency aggregates extras keys into facetPromotionCandidates", async () => {
    const t = convexTest(schema, modules);

    await seedCandidateWithExtras(t, "AI_curriculum_design", "designed AI-integrated curriculum");
    await seedCandidateWithExtras(t, "AI_curriculum_design", "AI curriculum for grade 9");
    await seedCandidateWithExtras(t, "STEM_lab_setup", "built STEM lab from scratch");

    await t.action("facetPromotion:trackExtrasFrequency", {});

    const ai = await t.query("facetPromotion:getByKey", { key: "AI_curriculum_design" });
    expect(ai).not.toBeNull();
    expect(ai!.occurrenceCount).toBe(2);
    expect(ai!.sampleEvidence.length).toBeGreaterThanOrEqual(1);

    const stem = await t.query("facetPromotion:getByKey", { key: "STEM_lab_setup" });
    expect(stem!.occurrenceCount).toBe(1);
  });

  it("trackExtrasFrequency is idempotent — running twice doesn't double-count", async () => {
    const t = convexTest(schema, modules);
    await seedCandidateWithExtras(t, "AI_curriculum_design", "v1");
    await t.action("facetPromotion:trackExtrasFrequency", {});
    await t.action("facetPromotion:trackExtrasFrequency", {});
    const row = await t.query("facetPromotion:getByKey", { key: "AI_curriculum_design" });
    expect(row!.occurrenceCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- facetPromotion`
Expected: FAIL — module missing.

---

## Task 5: Implement frequency tracker

**Files:**
- Create: `convex/facetPromotion.ts`

- [ ] **Step 1: Write the file**

```ts
// convex/facetPromotion.ts
import { action, internalAction, mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import {
  PROMOTION_OCCURRENCE_THRESHOLD,
  PROMOTION_PERCENT_THRESHOLD,
  PROMOTION_WINDOW_DAYS,
  FACET_TRACKER_LOOKBACK_MS,
} from "./versions";

interface CandidateExtraOccurrence {
  candidateId: string;
  key: string;
  value: string;
  quote: string;
  offset: number;
  context: string;
}

/**
 * trackExtrasFrequency — scans candidates parsed in the last FACET_TRACKER_LOOKBACK_MS,
 * aggregates parsedFacets.extras keys, and upserts rows in facetPromotionCandidates.
 *
 * Idempotent: each (key, candidateId) pair is counted at most once per row.
 * Each existing row tracks which candidate IDs have already contributed (via a set
 * stored in sampleEvidence — we use sampleEvidence as the dedup signal since we
 * always know the candidateId for every contribution).
 *
 * Designed to be called by a nightly cron OR on-demand.
 */
export const trackExtrasFrequency = action({
  args: { lookbackMs: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ keysSeen: number; newRows: number; updatedRows: number }> => {
    const lookback = args.lookbackMs ?? FACET_TRACKER_LOOKBACK_MS;
    const since = Date.now() - lookback;

    const recent = await ctx.runQuery(internal.facetPromotion.listRecentlyParsed, { since });

    // Collect all (key, candidateId, value, evidence) occurrences
    const occurrences: CandidateExtraOccurrence[] = [];
    for (const c of recent) {
      const extras = c.parsedFacets?.extras ?? {};
      for (const [key, arr] of Object.entries(extras)) {
        for (const fv of arr as any[]) {
          occurrences.push({
            candidateId: c._id,
            key,
            value: fv.value,
            quote: fv.evidence?.quote ?? "",
            offset: fv.evidence?.offset ?? 0,
            context: fv.evidence?.context ?? "",
          });
        }
      }
    }

    // Group by key
    const byKey = new Map<string, CandidateExtraOccurrence[]>();
    for (const o of occurrences) {
      if (!byKey.has(o.key)) byKey.set(o.key, []);
      byKey.get(o.key)!.push(o);
    }

    let newRows = 0;
    let updatedRows = 0;
    for (const [key, occs] of byKey) {
      const result = await ctx.runMutation(internal.facetPromotion.upsertCandidate, {
        key,
        occurrences: occs.slice(0, 50), // cap for the upsert call
      });
      if (result === "created") newRows++;
      else updatedRows++;
    }

    return { keysSeen: byKey.size, newRows, updatedRows };
  },
});

export const listRecentlyParsed = query({
  args: { since: v.number() },
  handler: async (ctx, args) => {
    // No `by_parsedAt` index yet — scan all candidates and filter. For Phase 2's
    // expected pool size (≤10K), this is fine. Add the index in a follow-up if
    // we cross 100K candidates.
    const all = await ctx.db.query("candidates").take(2000);
    return all.filter((c) => (c.parsedAt ?? 0) >= args.since);
  },
});

export const upsertCandidate = internalMutation({
  args: {
    key: v.string(),
    occurrences: v.array(v.object({
      candidateId: v.id("candidates"),
      key: v.string(),
      value: v.string(),
      quote: v.string(),
      offset: v.number(),
      context: v.string(),
    })),
  },
  handler: async (ctx, args): Promise<"created" | "updated"> => {
    const existing = await ctx.db
      .query("facetPromotionCandidates")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    // Dedup contributing candidate IDs
    const existingCandidates = new Set(
      existing?.sampleEvidence.map((e) => String(e.candidateId)) ?? []
    );
    const newOccurrences = args.occurrences.filter(
      (o) => !existingCandidates.has(String(o.candidateId))
    );

    if (existing) {
      // Skip if no new contributors
      if (newOccurrences.length === 0) return "updated";
      const newSamples = [
        ...existing.sampleEvidence,
        ...newOccurrences.slice(0, 5 - existing.sampleEvidence.length).map((o) => ({
          candidateId: o.candidateId,
          quote: o.quote,
          offset: o.offset,
          context: o.context,
        })),
      ].slice(0, 5);
      await ctx.db.patch(existing._id, {
        occurrenceCount: existing.occurrenceCount + newOccurrences.length,
        lastSeenAt: Date.now(),
        sampleEvidence: newSamples,
      });
      return "updated";
    } else {
      await ctx.db.insert("facetPromotionCandidates", {
        key: args.key,
        occurrenceCount: args.occurrences.length,
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
        sampleEvidence: args.occurrences.slice(0, 5).map((o) => ({
          candidateId: o.candidateId,
          quote: o.quote,
          offset: o.offset,
          context: o.context,
        })),
        status: "pending",
      });
      return "created";
    }
  },
});

export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("facetPromotionCandidates")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

/**
 * listPending — for the admin UI. Returns rows where status is "pending" AND
 * either occurrenceCount >= PROMOTION_OCCURRENCE_THRESHOLD OR the row hits
 * the percent threshold over the recent window.
 */
export const listPending = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const pending = await ctx.db
      .query("facetPromotionCandidates")
      .withIndex("by_status_occurrenceCount", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(200);

    // Pool size for the % threshold
    const recentCutoff = Date.now() - PROMOTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recentCandidates = await ctx.db.query("candidates").take(2000);
    const recentPoolSize = recentCandidates.filter((c) => (c.parsedAt ?? 0) >= recentCutoff).length;
    const percentThresholdAbsolute = Math.max(5, Math.ceil(recentPoolSize * PROMOTION_PERCENT_THRESHOLD));

    return pending
      .filter((r) =>
        r.occurrenceCount >= PROMOTION_OCCURRENCE_THRESHOLD ||
        r.occurrenceCount >= percentThresholdAbsolute
      )
      .slice(0, limit);
  },
});

export const listAll = query({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    let q = ctx.db.query("facetPromotionCandidates");
    if (args.status) {
      q = q.withIndex("by_status", (idx) => idx.eq("status", args.status as any));
    }
    return await q.order("desc").take(limit);
  },
});
```

- [ ] **Step 2: Run test from Task 4**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- facetPromotion`
Expected: both tests PASS.

- [ ] **Step 3: Full suite**

Run: `npm test` — expect all green.

- [ ] **Step 4: Commit**

```bash
git add convex/facetPromotion.ts tests/convex/facetPromotion.test.ts
git commit -m "feat(facetPromotion): trackExtrasFrequency + listPending + getByKey"
```

---

## Task 6: Register the nightly cron

**Files:**
- Modify: `convex/crons.ts`

- [ ] **Step 1: Read current crons.ts**

It should already register `dispatch-scheduled-outreach` every minute (from Phase 1 follow-up). Verify by reading.

- [ ] **Step 2: Add the frequency tracker cron**

Append the new entry alongside the existing one:

```ts
crons.daily(
  "track-extras-frequency",
  { hourUTC: 3, minuteUTC: 0 }, // 03:00 UTC nightly
  internal.facetPromotion.trackExtrasFrequency,
);
```

If `crons.daily` expects a different arg shape per Convex docs, adapt to match. Keep the existing dispatcher cron untouched.

- [ ] **Step 3: Push + commit**

```bash
npx convex dev --once
git add convex/crons.ts
git commit -m "feat(crons): nightly facet-frequency tracker"
```

---

# BLOCK C — Promote / Demote (Tasks 7–11)

## Task 7: Promoted-facet runtime registry — query

**Files:**
- Modify: `convex/facetPromotion.ts`

Promoted keys need to be readable at intake time (for the LLM prompt). Append:

```ts
export const listPromotedKeys = query({
  args: {},
  handler: async (ctx) => {
    const promoted = await ctx.db
      .query("facetPromotionCandidates")
      .withIndex("by_status", (q) => q.eq("status", "promoted"))
      .collect();
    return promoted.map((p) => p.key);
  },
});
```

This is what `ai.ts` will call to pull the typed-key list dynamically.

- [ ] **Verify + commit**

```bash
npx tsc --noEmit -p tsconfig.json && npm test
git add convex/facetPromotion.ts
git commit -m "feat(facetPromotion): listPromotedKeys runtime registry"
```

---

## Task 8: Helper mutations on `candidates.ts` — move values between typed/extras

**Files:**
- Modify: `convex/candidates.ts`

We need two internal mutations to shuffle values between a typed facet slot and the extras bag during promotion/demotion. Append:

```ts
// Phase 2 — Dynamic Facet Promotion helpers

export const promoteFacetForCandidate = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    key: v.string(),
    // Where in the typed facet list does this key go? "extras_promoted" is a flat
    // bucket — promoted keys live in a single typed slot called "promotedFacets"
    // to avoid mid-stream schema additions. We can revisit later if we want
    // per-key slots.
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.candidateId);
    if (!c || !c.parsedFacets) return;
    const extras = { ...c.parsedFacets.extras };
    const values = extras[args.key];
    if (!values) return;
    delete extras[args.key];
    // Re-attach under a promoted_<key> meta-key inside extras with a status
    // marker — promoted keys are conceptually typed but the schema doesn't have
    // first-class slots for arbitrary keys. We keep them under extras with a
    // namespace prefix so listPromotedKeys() and queries can pick them out.
    extras[`__promoted__${args.key}`] = values;
    await ctx.db.patch(args.candidateId, {
      parsedFacets: { ...c.parsedFacets, extras },
    });
  },
});

export const demoteFacetForCandidate = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.candidateId);
    if (!c || !c.parsedFacets) return;
    const extras = { ...c.parsedFacets.extras };
    const promotedKey = `__promoted__${args.key}`;
    const values = extras[promotedKey];
    if (!values) return;
    delete extras[promotedKey];
    extras[args.key] = values;
    await ctx.db.patch(args.candidateId, {
      parsedFacets: { ...c.parsedFacets, extras },
    });
  },
});
```

**Design note:** Instead of mutating the schema to add a new typed facet slot per promotion (which would require frequent migrations), promoted keys live inside `parsedFacets.extras` under a `__promoted__<key>` prefix. They're typed conceptually — the rest of the system treats them as first-class — but stored in the open-vocabulary slot we already have. Listing/searching code (e.g., NL search) is updated to recognize this prefix.

If a later need for true typed slots emerges, we can introduce a dedicated `parsedFacets.promoted: v.record(v.string(), facetArrayValidator)` field in a follow-up Phase 2.5.

- [ ] **Commit**

```bash
npm test && npx tsc --noEmit -p tsconfig.json
git add convex/candidates.ts
git commit -m "feat(candidates): promoteFacetForCandidate + demoteFacetForCandidate helpers"
```

---

## Task 9: Promotion test (TDD)

**Files:**
- Modify: `tests/convex/facetPromotion.test.ts`

Append a new test describing the promotion flow:

```ts
  it("promote moves extras values to __promoted__<key> for every carrying candidate", async () => {
    const t = convexTest(schema, modules);
    const c1 = await seedCandidateWithExtras(t, "AI_curriculum_design", "designed AI curriculum");
    const c2 = await seedCandidateWithExtras(t, "AI_curriculum_design", "AI lessons for grade 9");
    const c3 = await seedCandidateWithExtras(t, "STEM_lab_setup", "built STEM lab");

    await t.action("facetPromotion:trackExtrasFrequency", {});
    await t.mutation("facetPromotion:promote", { key: "AI_curriculum_design", actorUserId: "test_admin" });

    // Promoted candidates: values moved to __promoted__<key>
    const updated1 = await t.query("candidates:get", { candidateId: c1 });
    const updated2 = await t.query("candidates:get", { candidateId: c2 });
    expect(updated1!.parsedFacets!.extras).not.toHaveProperty("AI_curriculum_design");
    expect(updated1!.parsedFacets!.extras).toHaveProperty("__promoted__AI_curriculum_design");
    expect(updated2!.parsedFacets!.extras).toHaveProperty("__promoted__AI_curriculum_design");

    // Unrelated candidate untouched
    const updated3 = await t.query("candidates:get", { candidateId: c3 });
    expect(updated3!.parsedFacets!.extras).toHaveProperty("STEM_lab_setup");

    // Promotion row has status="promoted"
    const row = await t.query("facetPromotion:getByKey", { key: "AI_curriculum_design" });
    expect(row!.status).toBe("promoted");
    expect(row!.promotedAt).toBeDefined();

    // listPromotedKeys exposes it
    const keys = await t.query("facetPromotion:listPromotedKeys", {});
    expect(keys).toContain("AI_curriculum_design");
  });
```

Run: `npm test -- facetPromotion` — expect failure (promote mutation doesn't exist yet).

---

## Task 10: Implement `promote` + `dismiss` + `demote`

**Files:**
- Modify: `convex/facetPromotion.ts`

Append:

```ts
export const promote = mutation({
  args: { key: v.string(), actorUserId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("facetPromotionCandidates")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!row) throw new Error(`No facetPromotionCandidates row for key "${args.key}"`);
    if (row.status === "promoted") return row._id;

    await ctx.db.patch(row._id, { status: "promoted", promotedAt: Date.now() });

    // Schedule the backfill — moves values from extras[key] → extras[__promoted__key]
    // for every candidate carrying the key
    await ctx.scheduler.runAfter(0, internal.facetPromotion.backfillPromotion, {
      key: args.key,
    });
    return row._id;
  },
});

export const dismiss = mutation({
  args: { key: v.string(), actorUserId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("facetPromotionCandidates")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!row) return;
    await ctx.db.patch(row._id, { status: "dismissed", dismissedAt: Date.now() });
  },
});

export const demote = mutation({
  args: { key: v.string(), actorUserId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("facetPromotionCandidates")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!row || row.status !== "promoted") return;

    await ctx.db.patch(row._id, { status: "demoted", demotedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.facetPromotion.backfillDemotion, {
      key: args.key,
    });
  },
});

export const backfillPromotion = internalAction({
  args: { key: v.string() },
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const all = await ctx.runQuery(internal.facetPromotion.candidatesWithExtraKey, {
      key: args.key,
    });
    let processed = 0;
    for (const c of all) {
      await ctx.runMutation(internal.candidates.promoteFacetForCandidate, {
        candidateId: c._id,
        key: args.key,
      });
      processed++;
    }
    return { processed };
  },
});

export const backfillDemotion = internalAction({
  args: { key: v.string() },
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const all = await ctx.runQuery(internal.facetPromotion.candidatesWithPromotedKey, {
      key: args.key,
    });
    let processed = 0;
    for (const c of all) {
      await ctx.runMutation(internal.candidates.demoteFacetForCandidate, {
        candidateId: c._id,
        key: args.key,
      });
      processed++;
    }
    return { processed };
  },
});

export const candidatesWithExtraKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    // No index on extras keys — scan. For pool sizes up to ~10K this is fine.
    const all = await ctx.db.query("candidates").take(5000);
    return all.filter((c) => c.parsedFacets?.extras && (c.parsedFacets.extras as any)[args.key]);
  },
});

export const candidatesWithPromotedKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const promotedKey = `__promoted__${args.key}`;
    const all = await ctx.db.query("candidates").take(5000);
    return all.filter((c) => c.parsedFacets?.extras && (c.parsedFacets.extras as any)[promotedKey]);
  },
});
```

Run: `npm test -- facetPromotion` — expect PASS.

- [ ] **Commit**

```bash
git add convex/facetPromotion.ts tests/convex/facetPromotion.test.ts
git commit -m "feat(facetPromotion): promote/dismiss/demote + backfill actions"
```

---

## Task 11: Demotion test

**Files:**
- Modify: `tests/convex/facetPromotion.test.ts`

Append:

```ts
  it("demote moves __promoted__<key> values back to extras[key]", async () => {
    const t = convexTest(schema, modules);
    const c1 = await seedCandidateWithExtras(t, "AI_curriculum_design", "designed curriculum");
    await t.action("facetPromotion:trackExtrasFrequency", {});
    await t.mutation("facetPromotion:promote", { key: "AI_curriculum_design", actorUserId: "admin" });
    await t.mutation("facetPromotion:demote", { key: "AI_curriculum_design", actorUserId: "admin" });

    const c = await t.query("candidates:get", { candidateId: c1 });
    expect(c!.parsedFacets!.extras).toHaveProperty("AI_curriculum_design");
    expect(c!.parsedFacets!.extras).not.toHaveProperty("__promoted__AI_curriculum_design");

    const row = await t.query("facetPromotion:getByKey", { key: "AI_curriculum_design" });
    expect(row!.status).toBe("demoted");
  });
```

Run: `npm test -- facetPromotion` — expect PASS.

```bash
git add tests/convex/facetPromotion.test.ts
git commit -m "test(facetPromotion): demotion flow"
```

---

# BLOCK D — Data-driven extraction prompt (Tasks 12–13)

## Task 12: Make facet extraction prompt data-driven

**Files:**
- Modify: `convex/prompts/facetExtraction.ts`

The current export is a constant string. Change it to a function that takes the promoted-key list and returns the prompt with those keys mentioned in the typed-facet vocabulary section.

Replace the existing `FACET_EXTRACTION_SYSTEM` export with:

```ts
// convex/prompts/facetExtraction.ts

const STATIC_VOCAB = `FACET VOCABULARY (use these when applicable; coin new ones for novelty):
- specializations: JEE_prep, NEET_prep, Olympiad, remedial, gifted, special_needs, ESL
- gradeLevels: Pre_Primary, Primary, Middle, Secondary, Senior_Secondary
- pedagogicalApproach: inquiry_based, experiential, traditional, montessori, project_based
- leadershipRoles: HOD_<Subject>, curriculum_committee, examination_coordinator, mentor
- schoolTypes: CBSE_private, ICSE_private, IB_international, government_aided, government
- languages: English, Hindi, Marathi, Tamil, Telugu, Kannada, Bengali, regional
- redFlags: short_tenures, employment_gap, frequent_school_switches, terminated_role`;

export function buildFacetExtractionPrompt(promotedKeys: string[]): string {
  const promotedSection = promotedKeys.length > 0
    ? `\n\nADDITIONAL TYPED FACETS (auto-promoted from past corpus — extract these as typed facets, NOT into extras):\n${promotedKeys.map((k) => `- ${k}`).join("\n")}\n`
    : "";

  return `You are an AI that compiles candidate resumes for Indian K-12 teacher hiring into a structured, queryable form. Your output runs as the candidate's permanent profile in our database — extract EVERYTHING the system might need to match this candidate against any future role.

CRITICAL GROUNDING RULES:
1. Every facet value you emit MUST be supported by a quote from the resume text.
2. The quote you provide must appear LITERALLY in the resume text — you may not paraphrase.
3. The "offset" you provide must be the character position where the quote begins.
4. The "context" should be ~50 characters from the resume surrounding the quote.

INDIAN EDUCATION CONTEXT:
- Boards: CBSE, ICSE, IB, IGCSE, State Board
- Levels: PRT (Primary, Classes 1-5), TGT (Grades 6-10), PGT (Grades 11-12)
- Qualifications: B.Ed, D.El.Ed, M.Ed, M.Sc, B.Sc, Ph.D
- Certifications: CTET, State TET, NET, UGC-NET

${STATIC_VOCAB}${promotedSection}

EXTRAS BAG: Anything that doesn't fit a typed facet but seems important goes into "extras" — an open-vocabulary record. Use snake_case keys. The system tracks frequency and graduates popular extras to typed facets later — so be liberal.

For PROMOTED facets, emit values under the typed slot key (e.g., "AI_curriculum_design": [...]) inside parsedFacets, NOT inside extras.

RAW CHUNKS: Also split the resume into sections labeled header|experience|pedagogy|achievements|leadership|other. These are the source-of-truth for evidence validation and future re-extraction. "header" is for top-of-resume identity/qualifications; never use "overall".

CANDIDATE SUMMARY: A 1-paragraph (~80 words) job-agnostic third-person description of the candidate. No bullets. No subjective claims.

OUTPUT — return ONLY a JSON object (no markdown, no explanation) matching the same schema as before, with the additional promoted facets appearing as top-level keys in parsedFacets when applicable.`;
}

// Preserved for compatibility — same as buildFacetExtractionPrompt([]) — DO NOT REMOVE
// until all callers migrate to buildFacetExtractionPrompt
export const FACET_EXTRACTION_SYSTEM = buildFacetExtractionPrompt([]);

export const EMPTY_PARSED_FACETS = {
  specializations: [], gradeLevels: [], pedagogicalApproach: [],
  leadershipRoles: [], extracurricular: [], languages: [],
  schoolTypes: [], keyAchievements: [], redFlags: [], extras: {},
};
```

- [ ] **Verify + commit**

```bash
npx tsc --noEmit -p tsconfig.json && npm test
git add convex/prompts/facetExtraction.ts
git commit -m "feat(prompts): data-driven facet extraction with promoted-key injection"
```

---

## Task 13: Update `parseProfileFromText` to read promoted keys

**Files:**
- Modify: `convex/ai.ts`

Change the import + handler. Replace the existing `parseProfileFromText` action with:

```ts
import { buildFacetExtractionPrompt, EMPTY_PARSED_FACETS } from "./prompts/facetExtraction";
import { api } from "./_generated/api";
// (the existing ParsedProfile import stays)

export const parseProfileFromText = action({
  args: { text: v.string() },
  handler: async (ctx, args): Promise<ParsedProfile> => {
    const client = getClient();
    if (!client) return emptyProfile();

    // Phase 2: read promoted keys at runtime so the LLM extracts them as typed
    let promotedKeys: string[] = [];
    try {
      promotedKeys = await ctx.runQuery(api.facetPromotion.listPromotedKeys, {});
    } catch {
      // facetPromotion module may not exist in some test contexts — fall back to empty
      promotedKeys = [];
    }

    const systemPrompt = buildFacetExtractionPrompt(promotedKeys);

    const response = await client.chat.completions.create({
      model: "deepseek-v4-flash",
      max_tokens: 4096,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: args.text.substring(0, 12000) },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      const parsed = JSON.parse(jsonMatch[0]);

      // Merge LLM-emitted top-level promoted keys into parsedFacets.extras under __promoted__<key>
      const parsedFacets = { ...EMPTY_PARSED_FACETS, ...(parsed.parsedFacets ?? {}) };
      const extras = { ...((parsedFacets as any).extras ?? {}) };
      for (const k of promotedKeys) {
        if (parsed.parsedFacets?.[k]) {
          extras[`__promoted__${k}`] = parsed.parsedFacets[k];
          delete (parsedFacets as any)[k]; // remove from top-level — only typed/extras shape allowed
        }
      }
      (parsedFacets as any).extras = extras;

      return {
        ...emptyProfile(),
        ...parsed,
        parsedFacets: parsedFacets as any,
        rawChunks: Array.isArray(parsed.rawChunks) ? parsed.rawChunks : [],
        candidateSummary: typeof parsed.candidateSummary === "string" ? parsed.candidateSummary : "",
      };
    } catch {
      return emptyProfile();
    }
  },
});
```

- [ ] **Run existing tests + commit**

```bash
npm test
git add convex/ai.ts
git commit -m "feat(ai): parseProfileFromText reads promoted keys at runtime + maps to __promoted__<key>"
```

---

# BLOCK E — Admin UI (Tasks 14–16)

## Task 14: Promotion card component

**Files:**
- Create: `components/facets/promotion-card.tsx`

```tsx
"use client";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Check, X, TrendingDown } from "lucide-react";

interface Props {
  row: any;
}

export function PromotionCard({ row }: Props) {
  const { user } = useUser();
  const actorUserId = user?.id ?? "unknown";
  const promote = useMutation(api.facetPromotion.promote);
  const dismiss = useMutation(api.facetPromotion.dismiss);
  const demote = useMutation(api.facetPromotion.demote);

  return (
    <div className="rounded-lg ring-1 ring-gray-200 p-4 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{row.key}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{row.status}</span>
            <span className="text-sm text-gray-600">{row.occurrenceCount} candidates</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            First seen {new Date(row.firstSeenAt).toLocaleDateString()}
          </p>
          {row.sampleEvidence?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {row.sampleEvidence.slice(0, 3).map((s: any, i: number) => (
                <li key={i} className="text-xs text-gray-700 italic">
                  &ldquo;{s.quote}&rdquo;
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-2">
          {row.status === "pending" && (
            <>
              <button onClick={() => promote({ key: row.key, actorUserId })}
                className="px-3 py-1.5 bg-green-600 text-white rounded text-xs inline-flex items-center gap-1">
                <Check className="h-3 w-3" /> Promote
              </button>
              <button onClick={() => dismiss({ key: row.key, actorUserId })}
                className="px-3 py-1.5 bg-white text-gray-700 ring-1 ring-gray-300 rounded text-xs inline-flex items-center gap-1">
                <X className="h-3 w-3" /> Dismiss
              </button>
            </>
          )}
          {row.status === "promoted" && (
            <button onClick={() => demote({ key: row.key, actorUserId })}
              className="px-3 py-1.5 bg-white text-amber-700 ring-1 ring-amber-300 rounded text-xs inline-flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Demote
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add components/facets/promotion-card.tsx
git commit -m "feat(ui): PromotionCard component"
```

---

## Task 15: Facets settings page

**Files:**
- Create: `app/dashboard/settings/facets/page.tsx`

```tsx
"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PromotionCard } from "@/components/facets/promotion-card";
import { useState } from "react";

const TABS = [
  { key: "pending", label: "Pending Promotion" },
  { key: "promoted", label: "Promoted" },
  { key: "dismissed", label: "Dismissed" },
  { key: "demoted", label: "Demoted" },
];

export default function FacetsSettingsPage() {
  const [tab, setTab] = useState<string>("pending");
  const pending = useQuery(api.facetPromotion.listPending, tab === "pending" ? { limit: 100 } : "skip");
  const all = useQuery(api.facetPromotion.listAll, tab !== "pending" ? { status: tab, limit: 100 } : "skip");

  const rows = tab === "pending" ? pending : all;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Facet Promotion</h1>
      <p className="text-sm text-gray-600 mb-4">
        Auto-discovered facet keys from candidate intakes. Promote keys that cross our threshold to make them first-class typed facets used in matching and search.
      </p>
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm border-b-2 ${tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {rows === undefined ? (
          <div className="text-gray-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-gray-500 py-8 text-center">No facets in this state.</div>
        ) : (
          rows.map((row: any) => <PromotionCard key={row._id} row={row} />)
        )}
      </div>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add app/dashboard/settings/facets/page.tsx
git commit -m "feat(ui): /dashboard/settings/facets admin page"
```

---

## Task 16: Sidebar nav

**Files:**
- Modify: `components/dashboard/sidebar.tsx` (or whatever the actual nav file is — find first)

Add a "Facets" link under Settings with an icon like `Tags` from lucide-react. Place near other settings links.

- [ ] **Smoke test + commit**

```bash
npm run dev  # visit /dashboard/settings/facets — verify empty states render
git add components/dashboard/sidebar.tsx
git commit -m "feat(ui): sidebar link to Facets settings"
```

---

# BLOCK F — Verification + ship gate (Tasks 17–18)

## Task 17: End-to-end manual verification path

This is documentation, not a code change. Verify the following manually with `npm run dev`:

1. Seed a school with `triageEnabled=true` and ~30 candidates that ALL carry the same extras key `AI_curriculum_design` (you can use `convex run seed:seedE2E` then a small script).
2. Run `npx convex run facetPromotion:trackExtrasFrequency` — verify a row exists with `occurrenceCount=30`.
3. Visit `/dashboard/settings/facets` — confirm the row appears in "Pending Promotion" tab with sample evidence.
4. Click "Promote" — confirm:
   - Row status flips to "promoted"
   - All ~30 candidates now have `parsedFacets.extras["__promoted__AI_curriculum_design"]` instead of `parsedFacets.extras["AI_curriculum_design"]`
5. Click "Demote" — confirm the reverse.
6. Submit a NEW candidate via the careers site whose resume mentions AI curriculum design — confirm the LLM emits it under `__promoted__AI_curriculum_design` (because `parseProfileFromText` now reads promoted keys and rewrites).

If any step fails, file a follow-up.

---

## Task 18: Phase 2 ship gate

- [ ] **Full vitest:** `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test` — expect green
- [ ] **Typecheck:** `npx tsc --noEmit -p tsconfig.json` — 0 errors
- [ ] **Build:** `npm run build` — production build compiles
- [ ] **Convex push:** `npx convex dev --once` — schema deploys
- [ ] **Tag:** `git tag phase-2-shipped`
- [ ] **Push branch:** `git push -u origin phase-2-dynamic-facet-promotion`
- [ ] **Open PR:** `gh pr create --base main --head phase-2-dynamic-facet-promotion ...`

---

## Operational Notes

**Recursive promotion safety:** Promoting a key only re-labels candidates currently carrying that key. A subsequent intake will emit the key under `__promoted__<key>` directly. The frequency tracker should NOT count `__promoted__` prefixed keys — they're already typed. Verify in the implementation of `trackExtrasFrequency` that the iteration skips keys starting with `__promoted__`.

**Why no schema change for promoted facets:** Adding a new typed slot per promotion would require a schema migration on every promote. Storing promoted keys inside `extras` under a `__promoted__` namespace keeps the schema stable; the downstream system (NL search, triage) reads promoted keys via `listPromotedKeys` and queries the right namespace.

**Cost:** Frequency tracker is free (no LLM calls; it's a DB scan + writes). Promotion is free (DB writes only). The only ongoing cost is that future `parseProfileFromText` calls have a slightly longer system prompt — negligible token impact.

**Phase 3 dependency:** Phase 3 (Knowledge Graph) extracts relationship hints alongside facets. It doesn't depend on Phase 2 being shipped, but the data-driven prompt pattern from Task 12 here will be reused.

---

## Self-Review Checklist

- [ ] Every spec section has at least one task (frequency tracking, threshold trigger, admin UI, backfill, demotion)
- [ ] No placeholders or TODOs in steps
- [ ] All file paths absolute
- [ ] All new tests dispatched in the right `modules` map
- [ ] Promoted-key namespace (`__promoted__<key>`) consistent across:
  - `candidates.promoteFacetForCandidate` (write)
  - `candidates.demoteFacetForCandidate` (read+rewrite)
  - `facetPromotion.candidatesWithPromotedKey` (read)
  - `ai.parseProfileFromText` (write)
  - `facetPromotion.trackExtrasFrequency` (must SKIP `__promoted__`-prefixed keys to avoid double-counting promoted facets)
- [ ] No breaking change to existing Phase 1 contracts — old extras keys (without prefix) still extracted; new promoted keys layered on top
