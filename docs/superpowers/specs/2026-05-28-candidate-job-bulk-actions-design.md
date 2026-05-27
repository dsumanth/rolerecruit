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
- All three listing pages (candidates / applications / jobs) are **cursor-paginated** via Convex's native `paginate()`. Filtering, search, and sort move server-side.
- Multi-select supports **two modes**: selection-by-IDs (the default; what you check) and selection-by-filter (the banner opt-in for "Select all 2,345 matching"). Bulk mutations accept either.

## Non-Goals

- Persistent soft-delete / trash bin / "Recently deleted" view. The undo window is intentionally short (10s) — beyond that, data is genuinely gone.
- Server-side CSV generation (client-side from loaded rows is sufficient for current volumes; the matchAll mode is intentionally not wired to CSV — see Section 1).
- Keyboard shortcuts beyond shift-click range select (Cmd+A, Esc to clear, etc. can be follow-ups).
- A new evaluations subsystem — evaluations are already wired (`convex/evaluations.ts`, four UI consumers). The rejection-history feature reads existing evaluation data.
- Sub-batching for very large matchAll operations (>50k matching rows). Acceptable to leave as a follow-up; flagged in Section 1 edge cases.

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
   - For each such row, perform the actual cascading hard delete from Section 2 (child tables → resume file → row itself).
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

## Section 1 — Pagination & select-all-matching (cross-cutting)

### Why

Convex queries cap result payloads at 8 MiB and re-emit the full result on any reactive change. Without pagination, the talent bank breaks at roughly 3-8k candidates per school. Beyond the cap, full-result queries also burn memory and re-render cost on every insert. Pagination is the load-bearing fix for this.

### Convex query changes

Three list queries switch from full-result to cursor-paginated via Convex's native `paginate()`:

```ts
// convex/candidates.ts
listForSchool({
  schoolId: Id<"schools">,
  paginationOpts: PaginationOptsValidator,
  filter?: { poolId?: Id<"pools"> | "all", stages?: string[], search?: string },
  sort?: "newest" | "score" | "name",
}): { page: Application[], isDone: boolean, continueCursor: string }
// Reminder: talent-bank rows are applications with jobPostingId = undefined.
// listForSchool keeps that shape; the query just adds paginationOpts + server-side filter/sort.

countForSchool({
  schoolId,
  filter?: ...,
}): { total: number }     // separate cheap query for the banner

// convex/applications.ts
getPipelineForJob({
  jobId, paginationOpts,
  filter?: { stage?: string, search?: string },
  sort?: "newest" | "score" | "name",
})

countForJob({ jobId, filter? }): { total: number }

// convex/jobs.ts
listBySchool({
  schoolId, paginationOpts,
  filter?: { status?: JobStatus, search?: string },
  sort?: "newest" | "title",
})

countBySchool({ schoolId, filter? }): { total: number }
```

Notes on sort:

- `newest` uses `_creationTime` (Convex provides ordering on this for free).
- `name` / `title` require new indexes on the underlying tables: `by_schoolId_name` on candidates/applications (whichever the talent bank queries), `by_schoolId_title` on `jobPostings`.
- `score` for applications uses `aiMatchScore`; new index `by_jobPostingId_aiMatchScore` (descending) on `applications`. For talent bank where there's no job context, "score" is a meaningful field on the application row anyway (carried over from the original triage), so the same index works.

Count queries scan with the same filter but return only the count. `O(N)` server-side but zero payload — acceptable for the school sizes we expect, and only run on-demand when the banner needs to render.

### Client integration

Pages swap `useQuery` → `usePaginatedQuery`:

```tsx
const { results, status, loadMore } = usePaginatedQuery(
  api.candidates.listForSchool,
  { schoolId, filter, sort },
  { initialNumItems: 100 },
);
```

Infinite scroll via an intersection observer near the bottom of the virtualized list — when the user scrolls within ~10 rows of the loaded end, call `loadMore(100)`.

