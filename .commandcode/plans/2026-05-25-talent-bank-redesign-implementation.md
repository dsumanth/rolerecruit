# Talent Bank Redesign — Implementation Plan

**Date:** 2026-05-25
**Based on:** `.commandcode/plans/2026-05-25-talent-bank-redesign-design.md`

---

## Phase 1: Schema Changes

### 1.1 Add new tables to `convex/schema.ts`

Add after the `evaluations` table (around line 184):

**`pools` table:**
```ts
pools: defineTable({
  schoolId: v.id("schools"),
  name: v.string(),
  createdBy: v.union(v.literal("ai"), v.literal("admin")),
  tags: v.array(v.string()),
  createdAt: v.number(),
}).index("by_schoolId", ["schoolId"]),
```

**`candidatePools` table:**
```ts
candidatePools: defineTable({
  candidateId: v.id("candidates"),
  poolId: v.id("pools"),
  confidence: v.number(),
  createdAt: v.number(),
})
  .index("by_candidateId", ["candidateId"])
  .index("by_poolId", ["poolId"]),
```

**`globalCriteria` table:**
```ts
globalCriteria: defineTable({
  schoolId: v.id("schools"),
  scoringRules: v.object({
    dimensions: v.array(v.object({
      name: v.string(),
      weight: v.number(),
      config: v.any(),
    })),
    minimumScore: v.number(),
    autoRejectScore: v.number(),
    generatedBy: v.union(v.literal("agent"), v.literal("manual"), v.literal("agent_reviewed")),
    version: v.number(),
  }),
  updatedAt: v.number(),
}).index("by_schoolId", ["schoolId"]),
```

### 1.2 Add optional fields to existing tables in `convex/schema.ts`

**`candidates` table — add `poolIds`:**
```ts
poolIds: v.optional(v.array(v.id("pools"))),
```
Add this field after `talentBankFlag`.

**`applications` table — add `globalScore`:**
```ts
globalScore: v.optional(v.number()),
```
Add this field after `aiMatchScore`. Use `v.optional()` per taste (existing production docs lack this field).

---

## Phase 2: Convex Backend

### 2.1 Create `convex/pools.ts`

New file. Functions:

| Function | Kind | Args | Behavior |
|----------|------|------|----------|
| `create` | mutation | `{ schoolId, name, tags, createdBy }` | Dedup check by `(schoolId, name)` via index query. Insert pool. Return pool ID. |
| `listForSchool` | query | `{ schoolId }` | Query `pools` by `by_schoolId` index. Return all pools sorted by name. |
| `update` | mutation | `{ poolId, name?, tags? }` | Patch pool. Dedup check on rename. |
| `remove` | mutation | `{ poolId }` | Delete pool + all `candidatePools` entries for that pool. Also remove poolId from affected `candidates.poolIds`. |
| `suggest` | action | `{ schoolId }` | Fetches unpooled candidates for school. Calls DeepSeek with candidate profiles to suggest pool categories. Returns `[{ name, tags, sampleCandidateIds }]`. Does NOT persist. |
| `autoTagCandidate` | internalAction | `{ candidateId }` | Fetches candidate + existing pools for school. Calls DeepSeek to categorize. Deduplicates against existing pools. Creates new pools if needed. Inserts `candidatePools` rows. Updates `candidates.poolIds`. |
| `assignToPool` | mutation | `{ candidateId, poolId, confidence }` | Insert `candidatePools` row. Push `poolId` into `candidates.poolIds` if not already present. |
| `unassignFromPool` | mutation | `{ candidateId, poolId }` | Delete `candidatePools` row. Remove `poolId` from `candidates.poolIds`. |

**DeepSeek integration:** Use same pattern as `convex/scoring.ts` — `fetch` to DeepSeek API from inside `internalAction`. System prompt: "Categorize this teacher into one or more pools like TGT English, PGT Mathematics. Return JSON: `[{ name, confidence, tags }]`." Catch errors gracefully, return empty array on failure.

### 2.2 Create `convex/globalCriteria.ts`

New file. Functions:

| Function | Kind | Args | Behavior |
|----------|------|------|----------|
| `get` | query | `{ schoolId }` | Query `globalCriteria` by `by_schoolId`. Return first or null. |
| `save` | mutation | `{ schoolId, scoringRules }` | Upsert — check if exists, if so patch, else insert. Increment `version`. Set `updatedAt: Date.now()`. |
| `suggest` | action | `{ schoolId }` | Fetch school profile (name, board). Call DeepSeek to generate global scoring rubric. Return `ScoringRules` (same shape as jobPostings). |
| `scoreAllCandidates` | internalAction | `{ schoolId }` | Fetch global criteria + all candidates (via `applications.by_schoolId`). For each candidate, call `scoreDimension()` from `convex/scoring.ts` for each dimension, compute weighted sum. Call `getRecommendation()`. Update `applications.globalScore` and `scoringResult`. |

**Key design:** `scoreAllCandidates` imports and reuses `scoreDimension` and `getRecommendation` from `convex/scoring.ts`. No new scoring logic — the pure functions handle everything. The `ScoringRules` shape from global criteria matches job postings exactly, so `scoreDimension(name, config, candidateProfile)` works unchanged.

### 2.3 Extend `convex/candidates.ts`

**Modify `listForSchool` query:**
- Add optional `poolId` arg: `poolId: v.optional(v.id("pools"))`
- After current dedup + join logic, for each candidate:
  - Load pool names: query `candidatePools` by `by_candidateId`, join to `pools` table
  - Attach `globalScore` from the application row (already available)
  - Attach `poolIds` and `poolNames` to return object
- If `poolId` filter provided, filter candidates to those with matching `candidatePools` entry

**Return type (conceptual):**
```ts
{
  _id, name, phone?, email?, location?, qualifications[], certifications[],
  boardExperience[], subjects[], yearsExperience?, currentSchool?, resumeUrl?,
  sourceChannel?, talentBankFlag, poolIds?, poolNames[],
  applicationId, stage, aiMatchScore?, globalScore?
}
```

**Modify `updateScore` mutation:**
- Actually write `globalScore` and `scoringResult` to the application (or remove this function if unused)

### 2.4 Wire auto-tagging into candidate creation

In `convex/candidates.ts` `create` mutation or sourcing flows:
- After inserting candidate + application, fire async: `ctx.scheduler.runAfter(0, internal.pools.autoTagCandidate, { candidateId })`
- Non-blocking — candidate creation succeeds regardless of AI result

---

## Phase 3: Frontend Components

### 3.1 Create `components/talent/talent-controls.tsx`

New component. Simplified version of `PipelineControls` (256 lines currently).

**Props:**
```ts
interface TalentControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedPoolId: string | "all";
  onPoolChange: (poolId: string | "all") => void;
  pools: Array<{ _id: string; name: string; count: number }>;
  selectedStages: string[];
  onStagesChange: (stages: string[]) => void;
  stageCounts: Record<string, number>;
  sortBy: "newest" | "score" | "name";
  onSortChange: (sort: string) => void;
  totalCount: number;
  filteredCount: number;
}
```

**Layout:**
```
Row 1: [Search Input (flex-1)              ] [Sort Dropdown ▼]
Row 2: [Pool pills: "All (N)" | "TGT English (N)" | "PGT Math (N)" ...]
Row 3: [Stage pills: "Sourced (N)" | "Screened (N)" | ...]
Row 4: "Showing X of Y candidates" (text-xs text-ink-secondary)
```

**Key behaviors:**
- Pool pills: single-select. "All" is the default. Clicking a pool pill sets `selectedPoolId`.
- Stage pills: multi-select (additive). Same pattern as `PipelineControls` — toggle in array.
- Search: debounced (300ms). Search across name, email, location, subjects.
- Sort: "Newest" (default), "Highest Score", "Name A-Z".

**Styling:**
- Pool pills active: `bg-accent text-white`
- Pool pills inactive: `bg-surface-secondary text-ink-secondary hover:text-ink`
- Stage pills: same as pipeline stage pills
- Uses `components/ui/Input`, `components/ui/Select`, `components/ui/Badge` primitives

### 3.2 Create `components/talent/pool-selector.tsx`

New component. Admin UI for managing pools.

**Props:**
```ts
interface PoolSelectorProps {
  schoolId: string | undefined;
  pools: Array<{ _id: string; name: string; createdBy: string; tags: string[]; candidateCount: number }>;
}
```

