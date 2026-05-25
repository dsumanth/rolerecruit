# Talent Bank Redesign — Design Specification

**Date:** 2026-05-25
**Status:** Approved
**Scope:** Visual polish, filtering, pool tagging, and global scoring for `/dashboard/talent`

---

## 1. Problem

The talent bank page is a flat card-based list with only a source channel filter, hardcoded hex colors, no search, no sorting, no virtualization, and no inline expansion. It lacks the visual polish and filtering capability the pipeline gained in the recent redesign.

Additionally, the system has no way to categorize untargeted candidates (those who applied without a specific job) into meaningful pools, nor a way to score them against school-wide criteria independent of any job posting.

---

## 2. Goals

1. **Visual polish** — Replace card-based layout with the same virtualized `ApplicationTable` component, using design tokens and UI primitives.
2. **Filterability** — Add search, stage filter pills, pool filter, sort, and source channel column (matching pipeline parity).
3. **Pool system** — AI auto-discovers and suggests pool categories; admins can create custom pools; deduplication enforced.
4. **Global scoring** — School-level scoring rubric scores every candidate regardless of job. Displayed in talent bank. Replaced by job-specific score when candidate is matched to a job.

---

## 3. Existing Architecture (What We Build On)

### 3.1 Schema (unchanged tables, new tables added)

**Exists — `candidates`**
- `name`, `email?`, `location?`, `qualifications[]`, `certifications[]`, `boardExperience[]`, `subjects[]`, `yearsExperience?`, `currentSchool?`, `resumeUrl?`, `sourceChannel?`, `talentBankFlag`

**Exists — `applications`**
- `candidateId`, `jobPostingId?`, `schoolId`, `stage`, `aiMatchScore?`, `scoringResult?`, `createdAt`

**Exists — `jobPostings`**
- `scoringRules` (dimensions/weights), `parsedCriteria`

### 3.2 Existing Files

| File | Role |
|------|------|
| `app/dashboard/talent/page.tsx` | Current talent bank page — **to be rewritten** |
| `convex/candidates.ts` | `listForSchool` query — **to be extended** |
| `convex/scoring.ts` | `scoreDimension()`, `ScoringRules` type — **reused** |
| `convex/reverseMatching.ts` | Job-to-candidate scoring — **reused** |
| `components/pipeline/application-table.tsx` | Virtualized table with inline expansion — **reused as-is** |
| `components/pipeline/inline-expansion.tsx` | Candidate detail tabs — **reused as-is** |
| `components/pipeline/pipeline-controls.tsx` | Search/filter/sort bar — **adapted** |
| `components/ui/*` | Button, Badge, Input, Tabs, Card, etc. — **reused** |

---

## 4. New Backend

### 4.1 New Tables

**`pools`**
```
schoolId: Id<"schools">
name: string                    // e.g., "TGT English", "PGT Mathematics"
createdBy: "ai" | "admin"
tags: string[]                  // keywords AI uses to match, e.g. ["english", "tgt", "grades 5-8"]
createdAt: number
```
- Index: `by_schoolId` (dedup check on `name` at query layer)

**`candidatePools`** (join table — many to many)
```
candidateId: Id<"candidates">
poolId: Id<"pools">
confidence: number              // 0-100, AI confidence in this assignment
createdAt: number
```
- Index: `by_candidateId`, `by_poolId`

**`globalCriteria`** (one per school)
```
schoolId: Id<"schools">
scoringRules: {                  // same shape as jobPostings.scoringRules
  dimensions: Array<{ name: string, weight: number, config: any }>
  minimumScore: number
  autoRejectScore: number
  generatedBy: "agent" | "manual" | "agent_reviewed"
  version: number
}
updatedAt: number
```
- Index: `by_schoolId` (unique — one per school)

### 4.2 Schema Field Additions

**`applications` table — add:**
```
globalScore: v.optional(v.number())
```

**`candidates` table — add:**
```
poolIds: v.optional(v.array(v.id("pools")))
```

### 4.3 New Convex Functions

**`convex/pools.ts`**

