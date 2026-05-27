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
- Every destructive bulk action (and the single-row delete) is **undoable for 10 seconds** via a toast. After the window expires, the data is permanently hard-deleted.
- Selecting "all" selects every row in the current filtered set — not just the rows in the virtual viewport.

## Non-Goals

- Persistent soft-delete / trash bin / "Recently deleted" view. The undo window is intentionally short (10s) — beyond that, data is genuinely gone.
- Server-side CSV generation (client-side from loaded rows is sufficient for current volumes).
- Keyboard shortcuts beyond shift-click range select (Cmd+A, Esc to clear, etc. can be follow-ups).
- A new evaluations subsystem — evaluations are already wired (`convex/evaluations.ts`, four UI consumers). The rejection-history feature reads existing evaluation data.
- True server-side pagination across all listing pages. Today these queries load the full filtered set into memory, so bulk operations naturally cover everything that matches the filter. If real pagination is added later, cross-page bulk becomes a separate design question.

---

## Domain model recap

The data model underpinning the whole design — important enough to state explicitly because the destructive-action UX hinges on it.

- **Candidate** (`candidates` table): the person. One row per human. Stable identity across roles. Holds resume, contact, parsed facets, embeddings.
- **Application** (`applications` table): one candidate's attempt at one job. Holds `stage`, `scoringResult`, `aiMatchScore`. A candidate can have many.
- **Evaluation** (`evaluations` table): one evaluator's scorecard for one application. Multiple per application (principal, HOD, HR).

Rejection is therefore application-scoped: a candidate rejected for Role A is still eligible for Role B as a *new* application. Candidate identity is durable; applications are disposable.

### Three destructive actions

| Action | Scope | What it touches | Reversible? | Where it lives |
|---|---|---|---|---|
| **Reject** | One application | `applications.stage = "rejected"` (existing `moveStage`) | Yes — just move stage back | Stage picker / kanban — already exists. |
| **Remove from pipeline** | One or many applications for *this* job | Marks `applications` rows with `pendingDeleteAt`; after 10s, scheduled finalize deletes the rows + their `evaluations`, `outreachMessages`, `calendarEvents`, `triageDecisions`, `bookingTokens`. | Yes — undo within 10s | Job pipeline views, bulk action. |
| **Delete candidate** | The person and *all* their applications | Marks `candidates` row with `pendingDeleteAt`; after 10s, scheduled finalize cascades (every application, every evaluation, every outreach message, calendar event, triage decision, booking token, candidate-pool membership, resume file, candidate doc). | Yes — undo within 10s | Candidate detail view (single) + talent bank (bulk). |

All destructive actions go through the **scheduled-finalize undo pattern** — see Section 0.

---

## Section 0 — Undo for destructive actions (cross-cutting)

Every destructive bulk action — and the single-row "Delete candidate" affordance — gets a 10-second undo window via a toast. Two mechanisms are used depending on whether the action is a delete (irreversible without precaution) or a value change (trivially reversible by re-applying).

### Pattern A — Deletes: scheduled-finalize

Used for: candidate delete (single + bulk), Remove from pipeline (bulk), Delete jobs (bulk drafts).

**Schema additions** to `candidates`, `applications`, `jobPostings`:

```ts
pendingDeleteAt: v.optional(v.number()),
pendingDeleteBatchId: v.optional(v.string()),
```

**Flow:**

