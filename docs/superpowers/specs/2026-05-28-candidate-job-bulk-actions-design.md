# Candidate & Job Management — Bulk Actions, Delete, Criteria, Rejection History

**Date:** 2026-05-28
**Status:** Approved

## Problem

Four gaps in the current candidate and job management UX:

1. **No way to delete a candidate.** The `candidates` table has no `remove` mutation and no UI affordance. Mistaken or duplicate candidates accumulate; GDPR data-deletion requests can't be fulfilled.
2. **Criteria editor is one-sided.** `app/dashboard/jobs/[id]/criteria/page.tsx` only exposes the structured `ScoringRuleEditor`. The empty state effectively forces "Generate with AI" — there's no natural-language textarea (even though `jobPostings.criteria` exists in the schema) and no inviting path to add criteria manually.
3. **No multi-select on the candidate pipeline.** `components/pipeline/application-table.tsx` supports single-row click but no checkboxes, no shift-range select, no bulk actions.
4. **No multi-select on the jobs list.** `components/jobs/jobs-list.tsx` is single-click only.

## Goals

- Add cascading hard-delete for candidates, exposed in the candidate detail view and as a bulk action on the talent bank.
- Surface a natural-language criteria textarea alongside the structured editor; make manual entry feel first-class.
- Add a reusable multi-select + bulk-action-bar pattern to both candidate (application) tables and the jobs list.
- Distinguish three semantically different destructive actions in the UI: **Reject** (stage move), **Remove from pipeline** (delete application), **Delete candidate** (cascading purge).
- Show prior rejection history (with evaluation notes) on candidate rows when they appear in a new role's pipeline.

## Non-Goals

- Soft-delete / archive with restore (explicitly declined; hard delete only).
- Undo for any destructive bulk action.
- Bulk operations spanning pagination boundaries (only acts on rows currently loaded into the table).
- Server-side CSV generation (client-side from loaded rows is sufficient for current volumes).
- Keyboard shortcuts beyond shift-click range select (Cmd+A, Esc to clear, etc. can be follow-ups).
- A new evaluations subsystem — evaluations are already wired (`convex/evaluations.ts`, four UI consumers). The rejection-history feature reads existing evaluation data.

---

## Domain model recap

The data model underpinning the whole design — important enough to state explicitly because the destructive-action UX hinges on it.

- **Candidate** (`candidates` table): the person. One row per human. Stable identity across roles. Holds resume, contact, parsed facets, embeddings.
- **Application** (`applications` table): one candidate's attempt at one job. Holds `stage`, `scoringResult`, `aiMatchScore`. A candidate can have many.
- **Evaluation** (`evaluations` table): one evaluator's scorecard for one application. Multiple per application (principal, HOD, HR).

Rejection is therefore application-scoped: a candidate rejected for Role A is still eligible for Role B as a *new* application. Candidate identity is durable; applications are disposable.

### Three destructive actions

| Action | Scope | What it touches | Where it lives |
|---|---|---|---|
| **Reject** | One application | `applications.stage = "rejected"` (existing `moveStage`) | Stage picker / kanban — already exists. |
| **Remove from pipeline** | One or many applications for *this* job | Delete `applications` rows (+ their `evaluations`, `outreachMessages`) | Job pipeline views, bulk action. |
| **Delete candidate** | The person and *all* their applications | Cascading purge: every application, every evaluation, every outreach message, resume file, candidate doc | Candidate detail view (single) + talent bank (bulk). |

---

## Section 1 — Candidate hard delete (cascading)

### Convex mutations

In `convex/candidates.ts`:

```ts
remove(candidateId: Id<"candidates">): Promise<void>
removeMany(candidateIds: Id<"candidates">[]): Promise<void>
```

`remove` implementation steps:

1. Find all `applications` for this candidate via `by_candidateId` index.
2. For each application, delete child rows in this exact set (all tables that reference `applicationId`):
   - `evaluations` (index `by_applicationId`)
   - `outreachMessages` (index `by_applicationId`)
   - `calendarEvents` (index `by_applicationId`)
   - `triageDecisions` (index `by_applicationId`)
   - `bookingTokens` — **no `by_applicationId` index today**; add one as part of this work (a tiny schema change). Without it, cleanup would need a full-table scan.
3. Delete the application row.
4. Delete candidate-keyed rows that aren't joined through `applications`:
   - `candidatePools` (index `by_candidateId`)