Search/filter/sort inputs now drive query args (not client-side memoization). Changing any of them resets to a fresh paginated subscription (Convex handles this — new args, new query).

### Multi-select — two modes

`useTableSelection` gets a `mode` discriminator:

```ts
type SelectionMode<F> =
  | { kind: "ids"; selected: Set<Id> }
  | { kind: "all-matching"; filter: F };

function useTableSelection<Id, F>(): {
  mode: SelectionMode<F>;
  isSelected: (id: Id) => boolean;          // always true in matchAll mode
  toggle: (id: Id, shiftKey?: boolean) => void;   // moving from matchAll → ids implicitly switches mode
  toggleAllLoaded: (loadedIds: Id[]) => void;     // header checkbox; stays in ids mode
  selectAllMatching: (filter: F) => void;         // banner click; switches to matchAll
  clear: () => void;
  count: { kind: "ids"; n: number } | { kind: "all-matching"; n: number };
}
```

UI states:

1. **No selection** — action bar hidden.
2. **Some loaded selected (ids mode)** — action bar shows count + actions.
3. **All loaded selected (ids mode)** — action bar shows count + actions, and a banner appears above it: *"All {loadedCount} candidates on this page selected. [Select all {totalCount} matching this filter]"*. The total comes from the count query.
4. **All matching selected (matchAll mode)** — action bar shows the total + actions + Clear. Per-row checkboxes render as always-checked but are not individually togglable in this mode (clicking one drops back to ids mode with that row deselected from the now-expanded set — implemented by expanding matchAll to ids client-side via a paginated drain). The simpler v1 behaviour: clicking any per-row checkbox in matchAll mode just calls `clear()` and re-enters ids mode with only that single row toggled. Acceptable v1 simplification.

Banner is a new component `components/ui/select-all-matching-banner.tsx` rendered conditionally inside `BulkActionBar`.

### Bulk mutation signature changes

Every bulk mutation accepts a discriminated union:

```ts
type BulkInput<F> =
  | { ids: Id[] }
  | { matchAll: F };

// Updated signatures:
candidates.removeMany(args: BulkInput<{ schoolId, filter? }>)
  : Promise<{ batchId: string; count: number }>

applications.removeManyApplications(
  args: BulkInput<{ jobId: Id<"jobPostings"> | null, filter? }>
): Promise<{ batchId: string; count: number }>

applications.bulkSetStage(
  args: BulkInput<{ jobId, filter? }> & { stage: string }
): Promise<{ batchId: string; previousStages: Array<{ id, previousStage }> }>

jobs.removeMany(args: BulkInput<{ schoolId, filter? }>)
  : Promise<{ batchId: string; count: number }>            // server-validates draft-only

jobs.bulkSetStatus(
  args: BulkInput<{ schoolId, filter? }> & { status: string }
): Promise<{ batchId: string; previousStatuses: Array<{ id, previousStatus }> }>
```

Server-side handling: when `args.matchAll` is provided, the mutation runs the same query that powers the listing (same filter, no pagination — `.collect()` instead of `.paginate()`), gets the matching IDs, then runs the existing batch logic against those IDs. This means **no matchAll-specific finalize path** — once the matchAll is expanded into an ID set inside the mutation, all the existing Section 0 undo + cascade logic applies unchanged.