1. **Bulk delete mutation** (e.g., `candidates.removeMany(ids)`):
   - Generate a fresh `batchId` (e.g., crypto-random short string).
   - For each id, set `pendingDeleteAt = Date.now()` and `pendingDeleteBatchId = batchId`. **Do not** delete child rows or storage files yet.
   - Skip any id that already has `pendingDeleteAt` set (already pending — leave alone, don't reset the timer).
   - Schedule `internal.candidates.finalizeBatchDelete({ batchId })` via `ctx.scheduler.runAfter(10_000, ...)`.
   - Return `{ batchId, count }` to the client.

2. **All list/query functions** filter out rows where `pendingDeleteAt != null`. Affected queries (must update):
   - `candidates.listForSchool`, `candidates.hardFilter`, candidate vector searches.
   - `applications.getPipelineForJob` and any other application list.
   - `jobs.listBySchool`, `jobs.list` and any other job list.

3. **Undo mutation** `candidates.undoBatchDelete({ batchId })`:
   - Find all rows in this table where `pendingDeleteBatchId === batchId` AND `pendingDeleteAt != null`.
   - Clear both fields. Rows reappear via Convex reactivity.
   - Same shape for `applications.undoBatchDelete` and `jobs.undoBatchDelete`.

4. **Scheduled finalize** `internal.candidates.finalizeBatchDelete({ batchId })`:
   - Find all rows with `pendingDeleteBatchId === batchId` that still have `pendingDeleteAt` set (the undo cleared them otherwise).
   - For each such row, perform the actual cascading hard delete from Section 1 (child tables → resume file → row itself).
   - Same internal action shape for `applications.finalizeBatchDelete` and `jobs.finalizeBatchDelete`.

5. **Toast UI** (`components/ui/undo-toast.tsx`, new):
   - Appears top-right after the bulk mutation resolves.
   - Shows: `"5 candidates deleted. [Undo]"` + a thin countdown bar over 10s.
   - Click Undo → calls the matching `undoBatchDelete` → toast morphs to "Restored." for 2s, then dismisses.
   - Auto-dismiss after 10s with no action — data finalizes on the server independently of the toast.

### Pattern B — Value changes: client-side snapshot

Used for: bulk stage change (applications), bulk status change (jobs).

No schema change. The mutation returns the previous values, the toast holds them in a ref, the undo call passes them back.

**Flow:**

1. **Bulk mutation** (e.g., `applications.bulkSetStage(ids, newStage)`):
   - For each id, capture the current stage *before* writing the new one.
   - Apply the new stage.
   - Return `Array<{ id, previousStage }>` to the client.

2. **Toast UI** holds the returned snapshot in a `useRef`. On Undo click → call `applications.bulkSetStage` again, but with `ids` mapped to their `previousStage` values. (Since stages can differ across the batch — some were `applied`, some `screening` — this is a per-id restore, not a single-value batch.)

3. **No scheduled action.** If the user doesn't click undo, nothing happens — the value is already applied.

### Edge cases

- **Undo after the 10s window** (toast dismissed but user changes their mind via some other affordance) — not supported. Once finalize runs, the data is gone.
- **Re-deleting a pending row** — the second bulk mutation skips ids with `pendingDeleteAt` set. The user effectively can't extend the undo window by re-clicking delete.
- **Finalize sees rows already cleared** — the undo cleared `pendingDeleteAt`, so finalize's filter naturally excludes them. No-op for that id.
- **Multi-tab visibility** — both tabs see the same `pendingDeleteAt` filter. A delete in tab 1 hides rows in tab 2 immediately. An undo in tab 1 restores them in tab 2 immediately.
- **Storage file deletion failure during finalize** — wrap `storage.delete` in try/catch and log; never block the candidate-row deletion on a missing file.
- **Browser closed mid-window** — irrelevant. The scheduled action runs server-side. Data finalizes whether the client is alive or not. (This is the main reason to use the scheduler instead of a client timer.)

---

## Section 1 — Candidate cascading delete

This section is the body of work invoked by Section 0's Pattern A for candidates. The cascade itself is the same whether triggered by single or bulk delete — both go through the `pendingDeleteAt` → scheduled finalize flow.

### Convex functions

In `convex/candidates.ts`:

```ts
// Mutations — both go through the pending-delete pattern in Section 0
remove(candidateId: Id<"candidates">): Promise<{ batchId: string; count: 1 }>
removeMany(candidateIds: Id<"candidates">[]): Promise<{ batchId: string; count: number }>
undoBatchDelete(batchId: string): Promise<{ restored: number }>

// Internal action — runs 10s after the mutation
internal.candidates.finalizeBatchDelete({ batchId: string }): Promise<void>
```

`remove` and `removeMany` only mark rows as pending; they share the same batch flow described in Section 0. `remove` is just `removeMany` with one id, returning the same shape so the toast wiring is uniform.

### Cascade (executed by `finalizeBatchDelete`)

For each candidate in the batch whose `pendingDeleteAt` is still set (undo would have cleared it):

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

All mutations are authorized via the existing auth helper — only school members can delete their own school's candidates. The internal finalize action re-checks school membership via the row itself (not the caller) since it runs on the scheduler.

### UI

**Single delete:**
- New button on `components/pipeline/application-drawer.tsx` (and any candidate-detail surface in talent bank): `Delete candidate` — destructive style, placed in a footer "Danger zone" or a kebab menu (matching existing patterns).
- Click → `<ConfirmDialog>` with body: *"Delete {name}? This removes their resume, every application across roles, and all evaluations. You can undo within 10 seconds."*
- On confirm → call `remove` → close drawer → undo toast appears → row disappears from list via reactivity.

**Bulk delete:**
- Available on the **talent bank view** (`app/dashboard/talent/page.tsx`).
- NOT available on job pipeline views — there the bulk action is "Remove from pipeline" (Section 4).
- Same toast pattern.

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

**"All" means filtered, not viewport.** The caller passes the *full filtered+sorted dataset* to `toggleAll`, not just the rows currently rendered by the virtualizer. Since these pages load the full set into JS memory (no server-side pagination today), this is unambiguous — selecting all means every row that matches the current search/filter, even if 950 of 1000 are below the scroll. If real `paginate()` is added later, this contract needs revisiting; for now it's a single in-memory array.

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

- **Remove from pipeline** — destructive style. Confirm modal: *"Remove {N} applications from this pipeline? The candidates remain in the system and their other applications are unaffected. You can undo within 10 seconds."* Calls `applications.removeManyApplications(applicationIds)`, which follows Pattern A from Section 0: sets `pendingDeleteAt` + a `batchId` on each application, schedules `internal.applications.finalizeBatchDelete` for 10s later. The finalize action, when it runs, deletes child rows in `evaluations`, `outreachMessages`, `calendarEvents`, `triageDecisions`, and `bookingTokens`, then the application row. The candidate is untouched. Undo toast wired via the returned `batchId`.
- **Move to stage** — popover with the school's pipeline stages (read from `pipeline_config`). On select, calls `applications.bulkSetStage(applicationIds, stage)`, which captures previous stages per id and returns them. Toast shows "Moved {N} to {stage}. [Undo]" — undo calls the same mutation with the captured previous values (Pattern B from Section 0).
- **Export CSV** — client-side. Build CSV from already-loaded rows: columns `Name, Email, Phone, Score, Stage, Subjects, Applied At`. Trigger download via `Blob` + `URL.createObjectURL`. No server call. No undo (non-destructive).

### Talent bank view (`app/dashboard/talent/`)

Rows here are applications with `jobPostingId = undefined` — the application is just the candidate's entry point into the system. Conceptually the user is selecting *people*, so the bulk action operates on the underlying candidate. The bulk action bar shows two actions:

- **Delete candidates** — destructive. The page maps selected rows → `row.candidateId`. Confirm modal: *"Delete {N} candidates? This removes their resumes, every application across roles, and all evaluations. You can undo within 10 seconds."* → `candidates.removeMany(candidateIds)` (Pattern A). Undo toast wired via the returned `batchId`.
- **Export CSV** — client-side from loaded rows: `Name, Email, Phone, Years Experience, Subjects, Qualifications, Created At`. No undo.

### Jobs list (`app/dashboard/jobs/`)

Rows are **jobs**. The bulk action bar shows three actions:

- **Delete (drafts only)** — only enabled when *every* selected job has `status === "draft"`. If any selected job is non-draft, the button is disabled with a tooltip: *"Only draft jobs can be deleted in bulk. Change status to draft first, or use the per-job actions."* On confirm → `jobs.removeMany(jobIds)` (Pattern A): server validates draft-only (throws if any selected row isn't draft when the mutation runs), marks each draft with `pendingDeleteAt` + a `batchId`, schedules `internal.jobs.finalizeBatchDelete` for 10s. Undo toast wired via the returned `batchId`.
- **Change status** — popover with status options (`Active`, `On hold`, `Filled`, `Closed`). On select, calls `jobs.bulkSetStatus(jobIds, status)`, which captures previous statuses per id and returns them. Toast shows "Status updated for {N} jobs. [Undo]" — undo calls the same mutation with captured previous values (Pattern B).
- **Export CSV** — client-side: `Title, Subject, Level, Board, Status, Positions, Created At`. No undo.

### Bulk mutation signatures

```ts
// convex/applications.ts
removeManyApplications(applicationIds: Id<"applications">[])
  : Promise<{ batchId: string; count: number }>
undoBatchDelete(batchId: string)
  : Promise<{ restored: number }>
bulkSetStage(applicationIds: Id<"applications">[], stage: string)
  : Promise<{ previousStages: Array<{ id: Id<"applications">; previousStage: string }> }>

// convex/candidates.ts
remove(candidateId: Id<"candidates">)
  : Promise<{ batchId: string; count: 1 }>
removeMany(candidateIds: Id<"candidates">[])
  : Promise<{ batchId: string; count: number }>
undoBatchDelete(batchId: string)
  : Promise<{ restored: number }>

// convex/jobs.ts
removeMany(jobIds: Id<"jobPostings">[])               // server-validates draft-only
  : Promise<{ batchId: string; count: number }>
undoBatchDelete(batchId: string)
  : Promise<{ restored: number }>
bulkSetStatus(jobIds: Id<"jobPostings">[], status: string)
  : Promise<{ previousStatuses: Array<{ id: Id<"jobPostings">; previousStatus: string }> }>

// Internal actions (run on the scheduler 10s after the corresponding remove mutation)
internal.applications.finalizeBatchDelete({ batchId: string }): Promise<void>
internal.candidates.finalizeBatchDelete({ batchId: string }): Promise<void>
internal.jobs.finalizeBatchDelete({ batchId: string }): Promise<void>
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
| `hooks/use-undo-toast.ts` | Hook that owns the undo-toast queue + countdown + dismiss. |
| `components/ui/bulk-action-bar.tsx` | Fixed-position bottom bar shown when selection > 0. |
| `components/ui/confirm-dialog.tsx` | Reusable destructive/neutral confirmation modal. |
| `components/ui/undo-toast.tsx` | Toast component with countdown bar + Undo button + "Restored" terminal state. |
| `components/criteria/CriteriaNaturalLanguageEditor.tsx` | NL textarea with autosave for `job.criteria`. |
| `components/pipeline/rejection-history-indicator.tsx` | Row badge showing "N prior rejects". |
| `components/pipeline/previous-outcomes-section.tsx` | Drawer section listing prior rejections + eval notes. |
| `lib/csv-export.ts` | Tiny helper: takes rows + column config, triggers browser download. |

### Modified files

| Path | Change |
|---|---|
| `convex/schema.ts` | Add `by_applicationId` index on `bookingTokens`. Add `pendingDeleteAt` + `pendingDeleteBatchId` (both `v.optional`) to `candidates`, `applications`, `jobPostings`. |
| `convex/candidates.ts` | Add `remove`, `removeMany`, `undoBatchDelete`, `getRejectionHistory`. Add `internal.candidates.finalizeBatchDelete`. Update existing list/filter queries to exclude `pendingDeleteAt != null`. |
| `convex/applications.ts` | Add `removeManyApplications`, `undoBatchDelete`, `bulkSetStage`. Add `internal.applications.finalizeBatchDelete`. Extend `getPipelineForJob` to include `priorRejectCount` per row and exclude `pendingDeleteAt`. |
| `convex/jobs.ts` | Add `removeMany` (draft-only validation), `undoBatchDelete`, `bulkSetStatus`, `saveCriteriaText`. Add `internal.jobs.finalizeBatchDelete`. Update list queries to exclude `pendingDeleteAt`. |
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

- **Initial bulk-delete mutation failure** (the one that *marks* rows): runs in a single Convex transaction. Any per-id auth or state failure throws and rolls back the whole batch. Surface via toast.
- **Scheduled finalize failure**: the finalize action runs server-side after 10s. If it throws partway through a batch, some rows are deleted and some remain pending. Convex's scheduler retries failed actions with backoff, so transient errors recover; persistent errors surface in the Convex dashboard logs. The user doesn't see this — the rows are already hidden by `pendingDeleteAt`. Worst case: a row stays in "pending" forever; a follow-up admin sweep query (`pendingDeleteAt < now - 24h`) can be added later if this becomes a real problem.
- **Deleting a candidate currently being viewed in another tab**: Convex reactivity sets `pendingDeleteAt` on the row; the drawer in another tab sees the row become filtered (or `useQuery` returns the filtered list). The drawer should detect this and close itself with a notice ("This candidate was deleted.").
- **Resume file already deleted in storage**: `ctx.storage.delete` is wrapped in try/catch in finalize — swallow not-found errors and log; never block on a missing file.
- **Bulk job delete with mixed statuses**: client disables the Delete button when any selection isn't draft; server re-validates inside the mutation and throws on the first non-draft id encountered (rolls back the whole batch — no rows marked).
- **Undo called after finalize already ran**: the undo mutation finds no rows with that batchId (they're gone). Return `{ restored: 0 }`. UI toast should show "Couldn't undo — items have been permanently deleted."
- **Undo called twice for the same batch**: second call finds nothing to clear. Return `{ restored: 0 }`. Harmless.
- **Stage-change undo with a row that was further-modified after the bulk change**: still applies the previous-stage snapshot (last-write-wins). This is acceptable — undo means "go back to what you had right before the bulk action".
- **CSV export with non-ASCII fields**: prefix CSV with BOM (`﻿`) so Excel opens it as UTF-8.
- **Shift-click range select after a filter/sort change**: the visible-ids array passed to the hook updates each render, so the "range" is always relative to current display order. Correct behaviour.
- **Empty selection clicking a bulk action**: the bar is hidden at count=0, so this isn't reachable.

---

## Testing

### Unit

- `useTableSelection`: toggle, shift-range, toggleAll behaviour, clear. Pure logic — covered by RTL hook tests.
- `csv-export`: row→CSV string formatting, escaping, BOM. Pure function tests.

### Integration

Each delete-pattern test should cover: (a) mutation marks rows pending without touching child rows; (b) finalize action cascades correctly; (c) undo within window restores; (d) undo after finalize is a no-op.

- Convex mutations:
  - `candidates.remove` / `removeMany` / `internal.candidates.finalizeBatchDelete`: applications + evaluations + outreach + calendar events + triage decisions + booking tokens + candidate pools + resume → all gone after finalize; nothing gone before finalize. Undo before finalize restores all rows. Undo after finalize returns `restored: 0`.
  - `applications.removeManyApplications` / `internal.applications.finalizeBatchDelete`: applications + their child rows gone; candidate untouched.
  - `applications.bulkSetStage`: all stages updated; returns correct `previousStages` snapshot. Calling it again with the snapshot restores prior state.
  - `jobs.removeMany` / `internal.jobs.finalizeBatchDelete`: drafts deleted after finalize; non-draft mixed in throws on the initial mutation and nothing is marked.
  - `jobs.bulkSetStatus`: status updated across batch; returns correct `previousStatuses` snapshot.
  - `candidates.getRejectionHistory`: returns correct shape; `excludeApplicationId` honoured; orders by `rejectedAt` desc.
  - List queries (`candidates.listForSchool`, `applications.getPipelineForJob`, `jobs.listBySchool`): exclude rows where `pendingDeleteAt != null`.

### Manual / preview

- Multi-select on the candidate table: click, shift-click range, toggle all (selects every filtered row, not just rendered), clear.
- Multi-select on jobs grid: same.
- Bulk action bar appears, disappears, slides without layout shift.
- Criteria page: NL textarea autosave, structured editor coexistence, "Generate with AI" populates structured editor without touching textarea.
- Candidate delete from drawer → confirm modal → undo toast appears → row hidden → click Undo within 10s → row returns; let it expire → row gone, refresh confirms.
- Bulk Remove from pipeline: 5 selected → action → 5 rows hidden + undo toast → undo restores → repeat without undo, wait 10s, refresh confirms permanent deletion.
- Bulk stage change: 5 selected → Move to Interview → undo toast → undo restores individual prior stages (not all to the same value).
- Prior reject badge visible when applicable; drawer "Previous outcomes" shows evaluation notes; self-reference excluded.

---

## Open questions

None at spec time. The candidate-vs-application semantics, the cascading scope, the criteria layout, the bulk action set, and the rejection history shape were all settled during brainstorming.