| Function | Type | Args | Behavior |
|----------|------|------|----------|
| `autoTagCandidate` | `internalAction` | `candidateId` | AI reads candidate profile → returns pool name suggestions + confidence scores. Deduplicates against existing pools. Creates new pools if needed. Inserts `candidatePools` rows. |
| `createPool` | `mutation` | `schoolId, name, tags` | Admin creates pool. Checks dedup by `(schoolId, name)`. Returns pool ID. |
| `listForSchool` | `query` | `schoolId` | Returns all pools for school |
| `updatePool` | `mutation` | `poolId, name?, tags?` | Admin updates pool metadata |
| `deletePool` | `mutation` | `poolId` | Removes pool + all candidatePools entries |
| `suggestPools` | `action` | `schoolId` | AI scans all unpooled candidates → suggests pool categories. Returns list of `{ name, tags, sampleCandidateIds }` for admin review |

**`convex/globalCriteria.ts`**

| Function | Type | Args | Behavior |
|----------|------|------|----------|
| `get` | `query` | `schoolId` | Returns school's global criteria, or null |
| `save` | `mutation` | `schoolId, scoringRules` | Upserts global criteria for school |
| `suggest` | `action` | `schoolId` | AI generates global criteria based on school profile + board. Returns suggested `ScoringRules`. |
| `scoreAllCandidates` | `internalAction` | `schoolId` | Scores every candidate against global criteria. Updates `applications.globalScore`. |

**`convex/candidates.ts` — extended**

| Function | Type | Change |
|----------|------|--------|
| `listForSchool` | `query` | Add `poolId` filter arg. Return `globalScore`, `poolIds`, `poolNames`. |

### 4.4 AI Integration

Both pool tagging and global criteria use the existing `DeepSeek` client pattern from `convex/scoring.ts`:

- **Pool auto-tagging** — With candidate profile (subjects, qualifications, level from board/experience), ask AI: "Categorize this teacher into one or more pools like TGT English, PGT Mathematics. Return JSON: `[{ name, confidence, tags }]`."
- **Global criteria suggestion** — With school board + subjects list, ask AI: "Generate global scoring rubric for K-12 teacher evaluation. Return structured dimensions with weights."
- **Global scoring** — Reuses `scoreDimension()` from `convex/scoring.ts` directly. No new scoring logic. The global criteria are stored in the same `ScoringRules` shape.

### 4.5 Pipeline Integration Consideration

When `convex/applications.getPipelineForJob` returns applications for pipeline view, it already includes `aiMatchScore`. The talent bank `listForSchool` will return `globalScore` instead. When the pipeline page shows an application that has both scores, `aiMatchScore` takes visual priority (job-specific always overrides global). No backend change needed for pipeline — it already works correctly.

---

## 5. Frontend Components

### 5.1 `app/dashboard/talent/page.tsx` — Rewrite

Replace the entire card-based layout with:

```
<TalentBankPage>
  <Header: title "Talent Bank" + subtitle + PoolSelector button>
  <TalentControls
    searchQuery / onSearchChange
    selectedPoolId / onPoolChange
    selectedStages / onStagesChange
    stageCounts
    sortBy / onSortChange
    totalCount / filteredCount
  />
  <ApplicationTable
    applications={filteredCandidates}
    sortBy={sortBy}
    showScoreAs="global"        // new prop: renders globalScore column
    poolNames?                  // map of candidateId → pool names for badges
  />
</TalentBankPage>
```

**Changes vs pipeline:**
- No `viewMode` / `kanbanDisabled` props
- Add `selectedPoolId` prop (single-select)
- Score column labeled "Global Score" instead of "Match Score"

### 5.2 `TalentControls` — New Component

Simplified version of `PipelineControls` without the kanban toggle.

Layout:
```
Row 1: [Search Bar            ] [Sort ▼]
Row 2: [Pool pills with counts] 
Row 3: [Stage pills with counts]
Row 4: "Showing X of Y candidates"
```

- Pool pills: single-select (primary filter). "All" pill shows total count, pool pills show count of candidates in that pool. Active pill gets `bg-accent text-white`.
- Stage pills: additive (multi-select). Same pattern as pipeline.
- Search: debounced text search (300ms), matches name/email/location/subjects.
- Sort: "Newest" / "Highest Score" / "Name A-Z"