5. Leave `facetPromotionCandidates.sampleEvidence` entries that reference this candidate untouched. They live as items inside an array on each row, and they're historical evidence used for facet promotion analytics. A dangling candidateId there is harmless and the alternative (rewriting every row's array) isn't worth the complexity.
6. If `candidate.resumeStorageId` is set, `await ctx.storage.delete(resumeStorageId)` inside a try/catch (idempotent — swallow not-found).
7. Delete the candidate doc.

`removeMany` calls the same logic in a loop (single client round-trip).

Both run as `mutation` (not `internalMutation`), authorized via existing auth helper — only school members can delete their own school's candidates.

### UI

**Single delete:**
- New button on `components/pipeline/application-drawer.tsx` (and any candidate-detail surface in talent bank): `Delete candidate` — destructive style, placed in a footer "Danger zone" or a kebab menu (matching existing patterns).
- Click → `<ConfirmDialog>` with body: *"Delete {name}? This permanently removes their resume, every application across roles, and all evaluations. This cannot be undone."*
- On confirm → call `remove` → toast `"{name} deleted"` → close drawer → list re-queries automatically (Convex reactivity).

**Bulk delete:**
- Available on the **talent bank view** (`app/dashboard/talent/page.tsx`) where rows are candidates.
- NOT available on job pipeline views — there the bulk action is "Remove from pipeline" (Section 4).

---

## Section 2 — Criteria UX (NL textarea + structured editor)

### Page restructure

Rewrite `app/dashboard/jobs/[id]/criteria/page.tsx` so the page stacks two sections:

```
┌─────────────────────────────────────────────────────────────┐
│ Criteria · Math PGT                       [Generate with AI]│
├─────────────────────────────────────────────────────────────┤
│ 1. Criteria (natural language)                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ <textarea bound to job.criteria>                        │ │
│ │ Describe the ideal candidate in plain language —        │ │
│ │ qualifications, experience, must-haves, deal-breakers.  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                       [Saved] / Saving...   │
├─────────────────────────────────────────────────────────────┤
│ 2. Scoring rules (structured)                               │
│ <existing ScoringRuleEditor>                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- **Section 1 — NL textarea**: bound to `jobPostings.criteria` (existing string field). Autosave on blur via a new mutation `convex/jobs.ts:saveCriteriaText(jobId, text)`. Subtle "Saved" indicator on the right.
- **Section 2 — Structured editor**: the existing `ScoringRuleEditor` component, populated from `job.scoringRules` if present, empty otherwise.
- **Page-level "Generate with AI" button** (top-right of `PageHeader` action area): calls `api.scoring.suggestCriteria` using the NL textarea content as input (falling back to `job.naturalLanguageDescription` if textarea is empty), populates the structured editor directly. The textarea is **never** modified by AI.

### Component changes

- New: `components/criteria/CriteriaNaturalLanguageEditor.tsx` — textarea + autosave logic.
- Removed: `components/criteria/AISuggestedCriteria.tsx` (its "Generate" CTA moves to the page header; suggestions land directly in `ScoringRuleEditor` with no intermediate "Accept" step).
- New mutation: `convex/jobs.ts:saveCriteriaText({ jobId, text })`.

### Matching semantics (unchanged)

Matching code continues to prefer `scoringRules` when present; falls back to NL `criteria` parsing. No change.

---

## Section 3 — Multi-select primitive (shared)

### Hook

New: `hooks/use-table-selection.ts`

```ts
function useTableSelection<Id extends string>(): {
  selected: Set<Id>;
  isSelected: (id: Id) => boolean;
  toggle: (id: Id, shiftKey?: boolean) => void;  // shift-click range
  toggleAll: (ids: Id[]) => void;                // header "select visible"
  clear: () => void;
  count: number;
}
```

Internals:
- `selected` is a `Set<Id>` in component state.
- `toggle(id, shiftKey)` tracks the last-toggled id; if `shiftKey` is true and there's a last id, all ids between them in the visible-order array are toggled. The hook receives the visible-order array via a setter the caller wires up each render: `setVisibleIds(rows.map(r => r._id))`.
- `toggleAll(ids)` flips behaviour based on whether all `ids` are already selected: if yes, deselect them; if no, select them all (additive — doesn't clear other selections).

### Bulk action bar

New: `components/ui/bulk-action-bar.tsx`

```tsx
<BulkActionBar count={count} onClear={clear}>
  <BulkActionButton onClick={...} variant="destructive">Delete</BulkActionButton>
  <BulkActionButton onClick={...}>Move to stage</BulkActionButton>
  <BulkActionButton onClick={...}>Export CSV</BulkActionButton>
