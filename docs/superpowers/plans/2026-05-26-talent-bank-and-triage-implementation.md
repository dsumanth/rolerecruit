# Phase 1 — Intelligence Layer + Inbound Triage Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of the three-phase Talent Bank Intelligence Layer + Triage Agent design — a parse-once-query-forever compiler-pattern data layer with evidence spans, multi-vector facet embeddings, and continuous hybrid scoring, consumed by an Inbound Triage Agent that auto-routes new applications.

**Architecture:** Front-load LLM work at intake — one DeepSeek call extracts facets with evidence spans (`{value, evidence: {quote, offset, context}}`), an open-vocabulary extras bag, raw chunks with section labels, and a 1-paragraph candidate summary. Five small embedding calls produce per-facet vectors (`overall, experience, pedagogy, achievements, leadership`). Every future match runs Stage 1 (hard-requirement gates) → Stage 2 (hybrid score: `w_struct * S + w_sem * Σ + w_rules * R`, with Σ a weighted blend of cosine similarities across the 5 facet vectors) → Stage 3 (optional LLM rerank of top 10). The Triage Agent runs this funnel against every open role at the school when an application lands, snapshots `hybridWeights` into the decision row, and drafts evidence-grounded outreach for one-click approval.

**Tech Stack:** Next.js 14 App Router, Convex 1.17 (DB + actions + scheduler + native `vectorIndex`), Clerk auth, DeepSeek v4-flash via `openai` SDK pointed at `https://api.deepseek.com`, OpenAI `text-embedding-3-small` for embeddings (provider-agnostic interface — swappable), Resend, WhatsApp Cloud API, Vitest + `convex-test`, Playwright.

**Phase scope:** Phase 1 only. The spec references Phase 2 (Dynamic Facet Promotion) and Phase 3 (Knowledge Graph) which will get their own plans. Phase 1 is shippable standalone — the extras bag is collected at intake even though promotion machinery doesn't exist yet, so no rework when Phase 2 lands.

**Source spec:** `/Users/sumanthdaggubati/.claude/plans/the-agentic-ai-async-shannon.md`

---

## Reference Reading (Required Before Task 1)

Implementer must read these files end-to-end before starting:

- `convex/schema.ts` — current schema (no changes shipped yet for this work)
- `convex/ai.ts` — `parseProfileFromText`, `scoreCandidates`, `parseJobDescription`, DeepSeek client via `getClient()`
- `convex/scoring.ts` — `scoreDimension`, `getRecommendation`, `testScoreCandidate`, `ScoringRules` type
- `convex/reverseMatching.ts` — current `reverseMatchJob` stub
- `convex/applications.ts` — `create` mutation and pipeline stages
- `convex/email_ingestion.ts` — `receiveEmail` httpAction
- `convex/jobs.ts` and `convex/jobs_ai.ts` — job-create + AI parsing path
- `components/pipeline/application-drawer.tsx` — drawer tab structure
- `tests/convex/candidates.test.ts` — convex-test pattern with modules map
- `package.json` — `npm test` runs vitest; `npm run test:e2e` runs Playwright

---

## Naming Conventions Locked In

- `candidates.origin` (NOT `source`) — provenance. Avoids collision with the existing `sourceChannel` field.
- `applications.source` — per-match provenance (no collision).
- Version constants: `PARSED_FACETS_VERSION="facets-v1"`, `EMBEDDING_VERSION="emb-text3sm-v1"`, `TRIAGE_PROMPT_VERSION="triage-v1"`, `NL_SEARCH_PROMPT_VERSION="nl-v1"`, `OUTREACH_DRAFT_PROMPT_VERSION="outreach-v1"`, `JOB_EMBEDDING_VERSION="emb-text3sm-v1"`.
- `EMBEDDING_DIMS=1536` (matches `text-embedding-3-small` default).
- Five facet sections (used for both candidate and job embeddings): `overall, experience, pedagogy, achievements, leadership`.

---

## Shared Types — Single Source

Define ONCE in `convex/types.ts`, imported everywhere. This is Task 2; referenced throughout.

```ts
// Evidence span — quote must literally appear in rawChunks at offset
export interface Evidence {
  quote: string;
  offset: number;       // absolute char offset into the resume text
  context: string;      // ~50 chars before+after for human verification
}

export interface FacetValue {
  value: string;
  evidence: Evidence;
}

export interface ParsedFacets {
  specializations: FacetValue[];
  gradeLevels: FacetValue[];
  pedagogicalApproach: FacetValue[];
  leadershipRoles: FacetValue[];
  extracurricular: FacetValue[];
  languages: FacetValue[];
  schoolTypes: FacetValue[];
  keyAchievements: FacetValue[];
  redFlags: FacetValue[];
  extras: Record<string, FacetValue[]>; // open-vocabulary novelty channel
}

export interface RawChunk {
  text: string;
  section: "header" | "experience" | "pedagogy" | "achievements" | "leadership" | "other";
  offset: number;
}

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
}

export interface FacetEmbeddings {
  overall: number[];
  experience: number[];
  pedagogy: number[];
  achievements: number[];
  leadership: number[];
}

export type FacetSection = keyof FacetEmbeddings; // "overall" | "experience" | ...

export interface RoleEmbeddings extends FacetEmbeddings {}

export interface HybridWeights {
  w_struct: number;
  w_sem: number;
  w_rules: number;
  w_graph?: number; // Phase 3
  facetWeights: {
    overall: number;
    experience: number;
    pedagogy: number;
    achievements: number;
    leadership: number;
  };
}

export const DEFAULT_HYBRID_WEIGHTS: HybridWeights = {
  w_struct: 0.5,
  w_sem: 0.3,
  w_rules: 0.2,
  facetWeights: {
    overall: 0.2,
    experience: 0.2,
    pedagogy: 0.2,
    achievements: 0.2,
    leadership: 0.2,
  },
};
```

---

## File Structure (Locked In)

### New files
```
convex/
  versions.ts                 — version constants + EMBEDDING_DIMS
  types.ts                    — Evidence, FacetValue, ParsedFacets, RawChunk, ParsedProfile,
                                FacetEmbeddings, RoleEmbeddings, HybridWeights
  embeddings.ts               — provider-agnostic embedding interface, batch helper, cosine
  intake.ts                   — orchestrates parse → 5 embeddings → validate → persist
  triage.ts                   — runTriage + queueForSchool + approveDraft + overrideOutcome
  talentSearch.ts             — NL → structured query translator
  backfill.ts                 — re-extract stale rows from rawChunks
  evidenceValidator.ts        — pure function: validate every quote exists in rawChunks at offset
  hybridScoring.ts            — pure functions: structured_match_score, weighted_semantic_similarity
  prompts/
    facetExtraction.ts        — facet+evidence+chunks+summary system prompt
    jobSectionSplitter.ts     — split JD into 5 sections for role embeddings
    triageRouting.ts          — routing decision prompt
    outreachDraft.ts          — personalized outreach drafting prompt
    nlSearchTranslator.ts     — NL → structured-query prompt

app/dashboard/
  triage/page.tsx
  settings/triage/page.tsx

components/
  triage/
    triage-card.tsx
    triage-tab.tsx            — Triage tab body for application drawer
  talent/
    nl-search-bar.tsx
  shared/
    pool-origin-badge.tsx
    evidence-popover.tsx      — click-to-verify popover for any FacetValue

tests/convex/
  embeddings.test.ts
  facetExtraction.test.ts
  evidenceValidator.test.ts
  intake.test.ts
  hybridScoring.test.ts
  reverseMatching.test.ts
  triage.test.ts
  talentSearch.test.ts
  backfill.test.ts

tests/e2e/
  triage-happy-path.spec.ts
  triage-cross-role.spec.ts
```

### Modified files
```
convex/schema.ts              — facets with evidence, extras, rawChunks, 5 vectorIndexes,
                                jobPostings.roleEmbeddings, applications source/triage,
                                triageDecisions, schools triage config, outreachMessages
convex/ai.ts                  — parseProfileFromText emits ParsedProfile (uses facetExtraction prompt)
convex/candidates.ts          — Stage 1 hard-filter query; writeCompiledData internal mutation
convex/scoring.ts             — export rule-based total scorer for hybrid blending
convex/reverseMatching.ts     — replace stub with 3-stage hybrid flow
convex/applications.ts        — trigger intake + triage on create
convex/email_ingestion.ts     — chain parse + triage
convex/careers.ts             — chain parse + triage on careers-site apply
convex/jobs.ts                — compute roleEmbeddings on create/edit; listOpenForSchool
convex/jobs_ai.ts             — emit section splits feeding role embeddings
convex/schools.ts             — getTriageConfig, updateTriageConfig
convex/outreach.ts            — createDraft internal mutation
app/dashboard/talent/page.tsx — mount nl-search-bar
components/pipeline/application-drawer.tsx — pool badge + Triage tab
components/talent/application-table.tsx    — match reasons + triage outcome
```

---

# BLOCK A — Foundation (Tasks 1–7)

## Task 1: Versions module

**Files:**
- Create: `convex/versions.ts`

- [ ] **Step 1: Write the file**

```ts
// convex/versions.ts
// Bump these when the corresponding prompt or model changes.
// The backfill action re-extracts candidates whose stamps no longer match.

export const PARSED_FACETS_VERSION = "facets-v1";
export const EMBEDDING_VERSION = "emb-text3sm-v1";
export const JOB_EMBEDDING_VERSION = "emb-text3sm-v1";
export const TRIAGE_PROMPT_VERSION = "triage-v1";
export const NL_SEARCH_PROMPT_VERSION = "nl-v1";
export const OUTREACH_DRAFT_PROMPT_VERSION = "outreach-v1";

// Embedding dimensionality — vectorIndex declares this statically.
export const EMBEDDING_DIMS = 1536;

// Five facet sections used for both candidate and job embeddings.
export const FACET_SECTIONS = ["overall", "experience", "pedagogy", "achievements", "leadership"] as const;
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npx tsc --noEmit -p tsconfig.json`
Expected: no errors mentioning `versions.ts`.

- [ ] **Step 3: Commit**

```bash
git add convex/versions.ts
git commit -m "feat(convex): versions module + EMBEDDING_DIMS + FACET_SECTIONS"
```

---

## Task 2: Shared types module

**Files:**
- Create: `convex/types.ts`

- [ ] **Step 1: Write the file (copy from Shared Types section above)**

Use the full content from the "Shared Types — Single Source" section near the top of this plan.

- [ ] **Step 2: Typecheck**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add convex/types.ts
git commit -m "feat(convex): shared types — Evidence, FacetValue, ParsedProfile, HybridWeights"
```

---

## Task 3: Schema — extend `candidates`

**Files:**
- Modify: `convex/schema.ts` (the `candidates: defineTable({...})` block, lines 138-156)

- [ ] **Step 1: Replace the candidates block**

```ts
// Top of schema.ts — add helpers before defineSchema(...)
const evidenceValidator = v.object({
  quote: v.string(),
  offset: v.number(),
  context: v.string(),
});

const facetValueValidator = v.object({
  value: v.string(),
  evidence: evidenceValidator,
});

const facetArrayValidator = v.array(facetValueValidator);
```

Then replace the entire `candidates: defineTable({...})` block with:

```ts
candidates: defineTable({
  // existing fields
  name: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  location: v.optional(v.string()),
  qualifications: v.array(v.string()),
  certifications: v.array(v.string()),
  boardExperience: v.array(v.string()),
  subjects: v.array(v.string()),
  yearsExperience: v.optional(v.number()),
  currentSchool: v.optional(v.string()),
  resumeUrl: v.optional(v.string()),
  sourceChannel: v.optional(v.string()),
  credentialVerificationStatus: v.optional(
    v.union(v.literal("verified"), v.literal("flagged"), v.literal("pending"))
  ),
  talentBankFlag: v.boolean(),
  poolIds: v.optional(v.array(v.id("pools"))),

  // NEW: provenance (orthogonal to sourceChannel)
  origin: v.optional(v.union(
    v.literal("fresh_application"),
    v.literal("talent_pool"),
    v.literal("agent_sourced"),
    v.literal("referral"),
    v.literal("manual_import"),
  )),

  // NEW: facets with evidence spans
  parsedFacets: v.optional(v.object({
    specializations: facetArrayValidator,
    gradeLevels: facetArrayValidator,
    pedagogicalApproach: facetArrayValidator,
    leadershipRoles: facetArrayValidator,
    extracurricular: facetArrayValidator,
    languages: facetArrayValidator,
    schoolTypes: facetArrayValidator,
    keyAchievements: facetArrayValidator,
    redFlags: facetArrayValidator,
    extras: v.record(v.string(), facetArrayValidator),
  })),

  // NEW: 1-paragraph job-agnostic summary
  candidateSummary: v.optional(v.string()),

  // NEW: raw chunks — source of truth for evidence validation + future re-extraction
  rawChunks: v.optional(v.array(v.object({
    text: v.string(),
    section: v.union(
      v.literal("header"),
      v.literal("experience"),
      v.literal("pedagogy"),
      v.literal("achievements"),
      v.literal("leadership"),
      v.literal("other"),
    ),
    offset: v.number(),
  }))),

  // NEW: five facet embeddings (1536 dims each)
  facetEmbeddings: v.optional(v.object({
    overall: v.array(v.float64()),
    experience: v.array(v.float64()),
    pedagogy: v.array(v.float64()),
    achievements: v.array(v.float64()),
    leadership: v.array(v.float64()),
  })),

  // NEW: version stamps
  parsedVersion: v.optional(v.string()),
  embeddingVersion: v.optional(v.string()),
  parsedAt: v.optional(v.number()),

  // NEW: parsing notes — flags when evidence validation didn't fully pass on retry
  parsingNotes: v.optional(v.string()),
})
  .index("by_origin", ["origin"])
  .index("by_parsedVersion", ["parsedVersion"])
  .index("by_embeddingVersion", ["embeddingVersion"])
  .vectorIndex("by_overall_embedding", {
    vectorField: "facetEmbeddings.overall",
    dimensions: 1536,
    filterFields: ["subjects", "origin"],
  })
  .vectorIndex("by_experience_embedding", {
    vectorField: "facetEmbeddings.experience",
    dimensions: 1536,
    filterFields: ["subjects", "origin"],
  })
  .vectorIndex("by_pedagogy_embedding", {
    vectorField: "facetEmbeddings.pedagogy",
    dimensions: 1536,
    filterFields: ["subjects", "origin"],
  })
  .vectorIndex("by_achievements_embedding", {
    vectorField: "facetEmbeddings.achievements",
    dimensions: 1536,
    filterFields: ["subjects", "origin"],
  })
  .vectorIndex("by_leadership_embedding", {
    vectorField: "facetEmbeddings.leadership",
    dimensions: 1536,
    filterFields: ["subjects", "origin"],
  }),