**Layout (collapsible section):**
- Header bar with "Manage Pools" button + pool count badge
- Expanded view:
  - Pool list: each row shows name, "AI" or "Admin" badge, candidate count, edit/delete buttons
  - "Create Pool" form: name input + tags input (comma-separated) + "Create" button
  - "Suggest Pools" button: calls `api.pools.suggest`, shows AI suggestions for admin review with accept/reject buttons

**Mutations used:**
- `useMutation(api.pools.create)` — create pool
- `useMutation(api.pools.update)` — rename pool
- `useMutation(api.pools.remove)` — delete pool
- `useAction(api.pools.suggest)` — AI suggest pools

### 3.3 Adapt `components/pipeline/application-table.tsx`

**Add `showScoreAs` prop:**
```ts
showScoreAs?: "match" | "global";  // defaults to "match"
```

**Changes:**
- Column header: "Match Score" when `"match"`, "Global Score" when `"global"`
- Score cell: read `app.aiMatchScore` when `"match"`, read `app.globalScore` when `"global"`
- Score color coding: green ≥85, amber ≥60, gray otherwise (same as pipeline)

**Add `showPoolBadges` prop:**
```ts
showPoolBadges?: boolean;  // defaults to false
```

When `true`, in the candidate name column, render small pool badges under the candidate name using `components/ui/Badge` with variant `default`.

**Extend internal `Application` type:**
```ts
interface Application {
  _id: string;
  candidateId: string;
  stage: string;
  aiMatchScore?: number;
  globalScore?: number;      // NEW
  poolNames?: string[];       // NEW
  candidate?: { /* same as before */ } | null;
}
```

### 3.4 Create `components/talent/global-criteria-panel.tsx`

Modal/panel for managing school-wide scoring criteria.

**Props:**
```ts
interface GlobalCriteriaPanelProps {
  schoolId: string;
  onClose: () => void;
}
```

**Behavior:**
- Uses `useQuery(api.globalCriteria.get, { schoolId })` to check if criteria exist
- If no criteria: "Set Global Criteria" button → opens modal/panel
  - Text area for natural language description of school's hiring standards
  - "Suggest with AI" button → calls `api.globalCriteria.suggest({ schoolId })`
  - Shows returned dimensions with weights for review
  - Admin can adjust weights (sliders or number inputs)
  - "Save" button → calls `api.globalCriteria.save({ schoolId, scoringRules })`
  - On successful save, triggers `api.globalCriteria.scoreAllCandidates({ schoolId })` as an action
- If criteria exist: shows current criteria summary (dimensions, version) + "Edit" button

---

## Phase 4: Rewrite Talent Bank Page

### 4.1 Rewrite `app/dashboard/talent/page.tsx`

Replace the entire file. Structure:

```tsx
"use client";

export default function TalentBankPage() {
  // Auth
  const { user } = useUser();
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");
  const schoolId = profile?.schoolId;

  // Queries
  const pools = useQuery(api.pools.listForSchool, schoolId ? { schoolId } : "skip") ?? [];
  const candidates = useQuery(api.candidates.listForSchool,
    schoolId
      ? { schoolId, poolId: selectedPoolId === "all" ? undefined : selectedPoolId }
      : "skip"
  ) ?? [];

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPoolId, setSelectedPoolId] = useState<string | "all">("all");
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"newest" | "score" | "name">("newest");
  const [showPoolManager, setShowPoolManager] = useState(false);
  const [showCriteriaPanel, setShowCriteriaPanel] = useState(false);

  // Derived data
  const searchFiltered = useMemo(() => /* filter by searchQuery */, [candidates, searchQuery]);
  const stageFiltered = useMemo(() => /* filter by selectedStages */, [searchFiltered, selectedStages]);
  const sorted = useMemo(() => /* sort by sortBy */, [stageFiltered, sortBy]);
  const stageCounts = useMemo(() => /* aggregate counts */, [stageFiltered]);

  // Pool counts (from all candidates, not just filtered)
  const poolCounts = useMemo(() => /* count per pool */, [candidates, pools]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Talent Bank</h1>
          <p className="text-sm text-ink-secondary mt-1">
            Browse and manage all candidates across your school
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowPoolManager(!showPoolManager)}>
            Manage Pools
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowCriteriaPanel(true)}>
            Global Criteria
          </Button>
        </div>
      </div>

      {/* Pool Manager (collapsible) */}
      {showPoolManager && <PoolSelector schoolId={schoolId} pools={pools} />}

      {/* Global Criteria Panel (modal) */}
      {showCriteriaPanel && (
        <GlobalCriteriaPanel schoolId={schoolId} onClose={() => setShowCriteriaPanel(false)} />
      )}

      {/* Controls */}
      <TalentControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedPoolId={selectedPoolId}
        onPoolChange={setSelectedPoolId}
        pools={pools.map(p => ({ _id: p._id, name: p.name, count: poolCounts[p._id] ?? 0 }))}
        selectedStages={selectedStages}
        onStagesChange={setSelectedStages}
        stageCounts={stageCounts}
        sortBy={sortBy}
        onSortChange={setSortBy}
        totalCount={candidates.length}
        filteredCount={stageFiltered.length}
      />

      {/* Table */}
      {sorted.length === 0 ? (
        <EmptyState icon={<UsersIcon />} title="No candidates found"
          description={searchQuery ? "Try adjusting your search or filters." : "Candidates will appear here when sourced."} />
      ) : (
        <ApplicationTable applications={sorted} sortBy={sortBy}
          showScoreAs="global" showPoolBadges={true} />
      )}
    </div>
  );
}
```

