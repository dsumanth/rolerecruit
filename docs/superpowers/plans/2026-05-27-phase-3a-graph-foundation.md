# Phase 3a — Knowledge Graph Foundation + Cohort Sourcing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the knowledge-graph layer (nodes + edges) populated from LLM extraction at intake, exposed via a Cohort Sourcing UI that lets recruiters find untapped candidates from proven universities/programs.

**Architecture:** Two new Convex tables (`nodes`, `edges`) hold a typed graph of Candidate / School / University / Subject / Board / Certification / Qualification / Region / Cohort entities. The existing intake-time LLM call in `convex/ai.ts:parseProfileFromText` is extended to also emit a `relationships` block alongside facets — no extra LLM hop. A new `convex/graph.ts` module owns idempotent upserts, name canonicalization, cohort composition, and bounded traversals. A nightly backfill (cursor-paginated) builds the graph for candidates parsed before this feature shipped. A new `/dashboard/sourcing/cohorts` page surfaces cohort nodes with an "untapped only" filter that excludes candidates already in motion.

**Tech Stack:** Next.js 14 App Router, Convex 1.39.1 (DB + actions + scheduler + paginate API), DeepSeek v4-flash via OpenAI SDK, Vitest + `convex-test`, Tailwind + design-system primitives from `components/ui/`. Bun (not npm) for all commands.

**Phase scope:** Phase 3a only. Reputation propagation + `w_graph` scoring (Phase 3b), cross-school trust queries (Phase 3c), NL → graph translation in talentSearch (Phase 3d), and Insights dashboard (Phase 3e) get their own plans. 3a is shippable standalone: graph populates, cohort sourcing works end-to-end.

**Source spec:** `/Users/sumanthdaggubati/.claude/plans/the-agentic-ai-async-shannon.md` (Phase 3 section, lines 241–293, 368–381, 452–458).

---

## Reference Reading (Required Before Task 1)

Implementer must read these files end-to-end before starting:

- `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/schema.ts` — existing tables and index patterns
- `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/ai.ts` — `parseProfileFromText` action; how LLM output gets normalized into the parsed profile shape
- `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/intake.ts` — `parseAndStoreCandidate` orchestration — this is the hook point for graph materialization
- `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/facetPromotion.ts` — cursor-pagination pattern to mirror (see `trackExtrasFrequency` + `recentlyParsedPage`)
- `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/backfill.ts` — existing backfill structure
- `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/types.ts` — already declares `w_graph?: number` on `HybridWeights`
- `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/prompts/facetExtraction.ts` — current prompt + how `buildFacetExtractionPrompt(promotedKeys)` is composed
- `/Users/sumanthdaggubati/Dev/Rolerecruit/tests/convex/facetPromotion.test.ts` — convex-test + paginated action pattern with `vi.useFakeTimers()` + `t.finishAllScheduledFunctions(vi.runAllTimers)`
- `/Users/sumanthdaggubati/Dev/Rolerecruit/components/facets/promotion-card.tsx` and `/Users/sumanthdaggubati/Dev/Rolerecruit/app/dashboard/settings/facets/page.tsx` — design-system usage patterns (Badge, Card, PageHeader, Tabs)
- `/Users/sumanthdaggubati/Dev/Rolerecruit/components/ui/index.ts` — available UI primitives

---

## Naming Conventions Locked In

- **Node `type` values** (literal union): `Candidate | School | University | Subject | Board | Certification | Qualification | Region | Cohort`
- **Edge `type` values** (literal union): `TAUGHT_AT | HOLDS | FROM | CERTIFIED_IN | SPECIALIZES_IN | REFERRED_BY | TEACHES | BELONGS_TO | LOCATED_IN | APPLIED_TO`
  - `PEER_OF` is deferred to Phase 3b (computed by a periodic batch job, not intake)
- **Node `externalId`** is a stable string. For Candidate it's the `Id<"candidates">` cast to string; for all other entity types it's the normalized canonical name (e.g., `"delhi university"`, `"dps rk puram"`, `"cbse"`); for Cohort it's a composite key `"${normalizedUniversity}|${normalizedProgram}|${endYear}"`.
- **`PARSED_FACETS_VERSION` bump** to `"facets-v2"` — signals that this parser version also emits relationships. Backfill picks up stale rows.
- **`GRAPH_VERSION = "graph-v1"`** — new constant; stamped on the candidate row when graph was built. Backfill picks up rows missing or with stale `graphVersion`.

---

## File Structure (Locked In)

### New files
```
convex/
  graph.ts                       # node/edge upserts, canonicalization, cohort composition, traversals, materializeGraphFromIntake
  devSeedGraph.ts                # smoke-test seed/cleanup (mirrors devSeedFacets pattern)

app/dashboard/sourcing/
  page.tsx                       # redirect → /sourcing/cohorts
  cohorts/page.tsx               # cohort list with untapped filter

components/sourcing/
  cohort-card.tsx                # one cohort row: name, size, untapped count, action
  candidates-in-cohort.tsx       # drilldown when a cohort is opened

tests/convex/
  graph.test.ts                  # node upsert idempotency, edge dedup, cohort composition, traversal, intake hook, backfill pagination, untapped filter
```

### Modified files
```
convex/schema.ts                 # add `nodes`, `edges` tables; add `graphVersion?` to candidates
convex/versions.ts               # bump PARSED_FACETS_VERSION; add GRAPH_VERSION
convex/types.ts                  # add RelationshipsHint type + EMPTY_RELATIONSHIPS const
convex/prompts/facetExtraction.ts # extend prompt to emit relationships block
convex/ai.ts                     # surface relationships in ParsedProfile; pass through to caller
convex/intake.ts                 # call graph.materializeGraphFromIntake after writeCompiledData
convex/backfill.ts               # graph_build mode: re-runs intake or graph-only build for stale rows
convex/crons.ts                  # add nightly graph backfill cron
components/dashboard/dashboard-sidebar.tsx  # add Sourcing nav entry
```

### Stays untouched
- `convex/scoring.ts`, `convex/reverseMatching.ts`, `convex/triage.ts` — the `w_graph` scoring term is Phase 3b
- `convex/talentSearch.ts` — NL → graph traversal is Phase 3d
- All Phase 1 / Phase 2 data shapes — strictly additive

---

## Reusable Shape Definitions (Locked In)

These are referenced by multiple tasks. Define exactly once in `convex/types.ts` (Task 3) and import where needed.

```ts
// convex/types.ts — appended at the bottom

export type GraphNodeType =
  | "Candidate"
  | "School"
  | "University"
  | "Subject"
  | "Board"
  | "Certification"
  | "Qualification"
  | "Region"
  | "Cohort";

export type GraphEdgeType =
  | "TAUGHT_AT"
  | "HOLDS"
  | "FROM"
  | "CERTIFIED_IN"
  | "SPECIALIZES_IN"
  | "REFERRED_BY"
  | "TEACHES"
  | "BELONGS_TO"
  | "LOCATED_IN"
  | "APPLIED_TO";

export interface PreviousSchoolHint {
  name: string;
  role?: string;
  subjects?: string[];
  yearStart?: number;
  yearEnd?: number;
  endReason?: string;
}

export interface QualificationHint {
  degree: string;          // "B.Ed", "M.Sc Physics"
  university?: string;     // "Delhi University"
  yearStart?: number;
  yearEnd?: number;        // used for cohort composition
}

export interface RelationshipsHint {
  previousSchools: PreviousSchoolHint[];
  qualifications: QualificationHint[];
  certifications: string[];   // ["CTET", "NET"]
  referredBy?: string;        // free-text referrer name
  region?: string;            // "Delhi NCR", "Mumbai"
  // subjects + boards reuse top-level ParsedProfile.subjects/boardExperience
}

export const EMPTY_RELATIONSHIPS: RelationshipsHint = {
  previousSchools: [],
  qualifications: [],
  certifications: [],
};
```

`ParsedProfile` gets a new `relationships: RelationshipsHint` field (Task 3 extension).

---

### Task 1: Schema additions — `nodes`, `edges`, `candidates.graphVersion`

**Files:**
- Modify: `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/schema.ts`

- [ ] **Step 1: Add the two new tables and the `graphVersion` field**

Open `convex/schema.ts`. After the `facetPromotionCandidates` block (around line 565), and before the closing `});`, insert the two new tables. Also add `graphVersion: v.optional(v.string())` to the `candidates` table definition (alongside `parsedVersion`, `embeddingVersion`).

```ts
// In the candidates table definition, alongside parsedVersion/embeddingVersion:
graphVersion: v.optional(v.string()),

// After facetPromotionCandidates table, before the closing }); of defineSchema:
  nodes: defineTable({
    type: v.union(
      v.literal("Candidate"),
      v.literal("School"),
      v.literal("University"),
      v.literal("Subject"),
      v.literal("Board"),
      v.literal("Certification"),
      v.literal("Qualification"),
      v.literal("Region"),
      v.literal("Cohort"),
    ),
    externalId: v.string(),       // canonical id: normalized name, or Candidate's Id, or Cohort composite key
    displayName: v.string(),       // human-readable label
    attributes: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_type_externalId", ["type", "externalId"])
    .index("by_type", ["type"]),

  edges: defineTable({
    fromId: v.id("nodes"),
    toId: v.id("nodes"),
    type: v.union(
      v.literal("TAUGHT_AT"),
      v.literal("HOLDS"),
      v.literal("FROM"),
      v.literal("CERTIFIED_IN"),
      v.literal("SPECIALIZES_IN"),
      v.literal("REFERRED_BY"),
      v.literal("TEACHES"),
      v.literal("BELONGS_TO"),
      v.literal("LOCATED_IN"),
      v.literal("APPLIED_TO"),
    ),
    attributes: v.optional(v.any()),
    weight: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_from_type", ["fromId", "type"])
    .index("by_to_type", ["toId", "type"])
    .index("by_type", ["type"]),
```

- [ ] **Step 2: Typecheck schema**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): Phase 3a foundation — nodes, edges, candidates.graphVersion"
```

---

### Task 2: Versions / constants

**Files:**
- Modify: `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/versions.ts`

- [ ] **Step 1: Bump parsed-facets version, add graph version, add cron lookback**

Open `convex/versions.ts`. Change:

```ts
export const PARSED_FACETS_VERSION = "facets-v1";
```

to:

```ts
export const PARSED_FACETS_VERSION = "facets-v2";
```

and append at the bottom of the file:

```ts
// Phase 3a — Knowledge Graph
export const GRAPH_VERSION = "graph-v1";