```

Note: `candidates` does not carry `schoolId` (a candidate lives in the talent bank, not under a school). Filter by `subjects` + `origin` instead.

- [ ] **Step 2: Typecheck + run existing tests**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npx tsc --noEmit -p tsconfig.json && npm test -- candidates`
Expected: green. All new fields are optional, so existing rows still validate.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): candidates with facets+evidence+extras+rawChunks+5 vectorIndexes"
```

---

## Task 4: Schema — extend `jobPostings`, `applications`, `outreachMessages`, `schools`; add `triageDecisions`

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Extend `jobPostings`**

Inside the existing `jobPostings: defineTable({...})` block, before the closing `})`, add:

```ts
// NEW: role embeddings — mirror candidate.facetEmbeddings for Stage 2 cosine math
roleEmbeddings: v.optional(v.object({
  overall: v.array(v.float64()),
  experience: v.array(v.float64()),
  pedagogy: v.array(v.float64()),
  achievements: v.array(v.float64()),
  leadership: v.array(v.float64()),
})),
roleEmbeddingVersion: v.optional(v.string()),
```

- [ ] **Step 2: Extend `applications`**

Replace the `applications` block (currently lines ~158-179) with:

```ts
applications: defineTable({
  candidateId: v.id("candidates"),
  jobPostingId: v.optional(v.id("jobPostings")),
  schoolId: v.id("schools"),
  stage: v.string(),
  aiMatchScore: v.optional(v.number()),
  globalScore: v.optional(v.number()),
  trackingToken: v.optional(v.string()),
  scoringResult: v.optional(
    v.object({
      totalScore: v.number(),
      dimensionScores: v.array(v.any()),
      recommendation: v.string(),
    })
  ),
  createdAt: v.number(),

  // NEW
  source: v.optional(v.union(
    v.literal("careers_site"),
    v.literal("talent_pool_match"),
    v.literal("agent_sourced"),
    v.literal("triage_cross_match"),
    v.literal("manual"),
  )),
  matchedFromPoolId: v.optional(v.id("pools")),
  matchedAt: v.optional(v.number()),
  triageOutcome: v.optional(v.union(
    v.literal("auto_shortlisted"),
    v.literal("auto_rejected"),
    v.literal("human_review"),
    v.literal("cross_role_suggested"),
  )),
  triageDecisionId: v.optional(v.id("triageDecisions")),
  matchReasons: v.optional(v.array(v.string())),
})
  .index("by_jobPostingId", ["jobPostingId"])
  .index("by_candidateId", ["candidateId"])
  .index("by_schoolId", ["schoolId"])
  .index("by_stage", ["stage"])
  .index("by_trackingToken", ["trackingToken"])
  .index("by_schoolId_triageOutcome", ["schoolId", "triageOutcome"])
  .index("by_source", ["source"]),
```

- [ ] **Step 3: Extend `outreachMessages`**

Replace the existing block with:

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
  ),
  channel: v.union(v.literal("whatsapp"), v.literal("email")),
  body: v.string(),
  sentAt: v.optional(v.number()),  // optional — drafts have none yet
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
    v.literal("manual"),
  )),
  scheduledSendAt: v.optional(v.number()),
  externalId: v.optional(v.string()),
})
  .index("by_applicationId", ["applicationId"])
  .index("by_status_scheduledSendAt", ["status", "scheduledSendAt"]),
```

- [ ] **Step 4: Extend `schools`**

In the existing `schools` block, before the closing `})`, add:

```ts
triageEnabled: v.optional(v.boolean()),
autoShortlistThreshold: v.optional(v.number()),
autoRejectThreshold: v.optional(v.number()),
autoSendDelaySec: v.optional(v.number()),
redFlagOverrideCount: v.optional(v.number()),
```

- [ ] **Step 5: Add `triageDecisions` table**

Add as a new table inside `defineSchema({ ... })`:

```ts
triageDecisions: defineTable({
  applicationId: v.id("applications"),
  candidateId: v.id("candidates"),
  schoolId: v.id("schools"),
  primaryRoleId: v.optional(v.id("jobPostings")),
  primaryMatchScore: v.number(),
  primaryMatchReasons: v.array(v.string()),
  crossRoleMatches: v.array(v.object({
    roleId: v.id("jobPostings"),
    score: v.number(),
    reasons: v.array(v.string()),
  })),
  outcome: v.union(
    v.literal("auto_shortlisted"),
    v.literal("auto_rejected"),
    v.literal("human_review"),
    v.literal("cross_role_suggested"),
  ),
  outcomeReasoning: v.string(),
  outreachDraftId: v.optional(v.id("outreachMessages")),
  humanOverride: v.optional(v.object({
    overriddenAt: v.number(),
    overriddenBy: v.string(),
    fromOutcome: v.string(),
    toOutcome: v.string(),
    note: v.optional(v.string()),
  })),
  hybridWeights: v.object({
    w_struct: v.number(),
    w_sem: v.number(),
    w_rules: v.number(),
    w_graph: v.optional(v.number()),
    facetWeights: v.object({
      overall: v.number(),
      experience: v.number(),
      pedagogy: v.number(),
      achievements: v.number(),
      leadership: v.number(),
    }),
  }),
  createdAt: v.number(),
  triagePromptVersion: v.string(),
})
  .index("by_applicationId", ["applicationId"])
  .index("by_schoolId_outcome", ["schoolId", "outcome"])
  .index("by_candidateId", ["candidateId"]),
```

- [ ] **Step 6: Typecheck + tests**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npx tsc --noEmit -p tsconfig.json && npm test`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): jobPostings.roleEmbeddings, applications source+triage, triageDecisions w/ hybridWeights, outreach drafts, school triage config"
```

---

## Task 5: Deploy schema to Convex dev

- [ ] **Step 1: Push schema**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npx convex dev --once`
Expected: schema deploys cleanly. If Convex complains about vectorIndex syntax, verify Convex SDK ≥1.17.

- [ ] **Step 2: Commit any auto-generated `_generated/` updates**

```bash
git add convex/_generated
git commit -m "chore(convex): regenerate _generated after schema bump"
```

---

# BLOCK B — Embeddings (Tasks 6–8)

## Task 6: Embeddings — write failing test

**Files:**
- Create: `tests/convex/embeddings.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/convex/embeddings.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as embeddings from "../../convex/embeddings";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "embeddings.ts": async () => embeddings,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
});

describe("embeddings", () => {
  it("embedText returns a 1536-dim vector with stub provider", async () => {
    const t = convexTest(schema, modules);
    const vec = await t.action("embeddings:embedText", { text: "B.Ed CBSE Physics" });
    expect(Array.isArray(vec)).toBe(true);
    expect(vec.length).toBe(1536);
  });

  it("embedBatch returns five vectors keyed by section", async () => {
    const t = convexTest(schema, modules);
    const out = await t.action("embeddings:embedBatch", {
      sections: {
        overall: "summary text",
        experience: "work history text",
        pedagogy: "teaching philosophy text",
        achievements: "outcomes text",
        leadership: "leadership text",
      },
    });
    expect(out).toHaveProperty("overall");
    expect(out.overall.length).toBe(1536);
    expect(out.experience.length).toBe(1536);
    expect(out.pedagogy.length).toBe(1536);
    expect(out.achievements.length).toBe(1536);
    expect(out.leadership.length).toBe(1536);
  });

  it("returns null map when no provider configured", async () => {
    process.env.EMBEDDING_PROVIDER = "";
    delete process.env.OPENAI_API_KEY;
    const t = convexTest(schema, modules);
    const v = await t.action("embeddings:embedText", { text: "x" });
    expect(v).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- embeddings`
Expected: FAIL — module missing.

---

## Task 7: Embeddings — implement

**Files:**
- Create: `convex/embeddings.ts`

- [ ] **Step 1: Write the file**

```ts
// convex/embeddings.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { EMBEDDING_DIMS, EMBEDDING_VERSION } from "./versions";
import type { FacetEmbeddings } from "./types";
import OpenAI from "openai";

type EmbeddingProvider = "openai" | "stub" | "none";

function getProvider(): EmbeddingProvider {
  const explicit = process.env.EMBEDDING_PROVIDER;
  if (explicit === "stub") return "stub";
  if (explicit === "openai") return "openai";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "none";
}

// Deterministic stub for tests
function stubEmbed(text: string): number[] {
  const vec = new Array(EMBEDDING_DIMS).fill(0);
  for (let i = 0; i < text.length && i < EMBEDDING_DIMS; i++) {
    vec[i] = (text.charCodeAt(i) % 100) / 100;
  }
  return vec;
}

async function openaiEmbedSingle(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const client = new OpenAI({ apiKey });
  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text.substring(0, 8000),
    dimensions: EMBEDDING_DIMS,
  });
  return res.data[0]?.embedding ?? null;
}

async function openaiEmbedBatch(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return texts.map(() => null);
  const client = new OpenAI({ apiKey });
  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texts.map((t) => t.substring(0, 8000)),
    dimensions: EMBEDDING_DIMS,
  });
  return texts.map((_, i) => res.data[i]?.embedding ?? null);
}

export const embedText = action({
  args: { text: v.string() },
  handler: async (_ctx, args): Promise<number[] | null> => {
    const provider = getProvider();
    if (provider === "stub") return stubEmbed(args.text);
    if (provider === "openai") return await openaiEmbedSingle(args.text);
    return null;
  },
});

export const embedBatch = action({
  args: {
    sections: v.object({
      overall: v.string(),
      experience: v.string(),
      pedagogy: v.string(),
      achievements: v.string(),
      leadership: v.string(),
    }),
  },
  handler: async (_ctx, args): Promise<FacetEmbeddings | null> => {
    const provider = getProvider();
    const keys: (keyof typeof args.sections)[] = ["overall", "experience", "pedagogy", "achievements", "leadership"];
    const inputs = keys.map((k) => args.sections[k]);

    if (provider === "stub") {
      const out: any = {};
      for (const k of keys) out[k] = stubEmbed(args.sections[k]);
      return out;
    }
    if (provider === "openai") {
      const vectors = await openaiEmbedBatch(inputs);
      if (vectors.some((v) => v === null)) return null;
      const out: any = {};
      keys.forEach((k, i) => { out[k] = vectors[i]; });
      return out;
    }
    return null;
  },
});

export function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export { EMBEDDING_VERSION };
```

- [ ] **Step 2: Run Task 6 tests**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- embeddings`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/embeddings.ts tests/convex/embeddings.test.ts
git commit -m "feat(convex): embeddings — embedText, embedBatch (5-section), cosine"
```

---

## Task 8: Embedding cost sanity test (manual)

- [ ] **Step 1: Manual smoke test against real OpenAI (skip in CI)**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && EMBEDDING_PROVIDER=openai OPENAI_API_KEY=... node -e "import('./convex/embeddings.js').then(m => m.embedBatch({sections:{overall:'a',experience:'b',pedagogy:'c',achievements:'d',leadership:'e'}}).then(r => console.log(Object.keys(r))))"`
Expected: prints `[ 'overall', 'experience', 'pedagogy', 'achievements', 'leadership' ]`. Skip if no real key.

No commit — manual verification only.

---

# BLOCK C — Intake parsing (Tasks 9–14)

## Task 9: Facet extraction prompt

**Files:**
- Create: `convex/prompts/facetExtraction.ts`

- [ ] **Step 1: Write the prompt module**

```ts
// convex/prompts/facetExtraction.ts

export const FACET_EXTRACTION_SYSTEM = `You are an AI that compiles candidate resumes for Indian K-12 teacher hiring into a structured, queryable form. Your output runs as the candidate's permanent profile in our database — extract EVERYTHING the system might need to match this candidate against any future role.

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

FACET VOCABULARY (use these when applicable; coin new ones for novelty):
- specializations: JEE_prep, NEET_prep, Olympiad, remedial, gifted, special_needs, ESL
- gradeLevels: Pre_Primary, Primary, Middle, Secondary, Senior_Secondary
- pedagogicalApproach: inquiry_based, experiential, traditional, montessori, project_based
- leadershipRoles: HOD_<Subject>, curriculum_committee, examination_coordinator, mentor
- schoolTypes: CBSE_private, ICSE_private, IB_international, government_aided, government
- languages: English, Hindi, Marathi, Tamil, Telugu, Kannada, Bengali, regional
- redFlags: short_tenures, employment_gap, frequent_school_switches, terminated_role

EXTRAS BAG: Anything that doesn't fit a typed facet but seems important (e.g., "AI_curriculum_design", "STEM_lab_setup") goes into "extras" — an open-vocabulary record. Use snake_case keys. The system tracks frequency and graduates popular extras to typed facets later — so be liberal.

RAW CHUNKS: Also split the resume into sections labeled overall|experience|pedagogy|achievements|leadership|other. These are the source-of-truth for evidence validation and future re-extraction.

CANDIDATE SUMMARY: A 1-paragraph (~80 words) job-agnostic third-person description of the candidate. No bullets. No subjective claims.

OUTPUT — return ONLY a JSON object (no markdown, no explanation) matching this schema EXACTLY:

