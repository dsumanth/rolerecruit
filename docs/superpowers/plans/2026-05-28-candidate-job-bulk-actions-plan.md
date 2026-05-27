# Candidate & Job Bulk Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the candidate & job management feature set from `docs/superpowers/specs/2026-05-28-candidate-job-bulk-actions-design.md`: cascading candidate delete, NL criteria textarea, multi-select with bulk actions across three list views, 10-second undo for destructive actions, cursor pagination with "select all matching" mode, and rejection-history surfacing in pipeline rows.

**Architecture:** Two cross-cutting infrastructure pieces (pagination + undo) go in first. Then the multi-select primitive that consumes both. Then the feature work layers on top: candidate delete, pipeline/talent/jobs bulk actions, criteria UX, rejection history. Each phase ends in a working, committable state.

**Tech Stack:** Next.js 14 (App Router), Convex (database + paginated queries + scheduler), TypeScript (strict), Vitest + `convex-test` for backend tests, `@testing-library/react` for component tests, tanstack-virtual for virtualization.

---

## How to work this plan

- One task = one logical unit producing a commit. Steps within a task are 2–5 minute actions.
- Write failing tests first when a task touches business logic (mutations, hooks, util functions). Pure UI cosmetics may skip the test step where noted.
- Run `pnpm test` after each implementation step to ensure nothing regresses. Run `pnpm lint` before committing.
- Convex test scheduler: use `await t.finishInProgressScheduledFunctions()` to fast-forward queued actions in tests.
- This plan assumes the engineer can read `docs/superpowers/specs/2026-05-28-candidate-job-bulk-actions-design.md` for design rationale.

### Important: matchAll filter handling

Several bulk mutations (Tasks 6.1, 7.1, 7.2, 9.1, 9.2) accept a `matchAll` shape that resolves a filter into a set of IDs server-side. The plan shows a simplified resolver that walks *all* in-scope rows. **The engineer must replicate the same filter logic used by the listing query** (e.g., `candidates.listForSchool` from Task 3.1) — search string match, pool membership, stage filter, etc. The simplified resolver is a starting point, not the final implementation. When implementing each `matchAll` branch, copy the per-row filter predicate from the listing query verbatim, then collect the resulting IDs.

## Reference: common patterns

These appear in many tasks. Copy verbatim where referenced.

### Convex test setup boilerplate

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as users from "../../convex/users";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as jobs from "../../convex/jobs";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "users.ts": async () => users,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "jobs.ts": async () => jobs,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

async function seed(t: ReturnType<typeof convexTest>) {
  const schoolId = await t.mutation("schools:create", {
    name: "Test School", board: "CBSE", city: "Mumbai", state: "MH",
  });
  return { schoolId };
}
```

Add to `modules` any new convex module file you create.

### React component test boilerplate

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
```

### Commit message convention

Matches existing repo style — see `git log --oneline -10`. Examples:
- `feat(candidates): add cascading delete with 10s undo`
- `refactor(candidates): paginate listForSchool`
- `fix(pipeline): clear selection on filter change`

---

## File inventory

### New files

| Path | Purpose |
|---|---|
| `hooks/use-table-selection.ts` | Multi-select hook (ids + all-matching modes; shift-click range). |
| `hooks/use-undo-toast.ts` | Toast queue + countdown + dismiss state. |
| `hooks/use-infinite-scroll.ts` | Intersection-observer that calls `loadMore` near the end. |
| `components/ui/bulk-action-bar.tsx` | Sticky-bottom action bar visible when count > 0. |
| `components/ui/select-all-matching-banner.tsx` | "Select all N matching" banner above the action bar. |
| `components/ui/confirm-dialog.tsx` | Destructive/neutral confirm modal. |
| `components/ui/undo-toast.tsx` | Toast with countdown bar + Undo button. |
| `components/criteria/CriteriaNaturalLanguageEditor.tsx` | NL textarea with autosave. |
| `components/pipeline/rejection-history-indicator.tsx` | Inline row badge "N prior rejects". |
| `components/pipeline/previous-outcomes-section.tsx` | Drawer section listing prior rejections + eval notes. |
| `lib/csv-export.ts` | Rows + column config → browser download. |
| `lib/bulk-input.ts` | Shared TS types: `BulkInput<F>` + per-table filter shapes. |

### Modified files

| Path | What changes |
|---|---|
| `convex/schema.ts` | New fields + indexes (Phase 1). |
| `convex/candidates.ts` | Paginate `listForSchool`, add `countForSchool`, `remove`, `removeMany`, `undoBatchDelete`, `getRejectionHistory`, internal `finalizeBatchDelete`. Filter `pendingDeleteAt` from reads. |
| `convex/applications.ts` | Paginate `getPipelineForJob` (+ `priorRejectCount`), add `countForJob`, `removeManyApplications`, `undoBatchDelete`, `bulkSetStage`, internal `finalizeBatchDelete`. Filter `pendingDeleteAt`. |
| `convex/jobs.ts` | Paginate `listBySchool`, add `countBySchool`, `removeMany` (draft-only), `undoBatchDelete`, `bulkSetStatus`, `saveCriteriaText`, internal `finalizeBatchDelete`. Filter `pendingDeleteAt`. |
| `app/dashboard/jobs/[id]/criteria/page.tsx` | Restructure to NL + structured. |
| `app/dashboard/jobs/[id]/pipeline/page.tsx` | Paginated query; bulk actions. |
| `app/dashboard/pipeline/pipeline-list.tsx` | Same. |
| `app/dashboard/jobs/page.tsx` | Paginated; bulk actions. |
| `app/dashboard/talent/page.tsx` | Paginated; bulk actions. |
| `components/talent/talent-controls.tsx` | Controlled inputs emit filter/sort to the page. |
| `components/pipeline/application-table.tsx` | Checkbox column + selection highlight + prior-reject badge + intersection observer. |
| `components/pipeline/application-drawer.tsx` | "Delete candidate" button + "Previous outcomes" section. |
| `components/jobs/jobs-list.tsx` | Per-card checkbox + selection highlight + intersection observer. |

### Removed files

| Path | Reason |
|---|---|
| `components/criteria/AISuggestedCriteria.tsx` | Folded into the criteria page header + structured editor. |

---

# PHASE 1 — Schema foundation

Schema changes are cheap and unblock every phase that follows. Land them first so Convex can rebuild indexes in parallel with the rest of the work.

## Task 1.1 — Add `pendingDeleteAt` + `pendingDeleteBatchId` to three tables

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Find the `candidates` table definition (around line 194)** and add two optional fields to its schema object:

```ts
// inside candidates: defineTable({ ... }):
pendingDeleteAt: v.optional(v.number()),
pendingDeleteBatchId: v.optional(v.string()),
```

- [ ] **Step 2: Find the `applications` table (around line 320)** and add the same two fields inside its `defineTable({...})` object.

- [ ] **Step 3: Find the `jobPostings` table (around line 117)** and add the same two fields inside its `defineTable({...})` object.

- [ ] **Step 4: Run typecheck via the dev server**

```bash
pnpm dlx convex dev --once --typecheck=enable
```

Expected: succeeds with no validator errors. (If you don't have a Convex dev deployment set up locally, run `pnpm build` and verify the Next.js typecheck passes.)

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): pendingDelete fields on candidates/applications/jobPostings"
```

## Task 1.2 — Add `by_applicationId` index to `bookingTokens`

**Files:**
- Modify: `convex/schema.ts:466-472`

- [ ] **Step 1: Update `bookingTokens` indexes.** Find the existing `.index("by_token", ["token"])` and add a second index:

```ts
bookingTokens: defineTable({
  token: v.string(),
  applicationId: v.id("applications"),
  schoolId: v.id("schools"),
  expiresAt: v.number(),
  used: v.boolean(),
})
  .index("by_token", ["token"])
  .index("by_applicationId", ["applicationId"]),
```

- [ ] **Step 2: Verify by running typecheck or `pnpm dlx convex dev --once`.**

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): by_applicationId index on bookingTokens for cascade cleanup"
```

## Task 1.3 — Add sort indexes for pagination

**Files:**
- Modify: `convex/schema.ts`

These indexes back the server-side sort options described in Section 1 of the spec. Each one allows `paginate()` to walk rows in sort order without a full scan.

- [ ] **Step 1: Add `by_schoolId_aiMatchScore` and `by_jobPostingId_aiMatchScore` to `applications`.** The applications table already has indexes; add at the end of its `.index(...)` chain:

```ts
.index("by_schoolId_aiMatchScore", ["schoolId", "aiMatchScore"])
.index("by_jobPostingId_aiMatchScore", ["jobPostingId", "aiMatchScore"])
```

- [ ] **Step 2: Add `by_schoolId_title` to `jobPostings`.** Append to its index chain:

```ts
.index("by_schoolId_title", ["schoolId", "title"])
```

- [ ] **Step 3: Verify the schema compiles with `pnpm dlx convex dev --once`.**

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): sort indexes for paginated listings"
```

---

# PHASE 2 — Shared TS types

A tiny phase that defines the discriminated-union shapes used by every bulk mutation and the multi-select hook. Landing this first means later tasks can import directly.

## Task 2.1 — Define `BulkInput<F>` and filter shapes

**Files:**
- Create: `lib/bulk-input.ts`
- Test: `tests/lib/bulk-input.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/bulk-input.test.ts
import { describe, it, expect } from "vitest";
import { isIdsMode, isMatchAllMode, type BulkInput } from "../../lib/bulk-input";