// Cron heartbeat for nightly graph backfill — slightly > 24h to catch overlap
export const GRAPH_BACKFILL_LOOKBACK_MS = 25 * 60 * 60 * 1000;
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx tsc --noEmit -p tsconfig.json`
Expected: no errors. (Bumping `PARSED_FACETS_VERSION` triggers the existing backfill to mark every candidate as stale — that's intentional.)

- [ ] **Step 3: Commit**

```bash
git add convex/versions.ts
git commit -m "feat(versions): bump PARSED_FACETS_VERSION; add GRAPH_VERSION + cron lookback"
```

---

### Task 3: Type definitions — `RelationshipsHint` + extend `ParsedProfile`

**Files:**
- Modify: `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/types.ts`

- [ ] **Step 1: Append the relationship types**

At the end of `convex/types.ts`, append:

```ts
// ============================================================================
// Phase 3a — Knowledge Graph types
// ============================================================================

export type GraphNodeType =
  | "Candidate"
  | "School"
  | "University"
  | "Subject"
  | "Board"
  | "Certification"
  | "Qualification"
  | "Region"
  | "Cohort";

export type GraphEdgeType =
  | "TAUGHT_AT"
  | "HOLDS"
  | "FROM"
  | "CERTIFIED_IN"
  | "SPECIALIZES_IN"
  | "REFERRED_BY"
  | "TEACHES"
  | "BELONGS_TO"
  | "LOCATED_IN"
  | "APPLIED_TO";

export interface PreviousSchoolHint {
  name: string;
  role?: string;
  subjects?: string[];
  yearStart?: number;
  yearEnd?: number;
  endReason?: string;
}

export interface QualificationHint {
  degree: string;
  university?: string;
  yearStart?: number;
  yearEnd?: number;
}

export interface RelationshipsHint {
  previousSchools: PreviousSchoolHint[];
  qualifications: QualificationHint[];
  certifications: string[];
  referredBy?: string;
  region?: string;
}

export const EMPTY_RELATIONSHIPS: RelationshipsHint = {
  previousSchools: [],
  qualifications: [],
  certifications: [],
};
```

- [ ] **Step 2: Extend `ParsedProfile` with `relationships`**

In the same file, locate the `ParsedProfile` interface and add `relationships`:

```ts
export interface ParsedProfile {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  qualifications: string[];
  certifications: string[];
  boardExperience: string[];
  subjects: string[];
  yearsExperience: number | null;
  currentSchool: string | null;
  parsedFacets: ParsedFacets;
  candidateSummary: string;
  rawChunks: RawChunk[];
  relationships: RelationshipsHint;       // NEW
}
```

- [ ] **Step 3: Typecheck (expect errors in ai.ts that we fix in Task 7)**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx tsc --noEmit -p tsconfig.json`
Expected: errors in `convex/ai.ts` complaining about missing `relationships` field on `emptyProfile()` return — that's OK; Task 7 fixes those. **Do not commit yet — wait until Task 7 makes the codebase clean.**

Mark this task as "in progress through Task 7" in your tracker but do not commit a half-broken state.

---

### Task 4: `convex/graph.ts` — canonicalization helpers + node/edge upsert

**Files:**
- Create: `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/graph.ts`
- Test: `/Users/sumanthdaggubati/Dev/Rolerecruit/tests/convex/graph.test.ts`

- [ ] **Step 1: Write the failing test for canonicalization + upsertNode idempotency**

Create `tests/convex/graph.test.ts`:

```ts
// tests/convex/graph.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as graph from "../../convex/graph";
import * as candidates from "../../convex/candidates";
import * as ai from "../../convex/ai";
import * as embeddings from "../../convex/embeddings";
import * as intake from "../../convex/intake";
import * as backfill from "../../convex/backfill";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "graph.ts": async () => graph,
  "candidates.ts": async () => candidates,
  "ai.ts": async () => ai,
  "embeddings.ts": async () => embeddings,
  "intake.ts": async () => intake,
  "backfill.ts": async () => backfill,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
});

describe("graph canonicalization", () => {
  it("normalizes school names — strips punctuation, lowercases, collapses whitespace", () => {
    expect(graph.canonicalize("DPS R.K. Puram")).toBe("dps rk puram");
    expect(graph.canonicalize("  DPS   RK Puram  ")).toBe("dps rk puram");
    expect(graph.canonicalize("St. Xavier's School")).toBe("st xaviers school");
  });

  it("builds a stable cohort key", () => {
    expect(graph.cohortKey("Delhi University", "B.Ed", 2019)).toBe("delhi university|bed|2019");
    expect(graph.cohortKey("delhi university", "b.ed", 2019)).toBe("delhi university|bed|2019");
  });
});

describe("graph node/edge upsert", () => {
  it("upsertNode is idempotent on (type, externalId)", async () => {
    const t = convexTest(schema, modules);
    const id1 = await t.mutation("graph:upsertNode", {
      type: "School", externalId: "dps rk puram", displayName: "DPS RK Puram",
    });
    const id2 = await t.mutation("graph:upsertNode", {
      type: "School", externalId: "dps rk puram", displayName: "Delhi Public School RK Puram",
    });
    expect(id1).toBe(id2);

    // displayName should NOT have been overwritten by the second call
    const node = await t.run(async (ctx: any) => ctx.db.get(id1));
    expect(node.displayName).toBe("DPS RK Puram");
  });

  it("addEdge dedupes on (fromId, toId, type)", async () => {
    const t = convexTest(schema, modules);
    const candNode = await t.mutation("graph:upsertNode", {
      type: "Candidate", externalId: "cand_abc", displayName: "Test Cand",
    });
    const schoolNode = await t.mutation("graph:upsertNode", {
      type: "School", externalId: "dps rk puram", displayName: "DPS RK Puram",
    });
    await t.mutation("graph:addEdge", { fromId: candNode, toId: schoolNode, type: "TAUGHT_AT" });
    await t.mutation("graph:addEdge", { fromId: candNode, toId: schoolNode, type: "TAUGHT_AT" });

    const all = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_from_type", (q: any) => q.eq("fromId", candNode).eq("type", "TAUGHT_AT")).collect()
    );
    expect(all.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx vitest run tests/convex/graph.test.ts`
Expected: FAIL — module `convex/graph.ts` doesn't exist yet.

- [ ] **Step 3: Implement `convex/graph.ts` foundation (canonicalize, cohortKey, upsertNode, addEdge)**

Create `convex/graph.ts`:

```ts
// convex/graph.ts
// Phase 3a — Knowledge Graph foundation.
// Owns canonicalization, idempotent node/edge upserts, cohort composition,
// bounded traversals, and the intake-time materializeGraphFromIntake orchestrator.

import { internalMutation, mutation, query, internalQuery, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type {
  GraphNodeType,
  GraphEdgeType,
  RelationshipsHint,
} from "./types";

// ============================================================================
// Canonicalization
// ============================================================================

/**
 * canonicalize — lowercase + strip punctuation + collapse whitespace + trim.
 * Used to derive node externalId from human-entered names so that "DPS R.K.
 * Puram" and "DPS RK Puram" land on the same node.
 *
 * Known limitation: abbreviations ("DU" vs "Delhi University") canonicalize
 * differently and create separate nodes. Phase 3b will add an LLM-assisted
 * dedup pass; for now we accept the duplication.
 */
export function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * cohortKey — composite externalId for Cohort nodes. Stable across re-runs.
 * Format: "${normalizedUniversity}|${normalizedProgram}|${endYear}"
 */
export function cohortKey(university: string, program: string, endYear: number): string {
  return `${canonicalize(university)}|${canonicalize(program)}|${endYear}`;
}

// ============================================================================
// Public upsert mutations (also used by tests directly)
// ============================================================================

export const upsertNode = mutation({
  args: {
    type: v.union(
      v.literal("Candidate"), v.literal("School"), v.literal("University"),
      v.literal("Subject"), v.literal("Board"), v.literal("Certification"),
      v.literal("Qualification"), v.literal("Region"), v.literal("Cohort"),
    ),
    externalId: v.string(),
    displayName: v.string(),
    attributes: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<Id<"nodes">> => {
    const existing = await ctx.db
      .query("nodes")
      .withIndex("by_type_externalId", (q) => q.eq("type", args.type).eq("externalId", args.externalId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("nodes", {
      type: args.type,
      externalId: args.externalId,
      displayName: args.displayName,
      attributes: args.attributes,
      createdAt: Date.now(),
    });
  },
});

export const addEdge = mutation({
  args: {
    fromId: v.id("nodes"),
    toId: v.id("nodes"),
    type: v.union(
      v.literal("TAUGHT_AT"), v.literal("HOLDS"), v.literal("FROM"),
      v.literal("CERTIFIED_IN"), v.literal("SPECIALIZES_IN"), v.literal("REFERRED_BY"),
      v.literal("TEACHES"), v.literal("BELONGS_TO"), v.literal("LOCATED_IN"),
      v.literal("APPLIED_TO"),
    ),
    attributes: v.optional(v.any()),
    weight: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"edges">> => {
    const existing = await ctx.db
      .query("edges")
      .withIndex("by_from_type", (q) => q.eq("fromId", args.fromId).eq("type", args.type))
      .collect();
    const dup = existing.find((e) => String(e.toId) === String(args.toId));
    if (dup) {
      // Merge attributes if both sides have them (keep newest by overlay), do NOT duplicate the row.
      if (args.attributes || args.weight !== undefined) {
        await ctx.db.patch(dup._id, {
          attributes: { ...(dup.attributes ?? {}), ...(args.attributes ?? {}) },
          weight: args.weight ?? dup.weight,
        });
      }
      return dup._id;
    }
    return await ctx.db.insert("edges", {
      fromId: args.fromId,
      toId: args.toId,
      type: args.type,
      attributes: args.attributes,
      weight: args.weight,
      createdAt: Date.now(),
    });
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx vitest run tests/convex/graph.test.ts`
Expected: 3 pass (the 2 canonicalize tests + the 1 upsertNode test + the addEdge test = 4 actually; let me recount — `describe("graph canonicalization")` has 2 `it()`, `describe("graph node/edge upsert")` has 2 `it()`. So **4 passing**).