{
  "name": string | null,
  "email": string | null,
  "phone": string | null,
  "location": string | null,
  "qualifications": string[],
  "certifications": string[],
  "boardExperience": string[],
  "subjects": string[],
  "yearsExperience": number | null,
  "currentSchool": string | null,
  "parsedFacets": {
    "specializations": [{"value": "JEE_prep", "evidence": {"quote": "led JEE coaching", "offset": 1234, "context": "...led JEE coaching for class 12 batch..."}}],
    "gradeLevels": [...same shape],
    "pedagogicalApproach": [...same shape],
    "leadershipRoles": [...same shape],
    "extracurricular": [...same shape],
    "languages": [...same shape],
    "schoolTypes": [...same shape],
    "keyAchievements": [...same shape],
    "redFlags": [...same shape],
    "extras": {
      "AI_curriculum_design": [{"value": "designed AI-integrated curriculum", "evidence": {"quote":"...", "offset":..., "context":"..."}}]
    }
  },
  "candidateSummary": "string",
  "rawChunks": [
    {"text": "B.Ed (2018), M.Sc Physics (2016) — Delhi University", "section": "header", "offset": 0},
    {"text": "DPS Delhi, 2018-2025 — taught PGT Physics...", "section": "experience", "offset": 80},
    ...
  ]
}`;

export const EMPTY_PARSED_FACETS = {
  specializations: [], gradeLevels: [], pedagogicalApproach: [],
  leadershipRoles: [], extracurricular: [], languages: [],
  schoolTypes: [], keyAchievements: [], redFlags: [], extras: {},
};
```

- [ ] **Step 2: Commit**

```bash
git add convex/prompts/facetExtraction.ts
git commit -m "feat(prompts): facet extraction system prompt w/ evidence grounding rules"
```

---

## Task 10: Evidence validator — pure function with tests

**Files:**
- Create: `convex/evidenceValidator.ts`
- Create: `tests/convex/evidenceValidator.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/convex/evidenceValidator.test.ts
import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../convex/evidenceValidator";
import type { ParsedFacets, RawChunk } from "../../convex/types";

const chunks: RawChunk[] = [
  { text: "B.Ed and 7 years PGT Physics at DPS Delhi", section: "header", offset: 0 },
  { text: "Led JEE prep coaching with 80% clearance", section: "achievements", offset: 50 },
];

const valid: ParsedFacets = {
  specializations: [{ value: "JEE_prep", evidence: { quote: "Led JEE prep", offset: 50, context: "..." } }],
  gradeLevels: [], pedagogicalApproach: [], leadershipRoles: [],
  extracurricular: [], languages: [], schoolTypes: [],
  keyAchievements: [], redFlags: [], extras: {},
};

const invalidOffset: ParsedFacets = {
  ...valid,
  specializations: [{ value: "JEE_prep", evidence: { quote: "Led JEE prep", offset: 999, context: "..." } }],
};

const invalidQuote: ParsedFacets = {
  ...valid,
  specializations: [{ value: "JEE_prep", evidence: { quote: "completely fabricated", offset: 50, context: "..." } }],
};

describe("evidenceValidator", () => {
  it("accepts valid evidence", () => {
    const r = validateEvidence(valid, chunks);
    expect(r.ok).toBe(true);
    expect(r.invalidFacets).toHaveLength(0);
  });

  it("rejects evidence with wrong offset", () => {
    const r = validateEvidence(invalidOffset, chunks);
    expect(r.ok).toBe(false);
    expect(r.invalidFacets[0]).toMatchObject({ facetType: "specializations", reason: expect.stringContaining("offset") });
  });

  it("rejects evidence whose quote isn't in any chunk", () => {
    const r = validateEvidence(invalidQuote, chunks);
    expect(r.ok).toBe(false);
    expect(r.invalidFacets[0].reason).toContain("not found");
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- evidenceValidator`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the validator**

```ts
// convex/evidenceValidator.ts
import type { ParsedFacets, RawChunk, FacetValue } from "./types";

export interface ValidationResult {
  ok: boolean;
  invalidFacets: Array<{
    facetType: string;   // e.g., "specializations" or "extras.AI_curriculum_design"
    value: string;
    reason: string;
  }>;
}

function validateOne(fv: FacetValue, chunks: RawChunk[]): string | null {
  const { quote, offset } = fv.evidence;
  // Find any chunk containing the quote
  const containing = chunks.find((c) => c.text.includes(quote));
  if (!containing) return `evidence quote "${quote.substring(0, 30)}..." not found in any rawChunk`;
  // Offset must fall within the chunk and the substring at that offset must start with the quote
  const localOffset = offset - containing.offset;
  if (localOffset < 0 || localOffset >= containing.text.length) {
    return `offset ${offset} outside chunk range [${containing.offset}, ${containing.offset + containing.text.length})`;
  }
  if (!containing.text.substring(localOffset).startsWith(quote)) {
    return `offset ${offset} does not start the quote in the matching chunk`;
  }
  return null;
}

export function validateEvidence(facets: ParsedFacets, chunks: RawChunk[]): ValidationResult {
  const invalidFacets: ValidationResult["invalidFacets"] = [];

  const typedKeys: (keyof ParsedFacets)[] = [
    "specializations", "gradeLevels", "pedagogicalApproach", "leadershipRoles",
    "extracurricular", "languages", "schoolTypes", "keyAchievements", "redFlags",
  ];

  for (const k of typedKeys) {
    const arr = facets[k] as FacetValue[];
    for (const fv of arr) {
      const err = validateOne(fv, chunks);
      if (err) invalidFacets.push({ facetType: k as string, value: fv.value, reason: err });
    }
  }

  for (const [extraKey, arr] of Object.entries(facets.extras)) {
    for (const fv of arr) {
      const err = validateOne(fv, chunks);
      if (err) invalidFacets.push({ facetType: `extras.${extraKey}`, value: fv.value, reason: err });
    }
  }

  return { ok: invalidFacets.length === 0, invalidFacets };
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- evidenceValidator`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/evidenceValidator.ts tests/convex/evidenceValidator.test.ts
git commit -m "feat(convex): evidence validator — every quote must exist in rawChunks at offset"
```

---

## Task 11: Facet extraction action — write failing test

**Files:**
- Create: `tests/convex/facetExtraction.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/convex/facetExtraction.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as ai from "../../convex/ai";
import * as embeddings from "../../convex/embeddings";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "ai.ts": async () => ai,
  "embeddings.ts": async () => embeddings,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  delete process.env.DEEPSEEK_API_KEY; // forces empty-profile fallback
});

describe("facet extraction", () => {
  it("parseProfileFromText returns the new ParsedProfile shape even when no API key", async () => {
    const t = convexTest(schema, modules);
    const result = await t.action("ai:parseProfileFromText", { text: "any" });
    expect(result).toMatchObject({
      name: null,
      qualifications: expect.any(Array),
      parsedFacets: expect.objectContaining({
        specializations: expect.any(Array),
        extras: expect.any(Object),
      }),
      rawChunks: expect.any(Array),
      candidateSummary: expect.any(String),
    });
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- facetExtraction`
Expected: FAIL — current `parseProfileFromText` doesn't return rawChunks/extras/evidence shape.

---

## Task 12: Extend `parseProfileFromText`

**Files:**
- Modify: `convex/ai.ts`

- [ ] **Step 1: Replace the existing `PROFILE_PARSING_SYSTEM` and `parseProfileFromText` (lines ~161-220)**

At the top of `convex/ai.ts`, add:

```ts
import { FACET_EXTRACTION_SYSTEM, EMPTY_PARSED_FACETS } from "./prompts/facetExtraction";
import type { ParsedProfile } from "./types";
```

Delete the old `PROFILE_PARSING_SYSTEM` constant.

Replace `parseProfileFromText` with:

```ts
function emptyProfile(): ParsedProfile {
  return {
    name: null, email: null, phone: null, location: null,
    qualifications: [], certifications: [], boardExperience: [],
    subjects: [], yearsExperience: null, currentSchool: null,
    parsedFacets: EMPTY_PARSED_FACETS,
    candidateSummary: "",
    rawChunks: [],
  };
}

export const parseProfileFromText = action({
  args: { text: v.string() },
  handler: async (_ctx, args): Promise<ParsedProfile> => {
    const client = getClient();
    if (!client) return emptyProfile();

    const response = await client.chat.completions.create({
      model: "deepseek-v4-flash",
      max_tokens: 4096,
      temperature: 0,
      messages: [
        { role: "system", content: FACET_EXTRACTION_SYSTEM },
        { role: "user", content: args.text.substring(0, 12000) },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...emptyProfile(),
        ...parsed,
        parsedFacets: { ...EMPTY_PARSED_FACETS, ...(parsed.parsedFacets ?? {}) },
        rawChunks: Array.isArray(parsed.rawChunks) ? parsed.rawChunks : [],
        candidateSummary: typeof parsed.candidateSummary === "string" ? parsed.candidateSummary : "",
      };
    } catch {
      return emptyProfile();
    }
  },
});
```

- [ ] **Step 2: Run Task 11 test**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- facetExtraction`
Expected: PASS.

- [ ] **Step 3: Verify no regression in other tests using parseProfileFromText**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test`
Expected: green. Existing callers (email_ingestion) still work — they read the standard fields and ignore the new ones.

- [ ] **Step 4: Commit**

```bash
git add convex/ai.ts tests/convex/facetExtraction.test.ts
git commit -m "feat(ai): parseProfileFromText emits ParsedProfile w/ evidence, extras, rawChunks"
```

---

## Task 13: Candidates — `writeCompiledData` internal mutation + `setOrigin`

**Files:**
- Modify: `convex/candidates.ts`

- [ ] **Step 1: Append to candidates.ts**

```ts
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { PARSED_FACETS_VERSION, EMBEDDING_VERSION } from "./versions";

const facetValueValidator = v.object({
  value: v.string(),
  evidence: v.object({
    quote: v.string(),
    offset: v.number(),
    context: v.string(),
  }),
});
const facetArrayValidator = v.array(facetValueValidator);

export const writeCompiledData = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    parsedFacets: v.object({
      specializations: facetArrayValidator,
      gradeLevels: facetArrayValidator,
      pedagogicalApproach: facetArrayValidator,
      leadershipRoles: facetArrayValidator,
      extracurricular: facetArrayValidator,
      languages: facetArrayValidator,
      schoolTypes: facetArrayValidator,
      keyAchievements: facetArrayValidator,
      redFlags: facetArrayValidator,
      extras: v.record(v.string(), facetArrayValidator),
    }),
    candidateSummary: v.string(),
    rawChunks: v.array(v.object({
      text: v.string(),
      section: v.union(
        v.literal("header"), v.literal("experience"), v.literal("pedagogy"),
        v.literal("achievements"), v.literal("leadership"), v.literal("other"),
      ),
      offset: v.number(),
    })),
    facetEmbeddings: v.optional(v.object({
      overall: v.array(v.float64()),
      experience: v.array(v.float64()),
      pedagogy: v.array(v.float64()),
      achievements: v.array(v.float64()),
      leadership: v.array(v.float64()),
    })),
    parsingNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.candidateId, {
      parsedFacets: args.parsedFacets,
      candidateSummary: args.candidateSummary,
      rawChunks: args.rawChunks,
      facetEmbeddings: args.facetEmbeddings,
      parsedVersion: PARSED_FACETS_VERSION,
      embeddingVersion: args.facetEmbeddings ? EMBEDDING_VERSION : undefined,
      parsedAt: Date.now(),
      parsingNotes: args.parsingNotes,
    });
  },
});

export const setOrigin = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    origin: v.union(
      v.literal("fresh_application"),
      v.literal("talent_pool"),
      v.literal("agent_sourced"),
      v.literal("referral"),
      v.literal("manual_import"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.candidateId, { origin: args.origin });
  },
});
```

- [ ] **Step 2: Add a Stage-1 hard-filter query**

```ts
import { query } from "./_generated/server";

export const hardFilter = query({
  args: {
    subjects: v.optional(v.array(v.string())),
    minYears: v.optional(v.number()),
    boards: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
    excludeCandidateIds: v.optional(v.array(v.id("candidates"))),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    const exclude = new Set((args.excludeCandidateIds ?? []).map(String));
    const all = await ctx.db.query("candidates").collect();
    const filtered = all.filter((c) => {
      if (exclude.has(String(c._id))) return false;
      if (args.subjects?.length) {
        const hit = args.subjects.some((s) =>
          c.subjects.some((cs) => cs.toLowerCase().includes(s.toLowerCase()))
        );
        if (!hit) return false;
      }
      if (args.minYears != null && (c.yearsExperience ?? 0) < args.minYears) return false;
      if (args.boards?.length) {
        const hit = args.boards.some((b) =>
          c.boardExperience.some((cb) => cb.toLowerCase().includes(b.toLowerCase()))
        );
        if (!hit) return false;
      }
      return true;
    });
    return filtered.slice(0, limit);
  },
});
```

- [ ] **Step 3: Typecheck + tests**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- candidates && npx tsc --noEmit -p tsconfig.json`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add convex/candidates.ts
git commit -m "feat(candidates): writeCompiledData + setOrigin + hardFilter (Stage 1)"
```

---

## Task 14: Intake orchestrator — write failing test, then implement

**Files:**
- Create: `convex/intake.ts`
- Create: `tests/convex/intake.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/convex/intake.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as intake from "../../convex/intake";
import * as ai from "../../convex/ai";
import * as embeddings from "../../convex/embeddings";
import * as candidates from "../../convex/candidates";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "intake.ts": async () => intake,
  "ai.ts": async () => ai,
  "embeddings.ts": async () => embeddings,
  "candidates.ts": async () => candidates,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
  delete process.env.DEEPSEEK_API_KEY; // empty profile fallback; embeddings still computed
});