describe("BulkInput discriminators", () => {
  it("isIdsMode identifies the ids shape", () => {
    const a: BulkInput<{}> = { ids: ["a", "b"] };
    expect(isIdsMode(a)).toBe(true);
    expect(isMatchAllMode(a)).toBe(false);
  });

  it("isMatchAllMode identifies the matchAll shape", () => {
    const a: BulkInput<{ schoolId: string }> = { matchAll: { schoolId: "s1" } };
    expect(isIdsMode(a)).toBe(false);
    expect(isMatchAllMode(a)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL** (`Cannot find module`).

```bash
pnpm test tests/lib/bulk-input.test.ts
```

- [ ] **Step 3: Create `lib/bulk-input.ts`**

```ts
import type { Id } from "@/convex/_generated/dataModel";

export type BulkInput<F> = { ids: string[] } | { matchAll: F };

export function isIdsMode<F>(x: BulkInput<F>): x is { ids: string[] } {
  return Object.prototype.hasOwnProperty.call(x, "ids");
}

export function isMatchAllMode<F>(x: BulkInput<F>): x is { matchAll: F } {
  return Object.prototype.hasOwnProperty.call(x, "matchAll");
}

// Per-table filter shapes used both by Convex queries (validated) and by client code.
export type TalentFilter = {
  poolId?: Id<"pools"> | "all";
  stages?: string[];
  search?: string;
};

export type PipelineFilter = {
  stage?: string;
  search?: string;
};

export type JobFilter = {
  status?: "draft" | "active" | "paused" | "filled" | "closed";
  search?: string;
};

export type CandidateSort = "newest" | "score" | "name";
export type ApplicationSort = "newest" | "score" | "name";
export type JobSort = "newest" | "title";
```

- [ ] **Step 4: Run the test, expect PASS.**

```bash
pnpm test tests/lib/bulk-input.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/bulk-input.ts tests/lib/bulk-input.test.ts
git commit -m "feat(lib): BulkInput<F> discriminated union + per-table filter types"
```

---

# PHASE 3 — Paginate Convex queries + count queries

Refactor the three list queries to use `paginate()` and accept server-side filter/sort args. Add a corresponding `count*` query for each that runs the same filter and returns just a number. All queries also begin filtering out `pendingDeleteAt != null` rows.

## Task 3.1 — Paginate `candidates.listForSchool`

**Files:**
- Modify: `convex/candidates.ts` (the existing `listForSchool` at line 69)
- Test: `tests/convex/candidates-list.test.ts` (new)

The talent bank rows are actually applications-without-job. We keep that shape (one row per application that joins candidate data) but paginate the underlying applications query.

- [ ] **Step 1: Write the failing test**

```ts
// tests/convex/candidates-list.test.ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
// ...same modules import block as in tests/convex/users.test.ts...
// (include candidates, applications, schools, etc.)

describe("candidates.listForSchool — paginated", () => {
  it("returns a page + isDone + continueCursor", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "M", state: "MH",
    });
    // seed 3 candidates with applications
    for (let i = 0; i < 3; i++) {
      const candidateId = await t.mutation("candidates:create", {
        name: `Cand ${i}`, email: `c${i}@x.com`,
      });
      await t.mutation("applications:create", {
        candidateId, schoolId, stage: "applied",
      });
    }
    const result = await t.query("candidates:listForSchool", {
      schoolId,
      paginationOpts: { cursor: null, numItems: 2 },
    });
    expect(result.page.length).toBe(2);
    expect(result.isDone).toBe(false);
    expect(typeof result.continueCursor).toBe("string");
  });

  it("excludes rows with pendingDeleteAt set", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "M", state: "MH",
    });
    const candidateId = await t.mutation("candidates:create", {
      name: "Cand", email: "c@x.com",
    });
    const appId = await t.mutation("applications:create", {
      candidateId, schoolId, stage: "applied",
    });
    // Mark pending — simulate what removeManyApplications would do.
    await t.run(async (ctx) => {
      await ctx.db.patch(appId, { pendingDeleteAt: Date.now(), pendingDeleteBatchId: "b" });
    });
    const result = await t.query("candidates:listForSchool", {
      schoolId,
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(result.page.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test, expect FAIL** (`paginationOpts` arg unknown / not paginated).

```bash
pnpm test tests/convex/candidates-list.test.ts
```

- [ ] **Step 3: Rewrite `listForSchool` in `convex/candidates.ts`**

```ts
import { paginationOptsValidator } from "convex/server";

export const listForSchool = query({
  args: {
    schoolId: v.id("schools"),
    paginationOpts: paginationOptsValidator,
    filter: v.optional(v.object({
      poolId: v.optional(v.union(v.id("pools"), v.literal("all"))),
      stages: v.optional(v.array(v.string())),
      search: v.optional(v.string()),
    })),
    sort: v.optional(v.union(
      v.literal("newest"), v.literal("score"), v.literal("name"),
    )),
  },
  handler: async (ctx, args) => {
    // Choose an index based on sort. For non-newest sorts on a schoolId scope,
    // we use a compound index. Default order on by_schoolId is _creationTime desc.
    const indexName =
      args.sort === "score" ? "by_schoolId_aiMatchScore"
      : "by_schoolId";

    const builder = ctx.db
      .query("applications")
      .withIndex(indexName, (q) => q.eq("schoolId", args.schoolId));

    // pendingDeleteAt filter + stage filter (applied to the index walk via filter())
    const filtered = builder.filter((q) => {
      let expr = q.eq(q.field("pendingDeleteAt"), undefined);
      if (args.filter?.stages && args.filter.stages.length > 0) {
        const stageExprs = args.filter.stages.map((s) => q.eq(q.field("stage"), s));
        expr = q.and(expr, q.or(...stageExprs));
      }
      return expr;
    });

    // Walk pages.
    const ordered = args.sort === "score" ? filtered.order("desc") : filtered.order("desc");
    const result = await ordered.paginate(args.paginationOpts);

    // Join candidate data; apply remaining client-style filters that can't
    // be expressed in the index (poolId via candidatePools, name search).
    const enriched: any[] = [];
    for (const app of result.page) {
      const candidate = await ctx.db.get(app.candidateId);
      if (!candidate) continue;
      if (candidate.pendingDeleteAt != null) continue;

      if (args.filter?.search) {
        const s = args.filter.search.toLowerCase();
        const haystack = `${candidate.name ?? ""} ${candidate.email ?? ""}`.toLowerCase();
        if (!haystack.includes(s)) continue;
      }

      if (args.filter?.poolId && args.filter.poolId !== "all") {
        const poolMember = await ctx.db
          .query("candidatePools")
          .withIndex("by_candidateId", (q) => q.eq("candidateId", candidate._id))
          .filter((q) => q.eq(q.field("poolId"), args.filter!.poolId))
          .first();
        if (!poolMember) continue;
      }

      enriched.push({
        applicationId: app._id,
        candidateId: candidate._id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        stage: app.stage,
        aiMatchScore: app.aiMatchScore,
        subjects: candidate.subjects ?? [],
        yearsExperience: candidate.yearsExperience,
        location: candidate.location,
        sourceChannel: candidate.sourceChannel,
        createdAt: app._creationTime,
      });
    }

    return {
      page: enriched,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
```

- [ ] **Step 4: Run the test, expect PASS.**

```bash
pnpm test tests/convex/candidates-list.test.ts
```

If callers of the old signature break the build (`tsc`/`pnpm build`), note them — they'll be fixed when the UI pages are updated (Phase 5). Tests pass means the contract is right.

- [ ] **Step 5: Commit**

```bash
git add convex/candidates.ts tests/convex/candidates-list.test.ts
git commit -m "refactor(candidates): paginate listForSchool with filter/sort + pendingDelete filter"
```

## Task 3.2 — Add `candidates.countForSchool`

**Files:**
- Modify: `convex/candidates.ts`
- Test: `tests/convex/candidates-list.test.ts` (extend)

- [ ] **Step 1: Add a test**

```ts
it("countForSchool returns total matching", async () => {
  const t = convexTest(schema, modules);
  const schoolId = await t.mutation("schools:create", {
    name: "S", board: "CBSE", city: "M", state: "MH",
  });
  for (let i = 0; i < 5; i++) {
    const candidateId = await t.mutation("candidates:create", {
      name: `Cand ${i}`, email: `c${i}@x.com`,
    });
    await t.mutation("applications:create", { candidateId, schoolId, stage: "applied" });
  }
  const total = await t.query("candidates:countForSchool", { schoolId });
  expect(total.total).toBe(5);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement in `convex/candidates.ts`**

```ts
export const countForSchool = query({
  args: {
    schoolId: v.id("schools"),
    filter: v.optional(v.object({
      poolId: v.optional(v.union(v.id("pools"), v.literal("all"))),
      stages: v.optional(v.array(v.string())),
      search: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.eq(q.field("pendingDeleteAt"), undefined))
      .collect();
    let total = 0;
    for (const app of apps) {
      if (args.filter?.stages && args.filter.stages.length > 0
          && !args.filter.stages.includes(app.stage)) continue;
      const cand = await ctx.db.get(app.candidateId);
      if (!cand || cand.pendingDeleteAt != null) continue;
      if (args.filter?.search) {
        const s = args.filter.search.toLowerCase();
        const hay = `${cand.name ?? ""} ${cand.email ?? ""}`.toLowerCase();
        if (!hay.includes(s)) continue;
      }
      if (args.filter?.poolId && args.filter.poolId !== "all") {
        const member = await ctx.db
          .query("candidatePools")
          .withIndex("by_candidateId", (q) => q.eq("candidateId", cand._id))
          .filter((q) => q.eq(q.field("poolId"), args.filter!.poolId))
          .first();
        if (!member) continue;
      }
      total++;
    }
    return { total };
  },
});
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add convex/candidates.ts tests/convex/candidates-list.test.ts
git commit -m "feat(candidates): countForSchool for matchAll banner"
```

## Task 3.3 — Paginate `applications.getPipelineForJob`

**Files:**
- Modify: `convex/applications.ts` (existing query at line 167)
- Test: `tests/convex/applications-pipeline.test.ts` (new)

The query keeps its shape but adopts the same paginationOpts + filter + sort pattern. It also stops returning rows where `pendingDeleteAt` is set.

- [ ] **Step 1: Write the failing test**

```ts
// tests/convex/applications-pipeline.test.ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
// ...same modules block...

describe("applications.getPipelineForJob — paginated", () => {
  it("returns paginated rows and excludes pending-delete", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "M", state: "MH",
    });
    const jobId = await t.mutation("jobs:create", {
      schoolId, title: "Math PGT", subject: "Math", level: "PGT",
      board: "CBSE", qualifications: [], minExperience: 0, positions: 1,
      naturalLanguageDescription: "x",
    });
    for (let i = 0; i < 3; i++) {
      const candId = await t.mutation("candidates:create", {
        name: `C${i}`, email: `c${i}@x.com`,
      });
      await t.mutation("applications:create", {
        candidateId: candId, schoolId, jobPostingId: jobId, stage: "applied",
      });
    }
    const result = await t.query("applications:getPipelineForJob", {
      jobId,
      paginationOpts: { cursor: null, numItems: 2 },
    });
    expect(result.page.length).toBe(2);
    expect(result.isDone).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Rewrite `getPipelineForJob` in `convex/applications.ts`**

```ts
import { paginationOptsValidator } from "convex/server";

export const getPipelineForJob = query({
  args: {
    jobId: v.id("jobPostings"),
    paginationOpts: paginationOptsValidator,
    filter: v.optional(v.object({
      stage: v.optional(v.string()),
      search: v.optional(v.string()),
    })),
    sort: v.optional(v.union(
      v.literal("newest"), v.literal("score"), v.literal("name"),
    )),
  },
  handler: async (ctx, args) => {
    const indexName = args.sort === "score" ? "by_jobPostingId_aiMatchScore" : "by_jobPostingId";
    const builder = ctx.db
      .query("applications")
      .withIndex(indexName, (q) => q.eq("jobPostingId", args.jobId));

    const filtered = builder.filter((q) => {
      let expr = q.eq(q.field("pendingDeleteAt"), undefined);
      if (args.filter?.stage) {
        expr = q.and(expr, q.eq(q.field("stage"), args.filter.stage));
      }
      return expr;
    });

    const result = await filtered.order("desc").paginate(args.paginationOpts);

    const enriched: any[] = [];
    for (const app of result.page) {
      const candidate = await ctx.db.get(app.candidateId);
      if (!candidate || candidate.pendingDeleteAt != null) continue;
      if (args.filter?.search) {
        const s = args.filter.search.toLowerCase();
        const hay = `${candidate.name ?? ""} ${candidate.email ?? ""}`.toLowerCase();
        if (!hay.includes(s)) continue;
      }
      enriched.push({
        applicationId: app._id,
        candidateId: candidate._id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        stage: app.stage,
        aiMatchScore: app.aiMatchScore,
        subjects: candidate.subjects ?? [],
        yearsExperience: candidate.yearsExperience,
        location: candidate.location,
        createdAt: app._creationTime,
      });
    }

    return { page: enriched, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add convex/applications.ts tests/convex/applications-pipeline.test.ts
git commit -m "refactor(applications): paginate getPipelineForJob"
```

## Task 3.4 — Add `applications.countForJob`

**Files:**
- Modify: `convex/applications.ts`
- Test: `tests/convex/applications-pipeline.test.ts` (extend)

- [ ] **Step 1: Add a test**

```ts
it("countForJob returns total matching", async () => {
  const t = convexTest(schema, modules);
  const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
  const jobId = await t.mutation("jobs:create", {
    schoolId, title: "T", subject: "S", level: "PGT", board: "CBSE",
    qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
  });
  for (let i = 0; i < 4; i++) {
    const cId = await t.mutation("candidates:create", { name: `c${i}`, email: `${i}@x.com` });
    await t.mutation("applications:create", { candidateId: cId, schoolId, jobPostingId: jobId, stage: "applied" });
  }
  const r = await t.query("applications:countForJob", { jobId });
  expect(r.total).toBe(4);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
export const countForJob = query({
  args: {
    jobId: v.id("jobPostings"),
    filter: v.optional(v.object({
      stage: v.optional(v.string()),
      search: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_jobPostingId", (q) => q.eq("jobPostingId", args.jobId))
      .filter((q) => q.eq(q.field("pendingDeleteAt"), undefined))
      .collect();
    let total = 0;
    for (const app of apps) {
      if (args.filter?.stage && app.stage !== args.filter.stage) continue;
      const cand = await ctx.db.get(app.candidateId);
      if (!cand || cand.pendingDeleteAt != null) continue;
      if (args.filter?.search) {
        const s = args.filter.search.toLowerCase();
        const hay = `${cand.name ?? ""} ${cand.email ?? ""}`.toLowerCase();
        if (!hay.includes(s)) continue;
      }
      total++;
    }
    return { total };
  },
});
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add convex/applications.ts tests/convex/applications-pipeline.test.ts
git commit -m "feat(applications): countForJob for matchAll banner"
```

## Task 3.5 — Paginate `jobs.listBySchool`

**Files:**
- Modify: `convex/jobs.ts` (existing query at line 148)
- Test: `tests/convex/jobs-list.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// tests/convex/jobs-list.test.ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
// ...modules block...

describe("jobs.listBySchool — paginated", () => {
  it("returns paginated rows", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
    for (let i = 0; i < 3; i++) {
      await t.mutation("jobs:create", {
        schoolId, title: `Job ${i}`, subject: "Math", level: "PGT", board: "CBSE",
        qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
      });
    }
    const r = await t.query("jobs:listBySchool", {
      schoolId, paginationOpts: { cursor: null, numItems: 2 },
    });
    expect(r.page.length).toBe(2);
    expect(r.isDone).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Rewrite `listBySchool`**

```ts
import { paginationOptsValidator } from "convex/server";

export const listBySchool = query({
  args: {
    schoolId: v.id("schools"),
    paginationOpts: paginationOptsValidator,
    filter: v.optional(v.object({
      status: v.optional(v.union(
        v.literal("draft"), v.literal("active"), v.literal("paused"),
        v.literal("filled"), v.literal("closed"),
      )),
      search: v.optional(v.string()),
    })),
    sort: v.optional(v.union(v.literal("newest"), v.literal("title"))),
  },
  handler: async (ctx, args) => {
    const indexName = args.sort === "title" ? "by_schoolId_title" : "by_schoolId";
    const builder = ctx.db.query("jobPostings").withIndex(indexName, (q) => q.eq("schoolId", args.schoolId));
    const filtered = builder.filter((q) => {
      let expr = q.eq(q.field("pendingDeleteAt"), undefined);
      if (args.filter?.status) expr = q.and(expr, q.eq(q.field("status"), args.filter.status));
      return expr;
    });
    const ordered = args.sort === "title" ? filtered.order("asc") : filtered.order("desc");
    const result = await ordered.paginate(args.paginationOpts);

    let page = result.page;
    if (args.filter?.search) {
      const s = args.filter.search.toLowerCase();
      page = page.filter((j) => (j.title ?? "").toLowerCase().includes(s));
    }
    return { page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add convex/jobs.ts tests/convex/jobs-list.test.ts
git commit -m "refactor(jobs): paginate listBySchool"
```

## Task 3.6 — Add `jobs.countBySchool`

**Files:**
- Modify: `convex/jobs.ts`
- Test: `tests/convex/jobs-list.test.ts` (extend)

- [ ] **Step 1: Add a test**

```ts
it("countBySchool returns total matching", async () => {
  const t = convexTest(schema, modules);
  const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
  for (let i = 0; i < 3; i++) {
    await t.mutation("jobs:create", {
      schoolId, title: `J ${i}`, subject: "M", level: "PGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
  }
  const r = await t.query("jobs:countBySchool", { schoolId });
  expect(r.total).toBe(3);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
export const countBySchool = query({
  args: {
    schoolId: v.id("schools"),
    filter: v.optional(v.object({
      status: v.optional(v.union(
        v.literal("draft"), v.literal("active"), v.literal("paused"),
        v.literal("filled"), v.literal("closed"),
      )),
      search: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("jobPostings").withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.eq(q.field("pendingDeleteAt"), undefined));
    if (args.filter?.status) q = q.filter((qb) => qb.eq(qb.field("status"), args.filter!.status));
    const rows = await q.collect();
    let filtered = rows;
    if (args.filter?.search) {
      const s = args.filter.search.toLowerCase();
      filtered = filtered.filter((j) => (j.title ?? "").toLowerCase().includes(s));
    }
    return { total: filtered.length };
  },
});
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add convex/jobs.ts tests/convex/jobs-list.test.ts
git commit -m "feat(jobs): countBySchool for matchAll banner"
```

---

# PHASE 4 — Hooks & UI primitives (no business wiring yet)

Build the three hooks and four UI components that the bulk-action and pagination UX consume. These have no Convex dependency; they're pure UI plumbing.

## Task 4.1 — `useTableSelection` (ids + all-matching modes)

**Files:**
- Create: `hooks/use-table-selection.ts`
- Test: `tests/hooks/use-table-selection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/hooks/use-table-selection.test.ts
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTableSelection } from "../../hooks/use-table-selection";

describe("useTableSelection", () => {
  it("starts empty in ids mode", () => {
    const { result } = renderHook(() => useTableSelection<string, {}>());
    expect(result.current.mode.kind).toBe("ids");
    expect(result.current.count).toEqual({ kind: "ids", n: 0 });
  });

  it("toggles single ids and counts", () => {
    const { result } = renderHook(() => useTableSelection<string, {}>());
    act(() => { result.current.setLoadedIds(["a", "b", "c"]); });
    act(() => { result.current.toggle("a"); });
    act(() => { result.current.toggle("c"); });
    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.isSelected("b")).toBe(false);
    expect(result.current.count).toEqual({ kind: "ids", n: 2 });
  });

  it("shift-click selects a range over loaded ids", () => {
    const { result } = renderHook(() => useTableSelection<string, {}>());
    act(() => { result.current.setLoadedIds(["a", "b", "c", "d", "e"]); });
    act(() => { result.current.toggle("b"); });
    act(() => { result.current.toggle("d", true); });
    expect(result.current.isSelected("b")).toBe(true);
    expect(result.current.isSelected("c")).toBe(true);
    expect(result.current.isSelected("d")).toBe(true);
    expect(result.current.isSelected("a")).toBe(false);
  });

  it("toggleAllLoaded selects all then deselects", () => {
    const { result } = renderHook(() => useTableSelection<string, {}>());
    act(() => { result.current.setLoadedIds(["a", "b", "c"]); });
    act(() => { result.current.toggleAllLoaded(["a", "b", "c"]); });
    expect(result.current.count).toEqual({ kind: "ids", n: 3 });
    act(() => { result.current.toggleAllLoaded(["a", "b", "c"]); });
    expect(result.current.count).toEqual({ kind: "ids", n: 0 });
  });

  it("selectAllMatching switches to all-matching mode", () => {
    const { result } = renderHook(() => useTableSelection<string, { schoolId: string }>());
    act(() => { result.current.selectAllMatching({ schoolId: "s1" }); });
    expect(result.current.mode.kind).toBe("all-matching");
    expect(result.current.isSelected("any-id")).toBe(true);
  });

  it("toggle from all-matching mode returns to ids", () => {
    const { result } = renderHook(() => useTableSelection<string, {}>());
    act(() => { result.current.setLoadedIds(["a", "b"]); });
    act(() => { result.current.selectAllMatching({}); });
    act(() => { result.current.toggle("a"); });
    expect(result.current.mode.kind).toBe("ids");
  });

  it("clear returns to empty ids mode", () => {
    const { result } = renderHook(() => useTableSelection<string, {}>());
    act(() => { result.current.selectAllMatching({}); });
    act(() => { result.current.clear(); });
    expect(result.current.mode.kind).toBe("ids");
    expect(result.current.count).toEqual({ kind: "ids", n: 0 });
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// hooks/use-table-selection.ts
import { useCallback, useRef, useState } from "react";

export type SelectionMode<F> =
  | { kind: "ids"; selected: Set<string> }
  | { kind: "all-matching"; filter: F };

export interface UseTableSelectionResult<Id extends string, F> {
  mode: SelectionMode<F>;
  isSelected: (id: Id) => boolean;
  setLoadedIds: (ids: Id[]) => void;
  toggle: (id: Id, shiftKey?: boolean) => void;
  toggleAllLoaded: (ids: Id[]) => void;
  selectAllMatching: (filter: F) => void;
  clear: () => void;
  count: { kind: "ids"; n: number } | { kind: "all-matching"; n: number };
}

export function useTableSelection<Id extends string, F>(): UseTableSelectionResult<Id, F> {
  const [mode, setMode] = useState<SelectionMode<F>>({ kind: "ids", selected: new Set() });
  const loadedIdsRef = useRef<Id[]>([]);
  const lastToggledRef = useRef<Id | null>(null);

  const setLoadedIds = useCallback((ids: Id[]) => {
    loadedIdsRef.current = ids;
  }, []);

  const isSelected = useCallback(
    (id: Id) => mode.kind === "all-matching" ? true : mode.selected.has(id),
    [mode],
  );

  const toggle = useCallback((id: Id, shiftKey = false) => {
    setMode((prev) => {
      const base = prev.kind === "ids" ? new Set(prev.selected) : new Set<string>();
      if (shiftKey && lastToggledRef.current && loadedIdsRef.current.length > 0) {
        const all = loadedIdsRef.current;
        const a = all.indexOf(lastToggledRef.current);
        const b = all.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) base.add(all[i]);
          return { kind: "ids", selected: base };
        }
      }
      if (base.has(id)) base.delete(id);
      else base.add(id);
      lastToggledRef.current = id;
      return { kind: "ids", selected: base };
    });
  }, []);

  const toggleAllLoaded = useCallback((ids: Id[]) => {
    setMode((prev) => {
      const base = prev.kind === "ids" ? new Set(prev.selected) : new Set<string>();
      const allSelected = ids.every((id) => base.has(id));
      if (allSelected) ids.forEach((id) => base.delete(id));
      else ids.forEach((id) => base.add(id));
      return { kind: "ids", selected: base };
    });
  }, []);

  const selectAllMatching = useCallback((filter: F) => {
    setMode({ kind: "all-matching", filter });
  }, []);

  const clear = useCallback(() => {
    setMode({ kind: "ids", selected: new Set() });
    lastToggledRef.current = null;
  }, []);

  const count = mode.kind === "ids"
    ? { kind: "ids" as const, n: mode.selected.size }
    : { kind: "all-matching" as const, n: -1 }; // -1 means "use the count query"

  return { mode, isSelected, setLoadedIds, toggle, toggleAllLoaded, selectAllMatching, clear, count };
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add hooks/use-table-selection.ts tests/hooks/use-table-selection.test.ts
git commit -m "feat(hooks): useTableSelection with ids + all-matching modes"
```

## Task 4.2 — `useInfiniteScroll`

**Files:**
- Create: `hooks/use-infinite-scroll.ts`
- Test: `tests/hooks/use-infinite-scroll.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/hooks/use-infinite-scroll.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInfiniteScroll } from "../../hooks/use-infinite-scroll";

describe("useInfiniteScroll", () => {
  it("returns a ref and does not call loadMore by default", () => {
    const loadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({ status: "CanLoadMore", loadMore })
    );
    expect(typeof result.current).toBe("function"); // ref callback
    expect(loadMore).not.toHaveBeenCalled();
  });

  it("does not load when status is Exhausted", () => {
    const loadMore = vi.fn();
    renderHook(() =>
      useInfiniteScroll({ status: "Exhausted", loadMore })
    );
    expect(loadMore).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// hooks/use-infinite-scroll.ts
import { useCallback, useEffect, useRef } from "react";

type PaginationStatus = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";

interface Params {
  status: PaginationStatus;
  loadMore: (n: number) => void;
  loadCount?: number; // how many to fetch per trigger
}

export function useInfiniteScroll({ status, loadMore, loadCount = 100 }: Params) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setSentinel = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node) return;
    observerRef.current = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && status === "CanLoadMore") {
          loadMore(loadCount);
        }
      }
    }, { rootMargin: "200px" });
    observerRef.current.observe(node);
  }, [status, loadMore, loadCount]);

  useEffect(() => {
    return () => { observerRef.current?.disconnect(); };
  }, []);

  return setSentinel;
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add hooks/use-infinite-scroll.ts tests/hooks/use-infinite-scroll.test.ts
git commit -m "feat(hooks): useInfiniteScroll with intersection observer"
```

## Task 4.3 — `useUndoToast`

**Files:**
- Create: `hooks/use-undo-toast.ts`
- Test: `tests/hooks/use-undo-toast.test.ts`

The hook owns a small in-memory queue of toasts. Each toast has a label, an onUndo callback, and a TTL countdown that auto-dismisses.

- [ ] **Step 1: Write the failing test**

```ts
// tests/hooks/use-undo-toast.test.ts
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoToast } from "../../hooks/use-undo-toast";

describe("useUndoToast", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("shows a toast and auto-dismisses after the TTL", () => {
    const { result } = renderHook(() => useUndoToast());
    act(() => {
      result.current.show({ label: "5 deleted", onUndo: vi.fn() });
    });
    expect(result.current.toasts.length).toBe(1);
    act(() => { vi.advanceTimersByTime(10_500); });
    expect(result.current.toasts.length).toBe(0);
  });

  it("calls onUndo when undo is invoked and dismisses", () => {
    const { result } = renderHook(() => useUndoToast());
    const onUndo = vi.fn();
    let toastId = "";
    act(() => {
      toastId = result.current.show({ label: "5 deleted", onUndo });
    });
    act(() => { result.current.undo(toastId); });
    expect(onUndo).toHaveBeenCalledOnce();
    expect(result.current.toasts.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// hooks/use-undo-toast.ts
import { useCallback, useEffect, useRef, useState } from "react";

export interface UndoToast {
  id: string;
  label: string;
  onUndo: () => void | Promise<void>;
  createdAt: number;
}

const TTL_MS = 10_000;

export function useUndoToast() {
  const [toasts, setToasts] = useState<UndoToast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback((args: { label: string; onUndo: () => void | Promise<void> }) => {
    const id = Math.random().toString(36).slice(2, 10);
    const toast: UndoToast = { id, label: args.label, onUndo: args.onUndo, createdAt: Date.now() };
    setToasts((ts) => [...ts, toast]);
    const timer = setTimeout(() => dismiss(id), TTL_MS);
    timersRef.current.set(id, timer);
    return id;
  }, [dismiss]);

  const undo = useCallback(async (id: string) => {
    const toast = toasts.find((t) => t.id === id);
    if (!toast) return;
    await toast.onUndo();
    dismiss(id);
  }, [toasts, dismiss]);

  useEffect(() => () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  return { toasts, show, undo, dismiss };
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add hooks/use-undo-toast.ts tests/hooks/use-undo-toast.test.ts
git commit -m "feat(hooks): useUndoToast with 10s TTL"
```

## Task 4.4 — `ConfirmDialog` component

**Files:**
- Create: `components/ui/confirm-dialog.tsx`
- Test: `tests/components/confirm-dialog.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/confirm-dialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";

describe("ConfirmDialog", () => {
  it("renders title and body when open", () => {
    render(
      <ConfirmDialog
        open
        title="Delete?"
        body="This is permanent."
        confirmLabel="Delete"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText("Delete?")).toBeDefined();
    expect(screen.getByText("This is permanent.")).toBeDefined();
  });

  it("invokes onConfirm and onCancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="T"
        body="B"
        confirmLabel="Yes"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText("Yes"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// components/ui/confirm-dialog.tsx
"use client";

import { ReactNode } from "react";

interface Props {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  variant?: "destructive" | "neutral";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, body, confirmLabel, variant = "destructive", onConfirm, onCancel,
}: Props) {
  if (!open) return null;
  const confirmClass =
    variant === "destructive"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-accent hover:bg-accent-strong text-white";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-surface rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-ink mb-3">{title}</h2>
        <div className="text-body-s text-ink-secondary mb-5">{body}</div>
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 text-body-s text-ink-secondary hover:text-ink" onClick={onCancel}>
            Cancel
          </button>
          <button className={`px-4 py-2 text-body-s font-medium rounded ${confirmClass}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add components/ui/confirm-dialog.tsx tests/components/confirm-dialog.test.tsx
git commit -m "feat(ui): ConfirmDialog component"
```

## Task 4.5 — `UndoToast` component

**Files:**
- Create: `components/ui/undo-toast.tsx`
- Test: `tests/components/undo-toast.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/undo-toast.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UndoToast } from "../../components/ui/undo-toast";

describe("UndoToast", () => {
  it("renders label and calls onUndo when clicked", () => {
    const onUndo = vi.fn();
    render(<UndoToast label="5 deleted" onUndo={onUndo} onDismiss={() => {}} />);
    expect(screen.getByText("5 deleted")).toBeDefined();
    fireEvent.click(screen.getByText("Undo"));
    expect(onUndo).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// components/ui/undo-toast.tsx
"use client";

interface Props {
  label: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ label, onUndo, onDismiss }: Props) {
  return (
    <div className="bg-ink text-surface rounded-lg shadow-lg flex items-center gap-4 px-4 py-3 min-w-[280px]">
      <span className="text-body-s flex-1">{label}</span>
      <button
        onClick={onUndo}
        className="text-body-s font-semibold underline hover:no-underline"
      >
        Undo
      </button>
      <button onClick={onDismiss} aria-label="Dismiss" className="text-ink-secondary hover:text-surface">
        ✕
      </button>
      <div className="absolute bottom-0 left-0 h-0.5 bg-accent animate-shrink-x" style={{
        animationDuration: "10s",
        animationTimingFunction: "linear",
      }} />
    </div>
  );
}
```

Note: the `animate-shrink-x` keyframe needs to be defined in `tailwind.config.ts` (or globals.css). Add this entry to the tailwind config's `extend.keyframes` and `extend.animation`:

```ts
keyframes: {
  "shrink-x": { from: { width: "100%" }, to: { width: "0%" } },
},
animation: {
  "shrink-x": "shrink-x 10s linear",
},
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add components/ui/undo-toast.tsx tests/components/undo-toast.test.tsx tailwind.config.ts
git commit -m "feat(ui): UndoToast with 10s countdown bar"
```

## Task 4.6 — `BulkActionBar` component

**Files:**
- Create: `components/ui/bulk-action-bar.tsx`
- Test: `tests/components/bulk-action-bar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/bulk-action-bar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BulkActionBar } from "../../components/ui/bulk-action-bar";

describe("BulkActionBar", () => {
  it("renders null when count is 0", () => {
    const { container } = render(
      <BulkActionBar count={0} onClear={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows count, actions, and clear", () => {
    const onClear = vi.fn();
    render(
      <BulkActionBar count={5} onClear={onClear}>
        <button>Delete</button>
      </BulkActionBar>
    );
    expect(screen.getByText("5 selected")).toBeDefined();
    fireEvent.click(screen.getByText("Clear"));
    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.getByText("Delete")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// components/ui/bulk-action-bar.tsx
"use client";

import { ReactNode } from "react";

interface Props {
  count: number;
  countLabel?: string; // "candidates", "jobs", etc.
  onClear: () => void;
  banner?: ReactNode;
  children?: ReactNode;
}

export function BulkActionBar({ count, countLabel, onClear, banner, children }: Props) {
  if (count === 0) return null;
  const label = countLabel ? `${count} ${countLabel} selected` : `${count} selected`;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-stretch gap-2">
      {banner}
      <div className="bg-ink text-surface rounded-lg shadow-xl flex items-center gap-3 px-4 py-3 min-w-[420px]">
        <span className="text-body-s font-medium flex-1">{label}</span>
        <div className="flex items-center gap-2">{children}</div>
        <button
          onClick={onClear}
          className="text-body-s text-ink-secondary hover:text-surface ml-2"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add components/ui/bulk-action-bar.tsx tests/components/bulk-action-bar.test.tsx
git commit -m "feat(ui): BulkActionBar"
```

## Task 4.7 — `SelectAllMatchingBanner`

**Files:**
- Create: `components/ui/select-all-matching-banner.tsx`
- Test: `tests/components/select-all-matching-banner.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SelectAllMatchingBanner } from "../../components/ui/select-all-matching-banner";

describe("SelectAllMatchingBanner", () => {
  it("shows total and triggers onSelectAllMatching", () => {
    const onAll = vi.fn();
    render(
      <SelectAllMatchingBanner
        loadedCount={100}
        totalCount={2345}
        entityLabel="candidates"
        onSelectAllMatching={onAll}
      />
    );
    expect(screen.getByText(/All 100 candidates on this page selected/)).toBeDefined();
    fireEvent.click(screen.getByText(/Select all 2,345 matching/));
    expect(onAll).toHaveBeenCalledOnce();
  });

  it("is hidden when totalCount equals loadedCount", () => {
    const { container } = render(
      <SelectAllMatchingBanner
        loadedCount={5}
        totalCount={5}
        entityLabel="candidates"
        onSelectAllMatching={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// components/ui/select-all-matching-banner.tsx
"use client";

interface Props {
  loadedCount: number;
  totalCount: number;
  entityLabel: string;
  onSelectAllMatching: () => void;
}

export function SelectAllMatchingBanner({ loadedCount, totalCount, entityLabel, onSelectAllMatching }: Props) {
  if (totalCount <= loadedCount) return null;
  return (
    <div className="bg-accent-soft text-ink rounded-lg shadow flex items-center gap-3 px-4 py-2 min-w-[420px]">
      <span className="text-body-s flex-1">
        All {loadedCount} {entityLabel} on this page selected.
      </span>
      <button
        onClick={onSelectAllMatching}
        className="text-body-s font-semibold text-accent-strong underline hover:no-underline"
      >
        Select all {totalCount.toLocaleString()} matching
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add components/ui/select-all-matching-banner.tsx tests/components/select-all-matching-banner.test.tsx
git commit -m "feat(ui): SelectAllMatchingBanner"
```

## Task 4.8 — `csv-export` utility

**Files:**
- Create: `lib/csv-export.ts`
- Test: `tests/lib/csv-export.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/csv-export.test.ts
import { describe, it, expect } from "vitest";
import { rowsToCsv } from "../../lib/csv-export";

describe("rowsToCsv", () => {
  it("renders header and rows with BOM", () => {
    const csv = rowsToCsv(
      [{ name: "Joe", email: "j@x.com" }],
      [{ key: "name", label: "Name" }, { key: "email", label: "Email" }],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Name,Email\nJoe,j@x.com");
  });

  it("escapes commas and quotes", () => {
    const csv = rowsToCsv(
      [{ note: 'hello, "world"' }],
      [{ key: "note", label: "Note" }],
    );
    expect(csv).toContain('"hello, ""world"""');
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// lib/csv-export.ts
export interface CsvColumn<T> {
  key: keyof T;
  label: string;
}

function escapeField(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeField(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => escapeField(r[c.key])).join(",")).join("\n");
  return `﻿${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add lib/csv-export.ts tests/lib/csv-export.test.ts
git commit -m "feat(lib): rowsToCsv + downloadCsv"
```

---

# PHASE 5 — Wire pagination into the three list pages

UI pages switch from `useQuery` to `usePaginatedQuery`. Filter/sort/search inputs now drive query args. The intersection observer triggers `loadMore`. No bulk-action UX yet (that lands in Phase 8 onward).

## Task 5.1 — Talent page paginated query wiring

**Files:**
- Modify: `app/dashboard/talent/page.tsx`
- Modify: `components/talent/talent-controls.tsx`
- Modify: `components/pipeline/application-table.tsx`

- [ ] **Step 1: Update `application-table.tsx` to accept and call a `loadMoreRef` prop**

```tsx
// Add to the existing Props (find Props interface near top of file):
loadMoreRef?: (node: HTMLElement | null) => void;
```

Inside the table render, place a sentinel `<div ref={loadMoreRef}>` at the bottom of the virtualized container (after the virtualizer's items).

- [ ] **Step 2: Update `app/dashboard/talent/page.tsx` to use `usePaginatedQuery`.** Replace the existing `useQuery(api.candidates.listForSchool, ...)` call:

```tsx
"use client";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

// Inside the component:
const { results, status, loadMore } = usePaginatedQuery(
  api.candidates.listForSchool,
  schoolId ? { schoolId, filter: { poolId: selectedPoolId, stages: selectedStages, search: searchText }, sort: sortBy } : "skip",
  { initialNumItems: 100 },
);

const sentinelRef = useInfiniteScroll({ status, loadMore, loadCount: 100 });
```

Pass `loadMoreRef={sentinelRef}` to `<ApplicationTable />`. Remove the existing client-side filter/sort `useMemo` blocks — the server does this now.

- [ ] **Step 3: Update `talent-controls.tsx`** so its inputs (`searchText`, `selectedStages`, `selectedPoolId`) are controlled by the page via props, with `onChange` callbacks. No client-side filtering remains here.

- [ ] **Step 4: Smoke-check by running `pnpm dev` and visiting `/dashboard/talent`** to confirm:
  - Initial load shows up to 100 rows.
  - Scrolling near the bottom loads more.
  - Search input updates results.
  - Sort dropdown changes order.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/talent/page.tsx components/talent/talent-controls.tsx components/pipeline/application-table.tsx
git commit -m "refactor(talent): switch to usePaginatedQuery + infinite scroll"
```

## Task 5.2 — Per-job pipeline page paginated query wiring

**Files:**
- Modify: `app/dashboard/jobs/[id]/pipeline/page.tsx`

- [ ] **Step 1: Switch `useQuery(api.applications.getPipelineForJob, ...)` to `usePaginatedQuery`** with `{ initialNumItems: 100 }`. Accept filter+sort args from page-local state.

```tsx
const [filter, setFilter] = useState<{ stage?: string; search?: string }>({});
const [sort, setSort] = useState<"newest" | "score" | "name">("newest");
const { results, status, loadMore } = usePaginatedQuery(
  api.applications.getPipelineForJob,
  { jobId: params.id as any, filter, sort },
  { initialNumItems: 100 },
);
const sentinelRef = useInfiniteScroll({ status, loadMore, loadCount: 100 });
```

- [ ] **Step 2: Pass `loadMoreRef={sentinelRef}` to `<ApplicationTable />`** at the render site.

- [ ] **Step 3: Smoke-check by running `pnpm dev` and visiting a job's pipeline view.**

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/jobs/\[id\]/pipeline/page.tsx
git commit -m "refactor(pipeline): per-job page uses usePaginatedQuery"
```

## Task 5.3 — All-applications pipeline page wiring

**Files:**
- Modify: `app/dashboard/pipeline/pipeline-list.tsx`

Repeat the pattern from Task 5.2 — `usePaginatedQuery` against `api.applications.getPipelineForJob` (or whichever query backs this view — verify by reading the file).

- [ ] **Step 1: Read the file to confirm the current query call**

```bash
grep -nE "useQuery|getPipelineForJob" app/dashboard/pipeline/pipeline-list.tsx
```

- [ ] **Step 2: Apply the same `usePaginatedQuery` + `useInfiniteScroll` pattern** as Task 5.2.

- [ ] **Step 3: Smoke-check via `pnpm dev` and visit `/dashboard/pipeline`.**

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/pipeline/pipeline-list.tsx
git commit -m "refactor(pipeline): cross-job page uses usePaginatedQuery"
```

## Task 5.4 — Jobs list page paginated query wiring

**Files:**
- Modify: `app/dashboard/jobs/page.tsx`
- Modify: `components/jobs/jobs-list.tsx`

- [ ] **Step 1: Add a sentinel slot to `jobs-list.tsx`.** Accept a `loadMoreRef` prop and render `<div ref={loadMoreRef}/>` at the bottom of the card grid.

- [ ] **Step 2: Switch `app/dashboard/jobs/page.tsx` to `usePaginatedQuery`** using `api.jobs.listBySchool` with filter (status, search) and sort args. Wire `useInfiniteScroll`.

- [ ] **Step 3: Smoke-check via `pnpm dev` and visit `/dashboard/jobs`.**

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/jobs/page.tsx components/jobs/jobs-list.tsx
git commit -m "refactor(jobs): listBySchool uses usePaginatedQuery"
```

---

# PHASE 6 — Candidate hard delete + undo

The first concrete delete path. Lands the schema-marked-pending pattern (Section 0) and the cascade (Section 2 of the spec). Single-row delete from the drawer is wired here too.

## Task 6.1 — `candidates.removeMany` (marks pending) + `undoBatchDelete`

**Files:**
- Modify: `convex/candidates.ts`
- Test: `tests/convex/candidates-delete.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// tests/convex/candidates-delete.test.ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
// modules block

describe("candidates.removeMany", () => {
  it("marks candidates pendingDelete and returns batchId", async () => {
    const t = convexTest(schema, modules);
    const { schoolId } = await seed(t);
    const c1 = await t.mutation("candidates:create", { name: "A", email: "a@x.com" });
    const c2 = await t.mutation("candidates:create", { name: "B", email: "b@x.com" });
    const result = await t.mutation("candidates:removeMany", { ids: [c1, c2] });
    expect(result.count).toBe(2);
    expect(typeof result.batchId).toBe("string");
    // Both rows hidden from list
    const list = await t.query("candidates:listForSchool", {
      schoolId, paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(list.page.length).toBe(0);
  });

  it("undoBatchDelete restores rows within window", async () => {
    const t = convexTest(schema, modules);
    const { schoolId } = await seed(t);
    const c1 = await t.mutation("candidates:create", { name: "A", email: "a@x.com" });
    await t.mutation("applications:create", { candidateId: c1, schoolId, stage: "applied" });
    const { batchId } = await t.mutation("candidates:removeMany", { ids: [c1] });
    const r = await t.mutation("candidates:undoBatchDelete", { batchId });
    expect(r.restored).toBe(1);
    const list = await t.query("candidates:listForSchool", {
      schoolId, paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(list.page.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement in `convex/candidates.ts`**

```ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

function makeBatchId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const removeManyArgs = v.union(
  v.object({ ids: v.array(v.id("candidates")) }),
  v.object({ matchAll: v.object({
    schoolId: v.id("schools"),
    filter: v.optional(v.any()), // structured filter — see Section 1 of the spec
  })}),
);

export const removeMany = mutation({
  args: removeManyArgs,
  handler: async (ctx, args) => {
    let ids: any[] = [];
    if ("ids" in args) ids = args.ids;
    else {
      // matchAll: resolve filter to candidate IDs via the same applications query the listing uses.
      const apps = await ctx.db
        .query("applications")
        .withIndex("by_schoolId", (q) => q.eq("schoolId", args.matchAll.schoolId))
        .filter((q) => q.eq(q.field("pendingDeleteAt"), undefined))
        .collect();
      const candIds = new Set<string>();
      for (const app of apps) candIds.add(app.candidateId);
      ids = Array.from(candIds);
    }

    const batchId = makeBatchId();
    let count = 0;
    for (const id of ids) {
      const doc = await ctx.db.get(id);
      if (!doc || doc.pendingDeleteAt != null) continue;
      await ctx.db.patch(id, { pendingDeleteAt: Date.now(), pendingDeleteBatchId: batchId });
      count++;
    }
    await ctx.scheduler.runAfter(10_000, internal.candidates.finalizeBatchDelete, { batchId });
    return { batchId, count };
  },
});

export const remove = mutation({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.candidateId);
    if (!doc || doc.pendingDeleteAt != null) {
      return { batchId: "", count: 0 as const };
    }
    const batchId = makeBatchId();
    await ctx.db.patch(args.candidateId, { pendingDeleteAt: Date.now(), pendingDeleteBatchId: batchId });
    await ctx.scheduler.runAfter(10_000, internal.candidates.finalizeBatchDelete, { batchId });
    return { batchId, count: 1 as const };
  },
});

export const undoBatchDelete = mutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const candidates = await ctx.db
      .query("candidates")
      .filter((q) => q.eq(q.field("pendingDeleteBatchId"), args.batchId))
      .collect();
    let restored = 0;
    for (const c of candidates) {
      if (c.pendingDeleteAt == null) continue;
      await ctx.db.patch(c._id, { pendingDeleteAt: undefined, pendingDeleteBatchId: undefined });
      restored++;
    }
    return { restored };
  },
});
```

Also add the `internal` import at the top if not already present: `import { internal } from "./_generated/api";`

- [ ] **Step 4: Run, expect PASS.**

```bash
pnpm test tests/convex/candidates-delete.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add convex/candidates.ts tests/convex/candidates-delete.test.ts
git commit -m "feat(candidates): remove + removeMany + undoBatchDelete (pending mark)"
```

## Task 6.2 — `internal.candidates.finalizeBatchDelete` cascading delete

**Files:**
- Modify: `convex/candidates.ts`
- Test: `tests/convex/candidates-delete.test.ts` (extend)

- [ ] **Step 1: Add a test**

```ts
it("finalize cascades: applications, evaluations, outreach, calendar, triage, booking, pools, resume, candidate", async () => {
  const t = convexTest(schema, modules);
  const { schoolId } = await seed(t);

  // Seed candidate + linked rows
  const candidateId = await t.mutation("candidates:create", { name: "A", email: "a@x.com" });
  const appId = await t.mutation("applications:create", { candidateId, schoolId, stage: "applied" });

  // Seed an evaluation tied to that application
  await t.run(async (ctx) => {
    await ctx.db.insert("evaluations", {
      applicationId: appId, evaluatorUserId: "u1", evaluatorRole: "principal",
      token: "tok", submitted: false,
    });
    await ctx.db.insert("candidatePools", {
      candidateId, poolId: "p1" as any, confidence: 0.5, createdAt: Date.now(),
    });
  });

  const { batchId } = await t.mutation("candidates:removeMany", { ids: [candidateId] });
  await t.finishInProgressScheduledFunctions();

  // All gone after finalize
  const candAfter = await t.run(async (ctx) => ctx.db.get(candidateId));
  expect(candAfter).toBeNull();
  const appAfter = await t.run(async (ctx) => ctx.db.get(appId));
  expect(appAfter).toBeNull();
  const evals = await t.run(async (ctx) =>
    ctx.db.query("evaluations").withIndex("by_applicationId", (q) => q.eq("applicationId", appId)).collect()
  );
  expect(evals.length).toBe(0);
  const pools = await t.run(async (ctx) =>
    ctx.db.query("candidatePools").withIndex("by_candidateId", (q) => q.eq("candidateId", candidateId)).collect()
  );
  expect(pools.length).toBe(0);
});

it("undo before finalize prevents deletion", async () => {
  const t = convexTest(schema, modules);
  const { schoolId } = await seed(t);
  const candidateId = await t.mutation("candidates:create", { name: "A", email: "a@x.com" });
  const { batchId } = await t.mutation("candidates:removeMany", { ids: [candidateId] });
  await t.mutation("candidates:undoBatchDelete", { batchId });
  await t.finishInProgressScheduledFunctions();
  const after = await t.run(async (ctx) => ctx.db.get(candidateId));
  expect(after).not.toBeNull();
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement the internal action** in `convex/candidates.ts`:

```ts
import { internalMutation } from "./_generated/server";

export const finalizeBatchDelete = internalMutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const candidates = await ctx.db
      .query("candidates")
      .filter((q) => q.eq(q.field("pendingDeleteBatchId"), args.batchId))
      .collect();

    for (const cand of candidates) {
      if (cand.pendingDeleteAt == null) continue;

      // 1. Walk applications
      const apps = await ctx.db
        .query("applications")
        .withIndex("by_candidateId", (q) => q.eq("candidateId", cand._id))
        .collect();
      for (const app of apps) {
        await deleteApplicationChildren(ctx, app._id);
        await ctx.db.delete(app._id);
      }

      // 2. candidatePools
      const pools = await ctx.db
        .query("candidatePools")
        .withIndex("by_candidateId", (q) => q.eq("candidateId", cand._id))
        .collect();
      for (const p of pools) await ctx.db.delete(p._id);

      // 3. Resume file
      if (cand.resumeStorageId) {
        try { await ctx.storage.delete(cand.resumeStorageId as any); } catch {}
      }

      // 4. The candidate itself
      await ctx.db.delete(cand._id);
    }
  },
});

// Shared cascade for one application (also used by applications.finalizeBatchDelete in Phase 7).
export async function deleteApplicationChildren(ctx: any, applicationId: any) {
  for (const table of ["evaluations", "outreachMessages", "calendarEvents", "triageDecisions", "bookingTokens"] as const) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_applicationId", (q: any) => q.eq("applicationId", applicationId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  }
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add convex/candidates.ts tests/convex/candidates-delete.test.ts
git commit -m "feat(candidates): finalizeBatchDelete cascades across 6 child tables + storage"
```

## Task 6.3 — "Delete candidate" affordance in drawer

**Files:**
- Modify: `components/pipeline/application-drawer.tsx`

- [ ] **Step 1: Add a destructive button** at the bottom of the drawer (or in a kebab menu, matching existing style). Imports:

```tsx
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useUndoToast } from "@/hooks/use-undo-toast";
import { UndoToast } from "@/components/ui/undo-toast";
import { useMutation } from "convex/react";
```

- [ ] **Step 2: Add component state and the mutation hook**

```tsx
const [confirmOpen, setConfirmOpen] = useState(false);
const removeCandidate = useMutation(api.candidates.remove);
const undo = useMutation(api.candidates.undoBatchDelete);
const undoToast = useUndoToast();
```

- [ ] **Step 3: Render the button + ConfirmDialog**

```tsx
<div className="border-t border-hairline p-4 mt-4">
  <button
    onClick={() => setConfirmOpen(true)}
    className="text-body-s text-red-600 hover:text-red-700 font-medium"
  >
    Delete candidate
  </button>
</div>

<ConfirmDialog
  open={confirmOpen}
  title={`Delete ${candidate.name}?`}
  body="This removes their resume, every application across roles, and all evaluations. You can undo within 10 seconds."
  confirmLabel="Delete"
  onConfirm={async () => {
    setConfirmOpen(false);
    const r = await removeCandidate({ candidateId: candidate._id });
    onClose?.();
    if (r.batchId) {
      undoToast.show({
        label: `Deleted ${candidate.name}`,
        onUndo: () => undo({ batchId: r.batchId }),
      });
    }
  }}
  onCancel={() => setConfirmOpen(false)}
/>

<div className="fixed top-6 right-6 z-50 space-y-2">
  {undoToast.toasts.map((t) => (
    <UndoToast key={t.id} label={t.label} onUndo={() => undoToast.undo(t.id)} onDismiss={() => undoToast.dismiss(t.id)} />
  ))}
</div>
```

- [ ] **Step 4: Smoke-check by visiting a candidate in `/dashboard/pipeline`, opening drawer, clicking Delete, then Undo within 10s.** Expect the candidate to reappear in the list (Convex reactivity).

- [ ] **Step 5: Commit**

```bash
git add components/pipeline/application-drawer.tsx
git commit -m "feat(drawer): single candidate delete with undo toast"
```

---

# PHASE 7 — Applications bulk actions (Remove from pipeline, Move to stage)

## Task 7.1 — `applications.removeManyApplications` + `undoBatchDelete` + `finalizeBatchDelete`

**Files:**
- Modify: `convex/applications.ts`
- Test: `tests/convex/applications-delete.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// tests/convex/applications-delete.test.ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
// modules

describe("applications.removeManyApplications", () => {
  it("marks pending, finalize deletes app + children, candidate untouched", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
    const candidateId = await t.mutation("candidates:create", { name: "A", email: "a@x.com" });
    const appId = await t.mutation("applications:create", { candidateId, schoolId, stage: "applied" });
    await t.run(async (ctx) => {
      await ctx.db.insert("evaluations", { applicationId: appId, evaluatorUserId: "u", evaluatorRole: "principal", token: "t", submitted: false });
    });

    const { batchId, count } = await t.mutation("applications:removeManyApplications", { ids: [appId] });
    expect(count).toBe(1);

    await t.finishInProgressScheduledFunctions();

    const appAfter = await t.run(async (ctx) => ctx.db.get(appId));
    expect(appAfter).toBeNull();
    const evals = await t.run(async (ctx) =>
      ctx.db.query("evaluations").withIndex("by_applicationId", (q) => q.eq("applicationId", appId)).collect()
    );
    expect(evals.length).toBe(0);
    const candAfter = await t.run(async (ctx) => ctx.db.get(candidateId));
    expect(candAfter).not.toBeNull(); // candidate stays
  });

  it("undo restores applications", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
    const cId = await t.mutation("candidates:create", { name: "A", email: "a@x.com" });
    const appId = await t.mutation("applications:create", { candidateId: cId, schoolId, stage: "applied" });
    const { batchId } = await t.mutation("applications:removeManyApplications", { ids: [appId] });
    const r = await t.mutation("applications:undoBatchDelete", { batchId });
    expect(r.restored).toBe(1);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement in `convex/applications.ts`**

```ts
import { internal } from "./_generated/api";
import { deleteApplicationChildren } from "./candidates"; // shared helper from Task 6.2

function makeBatchId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const removeManyAppsArgs = v.union(
  v.object({ ids: v.array(v.id("applications")) }),
  v.object({ matchAll: v.object({
    jobId: v.union(v.id("jobPostings"), v.null()),
    filter: v.optional(v.any()),
  })}),
);

export const removeManyApplications = mutation({
  args: removeManyAppsArgs,
  handler: async (ctx, args) => {
    let ids: any[] = [];
    if ("ids" in args) ids = args.ids;
    else {
      // Resolve filter via the listing's query pattern.
      const builder = args.matchAll.jobId
        ? ctx.db.query("applications").withIndex("by_jobPostingId", (q) => q.eq("jobPostingId", args.matchAll.jobId!))
        : ctx.db.query("applications");
      const apps = await builder
        .filter((q) => q.eq(q.field("pendingDeleteAt"), undefined))
        .collect();
      ids = apps.map((a) => a._id);
    }

    const batchId = makeBatchId();
    let count = 0;
    for (const id of ids) {
      const a = await ctx.db.get(id);
      if (!a || a.pendingDeleteAt != null) continue;
      await ctx.db.patch(id, { pendingDeleteAt: Date.now(), pendingDeleteBatchId: batchId });
      count++;
    }
    await ctx.scheduler.runAfter(10_000, internal.applications.finalizeBatchDelete, { batchId });
    return { batchId, count };
  },
});

export const undoBatchDelete = mutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("applications")
      .filter((q) => q.eq(q.field("pendingDeleteBatchId"), args.batchId))
      .collect();
    let restored = 0;
    for (const r of rows) {
      if (r.pendingDeleteAt == null) continue;
      await ctx.db.patch(r._id, { pendingDeleteAt: undefined, pendingDeleteBatchId: undefined });
      restored++;
    }
    return { restored };
  },
});

export const finalizeBatchDelete = internalMutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("applications")
      .filter((q) => q.eq(q.field("pendingDeleteBatchId"), args.batchId))
      .collect();
    for (const r of rows) {
      if (r.pendingDeleteAt == null) continue;
      await deleteApplicationChildren(ctx, r._id);
      await ctx.db.delete(r._id);
    }
  },
});
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add convex/applications.ts tests/convex/applications-delete.test.ts
git commit -m "feat(applications): removeMany + undoBatchDelete + finalize cascade"
```

## Task 7.2 — `applications.bulkSetStage` with previous-value snapshot

**Files:**
- Modify: `convex/applications.ts`
- Test: `tests/convex/applications-stage.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
// modules

describe("applications.bulkSetStage", () => {
  it("updates stage and returns previousStages snapshot", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
    const c1 = await t.mutation("candidates:create", { name: "A", email: "a@x.com" });
    const c2 = await t.mutation("candidates:create", { name: "B", email: "b@x.com" });
    const a1 = await t.mutation("applications:create", { candidateId: c1, schoolId, stage: "applied" });
    const a2 = await t.mutation("applications:create", { candidateId: c2, schoolId, stage: "screening" });
    const r = await t.mutation("applications:bulkSetStage", { ids: [a1, a2], stage: "interview" });
    expect(r.previousStages.find((p: any) => p.id === a1)?.previousStage).toBe("applied");
    expect(r.previousStages.find((p: any) => p.id === a2)?.previousStage).toBe("screening");
    const a1After = await t.run(async (ctx) => ctx.db.get(a1));
    expect(a1After.stage).toBe("interview");
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
const bulkSetStageArgs = v.union(
  v.object({ ids: v.array(v.id("applications")), stage: v.string() }),
  v.object({
    matchAll: v.object({
      jobId: v.union(v.id("jobPostings"), v.null()),
      filter: v.optional(v.any()),
    }),
    stage: v.string(),
  }),
);

export const bulkSetStage = mutation({
  args: bulkSetStageArgs,
  handler: async (ctx, args) => {
    let ids: any[] = [];
    if ("ids" in args) ids = args.ids;
    else {
      const builder = args.matchAll.jobId
        ? ctx.db.query("applications").withIndex("by_jobPostingId", (q) => q.eq("jobPostingId", args.matchAll.jobId!))
        : ctx.db.query("applications");
      const apps = await builder.filter((q) => q.eq(q.field("pendingDeleteAt"), undefined)).collect();
      ids = apps.map((a) => a._id);
    }

    const batchId = makeBatchId();
    const previousStages: Array<{ id: any; previousStage: string }> = [];
    for (const id of ids) {
      const a = await ctx.db.get(id);
      if (!a) continue;
      previousStages.push({ id, previousStage: a.stage });
      await ctx.db.patch(id, { stage: args.stage });
    }
    return { batchId, previousStages };
  },
});
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add convex/applications.ts tests/convex/applications-stage.test.ts
git commit -m "feat(applications): bulkSetStage with previousStages snapshot"
```

## Task 7.3 — Add checkbox column to `application-table`

**Files:**
- Modify: `components/pipeline/application-table.tsx`

- [ ] **Step 1: Accept selection props**

```tsx
interface ApplicationTableProps {
  // ...existing props...
  selected?: (id: string) => boolean;
  onToggleRow?: (id: string, shiftKey: boolean) => void;
  onToggleAll?: (loadedIds: string[]) => void;
  loadMoreRef?: (node: HTMLElement | null) => void;
}
```

- [ ] **Step 2: Render the leading checkbox column.** Add it as the first column in both the header row and each data row. Header checkbox calls `onToggleAll(rows.map(r => r.applicationId))`. Row checkbox stops propagation on click so the existing row click (open drawer) still fires for the rest of the row.

```tsx
<td className="w-10 px-2">
  <input
    type="checkbox"
    checked={selected?.(row.applicationId) ?? false}
    onClick={(e) => e.stopPropagation()}
    onChange={(e) => onToggleRow?.(row.applicationId, (e.nativeEvent as MouseEvent).shiftKey)}
  />
</td>
```

For the header:

```tsx
<th className="w-10 px-2">
  <input
    type="checkbox"
    checked={rows.length > 0 && rows.every((r) => selected?.(r.applicationId))}
    onChange={() => onToggleAll?.(rows.map((r) => r.applicationId))}
  />
</th>
```

- [ ] **Step 3: Visual highlight on selected rows.** Add a conditional class on the `<tr>`: `${selected?.(row.applicationId) ? "bg-accent-soft" : ""}`.

- [ ] **Step 4: Smoke-check** by visiting `/dashboard/pipeline`. Without bulk action wiring at the page yet, checkboxes won't do anything functional — but the rendering should be intact.

- [ ] **Step 5: Commit**

```bash
git add components/pipeline/application-table.tsx
git commit -m "feat(table): checkbox column + selection highlight on application-table"
```

## Task 7.4 — Wire bulk actions on per-job pipeline page

**Files:**
- Modify: `app/dashboard/jobs/[id]/pipeline/page.tsx`

- [ ] **Step 1: Add hook usage**

```tsx
import { useTableSelection } from "@/hooks/use-table-selection";
import { useUndoToast } from "@/hooks/use-undo-toast";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { SelectAllMatchingBanner } from "@/components/ui/select-all-matching-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UndoToast } from "@/components/ui/undo-toast";

const sel = useTableSelection<string, { jobId: any; filter: any }>();
const undoToast = useUndoToast();
const removeApps = useMutation(api.applications.removeManyApplications);
const undoRemove = useMutation(api.applications.undoBatchDelete);
const bulkSetStage = useMutation(api.applications.bulkSetStage);
const totalCountQuery = useQuery(api.applications.countForJob, { jobId: params.id as any, filter });

useEffect(() => {
  sel.setLoadedIds(results.map((r: any) => r.applicationId));
}, [results]);
```

Reset selection on filter/sort change:

```tsx
useEffect(() => { sel.clear(); }, [filter, sort]);
```

- [ ] **Step 2: Pass selection props to `<ApplicationTable />`**

```tsx
<ApplicationTable
  rows={results}
  selected={(id) => sel.isSelected(id as any)}
  onToggleRow={(id, shift) => sel.toggle(id as any, shift)}
  onToggleAll={(ids) => sel.toggleAllLoaded(ids as any)}
  loadMoreRef={sentinelRef}
  // ... existing props ...
/>
```

- [ ] **Step 3: Render the action bar + banner + toast container**

```tsx
const [confirmRemove, setConfirmRemove] = useState(false);
const selectedIds = sel.mode.kind === "ids" ? Array.from(sel.mode.selected) : null;
const totalCount = totalCountQuery?.total ?? 0;

return (
  <>
    {/* ...existing page... */}

    <BulkActionBar
      count={sel.count.kind === "all-matching" ? totalCount : sel.count.n}
      countLabel="applications"
      onClear={() => sel.clear()}
      banner={
        sel.mode.kind === "ids" && sel.count.n === results.length && results.length > 0 && totalCount > results.length ? (
          <SelectAllMatchingBanner
            loadedCount={results.length}
            totalCount={totalCount}
            entityLabel="applications"
            onSelectAllMatching={() => sel.selectAllMatching({ jobId: params.id, filter })}
          />
        ) : undefined
      }
    >
      <button className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-body-s" onClick={() => setConfirmRemove(true)}>
        Remove from pipeline
      </button>
      <button className="bg-accent text-white px-3 py-1.5 rounded text-body-s" onClick={() => { /* open stage picker — Task 7.5 */ }}>
        Move to stage
      </button>
      {sel.mode.kind === "ids" && (
        <button className="bg-surface text-ink px-3 py-1.5 rounded text-body-s" onClick={() => { /* CSV — Task 12.x */ }}>
          Export CSV
        </button>
      )}
    </BulkActionBar>

    <ConfirmDialog
      open={confirmRemove}
      title={`Remove ${sel.count.kind === "all-matching" ? totalCount : sel.count.n} applications?`}
      body="The candidates remain in the system and their other applications are unaffected. You can undo within 10 seconds."
      confirmLabel="Remove"
      onConfirm={async () => {
        setConfirmRemove(false);
        const args: any = sel.mode.kind === "ids"
          ? { ids: Array.from(sel.mode.selected) }
          : { matchAll: { jobId: params.id, filter } };
        const r = await removeApps(args);
        const label = `Removed ${r.count} ${r.count === 1 ? "application" : "applications"}`;
        sel.clear();
        undoToast.show({ label, onUndo: () => undoRemove({ batchId: r.batchId }) });
      }}
      onCancel={() => setConfirmRemove(false)}
    />

    <div className="fixed top-6 right-6 z-50 space-y-2">
      {undoToast.toasts.map((t) => (
        <UndoToast key={t.id} label={t.label} onUndo={() => undoToast.undo(t.id)} onDismiss={() => undoToast.dismiss(t.id)} />
      ))}
    </div>
  </>
);
```

- [ ] **Step 4: Smoke-check via `pnpm dev`.** Select a couple of rows, click Remove, confirm, see them disappear and a toast appear. Click Undo, see them return.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/jobs/\[id\]/pipeline/page.tsx
git commit -m "feat(pipeline): per-job page bulk actions (remove from pipeline + undo)"
```

## Task 7.5 — Stage picker for "Move to stage" bulk action

**Files:**
- Modify: `app/dashboard/jobs/[id]/pipeline/page.tsx`

- [ ] **Step 1: Add a simple stage picker.** Use a `<select>` inside a small modal/popover, or reuse an existing pattern in the codebase. Read stages from `pipeline_config.getForSchool` (already used in `pipeline-list.tsx`).

```tsx
const pipelineConfig = useQuery(api.pipeline_config.getForSchool, { schoolId: profile?.schoolId });
const stages = pipelineConfig?.stages ?? [];
const [stageOpen, setStageOpen] = useState(false);
const [pickedStage, setPickedStage] = useState<string>("");
```

- [ ] **Step 2: Wire the "Move to stage" button to open the picker, and the picker's Confirm to call bulkSetStage**

```tsx
<button onClick={() => setStageOpen(true)}>Move to stage</button>

{stageOpen && (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setStageOpen(false)}>
    <div className="bg-surface rounded-lg p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-body font-semibold mb-3">Move to stage</h3>
      <select className="w-full p-2 border border-hairline rounded" value={pickedStage} onChange={(e) => setPickedStage(e.target.value)}>
        <option value="">Select a stage…</option>
        {stages.map((s: any) => <option key={s.name} value={s.name}>{s.name}</option>)}
      </select>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={() => setStageOpen(false)} className="text-body-s text-ink-secondary">Cancel</button>
        <button
          disabled={!pickedStage}
          className="bg-accent text-white px-3 py-1.5 rounded text-body-s disabled:opacity-50"
          onClick={async () => {
            const args: any = sel.mode.kind === "ids"
              ? { ids: Array.from(sel.mode.selected), stage: pickedStage }
              : { matchAll: { jobId: params.id, filter }, stage: pickedStage };
            const r = await bulkSetStage(args);
            const label = `Moved ${r.previousStages.length} to ${pickedStage}`;
            sel.clear();
            setStageOpen(false);
            setPickedStage("");
            undoToast.show({
              label,
              onUndo: async () => {
                // restore per-id previous stages — group by previousStage and call per group
                const byStage = new Map<string, any[]>();
                for (const { id, previousStage } of r.previousStages) {
                  if (!byStage.has(previousStage)) byStage.set(previousStage, []);
                  byStage.get(previousStage)!.push(id);
                }
                for (const [stage, ids] of byStage) {
                  await bulkSetStage({ ids, stage });
                }
              },
            });
          }}
        >Move</button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Smoke-check via `pnpm dev`.**

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/jobs/\[id\]/pipeline/page.tsx
git commit -m "feat(pipeline): bulk move-to-stage with per-id undo"
```

## Task 7.6 — Apply the same wiring to the cross-job pipeline page

**Files:**
- Modify: `app/dashboard/pipeline/pipeline-list.tsx`

- [ ] **Step 1: Apply the exact same pattern from Tasks 7.4 + 7.5 (selection hook + bulk action bar + ConfirmDialog + stage picker + undo toast) to this page.** The matchAll filter should pass `jobId: null` since this view spans jobs.

- [ ] **Step 2: Smoke-check via `pnpm dev` at `/dashboard/pipeline`.**

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/pipeline/pipeline-list.tsx
git commit -m "feat(pipeline): cross-job page bulk actions (mirror per-job)"
```

---

# PHASE 8 — Talent bank bulk actions

## Task 8.1 — Wire talent page to bulk delete (candidates)

**Files:**
- Modify: `app/dashboard/talent/page.tsx`

The talent bank's rows are applications with `jobPostingId = undefined`, but the bulk action operates on candidates (cascading delete). Map row → candidateId before calling the mutation.

- [ ] **Step 1: Add hooks**

```tsx
import { useTableSelection } from "@/hooks/use-table-selection";
import { useUndoToast } from "@/hooks/use-undo-toast";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { SelectAllMatchingBanner } from "@/components/ui/select-all-matching-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UndoToast } from "@/components/ui/undo-toast";

const sel = useTableSelection<string, { schoolId: string; filter: any }>();
const undoToast = useUndoToast();
const removeMany = useMutation(api.candidates.removeMany);
const undoRemove = useMutation(api.candidates.undoBatchDelete);
const totalCountQuery = useQuery(api.candidates.countForSchool, { schoolId: profile?.schoolId, filter: { poolId: selectedPoolId, stages: selectedStages, search: searchText } });

useEffect(() => {
  sel.setLoadedIds(results.map((r: any) => r.applicationId));
}, [results]);
useEffect(() => { sel.clear(); }, [selectedPoolId, selectedStages, searchText, sortBy]);
```

- [ ] **Step 2: Render BulkActionBar with Delete + Export buttons; map row → candidateId for ids mode**

```tsx
const [confirmDelete, setConfirmDelete] = useState(false);
const totalCount = totalCountQuery?.total ?? 0;

<BulkActionBar
  count={sel.count.kind === "all-matching" ? totalCount : sel.count.n}
  countLabel="candidates"
  onClear={() => sel.clear()}
  banner={
    sel.mode.kind === "ids" && sel.count.n === results.length && results.length > 0 && totalCount > results.length ? (
      <SelectAllMatchingBanner
        loadedCount={results.length}
        totalCount={totalCount}
        entityLabel="candidates"
        onSelectAllMatching={() => sel.selectAllMatching({ schoolId: profile.schoolId, filter: { poolId: selectedPoolId, stages: selectedStages, search: searchText } })}
      />
    ) : undefined
  }
>
  <button className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-body-s" onClick={() => setConfirmDelete(true)}>
    Delete
  </button>
  {sel.mode.kind === "ids" && (
    <button className="bg-surface text-ink px-3 py-1.5 rounded text-body-s" onClick={() => { /* CSV in Phase 12 */ }}>
      Export CSV
    </button>
  )}
</BulkActionBar>

<ConfirmDialog
  open={confirmDelete}
  title={`Delete ${sel.count.kind === "all-matching" ? totalCount : sel.count.n} candidates?`}
  body="This removes their resumes, every application across roles, and all evaluations. You can undo within 10 seconds."
  confirmLabel="Delete"
  onConfirm={async () => {
    setConfirmDelete(false);
    const args: any = sel.mode.kind === "ids"
      ? { ids: results.filter((r: any) => sel.isSelected(r.applicationId)).map((r: any) => r.candidateId) }
      : { matchAll: { schoolId: profile.schoolId, filter: { poolId: selectedPoolId, stages: selectedStages, search: searchText } } };
    const r = await removeMany(args);
    sel.clear();
    undoToast.show({
      label: `Deleted ${r.count} ${r.count === 1 ? "candidate" : "candidates"}`,
      onUndo: () => undoRemove({ batchId: r.batchId }),
    });
  }}
  onCancel={() => setConfirmDelete(false)}
/>

<div className="fixed top-6 right-6 z-50 space-y-2">
  {undoToast.toasts.map((t) => (
    <UndoToast key={t.id} label={t.label} onUndo={() => undoToast.undo(t.id)} onDismiss={() => undoToast.dismiss(t.id)} />
  ))}
</div>
```

- [ ] **Step 3: Wire selection props on the `<ApplicationTable />` instance** (same shape as Task 7.4).

- [ ] **Step 4: Smoke-check via `pnpm dev` at `/dashboard/talent`.**

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/talent/page.tsx
git commit -m "feat(talent): bulk delete candidates with undo"
```

---

# PHASE 9 — Jobs list bulk actions (drafts + status change)

## Task 9.1 — `jobs.removeMany` (draft-only) + `undoBatchDelete` + `finalizeBatchDelete`

**Files:**
- Modify: `convex/jobs.ts`
- Test: `tests/convex/jobs-delete.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// tests/convex/jobs-delete.test.ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
// modules

describe("jobs.removeMany", () => {
  it("marks draft jobs pending and finalize deletes them", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
    const j1 = await t.mutation("jobs:create", {
      schoolId, title: "Draft 1", subject: "M", level: "PGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
    // jobs.create defaults status to "draft" — verify against your `create` mutation source
    const r = await t.mutation("jobs:removeMany", { ids: [j1] });
    expect(r.count).toBe(1);
    await t.finishInProgressScheduledFunctions();
    const after = await t.run(async (ctx) => ctx.db.get(j1));
    expect(after).toBeNull();
  });

  it("throws if any selected job is non-draft", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
    const j1 = await t.mutation("jobs:create", {
      schoolId, title: "T", subject: "M", level: "PGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
    await t.mutation("jobs:publish", { jobId: j1 }); // moves to "active"
    await expect(
      t.mutation("jobs:removeMany", { ids: [j1] })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement in `convex/jobs.ts`**

```ts
import { internal } from "./_generated/api";

function makeBatchId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const removeManyJobsArgs = v.union(
  v.object({ ids: v.array(v.id("jobPostings")) }),
  v.object({ matchAll: v.object({ schoolId: v.id("schools"), filter: v.optional(v.any()) }) }),
);

export const removeMany = mutation({
  args: removeManyJobsArgs,
  handler: async (ctx, args) => {
    let ids: any[] = [];
    if ("ids" in args) ids = args.ids;
    else {
      // matchAll only allows draft filter — server-enforce by checking filter.status === "draft"
      if (args.matchAll.filter?.status && args.matchAll.filter.status !== "draft") {
        throw new Error("Bulk delete only supports draft jobs");
      }
      const rows = await ctx.db.query("jobPostings")
        .withIndex("by_schoolId", (q) => q.eq("schoolId", args.matchAll.schoolId))
        .filter((q) => q.and(
          q.eq(q.field("pendingDeleteAt"), undefined),
          q.eq(q.field("status"), "draft"),
        ))
        .collect();
      ids = rows.map((r) => r._id);
    }

    // Validate all are drafts BEFORE marking anything (Convex transaction will roll back on throw).
    for (const id of ids) {
      const job = await ctx.db.get(id);
      if (!job) continue;
      if (job.status !== "draft") {
        throw new Error(`Job ${id} is not a draft; bulk delete denied`);
      }
    }

    const batchId = makeBatchId();
    let count = 0;
    for (const id of ids) {
      const job = await ctx.db.get(id);
      if (!job || job.pendingDeleteAt != null) continue;
      await ctx.db.patch(id, { pendingDeleteAt: Date.now(), pendingDeleteBatchId: batchId });
      count++;
    }
    await ctx.scheduler.runAfter(10_000, internal.jobs.finalizeBatchDelete, { batchId });
    return { batchId, count };
  },
});

export const undoBatchDelete = mutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("jobPostings")
      .filter((q) => q.eq(q.field("pendingDeleteBatchId"), args.batchId))
      .collect();
    let restored = 0;
    for (const r of rows) {
      if (r.pendingDeleteAt == null) continue;
      await ctx.db.patch(r._id, { pendingDeleteAt: undefined, pendingDeleteBatchId: undefined });
      restored++;
    }
    return { restored };
  },
});

export const finalizeBatchDelete = internalMutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("jobPostings")
      .filter((q) => q.eq(q.field("pendingDeleteBatchId"), args.batchId))
      .collect();
    for (const r of rows) {
      if (r.pendingDeleteAt == null) continue;
      await ctx.db.delete(r._id);
    }
  },
});
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add convex/jobs.ts tests/convex/jobs-delete.test.ts
git commit -m "feat(jobs): removeMany (draft-only) + undoBatchDelete + finalize"
```

## Task 9.2 — `jobs.bulkSetStatus`

**Files:**
- Modify: `convex/jobs.ts`
- Test: `tests/convex/jobs-status.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// tests/convex/jobs-status.test.ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
// modules

describe("jobs.bulkSetStatus", () => {
  it("updates status and returns previousStatuses", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
    const j1 = await t.mutation("jobs:create", {
      schoolId, title: "T1", subject: "M", level: "PGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
    await t.mutation("jobs:publish", { jobId: j1 });
    const r = await t.mutation("jobs:bulkSetStatus", { ids: [j1], status: "paused" });
    expect(r.previousStatuses.find((p: any) => p.id === j1)?.previousStatus).toBe("active");
    const after = await t.run(async (ctx) => ctx.db.get(j1));
    expect(after.status).toBe("paused");
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
const bulkSetStatusArgs = v.union(
  v.object({ ids: v.array(v.id("jobPostings")), status: v.string() }),
  v.object({ matchAll: v.object({ schoolId: v.id("schools"), filter: v.optional(v.any()) }), status: v.string() }),
);

export const bulkSetStatus = mutation({
  args: bulkSetStatusArgs,
  handler: async (ctx, args) => {
    let ids: any[] = [];
    if ("ids" in args) ids = args.ids;
    else {
      const rows = await ctx.db.query("jobPostings")
        .withIndex("by_schoolId", (q) => q.eq("schoolId", args.matchAll.schoolId))
        .filter((q) => q.eq(q.field("pendingDeleteAt"), undefined))
        .collect();
      ids = rows.map((r) => r._id);
    }
    const batchId = makeBatchId();
    const previousStatuses: Array<{ id: any; previousStatus: string }> = [];
    for (const id of ids) {
      const j = await ctx.db.get(id);
      if (!j) continue;
      previousStatuses.push({ id, previousStatus: j.status });
      await ctx.db.patch(id, { status: args.status });
    }
    return { batchId, previousStatuses };
  },
});
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add convex/jobs.ts tests/convex/jobs-status.test.ts
git commit -m "feat(jobs): bulkSetStatus with previousStatuses snapshot"
```

## Task 9.3 — Per-card checkbox on jobs list

**Files:**
- Modify: `components/jobs/jobs-list.tsx`

- [ ] **Step 1: Accept selection props** (same shape as Task 7.3 but applied to a grid of cards).

```tsx
interface JobsListProps {
  jobs: any[];
  selected?: (id: string) => boolean;
  onToggleRow?: (id: string, shiftKey: boolean) => void;
  onToggleAll?: (ids: string[]) => void;
  loadMoreRef?: (node: HTMLElement | null) => void;
}
```

- [ ] **Step 2: Render a checkbox at the top-left of each job card**

```tsx
<div className="absolute top-3 left-3">
  <input
    type="checkbox"
    checked={selected?.(job._id) ?? false}
    onClick={(e) => e.stopPropagation()}
    onChange={(e) => onToggleRow?.(job._id, (e.nativeEvent as MouseEvent).shiftKey)}
  />
</div>
```

- [ ] **Step 3: Visual highlight on selected cards** — a subtle border or background change. Add `${selected?.(job._id) ? "ring-2 ring-accent" : ""}` to the card container.

- [ ] **Step 4: Commit**

```bash
git add components/jobs/jobs-list.tsx
git commit -m "feat(jobs-list): per-card checkbox + selection highlight"
```

## Task 9.4 — Wire bulk actions on jobs page

**Files:**
- Modify: `app/dashboard/jobs/page.tsx`

- [ ] **Step 1: Add hooks**

```tsx
import { useTableSelection } from "@/hooks/use-table-selection";
import { useUndoToast } from "@/hooks/use-undo-toast";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { SelectAllMatchingBanner } from "@/components/ui/select-all-matching-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UndoToast } from "@/components/ui/undo-toast";

const sel = useTableSelection<string, { schoolId: string; filter: any }>();
const undoToast = useUndoToast();
const removeMany = useMutation(api.jobs.removeMany);
const undoRemove = useMutation(api.jobs.undoBatchDelete);
const bulkSetStatus = useMutation(api.jobs.bulkSetStatus);
const totalCountQuery = useQuery(api.jobs.countBySchool, { schoolId: profile?.schoolId, filter });
useEffect(() => { sel.setLoadedIds(results.map((j: any) => j._id)); }, [results]);
useEffect(() => { sel.clear(); }, [filter, sort]);
```

- [ ] **Step 2: Compute "drafts only" predicate**

```tsx
const allDrafts = sel.mode.kind === "ids"
  ? Array.from(sel.mode.selected).every((id) => {
      const job = results.find((j: any) => j._id === id);
      return job?.status === "draft";
    })
  : (filter?.status === "draft");
```

- [ ] **Step 3: Render the bulk action bar with conditional Delete button**

```tsx
<BulkActionBar count={sel.count.kind === "all-matching" ? totalCount : sel.count.n} countLabel="jobs" onClear={() => sel.clear()}
  banner={ /* SelectAllMatchingBanner — same pattern as Task 8.1 */ }
>
  <button
    disabled={!allDrafts}
    title={!allDrafts ? "Only draft jobs can be deleted in bulk" : undefined}
    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-body-s"
    onClick={() => setConfirmDelete(true)}
  >Delete drafts</button>

  <button className="bg-accent text-white px-3 py-1.5 rounded text-body-s" onClick={() => setStatusPickerOpen(true)}>
    Change status
  </button>

  {sel.mode.kind === "ids" && <button onClick={() => { /* CSV in Phase 12 */ }}>Export CSV</button>}
</BulkActionBar>
```

- [ ] **Step 4: Wire ConfirmDialog (for delete) and a status picker modal (for change-status) — mirror Task 7.5 patterns, but per-job-id grouped by previousStatus on undo.**

- [ ] **Step 5: Smoke-check via `pnpm dev` at `/dashboard/jobs`.**

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/jobs/page.tsx
git commit -m "feat(jobs): bulk delete drafts + bulk status change with undo"
```

---

# PHASE 10 — Criteria UX

## Task 10.1 — `jobs.saveCriteriaText` mutation

**Files:**
- Modify: `convex/jobs.ts`
- Test: `tests/convex/jobs-criteria.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// tests/convex/jobs-criteria.test.ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
// modules

describe("jobs.saveCriteriaText", () => {
  it("updates the criteria field", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
    const jobId = await t.mutation("jobs:create", {
      schoolId, title: "T", subject: "M", level: "PGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
    await t.mutation("jobs:saveCriteriaText", { jobId, text: "Must have 5+ years" });
    const after = await t.run(async (ctx) => ctx.db.get(jobId));
    expect(after.criteria).toBe("Must have 5+ years");
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
export const saveCriteriaText = mutation({
  args: { jobId: v.id("jobPostings"), text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, { criteria: args.text });
  },
});
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add convex/jobs.ts tests/convex/jobs-criteria.test.ts
git commit -m "feat(jobs): saveCriteriaText mutation"
```

## Task 10.2 — `CriteriaNaturalLanguageEditor` component

**Files:**
- Create: `components/criteria/CriteriaNaturalLanguageEditor.tsx`
- Test: `tests/components/criteria-nl-editor.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CriteriaNaturalLanguageEditor } from "../../components/criteria/CriteriaNaturalLanguageEditor";

describe("CriteriaNaturalLanguageEditor", () => {
  it("calls onSave on blur with new text", () => {
    const onSave = vi.fn();
    render(<CriteriaNaturalLanguageEditor initialValue="" onSave={onSave} />);
    const ta = screen.getByPlaceholderText(/Describe the ideal candidate/);
    fireEvent.change(ta, { target: { value: "5 years" } });
    fireEvent.blur(ta);
    expect(onSave).toHaveBeenCalledWith("5 years");
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// components/criteria/CriteriaNaturalLanguageEditor.tsx
"use client";

import { useState } from "react";

interface Props {
  initialValue: string;
  onSave: (text: string) => void | Promise<void>;
}

export function CriteriaNaturalLanguageEditor({ initialValue, onSave }: Props) {
  const [text, setText] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleBlur = async () => {
    if (text === initialValue) return;
    setSaving(true);
    try {
      await onSave(text);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <textarea
        className="w-full min-h-[180px] p-3 border border-hairline rounded text-body-s"
        placeholder="Describe the ideal candidate in plain language — qualifications, experience, must-haves, deal-breakers."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
      />
      <div className="absolute bottom-2 right-3 text-body-xs text-ink-secondary">
        {saving ? "Saving…" : saved ? "Saved" : ""}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add components/criteria/CriteriaNaturalLanguageEditor.tsx tests/components/criteria-nl-editor.test.tsx
git commit -m "feat(criteria): NL textarea component with autosave on blur"
```

## Task 10.3 — Restructure criteria page

**Files:**
- Modify: `app/dashboard/jobs/[id]/criteria/page.tsx`
- Delete: `components/criteria/AISuggestedCriteria.tsx`

- [ ] **Step 1: Replace the body of the criteria page** so it stacks the NL textarea + structured editor:

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Badge, Card } from "@/components/ui";
import { ScoringRuleEditor } from "@/components/criteria/ScoringRuleEditor";
import { CriteriaNaturalLanguageEditor } from "@/components/criteria/CriteriaNaturalLanguageEditor";

// ...keep the JobTabs, jobBadge helpers as-is...

export default function CriteriaPage() {
  const { id } = useParams<{ id: string }>();
  const job = useQuery(api.jobs.get, { jobId: id as any });
  const saveRules = useMutation(api.jobs.saveScoringRules);
  const saveCriteriaText = useMutation(api.jobs.saveCriteriaText);
  const suggestCriteria = useAction(api.scoring.suggestCriteria);
  const [saving, setSaving] = useState(false);
  const [suggested, setSuggested] = useState<any>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const handleGenerateSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const result = await suggestCriteria({ jobId: id as any });
      if (result) setSuggested(result);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSave = async (dimensions: any[], minimumScore: number, autoRejectScore: number) => {
    setSaving(true);
    try {
      await saveRules({
        jobId: id as any,
        scoringRules: { dimensions, minimumScore, autoRejectScore, generatedBy: "manual", version: 1 },
      });
    } finally {
      setSaving(false);
    }
  };

  if (!job) return null;

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/jobs", label: "Jobs" }}
        title={job.title ?? "Scoring criteria"}
        subtitle={[job.subject, job.level, job.board].filter(Boolean).join(" · ")}
        status={jobBadge(job.status)}
        actions={
          <button
            onClick={handleGenerateSuggestions}
            disabled={loadingSuggestions}
            className="bg-accent text-white px-4 py-2 rounded text-body-s disabled:opacity-50"
          >
            {loadingSuggestions ? "Generating…" : "Generate with AI"}
          </button>
        }
      />

      <JobTabs jobId={id} active="criteria" />

      <div className="mt-7 space-y-5">
        <Card padding="md" elevation={1}>
          <h3 className="text-body-s font-semibold text-ink mb-3">Criteria (natural language)</h3>
          <CriteriaNaturalLanguageEditor
            initialValue={job.criteria ?? ""}
            onSave={(text) => saveCriteriaText({ jobId: id as any, text })}
          />
        </Card>

        <Card padding="md" elevation={1}>
          <h3 className="text-body-s font-semibold text-ink mb-4">Scoring rules</h3>
          <ScoringRuleEditor
            initialDimensions={suggested?.dimensions ?? job.scoringRules?.dimensions ?? []}
            onSave={handleSave}
            saving={saving}
          />
        </Card>
      </div>
    </div>
  );
}
```

(Keep the `JobTabs` and `jobBadge` helpers in the same file or extract — match the existing style.)

- [ ] **Step 2: Delete the now-unused component**

```bash
rm components/criteria/AISuggestedCriteria.tsx
```

- [ ] **Step 3: Verify there are no remaining imports of `AISuggestedCriteria`**

```bash
grep -rn "AISuggestedCriteria" --include="*.tsx" --include="*.ts" app/ components/
```

Expected: no matches.

- [ ] **Step 4: Smoke-check via `pnpm dev` at `/dashboard/jobs/<id>/criteria`.**

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/jobs/\[id\]/criteria/page.tsx components/criteria/AISuggestedCriteria.tsx
git commit -m "feat(criteria): NL textarea + structured editor with page-level AI button"
```

---

# PHASE 11 — Rejection history

## Task 11.1 — `candidates.getRejectionHistory` query

**Files:**
- Modify: `convex/candidates.ts`
- Test: `tests/convex/candidates-rejection-history.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// tests/convex/candidates-rejection-history.test.ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
// modules

describe("candidates.getRejectionHistory", () => {
  it("returns prior rejections excluding the current application", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
    const candidateId = await t.mutation("candidates:create", { name: "A", email: "a@x.com" });
    const job1 = await t.mutation("jobs:create", {
      schoolId, title: "Math PGT", subject: "Math", level: "PGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
    const job2 = await t.mutation("jobs:create", {
      schoolId, title: "Math TGT", subject: "Math", level: "TGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
    const app1 = await t.mutation("applications:create", { candidateId, schoolId, jobPostingId: job1, stage: "rejected" });
    const app2 = await t.mutation("applications:create", { candidateId, schoolId, jobPostingId: job2, stage: "applied" });

    const history = await t.query("candidates:getRejectionHistory", { candidateId, excludeApplicationId: app2 });
    expect(history.length).toBe(1);
    expect(history[0].applicationId).toBe(app1);
    expect(history[0].jobTitle).toBe("Math PGT");
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
export const getRejectionHistory = query({
  args: {
    candidateId: v.id("candidates"),
    excludeApplicationId: v.optional(v.id("applications")),
  },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", args.candidateId))
      .filter((q) => q.eq(q.field("pendingDeleteAt"), undefined))
      .collect();

    const result: any[] = [];
    for (const app of apps) {
      if (args.excludeApplicationId && app._id === args.excludeApplicationId) continue;

      const evaluations = app._id
        ? await ctx.db
            .query("evaluations")
            .withIndex("by_applicationId", (q) => q.eq("applicationId", app._id))
            .filter((q) => q.eq(q.field("submitted"), true))
            .collect()
        : [];

      const hasReject = evaluations.some((e) => e.recommendation === "reject");
      if (app.stage !== "rejected" && !hasReject) continue;

      const job = app.jobPostingId ? await ctx.db.get(app.jobPostingId) : null;
      const evalSubmitted = evaluations
        .filter((e) => e.recommendation != null)
        .map((e) => e.submittedAt ?? 0);
      const rejectedAt = Math.max(app._creationTime, ...(evalSubmitted.length ? evalSubmitted : [0]));

      result.push({
        applicationId: app._id,
        jobId: app.jobPostingId,
        jobTitle: job?.title ?? "(deleted role)",
        jobSubject: job?.subject,
        jobLevel: job?.level,
        rejectedAt,
        evaluations: evaluations.map((e) => ({
          evaluatorRole: e.evaluatorRole,
          recommendation: e.recommendation,
          comments: e.comments,
          scores: {
            subjectKnowledge: e.subjectKnowledge,
            classroomManagement: e.classroomManagement,
            communication: e.communication,
            overallFit: e.overallFit,
          },
          submittedAt: e.submittedAt,
        })),
      });
    }

    result.sort((a, b) => b.rejectedAt - a.rejectedAt);
    return result;
  },
});
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add convex/candidates.ts tests/convex/candidates-rejection-history.test.ts
git commit -m "feat(candidates): getRejectionHistory query"
```

## Task 11.2 — Extend `getPipelineForJob` with `priorRejectCount` per row

**Files:**
- Modify: `convex/applications.ts`
- Test: `tests/convex/applications-pipeline.test.ts` (extend)

- [ ] **Step 1: Add a test**

```ts
it("returns priorRejectCount per row", async () => {
  const t = convexTest(schema, modules);
  const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
  const cId = await t.mutation("candidates:create", { name: "A", email: "a@x.com" });
  const job1 = await t.mutation("jobs:create", {
    schoolId, title: "J1", subject: "M", level: "PGT", board: "CBSE",
    qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
  });
  const job2 = await t.mutation("jobs:create", {
    schoolId, title: "J2", subject: "M", level: "PGT", board: "CBSE",
    qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
  });
  await t.mutation("applications:create", { candidateId: cId, schoolId, jobPostingId: job1, stage: "rejected" });
  const currentApp = await t.mutation("applications:create", { candidateId: cId, schoolId, jobPostingId: job2, stage: "applied" });
  const result = await t.query("applications:getPipelineForJob", {
    jobId: job2, paginationOpts: { cursor: null, numItems: 10 },
  });
  expect(result.page[0].priorRejectCount).toBe(1);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Inside `getPipelineForJob`'s enrich loop, compute `priorRejectCount`**

```ts
// Inside the enriched-row loop, after fetching candidate:
const otherApps = await ctx.db
  .query("applications")
  .withIndex("by_candidateId", (q) => q.eq("candidateId", candidate._id))
  .filter((q) => q.and(
    q.eq(q.field("pendingDeleteAt"), undefined),
    q.neq(q.field("_id"), app._id),
  ))
  .collect();
let priorRejectCount = 0;
for (const other of otherApps) {
  if (other.stage === "rejected") { priorRejectCount++; continue; }
  const evals = await ctx.db
    .query("evaluations")
    .withIndex("by_applicationId", (q) => q.eq("applicationId", other._id))
    .filter((q) => q.eq(q.field("recommendation"), "reject"))
    .collect();
  if (evals.length > 0) priorRejectCount++;
}
// Add to the enriched row object:
priorRejectCount,
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add convex/applications.ts tests/convex/applications-pipeline.test.ts
git commit -m "feat(pipeline): include priorRejectCount per row"
```

## Task 11.3 — `RejectionHistoryIndicator` row badge

**Files:**
- Create: `components/pipeline/rejection-history-indicator.tsx`
- Modify: `components/pipeline/application-table.tsx` (render the badge per row)

- [ ] **Step 1: Implement the badge component**

```tsx
// components/pipeline/rejection-history-indicator.tsx
"use client";

interface Props {
  count: number;
  onClick?: () => void;
}

export function RejectionHistoryIndicator({ count, onClick }: Props) {
  if (count <= 0) return null;
  const label = count === 1 ? "1 prior reject" : `${count} prior rejects`;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="inline-flex items-center gap-1 text-body-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded"
      title="Click to view rejection history"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Render the badge in `application-table.tsx` next to the candidate name** when `row.priorRejectCount > 0`:

```tsx
<div className="flex items-center gap-2">
  <span className="font-medium text-ink">{row.name}</span>
  {row.priorRejectCount > 0 && (
    <RejectionHistoryIndicator
      count={row.priorRejectCount}
      onClick={() => onRowClick?.(row, { expandPreviousOutcomes: true })}
    />
  )}
</div>
```

(Adjust `onRowClick` signature to accept a second arg — it's an existing callback you pass from the page; the second-arg shape is consumed by the drawer in Task 11.4.)

- [ ] **Step 3: Smoke-check via `pnpm dev`.**

- [ ] **Step 4: Commit**

```bash
git add components/pipeline/rejection-history-indicator.tsx components/pipeline/application-table.tsx
git commit -m "feat(pipeline): rejection history badge on row"
```

## Task 11.4 — `PreviousOutcomesSection` in drawer

**Files:**
- Create: `components/pipeline/previous-outcomes-section.tsx`
- Modify: `components/pipeline/application-drawer.tsx`

- [ ] **Step 1: Implement the section component**

```tsx
// components/pipeline/previous-outcomes-section.tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface Props {
  candidateId: any;
  currentApplicationId: any;
  defaultExpanded?: boolean;
}

export function PreviousOutcomesSection({ candidateId, currentApplicationId, defaultExpanded = false }: Props) {
  const history = useQuery(api.candidates.getRejectionHistory, {
    candidateId, excludeApplicationId: currentApplicationId,
  });
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  if (!history || history.length === 0) return null;

  return (
    <div className="mt-6 border-t border-hairline pt-5">
      <h3 className="text-body-s font-semibold text-ink mb-3">Previous outcomes ({history.length})</h3>
      <div className="space-y-3">
        {history.map((h) => {
          const expanded = expandedById[h.applicationId] ?? defaultExpanded;
          return (
            <div key={h.applicationId} className="rounded border border-hairline p-3">
              <button
                onClick={() => setExpandedById((s) => ({ ...s, [h.applicationId]: !expanded }))}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="text-body-s">
                  <span className="font-medium">{h.jobTitle}</span>
                  <span className="text-ink-secondary"> · rejected {new Date(h.rejectedAt).toLocaleDateString()}</span>
                </span>
                <span aria-hidden>{expanded ? "▾" : "▸"}</span>
              </button>
              {expanded && (
                <div className="mt-2 space-y-2 text-body-s">
                  {h.evaluations.length === 0 ? (
                    <p className="text-ink-secondary italic">No evaluation notes recorded.</p>
                  ) : (
                    h.evaluations.map((e, i) => (
                      <div key={i} className="pl-2 border-l-2 border-hairline">
                        <div className="text-ink font-medium capitalize">{e.evaluatorRole.replace("_", " ")}</div>
                        {e.recommendation && (
                          <div className="text-ink-secondary text-body-xs">
                            Recommendation: <span className="font-medium">{e.recommendation}</span>
                          </div>
                        )}
                        {e.comments && <div className="text-ink-secondary italic">"{e.comments}"</div>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render the section inside `application-drawer.tsx`** — below the candidate summary, above the danger-zone footer:

```tsx
<PreviousOutcomesSection
  candidateId={candidate._id}
  currentApplicationId={application._id}
  defaultExpanded={expandPreviousOutcomes}
/>
```

(`expandPreviousOutcomes` comes from the drawer's open-state prop, passed when the badge click opens the drawer.)

- [ ] **Step 3: Smoke-check via `pnpm dev`.**

- [ ] **Step 4: Commit**

```bash
git add components/pipeline/previous-outcomes-section.tsx components/pipeline/application-drawer.tsx
git commit -m "feat(drawer): previous outcomes section with eval notes"
```

---

# PHASE 12 — CSV export wiring

## Task 12.1 — Wire CSV export on the per-job pipeline page

**Files:**
- Modify: `app/dashboard/jobs/[id]/pipeline/page.tsx`

- [ ] **Step 1: Replace the placeholder Export button onClick**

```tsx
import { rowsToCsv, downloadCsv } from "@/lib/csv-export";

// inside the Export onClick:
const selectedRows = sel.mode.kind === "ids"
  ? results.filter((r: any) => sel.isSelected(r.applicationId))
  : results;
const csv = rowsToCsv(selectedRows, [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "aiMatchScore", label: "Score" },
  { key: "stage", label: "Stage" },
  { key: "subjects", label: "Subjects" },
  { key: "createdAt", label: "Applied At" },
]);
downloadCsv(`pipeline-${job.title}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
```

- [ ] **Step 2: Confirm the button is hidden in matchAll mode** (already in the JSX from Task 7.4).

- [ ] **Step 3: Smoke-check by clicking Export with rows selected.**

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/jobs/\[id\]/pipeline/page.tsx
git commit -m "feat(pipeline): CSV export of selected rows"
```

## Task 12.2 — CSV export on talent page

**Files:**
- Modify: `app/dashboard/talent/page.tsx`

- [ ] **Step 1: Apply the same pattern from Task 12.1** with the talent-bank column set:

```tsx
const csv = rowsToCsv(selectedRows, [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "yearsExperience", label: "Years Experience" },
  { key: "subjects", label: "Subjects" },
  { key: "createdAt", label: "Created At" },
]);
downloadCsv(`talent-${new Date().toISOString().slice(0, 10)}.csv`, csv);
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/talent/page.tsx
git commit -m "feat(talent): CSV export of selected candidates"
```

## Task 12.3 — CSV export on jobs page

**Files:**
- Modify: `app/dashboard/jobs/page.tsx`

- [ ] **Step 1: Apply the same pattern** with the jobs column set:

```tsx
const csv = rowsToCsv(selectedRows, [
  { key: "title", label: "Title" },
  { key: "subject", label: "Subject" },
  { key: "level", label: "Level" },
  { key: "board", label: "Board" },
  { key: "status", label: "Status" },
  { key: "positions", label: "Positions" },
  { key: "_creationTime", label: "Created At" },
]);
downloadCsv(`jobs-${new Date().toISOString().slice(0, 10)}.csv`, csv);
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/jobs/page.tsx
git commit -m "feat(jobs): CSV export of selected jobs"
```

---

# PHASE 13 — Final integration sweep

## Task 13.1 — Run the full test suite and lint, fix any drift

- [ ] **Step 1: Run the suite**

```bash
pnpm test
pnpm lint
```

- [ ] **Step 2: Fix anything that broke.** Most likely culprits:
  - Old callers of the un-paginated `listForSchool` / `getPipelineForJob` / `listBySchool` that need to be updated to `usePaginatedQuery`.
  - Stale type imports.
  - Linter complaints about unused imports.

- [ ] **Step 3: Verify `pnpm build` (Next.js production build) succeeds**

```bash
pnpm build
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: post-merge cleanup, lint fixes, test stabilization"
```

## Task 13.2 — Manual end-to-end walkthrough

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Walk the spec's "Manual / preview" section in order**, ticking each one. Anything unexpected → file an issue or fix in place:
  - Pagination + infinite scroll on talent bank with 2k+ candidates.
  - Multi-select (ids mode + matchAll banner + clear).
  - Bulk Remove from pipeline + undo within 10s.
  - Bulk Delete candidates (matchAll mode) on talent.
  - Bulk stage change with per-id undo.
  - Bulk job delete (drafts only) — disabled state for non-drafts.
  - Bulk job status change.
  - Candidate delete from drawer.
  - Criteria page: NL textarea autosave + structured editor + "Generate with AI".
  - Prior reject badge on pipeline row → drawer Previous outcomes expanded.
  - CSV export from each of the three lists.

- [ ] **Step 3: No commit unless fixes were needed.**

---

## End of plan

When all tasks are complete, the spec's Goals are met:

- ✅ Cascading hard-delete for candidates (Phase 6) with 10s undo (Phase 4).
- ✅ NL criteria textarea alongside structured editor (Phase 10).
- ✅ Multi-select primitive + bulk action bar (Phase 4) consumed by all three list views (Phases 7, 8, 9).
- ✅ Three semantically different destructive actions: Reject (pre-existing), Remove from pipeline (Phase 7), Delete candidate (Phases 6 + 8).
- ✅ Rejection history with eval notes on pipeline rows (Phase 11).
- ✅ 10-second undo via toast for every destructive bulk action (Phases 6, 7, 8, 9).
- ✅ Cursor pagination + select-all-matching (Phases 3 + 5).