- [ ] **Step 5: Commit**

```bash
git add convex/graph.ts tests/convex/graph.test.ts
git commit -m "feat(graph): canonicalize + cohortKey + upsertNode/addEdge with dedup"
```

---

### Task 5: `convex/graph.ts` — `materializeGraphFromIntake` orchestrator

**Files:**
- Modify: `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/graph.ts`
- Modify: `/Users/sumanthdaggubati/Dev/Rolerecruit/tests/convex/graph.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `tests/convex/graph.test.ts`:

```ts
describe("materializeGraphFromIntake", () => {
  it("creates Candidate node + edges for previousSchools / qualifications / certifications / subjects / boards / region", async () => {
    const t = convexTest(schema, modules);
    const candId = await t.mutation("candidates:create", {
      name: "Priya Sharma", qualifications: ["B.Ed", "M.Sc Physics"], certifications: ["CTET"],
      boardExperience: ["CBSE"], subjects: ["Physics", "Chemistry"],
    });

    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: candId,
      relationships: {
        previousSchools: [
          { name: "DPS RK Puram", role: "PGT Physics", subjects: ["Physics"], yearStart: 2018, yearEnd: 2022 },
        ],
        qualifications: [
          { degree: "B.Ed", university: "Delhi University", yearEnd: 2019 },
          { degree: "M.Sc Physics", university: "Delhi University", yearEnd: 2017 },
        ],
        certifications: ["CTET"],
        referredBy: undefined,
        region: "Delhi NCR",
      },
      subjects: ["Physics", "Chemistry"],
      boardExperience: ["CBSE"],
    });

    // Candidate node exists
    const candNodes = await t.run(async (ctx: any) =>
      ctx.db.query("nodes").withIndex("by_type_externalId", (q: any) => q.eq("type", "Candidate").eq("externalId", String(candId))).collect()
    );
    expect(candNodes.length).toBe(1);
    const candNode = candNodes[0];

    // TAUGHT_AT edge to DPS RK Puram
    const taughtAt = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_from_type", (q: any) => q.eq("fromId", candNode._id).eq("type", "TAUGHT_AT")).collect()
    );
    expect(taughtAt.length).toBe(1);

    // Two HOLDS edges (B.Ed + M.Sc Physics), two FROM edges (qualification → Delhi University)
    const holds = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_from_type", (q: any) => q.eq("fromId", candNode._id).eq("type", "HOLDS")).collect()
    );
    expect(holds.length).toBe(2);

    // CERTIFIED_IN, SPECIALIZES_IN (×2), BELONGS_TO (CBSE), LOCATED_IN (region)
    const certEdges = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_from_type", (q: any) => q.eq("fromId", candNode._id).eq("type", "CERTIFIED_IN")).collect()
    );
    expect(certEdges.length).toBe(1);
    const specEdges = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_from_type", (q: any) => q.eq("fromId", candNode._id).eq("type", "SPECIALIZES_IN")).collect()
    );
    expect(specEdges.length).toBe(2);
    const boardEdges = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_from_type", (q: any) => q.eq("fromId", candNode._id).eq("type", "BELONGS_TO")).collect()
    );
    expect(boardEdges.length).toBe(1);
    const regionEdges = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_from_type", (q: any) => q.eq("fromId", candNode._id).eq("type", "LOCATED_IN")).collect()
    );
    expect(regionEdges.length).toBe(1);
  });

  it("composes a Cohort node from (university, program, endYear) shared across candidates", async () => {
    const t = convexTest(schema, modules);
    const candA = await t.mutation("candidates:create", {
      name: "Cand A", qualifications: ["B.Ed"], subjects: [],
    });
    const candB = await t.mutation("candidates:create", {
      name: "Cand B", qualifications: ["B.Ed"], subjects: [],
    });
    const baseRel = { previousSchools: [], certifications: [] };
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: candA,
      relationships: { ...baseRel, qualifications: [{ degree: "B.Ed", university: "Delhi University", yearEnd: 2019 }] },
      subjects: [], boardExperience: [],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: candB,
      relationships: { ...baseRel, qualifications: [{ degree: "B.Ed", university: "Delhi University", yearEnd: 2019 }] },
      subjects: [], boardExperience: [],
    });

    // Exactly one Cohort node for the (DU, B.Ed, 2019) tuple
    const cohortNodes = await t.run(async (ctx: any) =>
      ctx.db.query("nodes").withIndex("by_type", (q: any) => q.eq("type", "Cohort")).collect()
    );
    expect(cohortNodes.length).toBe(1);
    expect(cohortNodes[0].externalId).toBe("delhi university|bed|2019");

    // Both candidates have HOLDS edges that ALSO point to the same Cohort via FROM-style "BELONGS_TO" cohort edge
    // (We use the existing BELONGS_TO edge type for Candidate→Cohort membership.)
    const cohortMembership = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_to_type", (q: any) => q.eq("toId", cohortNodes[0]._id).eq("type", "BELONGS_TO")).collect()
    );
    expect(cohortMembership.length).toBe(2);
  });

  it("is idempotent — running twice on the same input doesn't duplicate edges", async () => {
    const t = convexTest(schema, modules);
    const candId = await t.mutation("candidates:create", {
      name: "Cand X", qualifications: ["B.Ed"], subjects: ["Physics"],
    });
    const rel = {
      previousSchools: [{ name: "DPS RK Puram", yearStart: 2018, yearEnd: 2022 }],
      qualifications: [{ degree: "B.Ed", university: "Delhi University", yearEnd: 2019 }],
      certifications: ["CTET"],
    };
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: candId, relationships: rel, subjects: ["Physics"], boardExperience: ["CBSE"],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: candId, relationships: rel, subjects: ["Physics"], boardExperience: ["CBSE"],
    });

    const allEdges = await t.run(async (ctx: any) =>
      ctx.db.query("edges").collect()
    );
    // Expected unique edges:
    // - TAUGHT_AT (DPS), HOLDS (B.Ed qual), FROM (qual→DU), CERTIFIED_IN (CTET),
    //   SPECIALIZES_IN (Physics), BELONGS_TO (CBSE board), BELONGS_TO (Cohort)
    // = 7 edges
    expect(allEdges.length).toBe(7);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx vitest run tests/convex/graph.test.ts`
Expected: 3 new failures — `graph:materializeGraphFromIntake` doesn't exist yet.

- [ ] **Step 3: Implement the orchestrator**

Append to `convex/graph.ts`:

```ts
// ============================================================================
// materializeGraphFromIntake — called from intake.ts after writeCompiledData.
// Takes the LLM-extracted relationship hints plus the structured fields the
// candidate already carries (subjects, boards) and writes nodes + edges.
// Idempotent: re-calling on the same candidate produces no duplicate edges
// (because both upsertNode and addEdge dedupe).
// ============================================================================

const previousSchoolValidator = v.object({
  name: v.string(),
  role: v.optional(v.string()),
  subjects: v.optional(v.array(v.string())),
  yearStart: v.optional(v.number()),
  yearEnd: v.optional(v.number()),
  endReason: v.optional(v.string()),
});

const qualificationHintValidator = v.object({
  degree: v.string(),
  university: v.optional(v.string()),
  yearStart: v.optional(v.number()),
  yearEnd: v.optional(v.number()),
});

const relationshipsValidator = v.object({
  previousSchools: v.array(previousSchoolValidator),
  qualifications: v.array(qualificationHintValidator),
  certifications: v.array(v.string()),
  referredBy: v.optional(v.string()),
  region: v.optional(v.string()),
});