describe("intake", () => {
  it("compiles a candidate with all 5 facet embeddings + version stamps", async () => {
    const t = convexTest(schema, modules);
    const candId = await t.mutation("candidates:create", {
      name: "Priya", qualifications: ["B.Ed"], certifications: [], boardExperience: ["CBSE"],
      subjects: ["Physics"], yearsExperience: 5,
    });
    await t.action("intake:parseAndStoreCandidate", {
      candidateId: candId,
      rawText: "B.Ed and 5 years PGT Physics. Led JEE prep coaching.",
    });
    const c = await t.query("candidates:get", { candidateId: candId });
    expect(c!.parsedVersion).toBe("facets-v1");
    expect(c!.embeddingVersion).toBe("emb-text3sm-v1");
    expect(c!.facetEmbeddings).toBeDefined();
    expect(c!.facetEmbeddings!.overall.length).toBe(1536);
    expect(c!.facetEmbeddings!.experience.length).toBe(1536);
    expect(c!.facetEmbeddings!.pedagogy.length).toBe(1536);
    expect(c!.facetEmbeddings!.achievements.length).toBe(1536);
    expect(c!.facetEmbeddings!.leadership.length).toBe(1536);
    expect(c!.rawChunks).toBeDefined();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- intake`
Expected: FAIL — module missing.

- [ ] **Step 3: Write `convex/intake.ts`**

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

export const parseAndStoreCandidate = action({
  args: {
    candidateId: v.id("candidates"),
    rawText: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // 1. Parse facets + chunks + summary
    let parsed: ParsedProfile = await ctx.runAction(api.ai.parseProfileFromText, { text: args.rawText });

    // 2. Validate evidence; if validation fails, retry parse once
    let parsingNotes: string | undefined = undefined;
    if (parsed.rawChunks.length > 0) {
      const result = validateEvidence(parsed.parsedFacets, parsed.rawChunks);
      if (!result.ok) {
        // Retry once
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

    // 4. Persist
    await ctx.runMutation(internal.candidates.writeCompiledData, {
      candidateId: args.candidateId,
      parsedFacets: parsed.parsedFacets,
      candidateSummary: parsed.candidateSummary,
      rawChunks: parsed.rawChunks,
      facetEmbeddings: facetEmbeddings ?? undefined,
      parsingNotes,
    });
  },
});
```

- [ ] **Step 4: Run test, expect PASS**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- intake`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/intake.ts tests/convex/intake.test.ts
git commit -m "feat(intake): parseAndStoreCandidate orchestrates parse → validate → 5 embeds → persist"
```

---

# BLOCK D — Job embeddings (Tasks 15–17)

## Task 15: Job section splitter prompt

**Files:**
- Create: `convex/prompts/jobSectionSplitter.ts`

- [ ] **Step 1: Write the prompt**

```ts
// convex/prompts/jobSectionSplitter.ts

export const JOB_SECTION_SPLITTER_SYSTEM = `You take a natural-language job description for an Indian K-12 teaching role and split it into 5 sections corresponding to candidate facet embeddings.

Return ONLY a JSON object (no markdown):
{
  "overall": "1-2 paragraph summary of the role",
  "experience": "what experience profile the ideal candidate would have",
  "pedagogy": "what teaching approach/philosophy the role calls for",
  "achievements": "what kinds of outcomes/wins matter",
  "leadership": "what leadership/management aspects (if any) the role has"
}

If a section isn't relevant (e.g., no leadership component), still produce a short string describing what would be neutral/preferred. Never return an empty string.`;
```

- [ ] **Step 2: Commit**

```bash
git add convex/prompts/jobSectionSplitter.ts
git commit -m "feat(prompts): JD section splitter for role embeddings"
```

---

## Task 16: Job embeddings — action + hook into job create

**Files:**
- Modify: `convex/jobs_ai.ts` (or add to `convex/jobs.ts` if cleaner)
- Modify: `convex/jobs.ts`

- [ ] **Step 1: Add a section-split + embed action**

In `convex/jobs_ai.ts`, append:

```ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { JOB_EMBEDDING_VERSION } from "./versions";
import { JOB_SECTION_SPLITTER_SYSTEM } from "./prompts/jobSectionSplitter";
import OpenAI from "openai";

function getDeepSeekClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
}

export const computeRoleEmbeddings = action({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args): Promise<void> => {
    const job = await ctx.runQuery(api.jobs.get, { jobId: args.jobId });
    if (!job) return;

    // 1. Split JD into 5 sections via DeepSeek (or fallback to raw text)
    const client = getDeepSeekClient();
    let sections: { overall: string; experience: string; pedagogy: string; achievements: string; leadership: string };
    const fallback = job.naturalLanguageDescription || `${job.title} ${job.subject} ${job.board} ${job.level}`;
    if (!client) {
      sections = { overall: fallback, experience: fallback, pedagogy: fallback, achievements: fallback, leadership: fallback };
    } else {
      try {
        const res = await client.chat.completions.create({
          model: "deepseek-v4-flash",
          max_tokens: 1024,
          temperature: 0,
          messages: [
            { role: "system", content: JOB_SECTION_SPLITTER_SYSTEM },
            { role: "user", content: `${job.title} (${job.subject}, ${job.board}, ${job.level}, min ${job.minExperience ?? 0}y): ${job.naturalLanguageDescription}` },
          ],
        });
        const text = res.choices[0]?.message?.content ?? "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        sections = jsonMatch ? JSON.parse(jsonMatch[0]) : { overall: fallback, experience: fallback, pedagogy: fallback, achievements: fallback, leadership: fallback };
      } catch {
        sections = { overall: fallback, experience: fallback, pedagogy: fallback, achievements: fallback, leadership: fallback };
      }
    }

    // 2. Embed all 5 sections in one batched call
    const roleEmbeddings = await ctx.runAction(api.embeddings.embedBatch, { sections });
    if (!roleEmbeddings) return;

    // 3. Persist
    await ctx.runMutation(api.jobs.setRoleEmbeddings, {
      jobId: args.jobId,
      roleEmbeddings,
      version: JOB_EMBEDDING_VERSION,
    });
  },
});
```

- [ ] **Step 2: Add `setRoleEmbeddings` mutation in `convex/jobs.ts`**

```ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const setRoleEmbeddings = mutation({
  args: {
    jobId: v.id("jobPostings"),
    roleEmbeddings: v.object({
      overall: v.array(v.float64()),
      experience: v.array(v.float64()),
      pedagogy: v.array(v.float64()),
      achievements: v.array(v.float64()),
      leadership: v.array(v.float64()),
    }),
    version: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      roleEmbeddings: args.roleEmbeddings,
      roleEmbeddingVersion: args.version,
    });
  },
});

export const listOpenForSchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobPostings")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});
```

(Add `query` import if not already imported.)

- [ ] **Step 3: Trigger `computeRoleEmbeddings` from job create/publish**

In `convex/jobs.ts`, locate the existing create/publish mutation. After the job is inserted/activated, schedule the embedding action:

```ts
await ctx.scheduler.runAfter(0, api.jobs_ai.computeRoleEmbeddings, { jobId });
```

- [ ] **Step 4: Run full test suite**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test && npx tsc --noEmit -p tsconfig.json`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add convex/jobs_ai.ts convex/jobs.ts
git commit -m "feat(jobs): computeRoleEmbeddings on create + setRoleEmbeddings mutation + listOpenForSchool"
```

---

## Task 17: One-shot role-embedding backfill for existing active jobs

**Files:**
- Modify: `convex/jobs.ts` (append a one-time helper action)

- [ ] **Step 1: Append a one-shot helper**

```ts
import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const backfillRoleEmbeddings = action({
  args: {},
  handler: async (ctx): Promise<{ processed: number }> => {
    const all = await ctx.runQuery(api.jobs.listAllActive, {});
    let processed = 0;
    for (const job of all) {
      if (!job.roleEmbeddings) {
        await ctx.runAction(api.jobs_ai.computeRoleEmbeddings, { jobId: job._id });
        processed++;
      }
    }
    return { processed };
  },
});

export const listAllActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobPostings").filter((q) => q.eq(q.field("status"), "active")).collect();
  },
});
```

(Add `action` + `query` imports if not already there.)

- [ ] **Step 2: Invoke manually after deploy**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npx convex run jobs:backfillRoleEmbeddings`
Expected: returns `{ processed: N }` where N is the count of previously-unembedded active jobs. Subsequent runs return `{ processed: 0 }`.

- [ ] **Step 3: Commit**

```bash
git add convex/jobs.ts
git commit -m "feat(jobs): one-shot role-embedding backfill for pre-existing active jobs"
```

---

# BLOCK E — Hybrid scoring + reverse-match (Tasks 18–22)

## Task 18: Hybrid scoring helpers — pure functions

**Files:**
- Create: `convex/hybridScoring.ts`
- Create: `tests/convex/hybridScoring.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/convex/hybridScoring.test.ts
import { describe, it, expect } from "vitest";
import {
  structuredMatchScore,
  weightedSemanticSimilarity,
  combinedScore,
} from "../../convex/hybridScoring";
import { DEFAULT_HYBRID_WEIGHTS } from "../../convex/types";

describe("hybridScoring", () => {
  it("structuredMatchScore awards full marks for exact match", () => {
    const job = { subjects: ["Physics"], boards: ["CBSE"], qualifications: ["B.Ed"], minYears: 3 };
    const cand: any = {
      subjects: ["Physics"], boardExperience: ["CBSE"], qualifications: ["B.Ed"], yearsExperience: 5,
    };
    const s = structuredMatchScore(job, cand);
    expect(s).toBeGreaterThan(80);
  });

  it("weightedSemanticSimilarity returns 0 when embeddings missing", () => {
    const sim = weightedSemanticSimilarity(undefined, undefined, DEFAULT_HYBRID_WEIGHTS);
    expect(sim).toBe(0);
  });

  it("combinedScore is convex combination of the three terms", () => {
    const s = combinedScore(80, 0.5, 70, DEFAULT_HYBRID_WEIGHTS);
    // 0.5*80 + 0.3*50 + 0.2*70 = 40 + 15 + 14 = 69
    expect(s).toBeCloseTo(69, 1);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- hybridScoring`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// convex/hybridScoring.ts
import type { FacetEmbeddings, RoleEmbeddings, HybridWeights } from "./types";
import { cosine } from "./embeddings";

interface JobCriteria {
  subjects: string[];
  boards: string[];
  qualifications: string[];
  minYears: number;
}

interface CandidateProfile {
  subjects: string[];
  boardExperience: string[];
  qualifications: string[];
  yearsExperience?: number;
}

/**
 * structuredMatchScore — 0..100 based on exact-substring matches across
 * subjects, boards, qualifications, and years overage. Cheap, deterministic.
 */
export function structuredMatchScore(job: JobCriteria, cand: CandidateProfile): number {
  let score = 0;
  // subjects (30 pts)
  if (job.subjects.length > 0) {
    const hits = job.subjects.filter((s) =>
      cand.subjects.some((cs) => cs.toLowerCase().includes(s.toLowerCase()))
    ).length;
    score += (hits / job.subjects.length) * 30;
  } else score += 30;

  // boards (20 pts)
  if (job.boards.length > 0) {
    const hits = job.boards.filter((b) =>
      cand.boardExperience.some((cb) => cb.toLowerCase().includes(b.toLowerCase()))
    ).length;
    score += (hits / job.boards.length) * 20;
  } else score += 20;

  // qualifications (30 pts)
  if (job.qualifications.length > 0) {
    const hits = job.qualifications.filter((q) =>
      cand.qualifications.some((cq) => cq.toLowerCase().includes(q.toLowerCase()))
    ).length;
    score += (hits / job.qualifications.length) * 30;
  } else score += 30;

  // experience (20 pts)
  const yrs = cand.yearsExperience ?? 0;
  if (job.minYears <= 0) score += 20;
  else if (yrs >= job.minYears) score += Math.min(20, 10 + (yrs - job.minYears) * 2);
  else score += 0;

  return Math.round(Math.min(100, score));
}

/**
 * weightedSemanticSimilarity — 0..1 weighted blend of cosine similarities
 * across the 5 facet embeddings.
 */
export function weightedSemanticSimilarity(
  role: RoleEmbeddings | undefined,
  cand: FacetEmbeddings | undefined,
  weights: HybridWeights,
): number {
  if (!role || !cand) return 0;
  const fw = weights.facetWeights;
  return (
    fw.overall      * cosine(role.overall,      cand.overall) +
    fw.experience   * cosine(role.experience,   cand.experience) +
    fw.pedagogy     * cosine(role.pedagogy,     cand.pedagogy) +
    fw.achievements * cosine(role.achievements, cand.achievements) +
    fw.leadership   * cosine(role.leadership,   cand.leadership)
  );
}

/**
 * combinedScore — 0..100 final hybrid score.
 * semanticSim is 0..1 (scaled to 0..100 inside the formula).
 */