### 5.3 `PoolSelector` — New Component

Small admin UI for managing pools. Opens as inline section above the table:

- "Manage Pools" button in header area
- Expands to show: list of pools (name, createdBy badge, candidate count)
- "Create Pool" input + tags field
- Edit/delete per pool
- "Suggest Pools" button (calls AI, shows suggestions for review)

### 5.4 `ApplicationTable` — Adaptation

The existing `ApplicationTable` already works. Two minor adaptations:

1. **New prop `showScoreAs`** — `"match"` | `"global"`. Controls column header label and which score field to read.
2. **Pool tags in the candidate column** — If candidate has `poolNames`, show small pool badges under the candidate name (e.g., "TGT English • PGT English"). Only in talent bank mode.

### 5.5 Design Tokens

All components use existing tokens. No new colors:
- Pill buttons: `bg-accent text-white` (active), `bg-surface-secondary text-ink-secondary` (inactive)
- Pool badges: `bg-surface-secondary text-ink-secondary` small pills
- Everything else: identical to pipeline patterns

---

## 6. Data Flow

### 6.1 Candidate Enters Talent Bank

```
1. sourcing_actions.ts / careers.ts / email_ingestion.ts
   → candidates.create() + applications.create()
   
2. After creation → pools.autoTagCandidate(candidateId)
   → AI categorizes candidate → candidatePools rows created
   → Candidate's poolIds updated on candidates table

3. On first global criteria save or criteria update:
   → globalCriteria.scoreAllCandidates(schoolId)
   → Every candidate scored → applications.globalScore updated
```

### 6.2 Admin Sets Up Global Criteria

```
1. Admin navigates to talent bank → "Set Global Criteria" button
2. Modal/panel: text field for criteria description OR "Suggest" button
3. "Suggest" → globalCriteria.suggest(schoolId) → returns dimensions
4. Admin reviews, adjusts weights → Save → globalCriteria.save()
5. On save → globalCriteria.scoreAllCandidates() triggered
```

### 6.3 Talent Bank Page Load

```
1. useQuery(candidates.listForSchool, { schoolId, poolId?, sourceChannel? })
2. Query returns: candidate + application data + globalScore + poolIds + poolNames
3. Frontend: sort, search, filter locally (no additional queries)
4. Inline expansion: same as pipeline — loads full candidate detail
```

---

## 7. Error Handling

- **AI unavailable (no API key):** Pool auto-tagging and global criteria suggestion gracefully skip. Candidates enter talent bank with no pool assignment. Admin can manually create pools and assign.
- **Empty pools:** "No pools yet. Create one or let AI suggest some." empty state.
- **No global criteria:** Score column shows "—" with a tooltip "Set up global criteria to score candidates."

---

## 8. Testing

### Unit Tests (Convex)
- `pools.test.ts`: create/delete pool, dedup enforcement, listForSchool
- `candidatePools.test.ts`: assign, remove, query by pool, query by candidate
- `globalCriteria.test.ts`: save, get, scoreDimension reuse verification
- `candidates.test.ts`: extend existing with `poolId` filter test

### Component Tests
- `TalentControls.test.tsx`: pool pill single-select, stage pills multi-select, search debounce
- `ApplicationTable.test.tsx`: extend with `showScoreAs="global"` variant

### Integration
- Verify full flow: candidate created → auto-tagged → global scored → appears in talent bank table

---

## 9. Out of Scope

- Pool-based permissions or visibility restrictions
- Editing pool assignments for individual candidates via UI (can be done via Convex dashboard for now)
- Global criteria version history beyond `version` counter

---

## 10. Implementation Order

1. **Schema changes** — Add `pools`, `candidatePools`, `globalCriteria` tables. Add `globalScore` to applications, `poolIds` to candidates.
2. **Convex backend** — `pools.ts`, `globalCriteria.ts`, extend `candidates.ts`
3. **Frontend components** — `TalentControls`, `PoolSelector`
4. **Rewrite talent bank page** — Drop in new components
5. **Adapt `ApplicationTable`** — `showScoreAs` prop, pool badges
6. **Tests** — Backend unit tests, component tests
7. **Polish pass** — Empty states, loading states, error handling