export const materializeGraphFromIntake = mutation({
  args: {
    candidateId: v.id("candidates"),
    relationships: relationshipsValidator,
    subjects: v.array(v.string()),
    boardExperience: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<{ nodesUpserted: number; edgesUpserted: number }> => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) throw new Error(`Candidate ${args.candidateId} not found`);

    let nodesUpserted = 0;
    let edgesUpserted = 0;

    const upsertNodeInline = async (
      type: GraphNodeType,
      externalId: string,
      displayName: string,
      attributes?: any,
    ): Promise<Id<"nodes">> => {
      const existing = await ctx.db
        .query("nodes")
        .withIndex("by_type_externalId", (q) => q.eq("type", type).eq("externalId", externalId))
        .first();
      if (existing) return existing._id;
      nodesUpserted++;
      return await ctx.db.insert("nodes", {
        type, externalId, displayName, attributes, createdAt: Date.now(),
      });
    };

    const addEdgeInline = async (
      fromId: Id<"nodes">,
      toId: Id<"nodes">,
      type: GraphEdgeType,
      attributes?: any,
    ): Promise<void> => {
      const existing = await ctx.db
        .query("edges")
        .withIndex("by_from_type", (q) => q.eq("fromId", fromId).eq("type", type))
        .collect();
      const dup = existing.find((e) => String(e.toId) === String(toId));
      if (dup) {
        if (attributes) {
          await ctx.db.patch(dup._id, { attributes: { ...(dup.attributes ?? {}), ...attributes } });
        }
        return;
      }
      await ctx.db.insert("edges", {
        fromId, toId, type, attributes, createdAt: Date.now(),
      });
      edgesUpserted++;
    };

    // 1. Candidate node
    const candNodeId = await upsertNodeInline(
      "Candidate",
      String(args.candidateId),
      candidate.name,
      { candidateId: String(args.candidateId) },
    );

    // 2. TAUGHT_AT — for each previous school
    for (const ps of args.relationships.previousSchools) {
      if (!ps.name?.trim()) continue;
      const schoolId = await upsertNodeInline("School", canonicalize(ps.name), ps.name);
      await addEdgeInline(candNodeId, schoolId, "TAUGHT_AT", {
        role: ps.role, subjects: ps.subjects, yearStart: ps.yearStart, yearEnd: ps.yearEnd, endReason: ps.endReason,
      });
    }

    // 3. HOLDS + FROM — for each qualification; cohort membership when university+endYear known
    for (const q of args.relationships.qualifications) {
      if (!q.degree?.trim()) continue;
      const qualId = await upsertNodeInline("Qualification", canonicalize(q.degree), q.degree);
      await addEdgeInline(candNodeId, qualId, "HOLDS", { yearStart: q.yearStart, yearEnd: q.yearEnd });
      if (q.university?.trim()) {
        const uniId = await upsertNodeInline("University", canonicalize(q.university), q.university);
        await addEdgeInline(qualId, uniId, "FROM");

        if (q.yearEnd) {
          const cohortExternalId = cohortKey(q.university, q.degree, q.yearEnd);
          const cohortDisplay = `${q.university} ${q.degree} ${q.yearEnd}`;
          const cohortId = await upsertNodeInline("Cohort", cohortExternalId, cohortDisplay, {
            university: q.university, program: q.degree, endYear: q.yearEnd,
          });
          await addEdgeInline(candNodeId, cohortId, "BELONGS_TO");
        }
      }
    }

    // 4. CERTIFIED_IN
    for (const cert of args.relationships.certifications) {
      if (!cert?.trim()) continue;
      const certId = await upsertNodeInline("Certification", canonicalize(cert), cert);
      await addEdgeInline(candNodeId, certId, "CERTIFIED_IN");
    }

    // 5. SPECIALIZES_IN — from the structured subjects array on the candidate
    for (const subj of args.subjects) {
      if (!subj?.trim()) continue;
      const subjId = await upsertNodeInline("Subject", canonicalize(subj), subj);
      await addEdgeInline(candNodeId, subjId, "SPECIALIZES_IN");
    }

    // 6. BELONGS_TO (Board) — from candidate.boardExperience
    for (const board of args.boardExperience) {
      if (!board?.trim()) continue;
      const boardId = await upsertNodeInline("Board", canonicalize(board), board);
      await addEdgeInline(candNodeId, boardId, "BELONGS_TO");
    }

    // 7. LOCATED_IN — region
    if (args.relationships.region?.trim()) {
      const regionId = await upsertNodeInline("Region", canonicalize(args.relationships.region), args.relationships.region);
      await addEdgeInline(candNodeId, regionId, "LOCATED_IN");
    }

    // 8. REFERRED_BY — only if referrer name is provided (Phase 3a stops at name-only; matching to existing candidates/users is Phase 3c)
    if (args.relationships.referredBy?.trim()) {
      // Park referrer as a free-text attribute on the candidate node for now.
      await ctx.db.patch(candNodeId, {
        attributes: { ...(await ctx.db.get(candNodeId))?.attributes ?? {}, referredByName: args.relationships.referredBy },
      });
    }

    // Stamp the candidate row so backfill knows the graph was built
    const { GRAPH_VERSION } = await import("./versions");
    await ctx.db.patch(args.candidateId, { graphVersion: GRAPH_VERSION });

    return { nodesUpserted, edgesUpserted };
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx vitest run tests/convex/graph.test.ts`
Expected: all 7 tests pass (4 from Task 4 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add convex/graph.ts tests/convex/graph.test.ts
git commit -m "feat(graph): materializeGraphFromIntake — Candidate + School/Uni/Cohort/Cert/Subj/Board/Region edges"
```

---

### Task 6: Extend LLM extraction prompt to emit `relationships`

**Files:**
- Modify: `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/prompts/facetExtraction.ts`

- [ ] **Step 1: Extend the prompt**

Open `convex/prompts/facetExtraction.ts`. Inside `buildFacetExtractionPrompt`, before the final closing backtick of the returned template literal, append a new section right after the EXTRAS BAG paragraph (and the "For PROMOTED facets..." paragraph):

```ts
RELATIONSHIPS (new — Phase 3a): Also emit a "relationships" object alongside parsedFacets with this exact shape:

{
  "previousSchools": [
    { "name": "DPS R.K. Puram", "role": "PGT Physics", "subjects": ["Physics"], "yearStart": 2018, "yearEnd": 2022, "endReason": null }
  ],
  "qualifications": [
    { "degree": "B.Ed", "university": "Delhi University", "yearStart": 2017, "yearEnd": 2019 },
    { "degree": "M.Sc Physics", "university": "Delhi University", "yearStart": 2015, "yearEnd": 2017 }
  ],
  "certifications": ["CTET", "NET"],
  "referredBy": null,
  "region": "Delhi NCR"
}

Rules for relationships:
- previousSchools: every prior employer the resume mentions, even briefly. Use the exact school name from the resume (do not abbreviate).
- qualifications: every degree. "university" is the institution that awarded it. "yearEnd" is the year completed — critical, drives cohort formation.
- certifications: array of strings (CTET, State TET, NET, UGC-NET, etc.).
- referredBy: name of the person who referred the candidate if explicitly mentioned, else null.
- region: city or region. Use a normalized form ("Delhi NCR", "Mumbai", "Bangalore", "Hyderabad", "Pune", "Chennai", "Kolkata", "Other").

OUTPUT FORMAT remains a single JSON object. Top-level keys are:
- the existing parsedProfile fields (name, email, phone, location, qualifications, certifications, boardExperience, subjects, yearsExperience, currentSchool)
- parsedFacets (object — same as before)
- candidateSummary (string)
- rawChunks (array — same as before)
- relationships (object — described above; emit even if empty arrays/nulls)
```

The full updated function becomes:

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

RELATIONSHIPS (Phase 3a — drives the knowledge graph): Emit a "relationships" object with this exact shape:

{
  "previousSchools": [
    { "name": "DPS R.K. Puram", "role": "PGT Physics", "subjects": ["Physics"], "yearStart": 2018, "yearEnd": 2022, "endReason": null }
  ],
  "qualifications": [
    { "degree": "B.Ed", "university": "Delhi University", "yearStart": 2017, "yearEnd": 2019 }
  ],
  "certifications": ["CTET", "NET"],
  "referredBy": null,
  "region": "Delhi NCR"
}

Rules for relationships:
- previousSchools: every prior employer the resume mentions. Use the exact school name from the resume (do not abbreviate "DPS" to "Delhi Public School" or vice versa — use what's printed).
- qualifications: every degree. "university" is the awarding institution. "yearEnd" is critical — drives cohort grouping.
- certifications: array of strings (CTET, State TET, NET, UGC-NET, etc.).
- referredBy: name of the referrer if explicitly mentioned, else null.
- region: normalized form — one of "Delhi NCR", "Mumbai", "Bangalore", "Hyderabad", "Pune", "Chennai", "Kolkata", "Other".

OUTPUT — return ONLY a JSON object (no markdown, no explanation) with these top-level keys: name, email, phone, location, qualifications, certifications, boardExperience, subjects, yearsExperience, currentSchool, parsedFacets, candidateSummary, rawChunks, relationships.`;
}

// Preserved for compatibility — same as buildFacetExtractionPrompt([])
export const FACET_EXTRACTION_SYSTEM = buildFacetExtractionPrompt([]);

export const EMPTY_PARSED_FACETS = {
  specializations: [], gradeLevels: [], pedagogicalApproach: [],
  leadershipRoles: [], extracurricular: [], languages: [],
  schoolTypes: [], keyAchievements: [], redFlags: [], extras: {},
};
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx tsc --noEmit -p tsconfig.json`
Expected: still has errors in `ai.ts` complaining about missing `relationships` field on `emptyProfile()` return — fixed in Task 7. **Do not commit yet.**

---

### Task 7: Surface `relationships` in `parseProfileFromText`

**Files:**
- Modify: `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/ai.ts`

- [ ] **Step 1: Update `emptyProfile()` and the parse-success path**

Open `convex/ai.ts`. Find the `emptyProfile()` function (around line 163) and update it to include `relationships`:

```ts
function emptyProfile(): ParsedProfile {
  return {
    name: null, email: null, phone: null, location: null,
    qualifications: [], certifications: [], boardExperience: [],
    subjects: [], yearsExperience: null, currentSchool: null,
    parsedFacets: EMPTY_PARSED_FACETS,
    candidateSummary: "",
    rawChunks: [],
    relationships: EMPTY_RELATIONSHIPS,
  };
}
```

Add the import at the top (alongside the other type/const imports):

```ts
import { EMPTY_PARSED_FACETS, buildFacetExtractionPrompt } from "./prompts/facetExtraction";
import type { ParsedProfile, RelationshipsHint } from "./types";
import { EMPTY_RELATIONSHIPS } from "./types";
```

In the `parseProfileFromText` handler's return statement (around line 217 in the current file), update to map `relationships`:

```ts
      // Map relationships with safe defaults
      const rawRel = parsed.relationships ?? {};
      const relationships: RelationshipsHint = {
        previousSchools: Array.isArray(rawRel.previousSchools) ? rawRel.previousSchools : [],
        qualifications: Array.isArray(rawRel.qualifications) ? rawRel.qualifications : [],
        certifications: Array.isArray(rawRel.certifications) ? rawRel.certifications : [],
        referredBy: typeof rawRel.referredBy === "string" ? rawRel.referredBy : undefined,
        region: typeof rawRel.region === "string" ? rawRel.region : undefined,
      };

      return {
        ...emptyProfile(),
        ...parsed,
        parsedFacets: parsedFacets as any,
        rawChunks: Array.isArray(parsed.rawChunks) ? parsed.rawChunks : [],
        candidateSummary: typeof parsed.candidateSummary === "string" ? parsed.candidateSummary : "",
        relationships,
      };
```

The full updated `parseProfileFromText` becomes:

```ts
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
          delete (parsedFacets as any)[k];
        }
      }
      (parsedFacets as any).extras = extras;

      // Phase 3a — normalize relationships block
      const rawRel = parsed.relationships ?? {};
      const relationships: RelationshipsHint = {
        previousSchools: Array.isArray(rawRel.previousSchools) ? rawRel.previousSchools : [],
        qualifications: Array.isArray(rawRel.qualifications) ? rawRel.qualifications : [],
        certifications: Array.isArray(rawRel.certifications) ? rawRel.certifications : [],
        referredBy: typeof rawRel.referredBy === "string" ? rawRel.referredBy : undefined,
        region: typeof rawRel.region === "string" ? rawRel.region : undefined,
      };

      return {
        ...emptyProfile(),
        ...parsed,
        parsedFacets: parsedFacets as any,
        rawChunks: Array.isArray(parsed.rawChunks) ? parsed.rawChunks : [],
        candidateSummary: typeof parsed.candidateSummary === "string" ? parsed.candidateSummary : "",
        relationships,
      };
    } catch {
      return emptyProfile();
    }
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 3: Run full test suite to check nothing broke**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx vitest run`
Expected: all previously-passing tests still pass. The 7 new graph tests pass.

- [ ] **Step 4: Commit (Tasks 3 + 6 + 7 together — they form one consistent state)**

```bash
git add convex/types.ts convex/prompts/facetExtraction.ts convex/ai.ts
git commit -m "feat(ai): extend extraction prompt + ParsedProfile with relationships block"
```

---

### Task 8: Wire intake to materialize the graph

**Files:**
- Modify: `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/intake.ts`
- Modify: `/Users/sumanthdaggubati/Dev/Rolerecruit/tests/convex/graph.test.ts`

- [ ] **Step 1: Add the failing test for the intake hook**

Append to `tests/convex/graph.test.ts`:

```ts
describe("intake → graph integration", () => {
  it("parseAndStoreCandidate (no LLM) still works and leaves graph empty", async () => {
    // With no DEEPSEEK_API_KEY, parseProfileFromText returns emptyProfile() —
    // relationships are empty — so no graph is built. This guards against the
    // intake hook crashing on empty input.
    delete process.env.DEEPSEEK_API_KEY;
    const t = convexTest(schema, modules);
    const candId = await t.mutation("candidates:create", {
      name: "X", qualifications: ["B.Ed"], subjects: ["Physics"],
    });
    await t.action("intake:parseAndStoreCandidate", { candidateId: candId, rawText: "" });

    // No Candidate node because materializeGraphFromIntake bails when
    // relationships are all empty (see helper below)
    const allNodes = await t.run(async (ctx: any) => ctx.db.query("nodes").collect());
    expect(allNodes.length).toBe(0);
  });

  it("intake.runGraphMaterialization mutation builds the graph from a candidate row", async () => {
    const t = convexTest(schema, modules);
    const candId = await t.mutation("candidates:create", {
      name: "Priya Sharma", qualifications: ["B.Ed"], certifications: ["CTET"],
      boardExperience: ["CBSE"], subjects: ["Physics"],
    });
    // Seed the candidate with parsedFacets + a synthetic relationships hint by
    // patching the row directly (in production this is written by writeCompiledData)
    await t.run(async (ctx: any) => {
      await ctx.db.patch(candId, {
        parsedFacets: {
          specializations: [], gradeLevels: [], pedagogicalApproach: [],
          leadershipRoles: [], extracurricular: [], languages: [],
          schoolTypes: [], keyAchievements: [], redFlags: [], extras: {},
        },
        rawChunks: [],
        parsedAt: Date.now(),
        parsedVersion: "facets-v2",
      });
    });

    // Materialize directly from a synthetic relationships block
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: candId,
      relationships: {
        previousSchools: [{ name: "DPS RK Puram", yearStart: 2018, yearEnd: 2022 }],
        qualifications: [{ degree: "B.Ed", university: "Delhi University", yearEnd: 2019 }],
        certifications: ["CTET"],
      },
      subjects: ["Physics"],
      boardExperience: ["CBSE"],
    });

    // Candidate node should be stamped with the graphVersion on the candidates row
    const c = await t.query("candidates:get", { candidateId: candId });
    expect(c!.graphVersion).toBe("graph-v1");
  });
});
```

- [ ] **Step 2: Run test to verify the second one fails** (the first passes by virtue of doing nothing yet, but the second test asserts `graphVersion` is set — which happens in `materializeGraphFromIntake` already from Task 5; so it should pass too)

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx vitest run tests/convex/graph.test.ts`
Expected: the new tests in this task pass IF Task 5 wired the `graphVersion` patch correctly. Verify both pass before moving on.

- [ ] **Step 3: Wire `convex/intake.ts` to call `graph.materializeGraphFromIntake`**

Open `convex/intake.ts`. After the `writeCompiledData` mutation call (step 4 in the handler), add a step 5 that materializes the graph. The updated file:

```ts
// convex/intake.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { validateEvidence } from "./evidenceValidator";
import type { ParsedProfile, RawChunk } from "./types";

function sectionText(chunks: RawChunk[], section: RawChunk["section"]): string {
  return chunks.filter((c) => c.section === section).map((c) => c.text).join("\n");
}

function fullText(chunks: RawChunk[]): string {
  return chunks.map((c) => c.text).join("\n");
}

function isEmptyRelationships(p: ParsedProfile): boolean {
  const r = p.relationships;
  return r.previousSchools.length === 0
    && r.qualifications.length === 0
    && r.certifications.length === 0
    && !r.referredBy
    && !r.region;
}

export const parseAndStoreCandidate = action({
  args: {
    candidateId: v.id("candidates"),
    rawText: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // 1. Parse facets + chunks + summary + relationships
    let parsed: ParsedProfile = await ctx.runAction(api.ai.parseProfileFromText, { text: args.rawText });

    // 2. Validate evidence; if validation fails, retry parse once
    let parsingNotes: string | undefined = undefined;
    if (parsed.rawChunks.length > 0) {
      const result = validateEvidence(parsed.parsedFacets, parsed.rawChunks);
      if (!result.ok) {
        parsed = await ctx.runAction(api.ai.parseProfileFromText, { text: args.rawText });
        const retry = validateEvidence(parsed.parsedFacets, parsed.rawChunks);
        if (!retry.ok) {
          parsingNotes = `Evidence validation failed on retry: ${retry.invalidFacets.length} invalid facet(s). First: ${retry.invalidFacets[0]?.reason ?? "unknown"}`;
        }
      }
    }

    // 3. Compute the 5 facet embeddings
    const chunks = parsed.rawChunks;
    const overall = parsed.candidateSummary && parsed.candidateSummary.length > 20
      ? parsed.candidateSummary
      : (fullText(chunks) || args.rawText);

    const facetEmbeddings = await ctx.runAction(api.embeddings.embedBatch, {
      sections: {
        overall,
        experience: sectionText(chunks, "experience") || overall,
        pedagogy: sectionText(chunks, "pedagogy") || overall,
        achievements: sectionText(chunks, "achievements") || overall,
        leadership: sectionText(chunks, "leadership") || overall,
      },
    });

    // 4. Persist compiled data
    await ctx.runMutation(internal.candidates.writeCompiledData, {
      candidateId: args.candidateId,
      parsedFacets: parsed.parsedFacets,
      candidateSummary: parsed.candidateSummary,
      rawChunks: parsed.rawChunks,
      facetEmbeddings: facetEmbeddings ?? undefined,
      parsingNotes,
    });

    // 5. Materialize the knowledge graph (skip if relationships are all empty —
    //    happens when no LLM key is configured or the LLM emitted nothing)
    if (!isEmptyRelationships(parsed)) {
      // Need the candidate's own subjects/boardExperience for SPECIALIZES_IN/BELONGS_TO edges
      const c = await ctx.runQuery(api.candidates.get, { candidateId: args.candidateId });
      await ctx.runMutation(api.graph.materializeGraphFromIntake, {
        candidateId: args.candidateId,
        relationships: parsed.relationships,
        subjects: c?.subjects ?? [],
        boardExperience: c?.boardExperience ?? [],
      });
    }
  },
});
```

- [ ] **Step 4: Run full vitest**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx vitest run`
Expected: all tests pass (including the two new intake-integration tests).

- [ ] **Step 5: Commit**

```bash
git add convex/intake.ts tests/convex/graph.test.ts
git commit -m "feat(intake): materialize graph after writeCompiledData"
```

---

### Task 9: Graph backfill — cursor-paginated action

**Files:**
- Modify: `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/backfill.ts`
- Modify: `/Users/sumanthdaggubati/Dev/Rolerecruit/tests/convex/graph.test.ts`

- [ ] **Step 1: Add the failing test for graph backfill across multiple pages**

Append to `tests/convex/graph.test.ts`:

```ts
describe("graph backfill", () => {
  it("backfillGraph paginates through candidates and stamps graphVersion", async () => {
    const t = convexTest(schema, modules);

    // Seed 5 candidates, all with parsedFacets but no graph
    const ids: any[] = [];
    for (let i = 0; i < 5; i++) {
      const cId = await t.mutation("candidates:create", {
        name: `Cand ${i}`, qualifications: ["B.Ed"], certifications: ["CTET"],
        boardExperience: ["CBSE"], subjects: ["Physics"],
      });
      // Patch with minimal parsed state (no graphVersion → backfill picks it up)
      await t.run(async (ctx: any) => {
        await ctx.db.patch(cId, {
          parsedFacets: {
            specializations: [], gradeLevels: [], pedagogicalApproach: [],
            leadershipRoles: [], extracurricular: [], languages: [],
            schoolTypes: [], keyAchievements: [], redFlags: [], extras: {},
          },
          rawChunks: [],
          parsedAt: Date.now(),
          parsedVersion: "facets-v2",
        });
      });
      ids.push(cId);
    }

    // Run backfill with pageSize=2 to force multiple pages
    const result = await t.action("backfill:backfillGraph", { pageSize: 2 });
    expect(result.processed).toBe(5);

    // All 5 should have a Candidate node + at least one edge (Physics SPECIALIZES_IN + CBSE BELONGS_TO + CTET CERTIFIED_IN)
    for (const id of ids) {
      const c = await t.query("candidates:get", { candidateId: id });
      expect(c!.graphVersion).toBe("graph-v1");
    }
    const candNodes = await t.run(async (ctx: any) =>
      ctx.db.query("nodes").withIndex("by_type", (q: any) => q.eq("type", "Candidate")).collect()
    );
    expect(candNodes.length).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx vitest run tests/convex/graph.test.ts`
Expected: FAIL — `backfill:backfillGraph` doesn't exist yet.

- [ ] **Step 3: Implement `backfillGraph` action + supporting internal query**

Open `convex/backfill.ts`. Replace the file content with:

```ts
// convex/backfill.ts
import { action, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { PARSED_FACETS_VERSION, EMBEDDING_VERSION, GRAPH_VERSION } from "./versions";

const DEFAULT_GRAPH_PAGE_SIZE = 200;

export const findStaleCandidates = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const all = await ctx.db.query("candidates").take(500);
    return all
      .filter((c) =>
        !c.parsedVersion || c.parsedVersion !== PARSED_FACETS_VERSION ||
        !c.embeddingVersion || c.embeddingVersion !== EMBEDDING_VERSION
      )
      .slice(0, limit);
  },
});

export const runBackfillBatch = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const stale = await ctx.runQuery(api.backfill.findStaleCandidates, { limit: args.limit ?? 20 });
    let processed = 0;
    for (const c of stale) {
      const text = c.rawChunks?.length
        ? c.rawChunks.map((ch: any) => ch.text).join("\n")
        : [
            c.name,
            c.qualifications.join(", "),
            c.certifications.join(", "),
            `Boards: ${c.boardExperience.join(", ")}`,
            `Subjects: ${c.subjects.join(", ")}`,
            c.yearsExperience ? `${c.yearsExperience} years experience` : "",
            c.currentSchool ? `Currently at ${c.currentSchool}` : "",
          ].filter(Boolean).join(". ");
      await ctx.runAction(api.intake.parseAndStoreCandidate, {
        candidateId: c._id,
        rawText: text,
      });
      processed++;
    }
    return { processed };
  },
});

// ============================================================================
// Phase 3a — graph backfill
// ============================================================================

export const candidatesMissingGraphPage = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("candidates").paginate({
      cursor: args.cursor,
      numItems: args.numItems ?? DEFAULT_GRAPH_PAGE_SIZE,
    });
    return {
      page: result.page.filter((c) => c.graphVersion !== GRAPH_VERSION),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/**
 * backfillGraph — for every candidate whose graphVersion ≠ current GRAPH_VERSION,
 * call materializeGraphFromIntake.
 *
 * For Phase 3a we DO NOT re-run the LLM during backfill (that would be expensive
 * at scale). Instead we synthesize a RelationshipsHint from the structured
 * candidate fields already in the row (subjects, boardExperience, currentSchool,
 * certifications) — yielding a partial but useful graph. A separate LLM-driven
 * backfill (Phase 3b) can re-extract previousSchools + universities from
 * rawChunks for richer signal.
 */
export const backfillGraph = action({
  args: { pageSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const pageSize = args.pageSize ?? DEFAULT_GRAPH_PAGE_SIZE;
    let cursor: string | null = null;
    let processed = 0;

    while (true) {
      const result: { page: Array<any>; isDone: boolean; continueCursor: string } =
        await ctx.runQuery(internal.backfill.candidatesMissingGraphPage, {
          cursor, numItems: pageSize,
        });
      for (const c of result.page) {
        // Synthesize a minimal relationships block from the structured fields.
        // currentSchool → previousSchools (best-effort; without yearStart/yearEnd).
        const synthetic = {
          previousSchools: c.currentSchool ? [{ name: c.currentSchool }] : [],
          qualifications: [],
          certifications: c.certifications ?? [],
        };
        await ctx.runMutation(api.graph.materializeGraphFromIntake, {
          candidateId: c._id,
          relationships: synthetic,
          subjects: c.subjects ?? [],
          boardExperience: c.boardExperience ?? [],
        });
        processed++;
      }
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    return { processed };
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx vitest run tests/convex/graph.test.ts`
Expected: all graph tests pass (10 total now).

- [ ] **Step 5: Commit**

```bash
git add convex/backfill.ts tests/convex/graph.test.ts
git commit -m "feat(backfill): backfillGraph — cursor-paginated graph build for legacy candidates"
```

---

### Task 10: Sourcing query API — cohort listings + untapped filter

**Files:**
- Modify: `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/graph.ts`
- Modify: `/Users/sumanthdaggubati/Dev/Rolerecruit/tests/convex/graph.test.ts`

- [ ] **Step 1: Add the failing test for sourcing queries**

Append to `tests/convex/graph.test.ts`:

```ts
describe("cohort sourcing queries", () => {
  it("listCohorts returns cohorts with member counts", async () => {
    const t = convexTest(schema, modules);
    const c1 = await t.mutation("candidates:create", { name: "A", qualifications: ["B.Ed"], subjects: [] });
    const c2 = await t.mutation("candidates:create", { name: "B", qualifications: ["B.Ed"], subjects: [] });
    const c3 = await t.mutation("candidates:create", { name: "C", qualifications: ["M.Ed"], subjects: [] });

    const rel = (degree: string, year: number) => ({
      previousSchools: [], certifications: [],
      qualifications: [{ degree, university: "Delhi University", yearEnd: year }],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: c1, relationships: rel("B.Ed", 2019), subjects: [], boardExperience: [],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: c2, relationships: rel("B.Ed", 2019), subjects: [], boardExperience: [],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: c3, relationships: rel("M.Ed", 2020), subjects: [], boardExperience: [],
    });

    const cohorts = await t.query("graph:listCohorts", { limit: 50 });
    expect(cohorts.length).toBe(2);
    const buEd = cohorts.find((c: any) => c.displayName === "Delhi University B.Ed 2019");
    expect(buEd?.memberCount).toBe(2);
    const mEd = cohorts.find((c: any) => c.displayName === "Delhi University M.Ed 2020");
    expect(mEd?.memberCount).toBe(1);
  });

  it("listCandidatesInCohort returns candidates connected to the cohort", async () => {
    const t = convexTest(schema, modules);
    const c1 = await t.mutation("candidates:create", { name: "A", qualifications: ["B.Ed"], subjects: [] });
    const c2 = await t.mutation("candidates:create", { name: "B", qualifications: ["B.Ed"], subjects: [] });
    const rel = {
      previousSchools: [], certifications: [],
      qualifications: [{ degree: "B.Ed", university: "Delhi University", yearEnd: 2019 }],
    };
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: c1, relationships: rel, subjects: [], boardExperience: [],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: c2, relationships: rel, subjects: [], boardExperience: [],
    });

    const cohorts = await t.query("graph:listCohorts", { limit: 50 });
    const buEd = cohorts.find((c: any) => c.displayName === "Delhi University B.Ed 2019");
    const members = await t.query("graph:listCandidatesInCohort", {
      cohortNodeId: buEd!.nodeId,
      untappedOnly: false,
      limit: 50,
    });
    expect(members.length).toBe(2);
    expect(members.map((m: any) => m.name).sort()).toEqual(["A", "B"]);
  });

  it("listCandidatesInCohort with untappedOnly=true excludes candidates with active applications", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "Mumbai", state: "MH",
    });
    const c1 = await t.mutation("candidates:create", { name: "Active", qualifications: ["B.Ed"], subjects: [] });
    const c2 = await t.mutation("candidates:create", { name: "Untapped", qualifications: ["B.Ed"], subjects: [] });
    const rel = {
      previousSchools: [], certifications: [],
      qualifications: [{ degree: "B.Ed", university: "Delhi University", yearEnd: 2019 }],
    };
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: c1, relationships: rel, subjects: [], boardExperience: [],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: c2, relationships: rel, subjects: [], boardExperience: [],
    });

    // c1 has an active application; c2 doesn't
    await t.mutation("applications:create", {
      candidateId: c1, schoolId, skipTriage: true,
    });

    const cohorts = await t.query("graph:listCohorts", { limit: 50 });
    const buEd = cohorts.find((c: any) => c.displayName === "Delhi University B.Ed 2019");

    const untapped = await t.query("graph:listCandidatesInCohort", {
      cohortNodeId: buEd!.nodeId,
      untappedOnly: true,
      limit: 50,
    });
    expect(untapped.length).toBe(1);
    expect(untapped[0].name).toBe("Untapped");
  });
});
```

NOTE: the third test depends on `applications:create` accepting `skipTriage: true` — that argument already exists in the current `convex/applications.ts` per Phase 1.

- [ ] **Step 2: Run test to verify failure**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx vitest run tests/convex/graph.test.ts`
Expected: 3 new failures — `listCohorts` and `listCandidatesInCohort` don't exist yet.

- [ ] **Step 3: Implement the queries in `convex/graph.ts`**

Append to `convex/graph.ts`:

```ts
// ============================================================================
// Sourcing queries
// ============================================================================

export const listCohorts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const cohortNodes = await ctx.db
      .query("nodes")
      .withIndex("by_type", (q) => q.eq("type", "Cohort"))
      .collect();

    const enriched = await Promise.all(cohortNodes.map(async (n) => {
      const memberEdges = await ctx.db
        .query("edges")
        .withIndex("by_to_type", (q) => q.eq("toId", n._id).eq("type", "BELONGS_TO"))
        .collect();
      return {
        nodeId: n._id,
        displayName: n.displayName,
        externalId: n.externalId,
        attributes: n.attributes,
        memberCount: memberEdges.length,
      };
    }));

    return enriched
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, limit);
  },
});