export function combinedScore(
  structured: number,
  semanticSim: number,
  ruleBased: number,
  weights: HybridWeights,
): number {
  return weights.w_struct * structured + weights.w_sem * (semanticSim * 100) + weights.w_rules * ruleBased;
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- hybridScoring`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/hybridScoring.ts tests/convex/hybridScoring.test.ts
git commit -m "feat(convex): hybrid scoring helpers — structured/semantic/combined"
```

---

## Task 19: Reverse-match — write failing test

**Files:**
- Create: `tests/convex/reverseMatching.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/convex/reverseMatching.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as reverseMatching from "../../convex/reverseMatching";
import * as ai from "../../convex/ai";
import * as embeddings from "../../convex/embeddings";
import * as scoring from "../../convex/scoring";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as jobs from "../../convex/jobs";
import * as jobsAi from "../../convex/jobs_ai";
import * as schools from "../../convex/schools";
import * as intake from "../../convex/intake";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "reverseMatching.ts": async () => reverseMatching,
  "ai.ts": async () => ai,
  "embeddings.ts": async () => embeddings,
  "scoring.ts": async () => scoring,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "jobs.ts": async () => jobs,
  "jobs_ai.ts": async () => jobsAi,
  "schools.ts": async () => schools,
  "intake.ts": async () => intake,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
});

describe("reverseMatching.findCandidatesForJob (hybrid)", () => {
  it("returns top candidates with hybrid score breakdown", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "X", state: "Y" });

    const strong = await t.mutation("candidates:create", {
      name: "Strong", qualifications: ["B.Ed", "M.Sc Physics"], certifications: ["CTET"],
      boardExperience: ["CBSE"], subjects: ["Physics"], yearsExperience: 7,
    });
    const weak = await t.mutation("candidates:create", {
      name: "Weak", qualifications: [], certifications: [],
      boardExperience: ["State"], subjects: ["Physics"], yearsExperience: 1,
    });
    const unrelated = await t.mutation("candidates:create", {
      name: "Unrelated", qualifications: ["B.Ed"], certifications: [],
      boardExperience: ["CBSE"], subjects: ["English"], yearsExperience: 3,
    });

    for (const id of [strong, weak, unrelated]) {
      await t.action("intake:parseAndStoreCandidate", { candidateId: id, rawText: "" });
    }

    const jobId = await t.mutation("jobs:create", {
      schoolId, title: "PGT Physics", subject: "Physics", level: "PGT", board: "CBSE",
      qualifications: ["B.Ed", "M.Sc Physics"], minExperience: 3,
      naturalLanguageDescription: "PGT Physics for CBSE Class 11-12",
    });
    await t.action("jobs_ai:computeRoleEmbeddings", { jobId });

    const results = await t.action("reverseMatching:findCandidatesForJob", { jobId });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].candidateId).toBe(strong);
    expect(results.some((r: any) => r.candidateId === unrelated)).toBe(false); // hard-filtered
    expect(results[0]).toHaveProperty("structuredScore");
    expect(results[0]).toHaveProperty("semanticSimilarity");
    expect(results[0]).toHaveProperty("ruleScore");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- reverseMatching`
Expected: FAIL — `findCandidatesForJob` not implemented.

---

## Task 20: Reverse-match — implement hybrid flow

**Files:**
- Modify: `convex/reverseMatching.ts` (replace contents)

- [ ] **Step 1: Replace file with hybrid flow**

```ts
// convex/reverseMatching.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { scoreDimension, getRecommendation, type ScoringRules } from "./scoring";
import { structuredMatchScore, weightedSemanticSimilarity, combinedScore } from "./hybridScoring";
import { DEFAULT_HYBRID_WEIGHTS, type HybridWeights } from "./types";
import OpenAI from "openai";

function getClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
}

const RERANK_SYSTEM = `You are a senior recruiter for Indian K-12 schools. Given a job and 10 pre-filtered candidates, rank them by fit and explain why with short phrases citing specific evidence.

Return ONLY a JSON array (no markdown):
[{"candidateIndex": 0, "score": 92, "reasons": ["7yr CBSE Physics", "led JEE prep program"]}]

score is 0-100. reasons is an array of short phrases (max 6 words each, cite specific facts).`;

interface MatchResult {
  candidateId: string;
  score: number;
  reasons: string[];
  structuredScore: number;
  semanticSimilarity: number;
  ruleScore: number;
  hybridWeights: HybridWeights;
}

export const findCandidatesForJob = action({
  args: {
    jobId: v.id("jobPostings"),
    excludeCandidateIds: v.optional(v.array(v.id("candidates"))),
    limit: v.optional(v.number()),
    useLlmRerank: v.optional(v.boolean()),
    weights: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<MatchResult[]> => {
    const limit = args.limit ?? 10;
    const useLlmRerank = args.useLlmRerank ?? true;
    const weights: HybridWeights = (args.weights as HybridWeights) ?? DEFAULT_HYBRID_WEIGHTS;

    const job = await ctx.runQuery(api.jobs.get, { jobId: args.jobId });
    if (!job) return [];

    // ----- Stage 1: hard filter (gates) -----
    const filtered = await ctx.runQuery(api.candidates.hardFilter, {
      subjects: [job.subject],
      boards: [job.board],
      minYears: job.minExperience,
      limit: 200,
      excludeCandidateIds: args.excludeCandidateIds,
    });
    if (filtered.length === 0) return [];

    // ----- Stage 2: hybrid score -----
    let rules = job.scoringRules as ScoringRules | null;
    if (!rules) {
      rules = {
        dimensions: [
          { name: "qualifications", weight: 0.25, config: { required: job.qualifications ?? [], preferred: [] } },
          { name: "subjectMatch", weight: 0.35, config: { subjects: [job.subject] } },
          { name: "experience", weight: 0.25, config: { minYears: job.minExperience ?? 0, idealYears: (job.minExperience ?? 0) + 3 } },
          { name: "certifications", weight: 0.15, config: { required: [] } },
        ],
        minimumScore: 60,
        autoRejectScore: 30,
        generatedBy: "agent",
        version: 1,
      };
    }

    const scored = filtered.map((cand: any) => {
      const structured = structuredMatchScore(
        {
          subjects: [job.subject],
          boards: [job.board],
          qualifications: job.qualifications ?? [],
          minYears: job.minExperience ?? 0,
        },
        cand,
      );
      const sim = weightedSemanticSimilarity(job.roleEmbeddings, cand.facetEmbeddings, weights);
      const dims = rules!.dimensions.map((d) => ({
        name: d.name,
        score: scoreDimension(d.name, d.config, cand),
        weight: d.weight,
      }));
      const ruleScore = dims.reduce((s, d) => s + d.score * d.weight, 0);
      const combined = combinedScore(structured, sim, ruleScore, weights);
      return {
        candidate: cand,
        structuredScore: structured,
        semanticSimilarity: sim,
        ruleScore: Math.round(ruleScore),
        combined,
      };
    });
    scored.sort((a, b) => b.combined - a.combined);
    const top10 = scored.slice(0, 10);

    // ----- Stage 3: LLM rerank on top 10 -----
    if (useLlmRerank) {
      const client = getClient();
      if (client) {
        const profiles = top10.map((s, i) => {
          const c = s.candidate;
          return `[${i}] ${c.candidateSummary || `${c.name}: ${c.qualifications.join(", ")}, ${c.subjects.join(", ")}, ${c.yearsExperience ?? "?"}y`}`;
        }).join("\n");

        try {
          const res = await client.chat.completions.create({
            model: "deepseek-v4-flash",
            max_tokens: 1024,
            temperature: 0,
            messages: [
              { role: "system", content: RERANK_SYSTEM },
              { role: "user", content: `Job: ${job.title} (${job.subject}, ${job.board}, ${job.level}, min ${job.minExperience ?? 0}y)\nDescription: ${job.naturalLanguageDescription}\n\nCandidates:\n${profiles}` },
            ],
          });
          const text = res.choices[0]?.message?.content ?? "";
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const ranked: Array<{ candidateIndex: number; score: number; reasons: string[] }> = JSON.parse(jsonMatch[0]);
            const final: MatchResult[] = ranked
              .map((r) => {
                const entry = top10[r.candidateIndex];
                if (!entry) return null;
                return {
                  candidateId: entry.candidate._id,
                  score: r.score,
                  reasons: r.reasons ?? [],
                  structuredScore: entry.structuredScore,
                  semanticSimilarity: entry.semanticSimilarity,
                  ruleScore: entry.ruleScore,
                  hybridWeights: weights,
                };
              })
              .filter((x): x is MatchResult => x !== null);
            return final.slice(0, limit);
          }
        } catch {
          /* fall through */
        }
      }
    }

    // No LLM rerank — return hybrid-only ranking with synthesized reasons
    return top10.slice(0, limit).map((s) => ({
      candidateId: s.candidate._id,
      score: Math.round(s.combined),
      reasons: [
        s.candidate.subjects?.length ? `Subjects: ${s.candidate.subjects.join(", ")}` : "",
        s.candidate.boardExperience?.length ? `Boards: ${s.candidate.boardExperience.join(", ")}` : "",
        s.candidate.yearsExperience ? `${s.candidate.yearsExperience}y experience` : "",
      ].filter(Boolean),
      structuredScore: s.structuredScore,
      semanticSimilarity: s.semanticSimilarity,
      ruleScore: s.ruleScore,
      hybridWeights: weights,
    }));
  },
});

// Deprecated stub — preserved for any callers; delegates
export const reverseMatchJob = action({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args) => {
    return await ctx.runAction(api.reverseMatching.findCandidatesForJob, { jobId: args.jobId });
  },
});
```

- [ ] **Step 2: Run test, expect PASS**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- reverseMatching`
Expected: PASS.

- [ ] **Step 3: Run full suite**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add convex/reverseMatching.ts tests/convex/reverseMatching.test.ts
git commit -m "feat(reverseMatching): hybrid 3-stage flow — gates, structured+semantic+rules, LLM rerank"
```

---

# BLOCK F — NL Admin Search (Tasks 21–23)

## Task 21: NL search translator prompt

**Files:**
- Create: `convex/prompts/nlSearchTranslator.ts`

- [ ] **Step 1: Write the prompt**

```ts
// convex/prompts/nlSearchTranslator.ts

export const NL_SEARCH_TRANSLATOR_SYSTEM = `You translate natural-language recruiter questions into structured filter queries against a candidate database.

Available filter fields (all optional):
- subjects: string[]
- minYears: number
- boards: string[] (CBSE, ICSE, IB, IGCSE, State)
- requireSpecializations: string[] (JEE_prep, NEET_prep, Olympiad, remedial, experiential, ...)
- requireLeadership: boolean (any non-empty leadershipRoles)
- excludeActiveApplications: boolean
- redFlagsAllowedMax: number
- lastOutreachOlderThanDays: number

Return ONLY a JSON object (no markdown):
{
  "filter": { /* fields above, omit unused */ },
  "intent": "string 1-sentence description of what the recruiter wants"
}`;
```

- [ ] **Step 2: Commit**

```bash
git add convex/prompts/nlSearchTranslator.ts
git commit -m "feat(prompts): NL search translator"
```

---

## Task 22: NL search — write failing test, then implement

**Files:**
- Create: `tests/convex/talentSearch.test.ts`
- Create: `convex/talentSearch.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/convex/talentSearch.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as talentSearch from "../../convex/talentSearch";
import * as candidates from "../../convex/candidates";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "talentSearch.ts": async () => talentSearch,
  "candidates.ts": async () => candidates,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  delete process.env.DEEPSEEK_API_KEY;
});

describe("talentSearch", () => {
  it("returns empty result gracefully when no LLM is configured", async () => {
    const t = convexTest(schema, modules);
    const out = await t.action("talentSearch:searchNatural", { question: "Physics teachers" });
    expect(out).toEqual({ candidates: [], intent: "", filter: {} });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- talentSearch`
Expected: FAIL.

- [ ] **Step 3: Implement `convex/talentSearch.ts`**

```ts
// convex/talentSearch.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { NL_SEARCH_TRANSLATOR_SYSTEM } from "./prompts/nlSearchTranslator";
import OpenAI from "openai";

function getClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
}

export const searchNatural = action({
  args: { question: v.string() },
  handler: async (ctx, args): Promise<{ candidates: any[]; intent: string; filter: any }> => {
    const client = getClient();
    if (!client) return { candidates: [], intent: "", filter: {} };

    const res = await client.chat.completions.create({
      model: "deepseek-v4-flash",
      max_tokens: 512,
      temperature: 0,
      messages: [
        { role: "system", content: NL_SEARCH_TRANSLATOR_SYSTEM },
        { role: "user", content: args.question.substring(0, 500) },
      ],
    });

    const text = res.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { candidates: [], intent: "", filter: {} };
    const parsed = JSON.parse(jsonMatch[0]);
    const filter = parsed.filter ?? {};

    // Stage 1 hard filter
    const results = await ctx.runQuery(api.candidates.hardFilter, {
      subjects: filter.subjects,
      boards: filter.boards,
      minYears: filter.minYears,
      limit: 50,
    });

    // Post-filter non-indexed predicates
    const finalCandidates = results.filter((c: any) => {
      if (filter.requireLeadership) {
        const roles = c.parsedFacets?.leadershipRoles ?? [];
        if (roles.length === 0) return false;
      }
      if (filter.requireSpecializations?.length) {
        const specs = (c.parsedFacets?.specializations ?? []).map((s: any) => s.value.toLowerCase());
        const need = filter.requireSpecializations.every((rs: string) => specs.includes(rs.toLowerCase()));
        if (!need) return false;
      }
      if (typeof filter.redFlagsAllowedMax === "number") {
        const rf = c.parsedFacets?.redFlags?.length ?? 0;
        if (rf > filter.redFlagsAllowedMax) return false;
      }
      return true;
    });

    return { candidates: finalCandidates, intent: parsed.intent ?? "", filter };
  },
});
```

- [ ] **Step 4: Run test, expect PASS**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- talentSearch`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/talentSearch.ts tests/convex/talentSearch.test.ts
git commit -m "feat(talentSearch): NL → structured query + post-filter for facet predicates"
```

---

# BLOCK G — Backfill (Task 23)

## Task 23: Backfill action with rawChunks-based re-extraction

**Files:**
- Create: `convex/backfill.ts`
- Create: `tests/convex/backfill.test.ts`

- [ ] **Step 1: Test (stale detection)**

```ts
// tests/convex/backfill.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as backfill from "../../convex/backfill";
import * as candidates from "../../convex/candidates";
import * as intake from "../../convex/intake";
import * as ai from "../../convex/ai";
import * as embeddings from "../../convex/embeddings";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "backfill.ts": async () => backfill,
  "candidates.ts": async () => candidates,
  "intake.ts": async () => intake,
  "ai.ts": async () => ai,
  "embeddings.ts": async () => embeddings,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => { process.env.EMBEDDING_PROVIDER = "stub"; });

describe("backfill", () => {
  it("findStaleCandidates returns candidates missing version stamps", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation("candidates:create", {
      name: "Stale", qualifications: [], certifications: [],
      boardExperience: [], subjects: ["Physics"],
    });
    const stale = await t.query("backfill:findStaleCandidates", { limit: 10 });
    expect(stale.map((c: any) => c._id)).toContain(id);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- backfill`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// convex/backfill.ts
import { action, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { PARSED_FACETS_VERSION, EMBEDDING_VERSION } from "./versions";

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
      // Prefer rawChunks if available — otherwise synthesize from structured fields
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
```

- [ ] **Step 4: Run test, expect PASS**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- backfill`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/backfill.ts tests/convex/backfill.test.ts
git commit -m "feat(backfill): re-extract stale candidates from rawChunks first; structured fallback"
```

---

# BLOCK H — Wiring (Task 24)

## Task 24: Chain intake parse on every candidate create

**Files:**
- Modify: `convex/email_ingestion.ts`
- Modify: `convex/careers.ts`

- [ ] **Step 1: Read both files**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && cat convex/email_ingestion.ts convex/careers.ts`

- [ ] **Step 2: After every candidate-create call site, schedule intake parse + set origin**

After each location where a candidate row is created (look for `candidates.create` calls), add:

```ts
await ctx.runMutation(internal.candidates.setOrigin, {
  candidateId,
  origin: "fresh_application",
});
await ctx.scheduler.runAfter(0, api.intake.parseAndStoreCandidate, {
  candidateId,
  rawText: rawResumeOrEmailBody, // the text that was passed to parseProfileFromText
});
```

Ensure `internal` and `api` are imported.

- [ ] **Step 3: Run full suite**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add convex/email_ingestion.ts convex/careers.ts
git commit -m "feat(intake): chain parseAndStoreCandidate + setOrigin on every candidate-create path"
```

---

# BLOCK I — Pool provenance + Evidence UI (Tasks 25–26)

## Task 25: Pool-origin badge + Evidence popover components

**Files:**
- Create: `components/shared/pool-origin-badge.tsx`
- Create: `components/shared/evidence-popover.tsx`

- [ ] **Step 1: Write the badge**

```tsx
// components/shared/pool-origin-badge.tsx
"use client";
import { Sparkles } from "lucide-react";

interface Props {
  source?: "careers_site" | "talent_pool_match" | "agent_sourced" | "triage_cross_match" | "manual";
  poolName?: string | null;
}

export function PoolOriginBadge({ source, poolName }: Props) {
  if (!source || source === "careers_site" || source === "manual") return null;
  const label =
    source === "talent_pool_match" ? `From Talent Pool${poolName ? ` — ${poolName}` : ""}` :
    source === "agent_sourced" ? "Agent Sourced" :
    source === "triage_cross_match" ? "Cross-role suggestion" :
    "Surfaced";
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 text-xs px-2 py-0.5 ring-1 ring-amber-200">
      <Sparkles className="h-3 w-3" />{label}
    </span>
  );
}
```

- [ ] **Step 2: Write the evidence popover**

```tsx
// components/shared/evidence-popover.tsx
"use client";
import { useState } from "react";
import { Info } from "lucide-react";

interface Evidence {
  quote: string;
  offset: number;
  context: string;
}

interface Props {
  value: string;
  evidence?: Evidence;
}

export function EvidencePopover({ value, evidence }: Props) {
  const [open, setOpen] = useState(false);
  if (!evidence) {
    return <span className="text-sm">{value}</span>;
  }
  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="text-sm underline decoration-dotted hover:decoration-solid inline-flex items-center gap-1"
      >
        {value}
        <Info className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-72 p-3 bg-white rounded shadow-lg ring-1 ring-gray-200 text-xs">
          <div className="font-medium text-gray-700 mb-1">Evidence</div>
          <div className="italic text-gray-600 mb-2">"{evidence.quote}"</div>
          <div className="text-gray-500">Context: …{evidence.context}…</div>
        </div>
      )}
    </span>
  );
}
```

- [ ] **Step 3: Mount badge in drawer + table**

In `components/pipeline/application-drawer.tsx`, near the candidate name in the header:
```tsx
import { PoolOriginBadge } from "@/components/shared/pool-origin-badge";
// ...
<PoolOriginBadge source={application.source} poolName={application.matchedFromPool?.name} />
```

In `components/talent/application-table.tsx`, in the name cell, append `<PoolOriginBadge source={row.source} />`.

- [ ] **Step 4: Smoke test**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm run dev` — visit a candidate; verify no regression.