Auth: the same school-membership check runs against the resolved filter (e.g., `schoolId` must match the caller's school).

### Edge cases

- **matchAll batch size**: a single mutation that expands 50k IDs and marks them stays within Convex's transaction limits. Larger than ~50k would need sub-batching (split into chunks of N, schedule sequentially); flagged as a follow-up.
- **Filter validation**: the matchAll filter is validated against the same schema validators used by the listing query — enums (stage, status) checked, search strings length-capped. Invalid filter → mutation throws.
- **Late arrivals**: matchAll resolves to IDs at mutation time. Rows uploaded a second later are *not* affected. Deliberate.
- **Count drift**: the banner shows the count at the moment it renders. By the time the user clicks the action, the count may have moved. The mutation re-expands and acts on the fresh set; banner is approximate.
- **Empty matchAll**: filter returns zero matches → mutation is a no-op, returns `{ batchId, count: 0 }`. UI suppresses the undo toast.
- **Undo + matchAll**: undo uses the `batchId`, not the filter. `undoBatchDelete(batchId)` restores exactly the rows that were marked at expansion time — even if the filter would now match a different set.
- **Bulk CSV export not wired to matchAll**: CSV export operates on currently-loaded rows. Exporting "all matching" would require either streaming or a server-side CSV builder; intentionally deferred. The UI hides the Export button when in matchAll mode.

---

## Section 2 — Candidate cascading delete

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
- NOT available on job pipeline views — there the bulk action is "Remove from pipeline" (Section 5).
- Same toast pattern.

---

## Section 3 — Criteria UX (NL textarea + structured editor)

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

- **Top block — NL textarea**: bound to `jobPostings.criteria` (existing string field). Autosave on blur via a new mutation `convex/jobs.ts:saveCriteriaText(jobId, text)`. Subtle "Saved" indicator on the right.
- **Bottom block — Structured editor**: the existing `ScoringRuleEditor` component, populated from `job.scoringRules` if present, empty otherwise.
- **Page-level "Generate with AI" button** (top-right of `PageHeader` action area): calls `api.scoring.suggestCriteria` using the NL textarea content as input (falling back to `job.naturalLanguageDescription` if textarea is empty), populates the structured editor directly. The textarea is **never** modified by AI.

### Component changes

- New: `components/criteria/CriteriaNaturalLanguageEditor.tsx` — textarea + autosave logic.
- Removed: `components/criteria/AISuggestedCriteria.tsx` (its "Generate" CTA moves to the page header; suggestions land directly in `ScoringRuleEditor` with no intermediate "Accept" step).
- New mutation: `convex/jobs.ts:saveCriteriaText({ jobId, text })`.

### Matching semantics (unchanged)

Matching code continues to prefer `scoringRules` when present; falls back to NL `criteria` parsing. No change.

---

## Section 4 — Multi-select primitive (shared)

### Hook

New: `hooks/use-table-selection.ts`. The full type and behaviour are defined in Section 1's "Multi-select — two modes" subsection (the hook is co-designed with the pagination story; it cannot be specified without it). Restated here in brief:

```ts
function useTableSelection<Id, F>(): {
  mode:
    | { kind: "ids"; selected: Set<Id> }
    | { kind: "all-matching"; filter: F };
  isSelected, toggle, toggleAllLoaded, selectAllMatching, clear, count;
}
```

Internals (ids mode):
- `mode.selected` is a `Set<Id>` in component state.
- `toggle(id, shiftKey)` tracks the last-toggled id; if `shiftKey` is true and there's a last id, all ids between them in the loaded-order array are toggled. The hook receives the loaded-order array via a setter the caller wires up each render: `setLoadedIds(rows.map(r => r._id))`.
- `toggleAllLoaded(ids)` flips behaviour based on whether all `ids` are already selected: if yes, deselect them; if no, select them all (additive — doesn't clear other selections).

Mode transitions:
- `selectAllMatching(filter)` flips to `{ kind: "all-matching", filter }`. Per-row checkboxes render as always-checked but are not individually togglable (clicking one — as a v1 simplification — clears and re-enters ids mode with that single row toggled).
- `toggle()` from matchAll mode also flips back to ids mode.
- `clear()` always returns to `{ kind: "ids", selected: empty }`.

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

## Section 5 — Bulk actions

### Candidate pipeline views (`app/dashboard/jobs/[id]/pipeline/`, `app/dashboard/pipeline/`)

Rows here are **applications**, not candidates. The bulk action bar shows three actions:

- **Remove from pipeline** — destructive style. Confirm modal: *"Remove {N} applications from this pipeline? The candidates remain in the system and their other applications are unaffected. You can undo within 10 seconds."* Calls `applications.removeManyApplications` with either `{ ids }` or `{ matchAll: { jobId, filter } }` based on the current selection mode (Section 1). Follows Pattern A from Section 0: sets `pendingDeleteAt` + a `batchId` on each application, schedules `internal.applications.finalizeBatchDelete` for 10s later. The finalize action, when it runs, deletes child rows in `evaluations`, `outreachMessages`, `calendarEvents`, `triageDecisions`, and `bookingTokens`, then the application row. The candidate is untouched. Undo toast wired via the returned `batchId`.
- **Move to stage** — popover with the school's pipeline stages (read from `pipeline_config`). On select, calls `applications.bulkSetStage` with `{ ids | matchAll, stage }` based on selection mode. The server captures previous stages per id and returns them. Toast shows "Moved {N} to {stage}. [Undo]" — undo calls `bulkSetStage` again with `{ ids: snapshot.map(s => s.id), stage: ... }` per-id (the snapshot also carries the original stages — see Pattern B from Section 0).
- **Export CSV** — client-side. Build CSV from already-loaded rows: columns `Name, Email, Phone, Score, Stage, Subjects, Applied At`. Trigger download via `Blob` + `URL.createObjectURL`. No server call. No undo (non-destructive). Hidden in matchAll mode (see Section 1).

### Talent bank view (`app/dashboard/talent/`)

Rows here are applications with `jobPostingId = undefined` — the application is just the candidate's entry point into the system. Conceptually the user is selecting *people*, so the bulk action operates on the underlying candidate. The bulk action bar shows two actions:

- **Delete candidates** — destructive. In ids mode, the page maps selected rows → `row.candidateId` and calls `candidates.removeMany({ ids: candidateIds })`. In matchAll mode, calls `candidates.removeMany({ matchAll: { schoolId, filter } })` — the server expands to candidateIds via the same query that powers the listing. Confirm modal: *"Delete {N} candidates? This removes their resumes, every application across roles, and all evaluations. You can undo within 10 seconds."* Pattern A. Undo toast wired via the returned `batchId`.
- **Export CSV** — client-side from loaded rows: `Name, Email, Phone, Years Experience, Subjects, Qualifications, Created At`. No undo. Hidden in matchAll mode.

### Jobs list (`app/dashboard/jobs/`)

Rows are **jobs**. The bulk action bar shows three actions:

- **Delete (drafts only)** — in ids mode, only enabled when *every* selected job has `status === "draft"` (client checks the loaded rows). In matchAll mode, this is enforced by always restricting the filter to `status: "draft"` before sending — the button is disabled in matchAll mode if the current view's status filter isn't `draft`. On confirm → `jobs.removeMany` with `{ ids }` or `{ matchAll: { schoolId, filter } }`. The server re-validates draft-only and throws if any matched row isn't draft (rollback). Pattern A.
- **Change status** — popover with status options (`Active`, `On hold`, `Filled`, `Closed`). On select, calls `jobs.bulkSetStatus` with `{ ids | matchAll, status }`. The server captures previous statuses per id and returns them. Toast shows "Status updated for {N} jobs. [Undo]" — undo calls `bulkSetStatus` per-id with the captured previous statuses (Pattern B).
- **Export CSV** — client-side: `Title, Subject, Level, Board, Status, Positions, Created At`. No undo. Hidden in matchAll mode.

### Bulk mutation signatures

All bulk mutations take `BulkInput<F> = { ids: Id[] } | { matchAll: F }` — see Section 1 for the matchAll semantics. Stage/status mutations also include the new value as a separate field. Single-row helpers (`remove`) wrap the bulk shape with a fixed `ids: [id]`.

```ts
// convex/applications.ts
removeManyApplications(
  args: BulkInput<{ jobId: Id<"jobPostings"> | null; filter?: PipelineFilter }>
): Promise<{ batchId: string; count: number }>

bulkSetStage(
  args: BulkInput<{ jobId: Id<"jobPostings"> | null; filter?: PipelineFilter }> & { stage: string }
): Promise<{ batchId: string; previousStages: Array<{ id: Id<"applications">; previousStage: string }> }>

undoBatchDelete(batchId: string): Promise<{ restored: number }>

// convex/candidates.ts
remove(candidateId: Id<"candidates">)
  : Promise<{ batchId: string; count: 1 }>
removeMany(
  args: BulkInput<{ schoolId: Id<"schools">; filter?: TalentFilter }>
): Promise<{ batchId: string; count: number }>
undoBatchDelete(batchId: string): Promise<{ restored: number }>

// convex/jobs.ts
removeMany(
  args: BulkInput<{ schoolId: Id<"schools">; filter?: JobFilter }>   // server-validates draft-only
): Promise<{ batchId: string; count: number }>

bulkSetStatus(
  args: BulkInput<{ schoolId: Id<"schools">; filter?: JobFilter }> & { status: string }
): Promise<{ batchId: string; previousStatuses: Array<{ id: Id<"jobPostings">; previousStatus: string }> }>

undoBatchDelete(batchId: string): Promise<{ restored: number }>

// Internal actions (run on the scheduler 10s after the corresponding remove mutation)
internal.applications.finalizeBatchDelete({ batchId: string }): Promise<void>
internal.candidates.finalizeBatchDelete({ batchId: string }): Promise<void>
internal.jobs.finalizeBatchDelete({ batchId: string }): Promise<void>
```

Server-side, when `args.matchAll` is provided, the mutation expands the filter to an ID set via the same query that powers the listing, then runs the same per-id batch logic as the `ids` path. Single-id failures abort the batch and Convex's transaction model rolls back any marks already set in the same call. Auth: school membership is re-checked per row.

---

## Section 6 — Rejection history indicator

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
| `hooks/use-table-selection.ts` | Multi-select hook with `ids` and `all-matching` modes; shift-click range select within loaded rows. |
| `hooks/use-undo-toast.ts` | Hook that owns the undo-toast queue + countdown + dismiss. |
| `hooks/use-infinite-scroll.ts` | Intersection-observer wrapper that calls `loadMore()` near the end of the loaded set. |
| `components/ui/bulk-action-bar.tsx` | Fixed-position bottom bar shown when selection > 0. Hosts the matchAll banner. |
| `components/ui/select-all-matching-banner.tsx` | "All {N} on this page selected. [Select all {total} matching]" banner. |
| `components/ui/confirm-dialog.tsx` | Reusable destructive/neutral confirmation modal. |
| `components/ui/undo-toast.tsx` | Toast component with countdown bar + Undo button + "Restored" terminal state. |
| `components/criteria/CriteriaNaturalLanguageEditor.tsx` | NL textarea with autosave for `job.criteria`. |
| `components/pipeline/rejection-history-indicator.tsx` | Row badge showing "N prior rejects". |
| `components/pipeline/previous-outcomes-section.tsx` | Drawer section listing prior rejections + eval notes. |
| `lib/csv-export.ts` | Tiny helper: takes rows + column config, triggers browser download. |
| `lib/bulk-input.ts` | Shared TS types for `BulkInput<F>` and per-table filter shapes (mirror of Convex validators). |

### Modified files

| Path | Change |
|---|---|
| `convex/schema.ts` | Add `by_applicationId` index on `bookingTokens`. Add `pendingDeleteAt` + `pendingDeleteBatchId` (both `v.optional`) to `candidates`, `applications`, `jobPostings`. Add sort indexes: `by_schoolId_creationTime` and `by_schoolId_name` on `applications` and `jobPostings`; `by_jobPostingId_aiMatchScore` on `applications`. |
| `convex/candidates.ts` | Convert `listForSchool` to paginated; add `countForSchool`. Add `remove`, `removeMany`, `undoBatchDelete`, `getRejectionHistory`. Add `internal.candidates.finalizeBatchDelete`. Update existing list/filter queries to exclude `pendingDeleteAt != null`. |
| `convex/applications.ts` | Convert `getPipelineForJob` to paginated; add `countForJob`. Add `removeManyApplications`, `undoBatchDelete`, `bulkSetStage`. Add `internal.applications.finalizeBatchDelete`. Extend the paginated query rows to include `priorRejectCount`. Exclude `pendingDeleteAt` from all reads. |
| `convex/jobs.ts` | Convert `listBySchool` to paginated; add `countBySchool`. Add `removeMany` (draft-only validation), `undoBatchDelete`, `bulkSetStatus`, `saveCriteriaText`. Add `internal.jobs.finalizeBatchDelete`. Update list queries to exclude `pendingDeleteAt`. |
| `app/dashboard/jobs/[id]/criteria/page.tsx` | Restructure: NL textarea + structured editor stacked; "Generate with AI" moves to page header. |
| `app/dashboard/jobs/[id]/pipeline/page.tsx` | Switch to `usePaginatedQuery`; filter/search/sort drive query args. Wire up `useTableSelection` + `<BulkActionBar>`. |
| `app/dashboard/pipeline/page.tsx` (and `pipeline-list.tsx`) | Same — paginated query + bulk-action wiring. |
| `app/dashboard/jobs/page.tsx` | Paginated `listBySchool`; server-side filter (status/search) + sort. Bulk-action wiring; draft-only validation logic for Delete button. |
| `app/dashboard/talent/page.tsx` | Paginated `listForSchool`; server-side filter (pool/stage/search) + sort. Bulk-action wiring; talent-bank-specific bulk actions (delete + export). |
| `components/talent/talent-controls.tsx` | Inputs now controlled and emit filter/sort changes to the page; no longer drives client-side memo. |
| `components/pipeline/application-table.tsx` | Leading checkbox column; selection highlight; prior-reject badge on row; intersection observer wired to `loadMore`. |
| `components/pipeline/application-drawer.tsx` | "Delete candidate" button (Danger zone); "Previous outcomes" section. |
| `components/jobs/jobs-list.tsx` | Per-card checkbox; selection highlight; intersection observer wired to `loadMore`. |

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
- **Shift-click range select after a filter/sort change**: the loaded-ids array passed to the hook updates each render, so the "range" is always relative to current loaded order. Correct behaviour.
- **Empty selection clicking a bulk action**: the bar is hidden at count=0, so this isn't reachable.
- **Shift-click range select across un-loaded rows**: the user selects row 1, scrolls down (more rows load), shift-clicks row 200. The range covers rows 1-200 in loaded order — the rows now in memory. If rows in the middle haven't loaded yet (sparse pagination), shift-click can't reach them. Acceptable v1 — the user can scroll to force them to load before shift-clicking.
- **Selection survives a `loadMore`**: ids selection is in component state, not derived from the result. Loading more rows adds them with `isSelected = false`. The selection set is unaffected.
- **Selection drops on filter/sort change**: when the user changes filter/sort, the underlying paginated query restarts; the selection is reset to empty (otherwise it could contain ids that are no longer in the visible result). Document this clearly in the UI ("Changing filter cleared your selection").
- **matchAll banner shows stale count**: the count query is reactive in Convex, so it updates as the dataset changes. Brief flicker between filter change and updated count is acceptable.
- **paginate result includes a row that another tab marked `pendingDeleteAt` mid-scroll**: Convex re-emits the affected page; the row drops from the result. The virtualized list re-renders without it. No further handling needed.

---

## Testing

### Unit

- `useTableSelection`: toggle, shift-range within loaded ids, toggleAllLoaded behaviour, mode transitions (ids ↔ all-matching), clear, count shape. Pure logic — covered by RTL hook tests.
- `useInfiniteScroll`: intersection-observer fires `loadMore` near the threshold; doesn't re-fire while a load is in-flight.
- `csv-export`: row→CSV string formatting, escaping, BOM. Pure function tests.

### Integration

Each delete-pattern test should cover: (a) mutation marks rows pending without touching child rows; (b) finalize action cascades correctly; (c) undo within window restores; (d) undo after finalize is a no-op. Each bulk mutation should also be tested in both `ids` and `matchAll` modes.

- Convex mutations:
  - `candidates.remove` / `removeMany` / `internal.candidates.finalizeBatchDelete`: applications + evaluations + outreach + calendar events + triage decisions + booking tokens + candidate pools + resume → all gone after finalize; nothing gone before finalize. Undo before finalize restores all rows. Undo after finalize returns `restored: 0`. matchAll expands filter to correct IDs and applies.
  - `applications.removeManyApplications` / `internal.applications.finalizeBatchDelete`: applications + their child rows gone; candidate untouched. Both `ids` and `matchAll` shapes covered.
  - `applications.bulkSetStage`: all stages updated; returns correct `previousStages` snapshot. Calling it again with the snapshot restores prior state. Both shapes covered.
  - `jobs.removeMany` / `internal.jobs.finalizeBatchDelete`: drafts deleted after finalize; non-draft mixed in throws on the initial mutation and nothing is marked. matchAll with a non-draft filter throws server-side.
  - `jobs.bulkSetStatus`: status updated across batch; returns correct `previousStatuses` snapshot. Both shapes covered.
  - `candidates.getRejectionHistory`: returns correct shape; `excludeApplicationId` honoured; orders by `rejectedAt` desc.
  - List queries (`candidates.listForSchool`, `applications.getPipelineForJob`, `jobs.listBySchool`): exclude rows where `pendingDeleteAt != null`. Return `{ page, isDone, continueCursor }`; server-side filter/sort honoured.
  - Count queries (`candidates.countForSchool`, `applications.countForJob`, `jobs.countBySchool`): match the totals you'd get by collecting the paginated query with the same filter.

### Manual / preview

- Pagination + infinite scroll: open talent bank with 2k+ candidates, confirm only ~100 load initially, scroll to load more, confirm no UI jank, confirm filter/sort/search changes reset to a fresh page.
- Multi-select on the candidate table: click, shift-click range, toggle all loaded, banner appears, click banner → matchAll mode, count shows total matching, clear.
- Multi-select on jobs grid: same.
- Bulk action bar appears, disappears, slides without layout shift.
- Criteria page: NL textarea autosave, structured editor coexistence, "Generate with AI" populates structured editor without touching textarea.
- Candidate delete from drawer → confirm modal → undo toast appears → row hidden → click Undo within 10s → row returns; let it expire → row gone, refresh confirms.
- Bulk Remove from pipeline (ids mode): 5 selected → action → 5 rows hidden + undo toast → undo restores → repeat without undo, wait 10s, refresh confirms permanent deletion.
- Bulk Delete candidates (matchAll mode): filter to "Math" subject (1,234 matching) → select all on page → click banner "Select all 1,234 matching" → Delete → confirm "Delete 1,234?" → undo toast → undo restores; repeat and wait → all 1,234 permanently deleted.
- Bulk stage change: 5 selected → Move to Interview → undo toast → undo restores individual prior stages (not all to the same value).
- Prior reject badge visible when applicable; drawer "Previous outcomes" shows evaluation notes; self-reference excluded.

---

## Open questions

None at spec time. Settled during brainstorming: candidate-vs-application semantics, cascading scope, criteria layout, bulk action set, rejection history shape, 10s undo via scheduled finalize, pagination + select-all-matching.