---

## Phase 5: Tests

### 5.1 Backend Tests

**`convex/pools.test.ts`:** create, dedup enforcement, listForSchool, update, remove with cascade.

**`convex/globalCriteria.test.ts`:** save, get, upsert (version increment), scoreAllCandidates.

**`convex/candidates.test.ts` (extend):** listForSchool with poolId filter, poolNames on results.

### 5.2 Component Tests

**`components/talent/talent-controls.test.tsx`:** Pool pill single-select, stage pills multi-select, search debounce, sort dropdown.

**`components/talent/pool-selector.test.tsx`:** Renders pools, create form, delete, suggest button.

### 5.3 Integration

Full flow: candidate created → auto-tagged → global scored → appears in talent bank table.

---

## Phase 6: Polish Pass

### 6.1 Empty States
- No pools: "No pools yet. Create one or let AI suggest some."
- No global criteria: Score column shows "—" with tooltip
- No candidates after filter: "No candidates match your filters" with "Clear filters" button

### 6.2 Loading & Error
- Skeleton rows for table while queries load
- Spinner on AI suggest actions
- AI failures: toast notification, UI remains functional
- No API key: graceful skip with notice

### 6.3 Responsive
- Controls wrap on small screens
- Pool manager collapses on mobile

---

## Files Summary

| File | Action |
|------|--------|
| `convex/schema.ts` | MODIFY — add 3 tables + 2 fields |
| `convex/pools.ts` | CREATE — 8 functions |
| `convex/globalCriteria.ts` | CREATE — 4 functions |
| `convex/candidates.ts` | MODIFY — extend listForSchool, fix updateScore, wire auto-tag |
| `components/talent/talent-controls.tsx` | CREATE |
| `components/talent/pool-selector.tsx` | CREATE |
| `components/talent/global-criteria-panel.tsx` | CREATE |
| `components/pipeline/application-table.tsx` | MODIFY — showScoreAs + showPoolBadges |
| `app/dashboard/talent/page.tsx` | REWRITE |
| `convex/pools.test.ts` | CREATE |
| `convex/globalCriteria.test.ts` | CREATE |
| `convex/candidates.test.ts` | MODIFY |
| `components/talent/talent-controls.test.tsx` | CREATE |
| `components/talent/pool-selector.test.tsx` | CREATE |

## Verification Checklist

1. `npx convex dev` — schema validates, new tables created
2. All backend tests pass
3. `/dashboard/talent` renders with new table layout
4. Create pool → appears in pool pills → filter works
5. Search filters candidates
6. Stage pills multi-select works
7. Sort by score reorders correctly
8. Global criteria save → scoreAllCandidates runs → scores appear
9. "Suggest Pools" returns AI suggestions
10. Inline expansion works on expanded rows
11. Pool badges appear under candidate names
12. Empty states render correctly