- [ ] **Step 5: Commit**

```bash
git add components/shared/pool-origin-badge.tsx components/shared/evidence-popover.tsx components/pipeline/application-drawer.tsx components/talent/application-table.tsx
git commit -m "feat(ui): PoolOriginBadge + EvidencePopover components; mount badge in drawer+table"
```

---

## Task 26: NL search bar on talent page

**Files:**
- Create: `components/talent/nl-search-bar.tsx`
- Modify: `app/dashboard/talent/page.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/talent/nl-search-bar.tsx
"use client";
import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Search, Loader2 } from "lucide-react";

interface Props {
  onResults: (candidates: any[], intent: string) => void;
}

export function NlSearchBar({ onResults }: Props) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const search = useAction(api.talentSearch.searchNatural);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await search({ question: q });
      onResults(res.candidates, res.intent);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 mb-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Ask: "Physics teachers with JEE coaching and 3+ years"'
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Mount in talent page**

Open `app/dashboard/talent/page.tsx`. Above existing `<TalentControls />`, add:

```tsx
import { NlSearchBar } from "@/components/talent/nl-search-bar";
// In the component:
const [nlResults, setNlResults] = useState<any[] | null>(null);
const [nlIntent, setNlIntent] = useState("");

// In JSX:
<NlSearchBar onResults={(c, intent) => { setNlResults(c); setNlIntent(intent); }} />
{nlResults && (
  <div className="mb-4 text-sm text-gray-600">
    {nlIntent ? `Showing results for: ${nlIntent}` : null} ({nlResults.length} candidates)
    <button className="ml-2 text-blue-600 underline" onClick={() => setNlResults(null)}>Clear</button>
  </div>
)}
{/* Pass nlResults into the existing table when set */}
```

- [ ] **Step 3: Smoke test + commit**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm run dev` and visit `/dashboard/talent`.

```bash
git add components/talent/nl-search-bar.tsx app/dashboard/talent/page.tsx
git commit -m "feat(ui): NL search bar on talent page"
```

---

## Task 27: Phase 1 (no-triage) verification gate

- [ ] **Step 1: Full test suite**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test`
Expected: green.

- [ ] **Step 2: Typecheck**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npx tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 3: Convex push**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npx convex dev --once`
Expected: clean.

- [ ] **Step 4: Tag (optional)**

```bash
git tag intelligence-layer-shipped
```

Intelligence Layer alone is shippable. Continue to Triage Agent.

---

# BLOCK J — Triage Agent (Tasks 28–34)

## Task 28: Triage routing prompt + outreach drafting prompt

**Files:**
- Create: `convex/prompts/triageRouting.ts`
- Create: `convex/prompts/outreachDraft.ts`

- [ ] **Step 1: Triage routing prompt**

```ts
// convex/prompts/triageRouting.ts

export const TRIAGE_ROUTING_SYSTEM = `You are a triage assistant for an Indian K-12 school HR team. Decide one of four outcomes:
- "auto_shortlisted" — strong fit, 0 hard red-flags
- "auto_rejected" — clear no-fit
- "human_review" — borderline OR red-flag count ≥ override
- "cross_role_suggested" — borderline primary but strong match elsewhere

Return ONLY JSON:
{
  "outcome": "auto_shortlisted" | "auto_rejected" | "human_review" | "cross_role_suggested",
  "reasoning": "1-2 sentences citing specific facts",
  "primaryReasons": ["short phrases"],
  "alternateRoleId": string | null
}`;
```

- [ ] **Step 2: Outreach drafting prompt**

```ts
// convex/prompts/outreachDraft.ts

export const OUTREACH_DRAFT_SYSTEM = `You draft short, warm, personalized outreach messages from an Indian K-12 school HR team to teacher candidates.

Inputs: candidateName, candidateSummary, schoolName, schoolCity, roleTitle, channel (whatsapp|email), type (shortlist|rejection|cross_role_suggestion), primaryReasons (array — facts to reference naturally).

Style:
- WhatsApp: ≤3 short paragraphs, <80 words. Use first name. No subject line.
- Email: first line "Subject: ...", blank line, then 2-4 short paragraphs. Sign off with school name.
- Reference ONE specific fact from primaryReasons naturally (no bullet lists in output).
- Rejection: respectful, one specific reason, invite future relevant openings.
- No emojis. No "Dear Sir/Madam".

Return ONLY the message body (and "Subject:" line for email). No JSON.`;
```

- [ ] **Step 3: Commit**

```bash
git add convex/prompts/triageRouting.ts convex/prompts/outreachDraft.ts
git commit -m "feat(prompts): triage routing + outreach draft"
```

---

## Task 29: Triage backend — schools config + outreach draft mutation

**Files:**
- Modify: `convex/schools.ts`
- Modify: `convex/outreach.ts`

- [ ] **Step 1: Add `getTriageConfig` + `updateTriageConfig` to schools.ts**

```ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getTriageConfig = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) return null;
    return {
      triageEnabled: school.triageEnabled ?? false,
      autoShortlistThreshold: school.autoShortlistThreshold ?? 0.85,
      autoRejectThreshold: school.autoRejectThreshold ?? 0.30,
      autoSendDelaySec: school.autoSendDelaySec ?? 14400,
      redFlagOverrideCount: school.redFlagOverrideCount ?? 2,
    };
  },
});

export const updateTriageConfig = mutation({
  args: {
    schoolId: v.id("schools"),
    triageEnabled: v.optional(v.boolean()),
    autoShortlistThreshold: v.optional(v.number()),
    autoRejectThreshold: v.optional(v.number()),
    autoSendDelaySec: v.optional(v.number()),
    redFlagOverrideCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { schoolId, ...patch } = args;
    await ctx.db.patch(schoolId, patch);
  },
});
```

- [ ] **Step 2: Add `createDraft` internal mutation to outreach.ts**

```ts
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const createDraft = internalMutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    type: v.union(
      v.literal("shortlist"),
      v.literal("rejection"),
      v.literal("cross_role_suggestion"),
    ),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    body: v.string(),
    scheduledSendAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachMessages", {
      ...args,
      status: args.scheduledSendAt ? "scheduled" : "draft_pending_approval",
      draftedBy: "triage_agent",
    });
  },
});
```

- [ ] **Step 3: Add `setTriageResult` and `setSource` to applications.ts**

```ts
export const setSource = internalMutation({
  args: {
    applicationId: v.id("applications"),
    source: v.union(
      v.literal("careers_site"),
      v.literal("talent_pool_match"),
      v.literal("agent_sourced"),
      v.literal("triage_cross_match"),
      v.literal("manual"),
    ),
    matchedFromPoolId: v.optional(v.id("pools")),
  },
  handler: async (ctx, args) => {
    const patch: any = { source: args.source, matchedAt: Date.now() };
    if (args.matchedFromPoolId) patch.matchedFromPoolId = args.matchedFromPoolId;
    await ctx.db.patch(args.applicationId, patch);
  },
});

export const setTriageResult = internalMutation({
  args: {
    applicationId: v.id("applications"),
    triageOutcome: v.union(
      v.literal("auto_shortlisted"),
      v.literal("auto_rejected"),
      v.literal("human_review"),
      v.literal("cross_role_suggested"),
    ),
    triageDecisionId: v.id("triageDecisions"),
    matchReasons: v.array(v.string()),
    aiMatchScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { applicationId, ...patch } = args;
    await ctx.db.patch(applicationId, patch);
  },
});
```

- [ ] **Step 4: Run tests + commit**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test && npx tsc --noEmit -p tsconfig.json
git add convex/schools.ts convex/outreach.ts convex/applications.ts
git commit -m "feat(triage): schools config + outreach.createDraft + applications.setTriageResult"
```

---

## Task 30: Triage — write failing test for runTriage

**Files:**
- Create: `tests/convex/triage.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/convex/triage.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as triage from "../../convex/triage";
import * as reverseMatching from "../../convex/reverseMatching";
import * as schools from "../../convex/schools";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as jobs from "../../convex/jobs";
import * as jobsAi from "../../convex/jobs_ai";
import * as intake from "../../convex/intake";
import * as ai from "../../convex/ai";
import * as embeddings from "../../convex/embeddings";
import * as scoring from "../../convex/scoring";
import * as outreach from "../../convex/outreach";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "triage.ts": async () => triage,
  "reverseMatching.ts": async () => reverseMatching,
  "schools.ts": async () => schools,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "jobs.ts": async () => jobs,
  "jobs_ai.ts": async () => jobsAi,
  "intake.ts": async () => intake,
  "ai.ts": async () => ai,
  "embeddings.ts": async () => embeddings,
  "scoring.ts": async () => scoring,
  "outreach.ts": async () => outreach,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
  delete process.env.DEEPSEEK_API_KEY;
});