</BulkActionBar>
```

- Renders nothing when `count === 0`.
- When `count > 0`: fixed positioning, bottom of viewport, centered, slides up on mount.
- Left section: `"{count} selected"` + a `Clear` ghost button.
- Right section: action buttons passed as children.
- Designed to work without layout shift in the underlying list (it's an overlay).

### Confirm dialog

New: `components/ui/confirm-dialog.tsx` — minimal modal with title, body, `Cancel` and confirm button (variant configurable for destructive vs neutral). Use this everywhere a destructive bulk action is confirmed.

### Table integration

**`components/pipeline/application-table.tsx`:**
- Add a leading checkbox column. Column width fixed at 40px.
- Header cell: a "select all visible" checkbox. Indeterminate state when some-but-not-all rows are selected.
- Row cell: checkbox bound to `isSelected(row.applicationId)`. Click handler calls `toggle(row.applicationId, e.shiftKey)` and stops propagation (so row click still opens the drawer).
- Selected rows get a subtle highlighted background (e.g., a tinted accent).
- Hook is owned by the parent page (`pipeline/page.tsx`, `jobs/[id]/pipeline/page.tsx`) so the action bar can read selection state alongside.

**`components/jobs/jobs-list.tsx`:**
- Add a checkbox to each card's top-left corner. Same handler pattern (toggle + stop propagation).
- Selected cards get a tinted border or background to mirror the table treatment.

**`app/dashboard/talent/page.tsx`:**
- The talent bank already reuses `components/pipeline/application-table.tsx`; rows are applications with `jobPostingId = undefined`. The checkbox column added to that table appears here for free.
- Wire `useTableSelection` at the page level. When bulk-deleting from this view, the page maps each selected row → `row.candidateId` before calling `candidates.removeMany(candidateIds)` (cascading purge — the right semantics for talent-bank deletion).

---

## Section 4 — Bulk actions

### Candidate pipeline views (`app/dashboard/jobs/[id]/pipeline/`, `app/dashboard/pipeline/`)

Rows here are **applications**, not candidates. The bulk action bar shows three actions:

- **Remove from pipeline** — destructive style. Confirm modal: *"Remove {N} applications from this pipeline? The candidates remain in the system and their other applications are unaffected."* Calls new `convex/applications.ts:removeManyApplications(applicationIds)` which, per application, deletes child rows in `evaluations`, `outreachMessages`, `calendarEvents`, `triageDecisions`, and `bookingTokens` (same set as Section 1's cascade), then deletes the application row. **Does not** delete the candidate.
- **Move to stage** — popover with the school's pipeline stages (read from `pipeline_config`). Confirm action on stage select. Calls new `convex/applications.ts:bulkSetStage(applicationIds, stage)`.
- **Export CSV** — client-side. Build CSV from already-loaded rows: columns `Name, Email, Phone, Score, Stage, Subjects, Applied At`. Trigger download via `Blob` + `URL.createObjectURL`. No server call.

### Talent bank view (`app/dashboard/talent/`)

Rows here are applications with `jobPostingId = undefined` — the application is just the candidate's entry point into the system. Conceptually the user is selecting *people*, so the bulk action operates on the underlying candidate. The bulk action bar shows two actions:

- **Delete candidates** — destructive. The page maps selected rows → `row.candidateId`. Confirm modal naming count + warning ("This removes their resume, every application across roles, and all evaluations. This cannot be undone.") → `candidates.removeMany(candidateIds)`.
- **Export CSV** — client-side from loaded rows: `Name, Email, Phone, Years Experience, Subjects, Qualifications, Created At`.

### Jobs list (`app/dashboard/jobs/`)

Rows are **jobs**. The bulk action bar shows three actions:

- **Delete (drafts only)** — only enabled when *every* selected job has `status === "draft"`. If any selected job is non-draft, the button is disabled with a tooltip: *"Only draft jobs can be deleted in bulk. Change status to draft first, or use the per-job actions."* On confirm → new `convex/jobs.ts:removeMany(jobIds)` which validates draft-only server-side and calls existing `deleteDraft` logic per id.
- **Change status** — popover with status options (`Active`, `On hold`, `Filled`, `Closed`). Calls new `convex/jobs.ts:bulkSetStatus(jobIds, status)`.
- **Export CSV** — client-side: `Title, Subject, Level, Board, Status, Positions, Created At`.

### Bulk mutation signatures

```ts
// convex/applications.ts
removeManyApplications(applicationIds: Id<"applications">[]): Promise<void>
bulkSetStage(applicationIds: Id<"applications">[], stage: string): Promise<void>