const ACTIVE_STAGES = new Set([
  "sourced", "screened", "demo_scheduled", "demo_completed", "offer_sent",
]);

export const listCandidatesInCohort = query({
  args: {
    cohortNodeId: v.id("nodes"),
    untappedOnly: v.boolean(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    // BELONGS_TO edges pointing AT this cohort node — from = Candidate node
    const memberEdges = await ctx.db
      .query("edges")
      .withIndex("by_to_type", (q) => q.eq("toId", args.cohortNodeId).eq("type", "BELONGS_TO"))
      .collect();

    const candidates: any[] = [];
    for (const edge of memberEdges) {
      const candNode = await ctx.db.get(edge.fromId);
      if (!candNode || candNode.type !== "Candidate") continue;
      const candidateId = candNode.externalId as any;
      const candidate = await ctx.db.get(candidateId);
      if (!candidate) continue;

      if (args.untappedOnly) {
        const apps = await ctx.db
          .query("applications")
          .withIndex("by_candidateId", (q) => q.eq("candidateId", candidateId))
          .collect();
        const inMotion = apps.some((a) => ACTIVE_STAGES.has(a.stage));
        if (inMotion) continue;
      }

      candidates.push({
        candidateId,
        name: candidate.name,
        subjects: candidate.subjects,
        yearsExperience: candidate.yearsExperience,
        boardExperience: candidate.boardExperience,
        currentSchool: candidate.currentSchool,
      });
      if (candidates.length >= limit) break;
    }
    return candidates;
  },
});

/**
 * neighbors — 1-hop traversal from a node. Used by future Phase 3b/3c work and
 * by the cohort drilldown for "candidates similar to this one." Bounded by limit.
 */
export const neighbors = query({
  args: {
    nodeId: v.id("nodes"),
    edgeType: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("out"), v.literal("in"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dir = args.direction ?? "out";
    const limit = args.limit ?? 100;
    const idx = dir === "out" ? "by_from_type" : "by_to_type";

    let q = ctx.db.query("edges").withIndex(idx, (b) =>
      dir === "out"
        ? (args.edgeType ? b.eq("fromId", args.nodeId).eq("type", args.edgeType as any) : b.eq("fromId", args.nodeId))
        : (args.edgeType ? b.eq("toId", args.nodeId).eq("type", args.edgeType as any) : b.eq("toId", args.nodeId))
    );
    const edges = await q.take(limit);
    const results = await Promise.all(edges.map(async (e) => {
      const other = await ctx.db.get(dir === "out" ? e.toId : e.fromId);
      return { edge: e, node: other };
    }));
    return results.filter((r) => r.node);
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx vitest run tests/convex/graph.test.ts`
Expected: all 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add convex/graph.ts tests/convex/graph.test.ts
git commit -m "feat(graph): listCohorts + listCandidatesInCohort (untapped filter) + neighbors"
```

---

### Task 11: Cohort Sourcing UI page

**Files:**
- Create: `/Users/sumanthdaggubati/Dev/Rolerecruit/app/dashboard/sourcing/page.tsx`
- Create: `/Users/sumanthdaggubati/Dev/Rolerecruit/app/dashboard/sourcing/cohorts/page.tsx`
- Create: `/Users/sumanthdaggubati/Dev/Rolerecruit/components/sourcing/cohort-card.tsx`
- Create: `/Users/sumanthdaggubati/Dev/Rolerecruit/components/sourcing/candidates-in-cohort.tsx`

- [ ] **Step 1: Create the redirect entry page**

Create `/Users/sumanthdaggubati/Dev/Rolerecruit/app/dashboard/sourcing/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function SourcingIndex() {
  redirect("/dashboard/sourcing/cohorts");
}
```

- [ ] **Step 2: Create the CohortCard component**

Create `/Users/sumanthdaggubati/Dev/Rolerecruit/components/sourcing/cohort-card.tsx`:

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CohortCardProps {
  displayName: string;
  memberCount: number;
  onView: () => void;
}

export function CohortCard({ displayName, memberCount, onView }: CohortCardProps) {
  return (
    <Card className="p-4 flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <div className="text-ink font-medium">{displayName}</div>
        <div className="text-ink-muted text-sm flex items-center gap-2">
          <Badge variant="info" dot>{memberCount} candidate{memberCount === 1 ? "" : "s"}</Badge>
        </div>
      </div>
      <Button variant="secondary" onClick={onView}>View</Button>
    </Card>
  );
}
```

- [ ] **Step 3: Create the CandidatesInCohort drilldown component**

Create `/Users/sumanthdaggubati/Dev/Rolerecruit/components/sourcing/candidates-in-cohort.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

interface CandidatesInCohortProps {
  cohortNodeId: Id<"nodes">;
  cohortName: string;
  onBack: () => void;
}

export function CandidatesInCohort({ cohortNodeId, cohortName, onBack }: CandidatesInCohortProps) {
  const [untappedOnly, setUntappedOnly] = useState(true);
  const data = useQuery(api.graph.listCandidatesInCohort, {
    cohortNodeId,
    untappedOnly,
    limit: 100,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="text-ink-muted text-sm hover:text-ink">← All cohorts</button>
          <h2 className="text-ink text-lg font-medium mt-1">{cohortName}</h2>
        </div>
        <Toggle
          pressed={untappedOnly}
          onPressedChange={setUntappedOnly}
        >
          Untapped only
        </Toggle>
      </div>

      {data === undefined ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          title={untappedOnly ? "No untapped candidates" : "No candidates"}
          description={
            untappedOnly
              ? "Every candidate from this cohort is already in motion. Try the full list."
              : "This cohort has no candidates yet."
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((c) => (
            <Card key={c.candidateId} className="p-4 flex items-center justify-between">
              <div>
                <div className="text-ink font-medium">{c.name}</div>
                <div className="text-ink-muted text-sm flex items-center gap-2 mt-1">
                  {c.subjects?.length ? <Badge variant="default">{c.subjects.join(", ")}</Badge> : null}
                  {typeof c.yearsExperience === "number"
                    ? <span>{c.yearsExperience}y experience</span> : null}
                  {c.currentSchool ? <span>• {c.currentSchool}</span> : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create the Cohorts page**

Create `/Users/sumanthdaggubati/Dev/Rolerecruit/app/dashboard/sourcing/cohorts/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CohortCard } from "@/components/sourcing/cohort-card";
import { CandidatesInCohort } from "@/components/sourcing/candidates-in-cohort";

export default function CohortsPage() {
  const cohorts = useQuery(api.graph.listCohorts, { limit: 100 });
  const [selected, setSelected] = useState<{ id: Id<"nodes">; name: string } | null>(null);

  if (selected) {
    return (
      <div className="p-6 flex flex-col gap-6">
        <CandidatesInCohort
          cohortNodeId={selected.id}
          cohortName={selected.name}
          onBack={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <PageHeader
        title="Cohort Sourcing"
        description="Find untapped candidates by university and graduation year."
      />
      {cohorts === undefined ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : cohorts.length === 0 ? (
        <EmptyState
          title="No cohorts yet"
          description="Cohorts form automatically as candidates flow through intake. Run the graph backfill from the Convex CLI to populate from existing candidates."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {cohorts.map((c) => (
            <CohortCard
              key={c.nodeId}
              displayName={c.displayName}
              memberCount={c.memberCount}
              onView={() => setSelected({ id: c.nodeId, name: c.displayName })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add Sourcing entry to the dashboard sidebar**

Open `/Users/sumanthdaggubati/Dev/Rolerecruit/components/dashboard/dashboard-sidebar.tsx`. Locate the nav-items array (look for the existing "Triage", "Talent" entries). Add a new entry for Sourcing — match the existing pattern. The implementer must read the file to discover the exact array structure and Icon import convention, then add an entry like:

```tsx
{ href: "/dashboard/sourcing", label: "Sourcing", icon: <Icon name="users" /> },
```

(Use whatever icon name is already used by the codebase — `network`, `users`, or `compass` are good candidates. Pick one already imported in the file.)

- [ ] **Step 6: Typecheck**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 7: Start dev server + verify UI in preview**

Use `preview_start` to launch the Next dev server. Once the server is up, navigate to `/dashboard/sourcing/cohorts`. Use `preview_snapshot` to confirm the page renders with either the EmptyState (if no graph data yet) or a list of cohort cards. Use `preview_console_logs` to confirm no errors. If issues found, fix them, then re-snapshot.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/sourcing components/sourcing components/dashboard/dashboard-sidebar.tsx
git commit -m "feat(ui): Cohort Sourcing page — list cohorts + untapped filter drilldown"
```

---

### Task 12: Dev seed for smoke testing

**Files:**
- Create: `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/devSeedGraph.ts`

- [ ] **Step 1: Create the seed action**

Mirror the pattern from `convex/devSeedFacets.ts`. Create `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/devSeedGraph.ts`:

```ts
/**
 * DEV-ONLY one-off actions for smoke-testing the Phase 3a graph build.
 *
 * Usage (against running Convex dev):
 *
 *   # Seed 6 candidates: 3 from DU B.Ed 2019, 2 from TISS Social Work 2020, 1 standalone
 *   bunx convex run devSeedGraph:seedTestGraph '{}'
 *
 *   # Trigger backfill (synthetic relationships — uses structured fields)
 *   bunx convex run backfill:backfillGraph '{"pageSize":50}'
 *
 *   # Inspect
 *   bunx convex run graph:listCohorts '{}'
 *
 *   # Clean up — deletes all seeded candidates + their graph nodes/edges
 *   bunx convex run devSeedGraph:cleanupTestGraph '{}'
 *
 * Seeded candidates are tagged with name prefix `__graphtest__`.
 */

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const TEST_NAME_PREFIX = "__graphtest__";

const FIXTURE = [
  { name: "DU_BEd_2019_alice", uni: "Delhi University", deg: "B.Ed", yearEnd: 2019, subjects: ["Physics"] },
  { name: "DU_BEd_2019_bob",   uni: "Delhi University", deg: "B.Ed", yearEnd: 2019, subjects: ["Chemistry"] },
  { name: "DU_BEd_2019_carol", uni: "Delhi University", deg: "B.Ed", yearEnd: 2019, subjects: ["Math"] },
  { name: "TISS_SW_2020_dave", uni: "TISS Mumbai", deg: "M.A. Social Work", yearEnd: 2020, subjects: ["Counselling"] },
  { name: "TISS_SW_2020_eve",  uni: "TISS Mumbai", deg: "M.A. Social Work", yearEnd: 2020, subjects: ["Counselling"] },
  { name: "Standalone_frank",  uni: "Bangalore University", deg: "B.Ed", yearEnd: 2021, subjects: ["English"] },
];

export const seedTestGraph = internalAction({
  args: {},
  handler: async (ctx): Promise<{ created: number }> => {
    let created = 0;
    for (const f of FIXTURE) {
      await ctx.runMutation(internal.devSeedGraph.insertTestCandidate, { fixture: f });
      created++;
    }
    return { created };
  },
});

export const insertTestCandidate = internalMutation({
  args: {
    fixture: v.object({
      name: v.string(),
      uni: v.string(),
      deg: v.string(),
      yearEnd: v.number(),
      subjects: v.array(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<Id<"candidates">> => {
    const fullName = `${TEST_NAME_PREFIX}${args.fixture.name}`;
    const candId = await ctx.db.insert("candidates", {
      name: fullName,
      qualifications: [args.fixture.deg],
      certifications: ["CTET"],
      boardExperience: ["CBSE"],
      subjects: args.fixture.subjects,
      yearsExperience: 5,
      sourceChannel: "manual_import",
      talentBankFlag: false,
      parsedFacets: {
        specializations: [], gradeLevels: [], pedagogicalApproach: [],
        leadershipRoles: [], extracurricular: [], languages: [],
        schoolTypes: [], keyAchievements: [], redFlags: [], extras: {},
      },
      rawChunks: [],
      parsedAt: Date.now(),
      parsedVersion: "facets-v2",
    });

    // Synthesize materialization directly (skipping the LLM)
    await ctx.scheduler.runAfter(0, internal.devSeedGraph.materializeForFixture, {
      candidateId: candId,
      fixture: args.fixture,
    });
    return candId;
  },
});

export const materializeForFixture = internalAction({
  args: {
    candidateId: v.id("candidates"),
    fixture: v.object({
      name: v.string(),
      uni: v.string(),
      deg: v.string(),
      yearEnd: v.number(),
      subjects: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(api.graph.materializeGraphFromIntake, {
      candidateId: args.candidateId,
      relationships: {
        previousSchools: [],
        qualifications: [{ degree: args.fixture.deg, university: args.fixture.uni, yearEnd: args.fixture.yearEnd }],
        certifications: ["CTET"],
      },
      subjects: args.fixture.subjects,
      boardExperience: ["CBSE"],
    });
  },
});

export const cleanupTestGraph = internalAction({
  args: {},
  handler: async (ctx): Promise<{ deletedCandidates: number; deletedNodes: number; deletedEdges: number }> => {
    const candIds: Id<"candidates">[] = await ctx.runQuery(internal.devSeedGraph.listTestCandidates, {});
    let deletedCandidates = 0;
    let deletedNodes = 0;
    let deletedEdges = 0;
    for (const id of candIds) {
      const counts = await ctx.runMutation(internal.devSeedGraph.deleteCandidateAndGraph, { candidateId: id });
      deletedCandidates++;
      deletedNodes += counts.deletedNodes;
      deletedEdges += counts.deletedEdges;
    }
    return { deletedCandidates, deletedNodes, deletedEdges };
  },
});

export const listTestCandidates = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"candidates">[]> => {
    const all = await ctx.db.query("candidates").take(2000);
    return all.filter((c) => c.name?.startsWith(TEST_NAME_PREFIX)).map((c) => c._id);
  },
});

export const deleteCandidateAndGraph = internalMutation({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args): Promise<{ deletedNodes: number; deletedEdges: number }> => {
    let deletedNodes = 0;
    let deletedEdges = 0;

    // Find the Candidate node
    const candNode = await ctx.db
      .query("nodes")
      .withIndex("by_type_externalId", (q) => q.eq("type", "Candidate").eq("externalId", String(args.candidateId)))
      .first();

    if (candNode) {
      // Delete all edges FROM and TO the candidate node
      const outEdges = await ctx.db.query("edges").withIndex("by_from_type", (q) => q.eq("fromId", candNode._id)).collect();
      const inEdges = await ctx.db.query("edges").withIndex("by_to_type", (q) => q.eq("toId", candNode._id)).collect();
      for (const e of [...outEdges, ...inEdges]) {
        await ctx.db.delete(e._id);
        deletedEdges++;
      }
      await ctx.db.delete(candNode._id);
      deletedNodes++;
    }

    await ctx.db.delete(args.candidateId);
    return { deletedNodes, deletedEdges };
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add convex/devSeedGraph.ts
git commit -m "feat(devSeedGraph): seed/cleanup utilities for Phase 3a smoke testing"
```

---

### Task 13: Cron registration + verification

**Files:**
- Modify: `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/crons.ts`

- [ ] **Step 1: Register the nightly graph backfill cron**

Open `/Users/sumanthdaggubati/Dev/Rolerecruit/convex/crons.ts` and add a daily entry (alongside the existing facet-promotion cron):

```ts
import { cronJobs } from "convex/server";
import { internal, api } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "dispatch-scheduled-outreach",
  { minutes: 1 },
  internal.outreach.dispatchScheduledOutreach,
);

crons.daily(
  "track-extras-frequency",
  { hourUTC: 3, minuteUTC: 0 },
  internal.facetPromotion.trackExtrasFrequency,
  {},
);

crons.daily(
  "backfill-graph",
  { hourUTC: 4, minuteUTC: 0 },
  api.backfill.backfillGraph,
  {},
);

export default crons;
```

Note: `api.backfill.backfillGraph` is a public `action`. Convex `crons.daily` accepts public actions when imported via `api`. The implementer should verify by running `bunx tsc` after the change.

- [ ] **Step 2: Typecheck + run full test suite**

Run in parallel: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx tsc --noEmit -p tsconfig.json && bunx vitest run`
Expected: tsc clean, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add convex/crons.ts
git commit -m "feat(crons): nightly graph backfill at 04:00 UTC"
```

---

### Task 14: Real-backend smoke test (no commit — verification only)

This task does NOT modify code or produce a commit. It's the "real Convex backend" sanity check before considering Phase 3a done.

Prerequisites: a local `bunx convex dev` is running.

- [ ] **Step 1: Seed test candidates**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx convex run devSeedGraph:seedTestGraph '{}'`
Expected output: `{ created: 6 }`

- [ ] **Step 2: Verify cohorts formed**

Run: `bunx convex run graph:listCohorts '{}'`
Expected: 3 cohorts returned — DU B.Ed 2019 (memberCount: 3), TISS Mumbai M.A. Social Work 2020 (memberCount: 2), Bangalore University B.Ed 2021 (memberCount: 1).

- [ ] **Step 3: Verify candidatesInCohort untapped filter**

Pick the nodeId of the DU B.Ed 2019 cohort from Step 2 output. Then:

Run: `bunx convex run graph:listCandidatesInCohort '{"cohortNodeId":"<ID>","untappedOnly":true,"limit":50}'`
Expected: 3 candidates (none have applications).

- [ ] **Step 4: UI verification**

Open `/dashboard/sourcing/cohorts` in the browser. Verify the three cohort cards render. Click into the DU cohort. Toggle "Untapped only". Confirm 3 candidates list.

- [ ] **Step 5: Clean up**

Run: `bunx convex run devSeedGraph:cleanupTestGraph '{}'`
Expected: `{ deletedCandidates: 6, deletedNodes: >0, deletedEdges: >0 }`

Verify with `bunx convex run graph:listCohorts '{}'` → returns empty list (or only non-test cohorts).

---

## Out of Scope (Deferred to Phase 3b / 3c / 3d / 3e)

- **Reputation propagation + scoring (Phase 3b):** weekly cron in `convex/reputation.ts`; adds `w_graph * G` term to `convex/triage.ts` hybrid scoring. Requires hire-outcome edges and the bounded 3-hop traversal.
- **Cross-school trust matching (Phase 3c):** queries that join `schools.trustId` to surface candidates who applied to sister schools.
- **NL → graph traversal (Phase 3d):** extend `convex/talentSearch.ts` so queries like "alumni of DU B.Ed 2019" route to graph queries instead of vector search.
- **Insights dashboard (Phase 3e):** `/dashboard/insights/page.tsx` — top referrers, school reputation rankings, cohort heatmap.
- **LLM-assisted node deduplication:** "DU" vs "Delhi University" become separate nodes today; Phase 3b will add a periodic merge job using LLM judgement.
- **`PEER_OF` edges:** computed from overlapping `TAUGHT_AT` years per school — pushes to a periodic batch job, not intake.
- **LLM-driven backfill (richer Phase 3a graph for legacy candidates):** Phase 3a backfill synthesizes relationships from existing structured fields. A separate LLM-driven backfill could re-extract previousSchools + universities from `rawChunks` for legacy candidates. Out of scope here since `runBackfillBatch` already re-runs intake when `parsedVersion` is bumped — that handles the LLM-driven path naturally.

---

## Self-Review Checklist

- [ ] Every Phase 3a spec section (lines 241–293, 368–381, 452–458 of the master spec) has at least one task
- [ ] No placeholders or TODOs in steps
- [ ] All file paths absolute
- [ ] All new tests dispatched in the right `modules` map
- [ ] Node `externalId` convention consistent across:
  - `graph.materializeGraphFromIntake` (write)
  - `graph.listCandidatesInCohort` (read — extracts `Id<"candidates">` from Candidate node's externalId)
  - `devSeedGraph.deleteCandidateAndGraph` (delete by candidate's externalId match)
- [ ] Cohort composite key is deterministic — `cohortKey(uni, deg, year)` is pure
- [ ] `PARSED_FACETS_VERSION` bump cascades correctly: existing backfill picks up stale rows AND the new graph backfill picks up rows without `graphVersion`
- [ ] No breaking change to existing Phase 1/2 contracts — strictly additive (new field on candidates, new tables)
- [ ] Cursor pagination used everywhere a full-table scan would otherwise happen
- [ ] No `.take(5000)`-style silent-cap reads

---

## Operational Notes

**Migration impact of `PARSED_FACETS_VERSION` bump:** Every existing candidate becomes "stale" the moment Task 2 lands. The existing `runBackfillBatch` will re-run intake (which is expensive: full LLM re-parse + 5 embeddings per candidate). For a school with thousands of legacy candidates this could cost $20–50 in DeepSeek calls. **Recommend triggering backfill in batches manually after Task 13 lands**, not via automatic cron, until ops decide on a budget. The graph backfill (`backfillGraph`) is free — it just shuffles structured fields into node/edge rows.

**Graph size growth:** Each candidate creates ~7–15 nodes (some shared, like Universities and Boards) and ~5–10 edges. A school with 5000 candidates ends up with 5000 Candidate nodes + ~50 University nodes + ~500 School nodes + ~10 Board nodes + ~50 Cohort nodes + ~20 Region nodes ≈ 5630 nodes total. Edges roughly 35K. Well within Convex limits.

**No index on `nodes.attributes`:** Convex can't index dynamic JSON keys. Cohort lookup by `(university, program, year)` uses `externalId` (a composite string) via the `by_type_externalId` index — that's why the cohort key is composed deliberately, not stored as separate fields.

**Untapped filter performance:** `listCandidatesInCohort` does N point-reads against `applications.by_candidateId` to compute the in-motion flag. For cohorts up to ~100 members this is fine (<100 ms). For larger cohorts, Phase 3b can denormalize an `isInActiveMotion` boolean onto the Candidate node.

---

## Execution Handoff

Plan complete. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, two-stage review (spec compliance then code quality), fast iteration. Use `superpowers:subagent-driven-development`.

**2. Inline Execution** — batch execution with checkpoints in this session. Use `superpowers:executing-plans`.

---