describe("triage.runTriage", () => {
  it("writes a triageDecisions row with hybridWeights snapshot and stamps the application", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "Mumbai", state: "MH" });
    await t.mutation("schools:updateTriageConfig", { schoolId, triageEnabled: true });

    const jobId = await t.mutation("jobs:create", {
      schoolId, title: "PGT Physics", subject: "Physics", level: "PGT", board: "CBSE",
      qualifications: ["B.Ed"], minExperience: 2,
      naturalLanguageDescription: "PGT Physics",
    });
    await t.action("jobs_ai:computeRoleEmbeddings", { jobId });

    const candId = await t.mutation("candidates:create", {
      name: "X", qualifications: ["B.Ed", "M.Sc Physics"], certifications: ["CTET"],
      boardExperience: ["CBSE"], subjects: ["Physics"], yearsExperience: 5,
    });
    await t.action("intake:parseAndStoreCandidate", { candidateId: candId, rawText: "" });

    const appId = await t.mutation("applications:create", {
      candidateId: candId, jobPostingId: jobId, schoolId,
    });

    await t.action("triage:runTriage", { applicationId: appId });

    const app = await t.query("applications:get", { applicationId: appId });
    expect(app!.triageOutcome).toBeDefined();
    expect(app!.triageDecisionId).toBeDefined();

    const decision = await t.query("triage:getByApplicationId", { applicationId: appId });
    expect(decision!.hybridWeights).toBeDefined();
    expect(decision!.hybridWeights.w_struct).toBe(0.5);
    expect(decision!.hybridWeights.w_sem).toBe(0.3);
    expect(decision!.hybridWeights.w_rules).toBe(0.2);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- triage`
Expected: FAIL — `triage` module missing.

---

## Task 31: Triage — implement

**Files:**
- Create: `convex/triage.ts`

- [ ] **Step 1: Write the file**

```ts
// convex/triage.ts
import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { TRIAGE_PROMPT_VERSION } from "./versions";
import { TRIAGE_ROUTING_SYSTEM } from "./prompts/triageRouting";
import { OUTREACH_DRAFT_SYSTEM } from "./prompts/outreachDraft";
import { DEFAULT_HYBRID_WEIGHTS } from "./types";
import OpenAI from "openai";

function getClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
}

export const writeTriageDecision = internalMutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    schoolId: v.id("schools"),
    primaryRoleId: v.optional(v.id("jobPostings")),
    primaryMatchScore: v.number(),
    primaryMatchReasons: v.array(v.string()),
    crossRoleMatches: v.array(v.object({
      roleId: v.id("jobPostings"),
      score: v.number(),
      reasons: v.array(v.string()),
    })),
    outcome: v.union(
      v.literal("auto_shortlisted"),
      v.literal("auto_rejected"),
      v.literal("human_review"),
      v.literal("cross_role_suggested"),
    ),
    outcomeReasoning: v.string(),
    outreachDraftId: v.optional(v.id("outreachMessages")),
    hybridWeights: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("triageDecisions", {
      ...args,
      createdAt: Date.now(),
      triagePromptVersion: TRIAGE_PROMPT_VERSION,
    });
  },
});

export const runTriage = action({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args): Promise<void> => {
    const app = await ctx.runQuery(api.applications.get, { applicationId: args.applicationId });
    if (!app) throw new Error("Application not found");

    const config = await ctx.runQuery(api.schools.getTriageConfig, { schoolId: app.schoolId });
    if (!config || !config.triageEnabled) return;

    const weights = DEFAULT_HYBRID_WEIGHTS;

    // 1. Hybrid-match across all open roles at this school
    const openRoles = await ctx.runQuery(api.jobs.listOpenForSchool, { schoolId: app.schoolId });
    if (openRoles.length === 0) return;

    const perRole: Array<{ roleId: string; score: number; reasons: string[] }> = [];
    for (const role of openRoles) {
      const matches = await ctx.runAction(api.reverseMatching.findCandidatesForJob, {
        jobId: role._id,
        limit: 50,
        useLlmRerank: false,
        weights,
      });
      const hit = matches.find((m: any) => String(m.candidateId) === String(app.candidateId));
      if (hit) perRole.push({ roleId: role._id, score: hit.score, reasons: hit.reasons });
    }

    const primary = perRole.find((p) => String(p.roleId) === String(app.jobPostingId)) ?? {
      roleId: app.jobPostingId,
      score: 0,
      reasons: [],
    };
    const crossRoles = perRole
      .filter((p) => String(p.roleId) !== String(app.jobPostingId) && p.score >= 70)
      .sort((a, b) => b.score - a.score);

    const candidate = await ctx.runQuery(api.candidates.get, { candidateId: app.candidateId });
    const redFlagCount = candidate?.parsedFacets?.redFlags?.length ?? 0;

    let outcome: "auto_shortlisted" | "auto_rejected" | "human_review" | "cross_role_suggested";
    let reasoning: string;

    const score01 = primary.score / 100;
    if (score01 >= config.autoShortlistThreshold && redFlagCount < config.redFlagOverrideCount) {
      outcome = "auto_shortlisted";
      reasoning = `Strong fit (${primary.score}/100). ${primary.reasons.slice(0, 2).join("; ")}`;
    } else if (score01 <= config.autoRejectThreshold) {
      outcome = "auto_rejected";
      reasoning = `Low fit (${primary.score}/100). ${primary.reasons.join("; ") || "No qualifying signals."}`;
    } else if (crossRoles[0] && crossRoles[0].score >= 80 && primary.score < 75) {
      outcome = "cross_role_suggested";
      reasoning = `Better fit for ${crossRoles[0].roleId} (${crossRoles[0].score}/100) than primary (${primary.score}/100).`;
    } else {
      outcome = "human_review";
      reasoning = `Borderline fit (${primary.score}/100)${redFlagCount > 0 ? `, ${redFlagCount} red flag(s)` : ""}.`;
    }

    // 2. Draft outreach for non-human-review outcomes
    let outreachDraftId: any = undefined;
    if (outcome !== "human_review") {
      const draftBody = await draftOutreach(ctx, {
        candidate,
        school: await ctx.runQuery(api.schools.get, { schoolId: app.schoolId }),
        role: openRoles.find((r: any) => String(r._id) === String(primary.roleId)),
        outcome,
        primaryReasons: primary.reasons,
      });
      if (draftBody) {
        outreachDraftId = await ctx.runMutation(internal.outreach.createDraft, {
          applicationId: args.applicationId,
          candidateId: app.candidateId,
          type: outcome === "auto_shortlisted" ? "shortlist" : outcome === "auto_rejected" ? "rejection" : "cross_role_suggestion",
          channel: "whatsapp",
          body: draftBody,
          scheduledSendAt: outcome === "auto_shortlisted" || outcome === "auto_rejected"
            ? Date.now() + config.autoSendDelaySec * 1000
            : undefined,
        });
      }
    }

    // 3. Write decision row with hybridWeights snapshot
    const decisionId = await ctx.runMutation(internal.triage.writeTriageDecision, {
      applicationId: args.applicationId,
      candidateId: app.candidateId,
      schoolId: app.schoolId,
      primaryRoleId: app.jobPostingId,
      primaryMatchScore: primary.score,
      primaryMatchReasons: primary.reasons,
      crossRoleMatches: crossRoles.map((c) => ({ roleId: c.roleId as any, score: c.score, reasons: c.reasons })),
      outcome,
      outcomeReasoning: reasoning,
      outreachDraftId,
      hybridWeights: weights,
    });

    // 4. Stamp the application
    await ctx.runMutation(internal.applications.setTriageResult, {
      applicationId: args.applicationId,
      triageOutcome: outcome,
      triageDecisionId: decisionId,
      matchReasons: primary.reasons,
      aiMatchScore: primary.score,
    });

    // 5. Create cross-role suggestion applications
    for (const cr of crossRoles.slice(0, 3)) {
      const newAppId = await ctx.runMutation(api.applications.create, {
        candidateId: app.candidateId,
        jobPostingId: cr.roleId as any,
        schoolId: app.schoolId,
      });
      await ctx.runMutation(internal.applications.setSource, {
        applicationId: newAppId,
        source: "triage_cross_match",
      });
    }
  },
});

async function draftOutreach(ctx: any, args: { candidate: any; school: any; role: any; outcome: string; primaryReasons: string[] }): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const res = await client.chat.completions.create({
    model: "deepseek-v4-flash",
    max_tokens: 512,
    temperature: 0.4,
    messages: [
      { role: "system", content: OUTREACH_DRAFT_SYSTEM },
      { role: "user", content: JSON.stringify({
        candidateSummary: args.candidate?.candidateSummary ?? "",
        candidateName: args.candidate?.name ?? "",
        schoolName: args.school?.name ?? "",
        schoolCity: args.school?.city ?? "",
        roleTitle: args.role?.title ?? "",
        type: args.outcome === "auto_shortlisted" ? "shortlist" : args.outcome === "auto_rejected" ? "rejection" : "cross_role_suggestion",
        channel: "whatsapp",
        primaryReasons: args.primaryReasons,
      }) },
    ],
  });
  return res.choices[0]?.message?.content ?? null;
}

// Queries used by the UI
export const getByApplicationId = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("triageDecisions")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", args.applicationId))
      .first();
  },
});

export const queueForSchool = query({
  args: {
    schoolId: v.id("schools"),
    outcomes: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const want = new Set(args.outcomes ?? ["auto_shortlisted", "auto_rejected", "human_review", "cross_role_suggested"]);
    const limit = args.limit ?? 50;

    const apps = await ctx.db
      .query("applications")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.neq(q.field("triageOutcome"), undefined))
      .order("desc")
      .take(200);

    const filtered = apps.filter((a) => a.triageOutcome && want.has(a.triageOutcome));

    const enriched = [];
    for (const a of filtered.slice(0, limit)) {
      const decision = a.triageDecisionId ? await ctx.db.get(a.triageDecisionId) : null;
      const candidate = await ctx.db.get(a.candidateId);
      const job = a.jobPostingId ? await ctx.db.get(a.jobPostingId) : null;
      const draftId = decision?.outreachDraftId;
      const draft = draftId ? await ctx.db.get(draftId) : null;
      enriched.push({ application: a, candidate, job, decision, draft });
    }
    return enriched;
  },
});

export const approveDraft = mutation({
  args: { decisionId: v.id("triageDecisions"), overriddenBy: v.string() },
  handler: async (ctx, args) => {
    const decision = await ctx.db.get(args.decisionId);
    if (!decision || !decision.outreachDraftId) return;
    const draft = await ctx.db.get(decision.outreachDraftId);
    if (!draft) return;
    if (draft.status === "draft_pending_approval") {
      await ctx.db.patch(decision.outreachDraftId, {
        status: "scheduled",
        scheduledSendAt: Date.now() + 5000,
      });
    }
  },
});