// convex/candidates.ts
removeMany(candidateIds: Id<"candidates">[]): Promise<void>

// convex/jobs.ts
removeMany(jobIds: Id<"jobPostings">[]): Promise<void>      // server-validates draft-only
bulkSetStatus(jobIds: Id<"jobPostings">[], status: string): Promise<void>
```

All loop over ids server-side rather than client-side fan-out. Each mutation re-checks auth on every id (school membership), and any single-id failure aborts the batch with a clear error (no partial application).

---

## Section 5 — Rejection history indicator

### Query

New: `convex/candidates.ts:getRejectionHistory({ candidateId, excludeApplicationId? })`

Returns:
```ts
Array<{
  applicationId: Id<"applications">;
  jobId: Id<"jobPostings">;
  jobTitle: string;
  jobSubject: string | undefined;
  jobLevel: string | undefined;
  rejectedAt: number;  // application._creationTime or the latest reject-evaluation submittedAt, whichever is later
  evaluations: Array<{
    evaluatorRole: "principal" | "hod" | "hr_admin";
    recommendation: "hire" | "maybe" | "reject" | undefined;
    comments: string | undefined;
    scores: {
      subjectKnowledge?: number;
      classroomManagement?: number;
      communication?: number;
      overallFit?: number;
    };
    submittedAt: number | undefined;
  }>;
}>
```

Implementation:
- Find all `applications` for `candidateId` via `by_candidateId`.
- Filter to those with `stage === "rejected"` OR with at least one linked evaluation where `recommendation === "reject"`.
- Exclude `excludeApplicationId` if provided (used by pipeline rows / drawer to suppress self-reference).
- For each, join `jobPostings` (title, subject, level) and `evaluations` (filter to `submitted === true`).
- Sort by `rejectedAt` descending.

### UI — pipeline row badge

In `components/pipeline/application-table.tsx`:
- Each row receives a `priorRejectCount: number` field, computed server-side as part of the existing pipeline query (see implementation note below).
- When `priorRejectCount > 0`, render a small muted badge next to the candidate name: `2 prior rejects` with a warning-tinted dot. Clicking the badge opens the drawer with the "Previous outcomes" section auto-expanded.

Implementation note: avoid an N+1 fetch. Extend `api.applications.getPipelineForJob` so each returned row includes `priorRejectCount` — computed by the same logic as `getRejectionHistory` (find rejected applications for the candidate, exclude the current applicationId) but returning only the count. Single-query table render.

### UI — drawer "Previous outcomes" section

In `components/pipeline/application-drawer.tsx`:
- Below the candidate summary, when `getRejectionHistory(candidateId, excludeApplicationId=currentAppId).length > 0`, render a "Previous outcomes" section.
- Each prior rejection is a collapsible card:
  ```
  ▾ Math PGT · rejected 2026-03-12
      Principal (Mr. Sharma)
        Recommendation: reject
        "Strong subject knowledge but weak classroom management in demo."
        Scores — Subject: 8/10 · Classroom: 4/10 · Comm: 7/10 · Overall: 5/10
      HOD (Ms. Iyer)
        Recommendation: maybe
        "Could grow into it with mentoring."
      [View full evaluation]  ← links to existing evaluation-summary component
  ```
- Collapsed by default; clicking the row from the pipeline-row badge expands all by default.
- If an application has the `rejected` stage but no submitted evaluations, the card still shows ("rejected 2026-03-12 — no evaluation notes recorded").

### Self-reference guard

The rejection history surfaced in a given context always excludes the *current* application. Joe in Math TGT's drawer sees his Math PGT rejection, never his current Math TGT row (even if Math TGT is also rejected). The `excludeApplicationId` parameter on the query enforces this.

---

## File inventory

### New files

| Path | Purpose |
|---|---|
| `hooks/use-table-selection.ts` | Generic multi-select hook (Set-based, shift-click range). |
| `components/ui/bulk-action-bar.tsx` | Fixed-position bottom bar shown when selection > 0. |
| `components/ui/confirm-dialog.tsx` | Reusable destructive/neutral confirmation modal. |
| `components/criteria/CriteriaNaturalLanguageEditor.tsx` | NL textarea with autosave for `job.criteria`. |
| `components/pipeline/rejection-history-indicator.tsx` | Row badge showing "N prior rejects". |
| `components/pipeline/previous-outcomes-section.tsx` | Drawer section listing prior rejections + eval notes. |
| `lib/csv-export.ts` | Tiny helper: takes rows + column config, triggers browser download. |

### Modified files

| Path | Change |
|---|---|
| `convex/schema.ts` | Add `by_applicationId` index on `bookingTokens` so the cascade can find them without a full-table scan. |
| `convex/candidates.ts` | Add `remove`, `removeMany`, `getRejectionHistory`. |
| `convex/applications.ts` | Add `removeManyApplications`, `bulkSetStage`. Extend `getPipelineForJob` to include `priorRejectCount` per row. |
| `convex/jobs.ts` | Add `removeMany` (draft-only validation), `bulkSetStatus`, `saveCriteriaText`. |
| `app/dashboard/jobs/[id]/criteria/page.tsx` | Restructure: NL textarea + structured editor stacked; "Generate with AI" moves to page header. |
| `app/dashboard/jobs/[id]/pipeline/page.tsx` | Wire up `useTableSelection` + `<BulkActionBar>`. |
| `app/dashboard/pipeline/page.tsx` (and `pipeline-list.tsx`) | Same wiring. |
| `app/dashboard/jobs/page.tsx` | Same wiring; draft-only validation logic for Delete button enablement. |
| `app/dashboard/talent/page.tsx` | Same wiring; talent-bank-specific bulk actions (delete + export). |
| `components/pipeline/application-table.tsx` | Leading checkbox column; selection highlight; prior-reject badge on row. |
| `components/pipeline/application-drawer.tsx` | "Delete candidate" button (Danger zone); "Previous outcomes" section. |
| `components/jobs/jobs-list.tsx` | Per-card checkbox; selection highlight. |

### Removed files

| Path | Reason |
|---|---|
| `components/criteria/AISuggestedCriteria.tsx` | Its "Generate" CTA moves to the page header; suggestions populate `ScoringRuleEditor` directly. No intermediate "Accept" step. |

---

## Error handling & edge cases

- **Cascading delete partial failure**: bulk delete operations run server-side, sequentially per id, inside a single mutation. If any single id fails, the mutation throws and the whole batch is rolled back by Convex's transaction model. Surface the error message via toast.
- **Deleting a candidate currently being viewed in another tab**: Convex reactivity automatically removes the row; the drawer in another tab will see `useQuery` return `null` and should close itself with a toast ("This candidate was deleted.").
- **Resume file already deleted in storage**: `ctx.storage.delete` is idempotent in practice (throws if not found is fine to swallow); wrap in try/catch and log but don't fail the candidate-delete mutation.
- **Bulk job delete with mixed statuses**: client disables the Delete button when any selection isn't draft; server re-validates and throws on the first non-draft id encountered.
- **CSV export with non-ASCII fields**: prefix CSV with BOM (`﻿`) so Excel opens it as UTF-8.
- **Shift-click range select after a filter/sort change**: the visible-ids array passed to the hook updates each render, so the "range" is always relative to current display order. Correct behaviour.
- **Empty selection clicking a bulk action**: the bar is hidden at count=0, so this isn't reachable.

---

## Testing

### Unit

- `useTableSelection`: toggle, shift-range, toggleAll behaviour, clear. Pure logic — covered by RTL hook tests.
- `csv-export`: row→CSV string formatting, escaping, BOM. Pure function tests.

### Integration

- Convex mutations:
  - `candidates.remove`: with applications + evaluations + outreach + resume → all gone, no orphans.
  - `candidates.removeMany`: 10 ids, all cascading.
  - `applications.removeManyApplications`: applications + child rows gone; candidate untouched.
  - `applications.bulkSetStage`: all stages updated; no other field touched.
  - `jobs.removeMany`: drafts deleted; non-draft mixed in throws and rolls back.
  - `jobs.bulkSetStatus`: status updated across batch.
  - `candidates.getRejectionHistory`: returns correct shape; `excludeApplicationId` honoured; orders by `rejectedAt` desc.

### Manual / preview

- Multi-select pattern on the candidate table: click, shift-click range, toggle all, clear.
- Multi-select on jobs grid: same.
- Bulk action bar appears, disappears, slides without layout shift.
- Criteria page: NL textarea autosave, structured editor coexistence, "Generate with AI" populates structured editor without touching textarea.
- Candidate delete from drawer → confirm modal → list updates.
- Prior reject badge visible when applicable; drawer "Previous outcomes" shows evaluation notes; self-reference excluded.

---

## Open questions

None at spec time. The candidate-vs-application semantics, the cascading scope, the criteria layout, the bulk action set, and the rejection history shape were all settled during brainstorming.