export const overrideOutcome = mutation({
  args: {
    decisionId: v.id("triageDecisions"),
    overriddenBy: v.string(),
    toOutcome: v.union(
      v.literal("auto_shortlisted"),
      v.literal("auto_rejected"),
      v.literal("human_review"),
      v.literal("cross_role_suggested"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const decision = await ctx.db.get(args.decisionId);
    if (!decision) return;
    await ctx.db.patch(args.decisionId, {
      humanOverride: {
        overriddenAt: Date.now(),
        overriddenBy: args.overriddenBy,
        fromOutcome: decision.outcome,
        toOutcome: args.toOutcome,
        note: args.note,
      },
    });
    await ctx.db.patch(decision.applicationId, { triageOutcome: args.toOutcome });
  },
});
```

- [ ] **Step 2: Run test, expect PASS**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test -- triage`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/triage.ts tests/convex/triage.test.ts
git commit -m "feat(triage): runTriage + queue + approve + override with hybridWeights snapshot"
```

---

## Task 32: Wire triage into application-create

**Files:**
- Modify: `convex/applications.ts` (the `create` mutation)

- [ ] **Step 1: Update `applications.create`**

After the existing `ctx.db.insert("applications", { ... })` line, before returning, add:

```ts
// Default per-match source for direct careers-site apps
await ctx.db.patch(applicationId, { source: "careers_site", matchedAt: Date.now() });

// Schedule triage (runs after the transaction commits)
await ctx.scheduler.runAfter(0, api.triage.runTriage, { applicationId });

return applicationId;
```

(Ensure `api` is imported.)

- [ ] **Step 2: Run full suite**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add convex/applications.ts
git commit -m "feat(triage): schedule runTriage on every application create"
```

---

# BLOCK K — Triage UI (Tasks 33–36)

## Task 33: TriageCard component (with evidence)

**Files:**
- Create: `components/triage/triage-card.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/triage/triage-card.tsx
"use client";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Check, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { EvidencePopover } from "@/components/shared/evidence-popover";

interface Props {
  item: { application: any; candidate: any; job: any; decision: any; draft: any };
  userId: string;
}

const outcomeStyles: Record<string, { bg: string; label: string }> = {
  auto_shortlisted: { bg: "bg-green-50 ring-green-200", label: "Auto-Shortlisted" },
  auto_rejected: { bg: "bg-red-50 ring-red-200", label: "Auto-Rejected" },
  human_review: { bg: "bg-amber-50 ring-amber-200", label: "Needs Your Review" },
  cross_role_suggested: { bg: "bg-blue-50 ring-blue-200", label: "Cross-Role Match" },
};

export function TriageCard({ item, userId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const approve = useMutation(api.triage.approveDraft);
  const override = useMutation(api.triage.overrideOutcome);
  const outcome = item.decision?.outcome ?? "human_review";
  const styles = outcomeStyles[outcome];
  const specs: any[] = item.candidate?.parsedFacets?.specializations ?? [];

  return (
    <div className={`rounded-lg ring-1 p-4 ${styles.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-gray-900 truncate">{item.candidate?.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white">{styles.label}</span>
            <span className="text-sm text-gray-600">{item.decision?.primaryMatchScore}/100</span>
          </div>
          <p className="text-sm text-gray-700 mt-1">For: <span className="font-medium">{item.job?.title}</span></p>
          <p className="text-sm text-gray-600 mt-1 italic">{item.decision?.outcomeReasoning}</p>
          {specs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {specs.slice(0, 6).map((s: any, i: number) => (
                <span key={i} className="text-xs bg-white px-2 py-0.5 rounded ring-1 ring-gray-200">
                  <EvidencePopover value={s.value} evidence={s.evidence} />
                </span>
              ))}
            </div>
          )}
          {item.decision?.primaryMatchReasons && item.decision.primaryMatchReasons.length > 0 && (
            <ul className="mt-2 text-xs text-gray-700 list-disc list-inside">
              {item.decision.primaryMatchReasons.slice(0, 3).map((r: string, i: number) => <li key={i}>{r}</li>)}
            </ul>
          )}
          {item.draft && (
            <button className="mt-2 text-xs text-blue-600 inline-flex items-center gap-1" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Hide" : "Show"} draft outreach
            </button>
          )}
          {expanded && item.draft && (
            <pre className="mt-2 p-3 bg-white border rounded text-xs whitespace-pre-wrap">{item.draft.body}</pre>
          )}
        </div>
        <div className="flex gap-2">
          {item.draft && item.draft.status === "draft_pending_approval" && (
            <button onClick={() => approve({ decisionId: item.decision._id, overriddenBy: userId })}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-xs inline-flex items-center gap-1">
              <Check className="h-3 w-3" /> Approve
            </button>
          )}
          <button onClick={() => override({ decisionId: item.decision._id, overriddenBy: userId, toOutcome: "human_review" })}
            className="px-3 py-1.5 bg-white text-gray-700 ring-1 ring-gray-300 rounded text-xs inline-flex items-center gap-1">
            <Edit className="h-3 w-3" /> Override
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/triage/triage-card.tsx
git commit -m "feat(ui): TriageCard with EvidencePopover-driven facet display"
```

---

## Task 34: Triage Queue page

**Files:**
- Create: `app/dashboard/triage/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// app/dashboard/triage/page.tsx
"use client";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { TriageCard } from "@/components/triage/triage-card";
import { useState } from "react";

const TABS = [
  { key: "human_review", label: "Needs Review" },
  { key: "auto_shortlisted", label: "Auto-Shortlisted" },
  { key: "auto_rejected", label: "Auto-Rejected" },
  { key: "cross_role_suggested", label: "Cross-Role" },
];

export default function TriagePage() {
  const { user } = useUser();
  const userId = user?.id ?? "";
  const profile = useQuery(api.users.getCurrentProfile, userId ? {} : "skip");
  const schoolId = profile?.schoolId;
  const [tab, setTab] = useState<string>("human_review");

  const queue = useQuery(api.triage.queueForSchool,
    schoolId ? { schoolId, outcomes: [tab], limit: 100 } : "skip");

  if (!schoolId) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Triage Queue</h1>
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm border-b-2 ${tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {queue === undefined ? (
          <div className="text-gray-500">Loading…</div>
        ) : queue.length === 0 ? (
          <div className="text-gray-500 py-8 text-center">No items in this queue.</div>
        ) : (
          queue.map((item: any) => <TriageCard key={item.application._id} item={item} userId={userId} />)
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add nav entry**

Find the dashboard sidebar (likely `components/dashboard/Sidebar.tsx` or similar). Add a "Triage" link to `/dashboard/triage`.

- [ ] **Step 3: Smoke test + commit**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm run dev
# Visit /dashboard/triage manually
git add app/dashboard/triage/page.tsx components/dashboard/Sidebar.tsx
git commit -m "feat(ui): Triage Queue page with tabs"
```

---

## Task 35: Triage Settings page

**Files:**
- Create: `app/dashboard/settings/triage/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// app/dashboard/settings/triage/page.tsx
"use client";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";

export default function TriageSettingsPage() {
  const { user } = useUser();
  const profile = useQuery(api.users.getCurrentProfile, user?.id ? {} : "skip");
  const schoolId = profile?.schoolId;
  const config = useQuery(api.schools.getTriageConfig, schoolId ? { schoolId } : "skip");
  const update = useMutation(api.schools.updateTriageConfig);

  const [enabled, setEnabled] = useState(false);
  const [shortlistT, setShortlistT] = useState(0.85);
  const [rejectT, setRejectT] = useState(0.30);
  const [delayH, setDelayH] = useState(4);
  const [redFlag, setRedFlag] = useState(2);

  useEffect(() => {
    if (config) {
      setEnabled(config.triageEnabled);
      setShortlistT(config.autoShortlistThreshold);
      setRejectT(config.autoRejectThreshold);
      setDelayH(config.autoSendDelaySec / 3600);
      setRedFlag(config.redFlagOverrideCount);
    }
  }, [config]);

  if (!schoolId || !config) return <div className="p-6">Loading…</div>;

  async function save() {
    await update({
      schoolId: schoolId!,
      triageEnabled: enabled,
      autoShortlistThreshold: shortlistT,
      autoRejectThreshold: rejectT,
      autoSendDelaySec: Math.round(delayH * 3600),
      redFlagOverrideCount: redFlag,
    });
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">Triage Agent Settings</h1>
      <div className="space-y-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>Enable Inbound Triage Agent</span>
        </label>
        <div>
          <label className="block text-sm font-medium">Auto-shortlist threshold ({Math.round(shortlistT * 100)}%)</label>
          <input type="range" min={0.5} max={1.0} step={0.01} value={shortlistT} onChange={(e) => setShortlistT(+e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium">Auto-reject threshold ({Math.round(rejectT * 100)}%)</label>
          <input type="range" min={0} max={0.5} step={0.01} value={rejectT} onChange={(e) => setRejectT(+e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium">Soft-confirmation window (hours)</label>
          <input type="number" min={0} max={24} value={delayH} onChange={(e) => setDelayH(+e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-sm font-medium">Red-flag override count</label>
          <input type="number" min={0} max={10} value={redFlag} onChange={(e) => setRedFlag(+e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke test + commit**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm run dev
git add app/dashboard/settings/triage/page.tsx
git commit -m "feat(ui): Triage settings page"
```

---

## Task 36: Triage tab on application drawer

**Files:**
- Modify: `components/pipeline/application-drawer.tsx`

- [ ] **Step 1: Add a Triage tab**

In the drawer's tab list, between "Info" and "Outreach", add tab `"Triage"`. Tab body:

```tsx
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EvidencePopover } from "@/components/shared/evidence-popover";

const decision = useQuery(api.triage.getByApplicationId, applicationId ? { applicationId } : "skip");
const candidate = useQuery(api.candidates.get, candidateId ? { candidateId } : "skip");

// Tab body JSX:
{decision ? (
  <div className="space-y-3 p-4">
    <div>
      <div className="text-sm text-gray-500">Outcome</div>
      <div className="font-medium">{decision.outcome}</div>
    </div>
    <div>
      <div className="text-sm text-gray-500">Score</div>
      <div className="font-medium">{decision.primaryMatchScore}/100</div>
    </div>
    <div>
      <div className="text-sm text-gray-500">Hybrid weights</div>
      <div className="text-xs">struct={decision.hybridWeights.w_struct}, sem={decision.hybridWeights.w_sem}, rules={decision.hybridWeights.w_rules}</div>
    </div>
    <div>
      <div className="text-sm text-gray-500">Reasoning</div>
      <div className="text-sm">{decision.outcomeReasoning}</div>
    </div>
    <div>
      <div className="text-sm text-gray-500">Match reasons</div>
      <ul className="list-disc list-inside text-sm">
        {decision.primaryMatchReasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
      </ul>
    </div>
    {candidate?.parsedFacets?.specializations && candidate.parsedFacets.specializations.length > 0 && (
      <div>
        <div className="text-sm text-gray-500">Specializations (click to verify)</div>
        <div className="flex flex-wrap gap-1 mt-1">
          {candidate.parsedFacets.specializations.map((s: any, i: number) => (
            <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
              <EvidencePopover value={s.value} evidence={s.evidence} />
            </span>
          ))}
        </div>
      </div>
    )}
    {decision.humanOverride && (
      <div className="text-sm bg-amber-50 p-2 rounded ring-1 ring-amber-200">
        Overridden by {decision.humanOverride.overriddenBy} ({decision.humanOverride.fromOutcome} → {decision.humanOverride.toOutcome})
      </div>
    )}
  </div>
) : (
  <div className="p-4 text-sm text-gray-500">No triage decision for this application.</div>
)}
```

- [ ] **Step 2: Smoke test + commit**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm run dev
git add components/pipeline/application-drawer.tsx
git commit -m "feat(ui): Triage tab on application drawer with evidence-click facets"
```

---

# BLOCK L — End-to-end (Tasks 37–39)

## Task 37: E2E happy path

**Files:**
- Create: `tests/e2e/triage-happy-path.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/triage-happy-path.spec.ts
import { test, expect } from "@playwright/test";

test("strong-fit careers application surfaces in Auto-Shortlisted with draft outreach", async ({ page }) => {
  // PREREQ: seed school with triageEnabled + PGT Physics open + existing test-auth fixture
  await page.goto("/careers/test-school/jobs/pgt-physics");
  await page.fill('[name="name"]', "Priya Sharma");
  await page.fill('[name="email"]', "priya@example.com");
  await page.fill('[name="phone"]', "+919876543210");
  await page.fill('[name="qualifications"]', "B.Ed, M.Sc Physics");
  await page.fill('[name="subjects"]', "Physics");
  await page.fill('[name="boardExperience"]', "CBSE");
  await page.fill('[name="yearsExperience"]', "7");
  await page.click('button[type="submit"]');
  await expect(page.locator("text=Application received")).toBeVisible({ timeout: 5000 });

  await page.goto("/dashboard/triage");
  await page.click("text=Auto-Shortlisted");
  await expect(page.locator("text=Priya Sharma").first()).toBeVisible({ timeout: 15000 });
  await page.locator("text=Show draft outreach").first().click();
  await expect(page.locator("pre").first()).toContainText(/priya/i);
});
```

- [ ] **Step 2: Run + commit**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm run test:e2e -- triage-happy-path
git add tests/e2e/triage-happy-path.spec.ts
git commit -m "test(e2e): triage happy path"
```

---

## Task 38: E2E cross-role suggestion

**Files:**
- Create: `tests/e2e/triage-cross-role.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/triage-cross-role.spec.ts
import { test, expect } from "@playwright/test";

test("applicant for one role appears as cross-role for another open role", async ({ page }) => {
  // PREREQ: school has BOTH PGT Physics and TGT Science open + triageEnabled
  await page.goto("/careers/test-school/jobs/pgt-physics");
  await page.fill('[name="name"]', "Ravi Kumar");
  await page.fill('[name="qualifications"]', "B.Ed, M.Sc Physics, B.Sc Chemistry");
  await page.fill('[name="subjects"]', "Physics, Chemistry, Biology");
  await page.fill('[name="boardExperience"]', "CBSE");
  await page.fill('[name="yearsExperience"]', "8");
  await page.click('button[type="submit"]');
  await expect(page.locator("text=Application received")).toBeVisible({ timeout: 5000 });

  await page.goto("/dashboard/triage");
  await page.click("text=Cross-Role");
  await expect(page.locator("text=Ravi Kumar").first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator("text=TGT Science").first()).toBeVisible();
});
```

- [ ] **Step 2: Run + commit**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm run test:e2e -- triage-cross-role
git add tests/e2e/triage-cross-role.spec.ts
git commit -m "test(e2e): triage cross-role suggestion"
```

---

## Task 39: Phase 1 ship gate

- [ ] **Step 1: Full vitest**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm test`
Expected: green.

- [ ] **Step 2: Full Playwright**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npm run test:e2e`
Expected: green.

- [ ] **Step 3: Typecheck + Convex dev push**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && npx tsc --noEmit -p tsconfig.json && npx convex dev --once`
Expected: clean.

- [ ] **Step 4: Tag**

```bash
git tag phase-1-shipped
```

Phase 1 is shippable. Phase 2 (Dynamic Facet Promotion) and Phase 3 (Knowledge Graph) get their own implementation plans.

---

## Operational Notes

**Outreach sender worker (out-of-scope for this plan):** Drafts with `status="scheduled"` and `scheduledSendAt < now` must be picked up by a worker (Convex cron every minute, query `by_status_scheduledSendAt`) and actually sent via existing `whatsapp.ts` / `resend.ts` paths. **File a follow-up** if not already done.

**Embedding provider swap:** Set `OPENAI_API_KEY` in production; leave `EMBEDDING_PROVIDER` unset (auto-detects). To swap providers later, edit `convex/embeddings.ts:openaiEmbedSingle`/`openaiEmbedBatch` and bump `EMBEDDING_VERSION` in `convex/versions.ts` — `backfill.runBackfillBatch` will re-embed everything on the next cron tick.

**v1 vector search:** Stage 1 (hard filter) returns ≤200 candidates; Stage 2 cosine math runs in-memory across them. This is fine to ~10K candidates per school. When pools grow beyond, swap the cosine sweep for `ctx.vectorSearch` against the per-facet `vectorIndex` declared in the schema — drop-in change.

**Cost telemetry (deferred):** Add a `llmCallLog` table after Phase 1 ships to track per-school spend.

---

## Self-Review Checklist (Run Before Handoff)

- [ ] Every Phase 1 spec section has at least one task implementing it
- [ ] Evidence-grounding rule enforced by `evidenceValidator.ts` + intake retry-once
- [ ] All five facet embeddings computed in one batched call via `embedBatch`
- [ ] Five `vectorIndex` declarations on `candidates.facetEmbeddings.*`
- [ ] `jobPostings.roleEmbeddings` computed on every create/edit via scheduled action
- [ ] Hybrid scoring uses `DEFAULT_HYBRID_WEIGHTS` from `convex/types.ts` and snapshots into `triageDecisions.hybridWeights`
- [ ] No "TBD", "TODO", "etc." in any step
- [ ] All types (`Evidence`, `FacetValue`, `ParsedProfile`, `ParsedFacets`, `RawChunk`, `FacetEmbeddings`, `RoleEmbeddings`, `HybridWeights`) defined in `convex/types.ts` (Task 2) and referenced consistently
- [ ] All new convex modules added to relevant test `modules` map
- [ ] All new fields on existing tables are `v.optional` (existing rows must still validate)
- [ ] Outreach drafts have a clear path: `draft_pending_approval` → `scheduled` → `sent` (last hop is the deferred sender worker)
- [ ] `EMBEDDING_DIMS = 1536` is the only place dimensionality is hardcoded
