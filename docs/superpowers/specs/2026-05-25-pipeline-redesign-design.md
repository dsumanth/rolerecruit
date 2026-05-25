# Pipeline Redesign — Design Spec

**Date:** 2026-05-25  
**Status:** Approved

## Problem

The current pipeline view has three structural problems:

1. **Doesn't scale** — A 6-column kanban with raw cards breaks beyond ~20 applications. Users with 1000+ applications per job can't use the view effectively.
2. **Missing job statuses** — Only `active` and `filled` jobs appear in the picker. `draft`, `paused`, and `closed` jobs are invisible.
3. **Context-switching drawer** — Every candidate interaction opens a slide-out drawer that covers the pipeline, breaking spatial context.

## Goals

- Show all job statuses (active, paused, closed, draft) in a tabbed interface
- Default to a searchable, filterable, sortable **list view** that scales to thousands of applications
- Keep kanban as a "focus mode" available when filtered to ≤ 50 applications
- Replace the drawer with inline row expansion — no context switch
- Apple-esque minimalist visual design throughout

---

## Layout Structure

```
┌──────────────────────────────────────────────────────────────┐
│ [ Active (3) ]  [ Paused (1) ]  [ Closed (5) ]  [ Drafts ]  │  ← status tabs with counts
├────────────┬─────────────────────────────────────────────────┤
│            │  [List | Kanban]   [Search...]  [Filter pills]  │  ← view toggle + controls
│  Job       │  ─────────────────────────────────────────────  │
│  sidebar   │  Candidate │ Score │ Stage │ Subjects │ ...    │  ← sticky table header
│  ───────   │  ─────────────────────────────────────────────  │
│  Math TGT  │  Priya S.   │  92%  │ Screened │ Math,Sci     │
│  English   │  Rahul K.   │  78%  │ Sourced  │ English      │  ← virtualized rows
│  Science   │  Anjali M.  │  85%  │ Demo Sch.│ Physics      │
│  ...       │  ...                                           │
│            │  ─── expanded row (inline tabs) ───             │  ← click to expand
│            │  [Info] [Outreach] [Demo] [Evaluate]            │
│            │  Content here...                                │
│            │                                                 │
└────────────┴─────────────────────────────────────────────────┘
```

### Job Sidebar (240px, collapsible to 48px icons)

- Lists jobs filtered by the selected status tab
- Vertical scrollable list — scales to any number of jobs
- Selected job highlighted in blue (`#0071e3`) with a subtle left border accent
- Search input at top of sidebar for filtering jobs by title
- Collapse button toggles to icon-only mode (48px wide)
- Each job row shows: title, subject, level, and a mini application count

### Status Tabs

- Tabs: `Active`, `Paused`, `Closed`, `Drafts`
- Each tab shows a count badge (e.g., "Active (3)")
- Jobs are pre-filtered by the selected status before appearing in the sidebar
- `Active` is the default tab

---

## Application List View (Default)

The default view when a job is selected. Replaces the kanban entirely at scale.

### Table Columns

| Column      | Description                                                    |
|-------------|----------------------------------------------------------------|
| Candidate   | Name (bold), location below in muted text                      |
| Score       | AI match score as a colored pill: green ≥80, amber ≥50, gray <50 |
| Stage       | Current pipeline stage as a subtle chip                        |
| Subjects    | Comma-separated subjects in muted text                         |
| Experience  | Years of experience (integer)                                  |
| Location    | City/location                                                  |

### Controls (above table)

- **Search bar** — client-side filter by name, subject, location. Debounced 300ms input.
- **View toggle** — segmented control: `[List] [Kanban]`. Kanban is disabled (grayed out) when filtered results > 50, with tooltip: "Filter to 50 or fewer applications to use Kanban view."
- **Stage filter pills** — horizontal row: `[All] [Sourced (12)] [Screened (8)] [Demo Scheduled (5)] [Demo Completed (3)] [Offer Sent (2)] [Hired (1)]`. Click to filter the table to that stage. `All` is default.
- **Sort control** — dropdown or segmented control: `Newest`, `Highest Score`, `Name A-Z`
- **Row count** — "Showing 47 of 1,024 applications" in muted text below the controls

### Row Expansion (Inline)

Clicking a table row expands it downward, pushing subsequent rows lower. The expanded area contains the same four-tab content currently in the drawer:

```
┌──────────────────────────── Row (collapsed) ────────────────────────────┐
│ Priya S.      │ 92% │ Screened │ Math, Science │ 5 yrs │ Bangalore     │
├──────────────────────────── Row (expanded) ─────────────────────────────┤
│ [Info] [Outreach] [Demo] [Evaluate]                                      │
│                                                                          │
│ Stage: Screened                                                          │
│ AI Match: 92%                                                            │
│ Location: Bangalore                                                      │
│ Contact: +91 9876543210 | priya@email.com                                │
│ Experience: 5 years at DPS Bangalore                                     │
│ Qualifications: B.Ed, M.Sc Mathematics                                   │
│ ...                                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

- Only one row can be expanded at a time (expanding a new row collapses the previous)
- Tab content is the same as the current drawer — no new components, just relocated
- The expanded row uses a subtle blue left border to indicate it belongs to the selected row

### Virtualization

- Table uses `@tanstack/react-virtual` or similar for rows
- Only visible rows (~20-30) are rendered in the DOM
- 1000 rows render as fast as 20

### Filter Interaction Rules

- Search and stage filters combine: if "P" is typed AND "Screened" pill is selected, show screened candidates whose name/subject/location contains "P"
- Clearing search restores the stage-filtered view
- Sort applies on top of the filtered set

---

## Kanban View (Focus Mode)

### Access

- Only accessible via the `[Kanban]` toggle when filtered results ≤ 50
- When > 50, the button is disabled with tooltip

### Layout

- Columns use proportional width (`flex-1` each) instead of fixed 260px
- Full available width of the content area
- Column header: stage name + count badge
- Each column scrolls independently if content overflows vertically

### Cards

Slightly richer than current:
- Name (semibold)
- Score badge (colored pill)
- Location (muted, below name)
- Subjects (smaller, below location)
- Drag-and-drop via `@hello-pangea/dnd` (same as current)

### Inline Expansion in Kanban

Same as list view: clicking a card expands its content downward within the column. The expanded area pushes other cards down. Same Info/Outreach/Demo/Evaluate tabs.

### Evaluation Summary

Shown below cards in `demo_completed`, `offer_sent`, and `hired` stages (same as current).

---

## Visual Design (Apple-esque Minimalist)

### Color Palette

| Role            | Value       |
|-----------------|-------------|
| Primary / Accent| `#0071e3`   |
| Text primary    | `#1d1d1f`   |
| Text secondary  | `#86868b`   |
| Text tertiary   | `#aeaeb2`   |
| Background      | `#f5f5f7`   |
| Surface (cards) | `#ffffff`   |
| Border          | `#e8e8ed`   |
| Success (score) | `#34c759`   |
| Warning (score) | `#ff9f0a`   |

### Typography

- Font: SF Pro (system stack: `-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`)
- Headings: `text-xl font-semibold tracking-tight`
- Body: `text-sm`
- Muted/captions: `text-xs`
- Tabular numbers for scores/counts: `font-variant-numeric: tabular-nums`

### Spacing & Borders

- Rounded corners: `rounded-apple` (existing project utility, typically ~10px)
- Subtle shadows on hover/active states only, not static
- Generous whitespace between sections
- Borders used sparingly — only for structural separation (sidebar border, table row dividers)
- No harsh outlines — use background color shifts instead

### Interaction

- Smooth 200ms transitions on expand/collapse
- Hover states: subtle background shift from white to `#f5f5f7`
- Active/selected states: blue background or blue left-border accent
- No jump cuts — everything animates

### Empty States

- **No job selected:** "Select a job from the sidebar to view its pipeline" centered in the content area with a subtle illustration or icon
- **No applications match filters:** "No candidates match your current filters" with a "Clear filters" button
- **No jobs in tab:** "No {status} jobs yet" with appropriate CTA (e.g., "Post a job" for Active)

---

## Component Changes

### New Components

- `JobSidebar` — collapsible vertical job list with search
- `StatusTabs` — horizontal tab bar for job statuses
- `ApplicationTable` — virtualized, sortable, filterable table with inline expansion
- `InlineDrawer` — reusable inline expansion panel (Info/Outreach/Demo/Evaluate tabs)
- `ViewToggle` — segmented [List | Kanban] control with disabled state
- `StageFilterPills` — horizontal pill row for stage filtering
- `SearchBar` — reusable search input with debounce

### Modified Components

- `KanbanBoard` — proportional column widths, inline expansion replaces drawer, richer cards
- `PipelineList` — restructured to use sidebar + tabs + toggle

### Deprecated Components

- `ApplicationDrawer` — removed entirely. Content lives in `InlineDrawer`.
- `pipeline-list.tsx` — restructured significantly

### Unchanged Components

- `CandidateCard` — reused in both list and kanban with minor props changes
- `EvaluationSummary` — unchanged, still rendered below cards
- `MessageComposer` — unchanged, rendered inside `InlineDrawer`
- `DemoScheduler` — unchanged, rendered inside `InlineDrawer`
- `EvaluateTab` — unchanged, rendered inside `InlineDrawer`

---

## Data Flow

```
PipelinePage (server)
  → requireProfile() → schoolId
  → PipelineView (client)
      → useQuery(jobs.listBySchool, { schoolId }) → all jobs
      → client-side filter by status tab → sidebar jobs
      → useQuery(applications.getPipelineForJob, { jobId }) → pipeline data
      → client-side filter by search + stage pills + sort → visible apps
      → ApplicationTable or KanbanBoard renders
      → InlineDrawer renders on row/card click
```

No new Convex queries or mutations needed. The only data change is consuming `jobs.listBySchool` without a status filter (fetch all), then filtering client-side by tab.

---

## Edge Cases

- **0 applications for a job:** Show "No applications yet" with the stage filter pills still visible (all showing 0)
- **All apps in one stage:** Full-width column in kanban, table works normally
- **Job with 0 active apps but all rejected:** Kanban shows only active stages (sourced-hired). Rejected candidates don't appear in pipeline view.
- **Very long candidate names:** Truncate with ellipsis in table, full name on expand
- **No jobs at all:** "No jobs posted yet" with a link/button to post a job
- **Sidebar with 50+ jobs:** Scrollable. Search box at top for quick filtering.

---

---

## Visual Polish — Premium UI Feel (Cross-Cutting)

The entire app suffers from a amateur-looking UI despite having excellent design tokens. The root cause: every component hardcodes hex colors instead of using the Tailwind config tokens, and there are zero reusable UI primitives. The result is visual inconsistency, no affordance patterns, and a "coded by intern" feel.

### Why It Feels Amateur Currently

1. **Hex everywhere, tokens nowhere** — `tailwind.config.ts` defines `surface`, `ink`, `accent`, `success`, `warning`, `danger` tokens but zero components use them. Every file uses raw `bg-[#f5f5f7]` instead of `bg-surface-secondary`.
2. **No shared primitives** — 26 component files, zero in a `ui/` directory. Every button, input, badge, and card is copy-pasted inline with slight variations.
3. **No depth** — Flat white cards on flat gray backgrounds. The only shadow (`shadow-menu`) is used in one place. No elevation system.
4. **No motion** — Transitions are sporadic. No animation for expand/collapse, no enter/exit animations, no micro-interactions.
5. **Inconsistent edge treatment** — Some things are `rounded-apple` (10px), others are `rounded-full`, others are `rounded-lg` (8px). No rule for when to use which.
6. **No type scale** — Body text varies between `text-sm` and `text-base` with no rhyme. Labels are sometimes `text-xs`, sometimes `text-sm`. Headings have no consistent rhythm.

### Design System Upgrade

#### 1. Create `components/ui/` Primitive Library

Extract the 8 most repeated patterns into standalone primitives. Every existing component gets refactored to use these. New components (pipeline redesign) use them from the start.

| Primitive | File | What It Replaces |
|-----------|------|-----------------|
| `Button` | `components/ui/button.tsx` | 7+ inline button variants across all components |
| `Input` | `components/ui/input.tsx` | Inline inputs in 8+ components |
| `Select` | `components/ui/select.tsx` | Inline selects in 4+ components |
| `Badge` | `components/ui/badge.tsx` | 10+ inline chip/pill/badge variants |
| `Card` | `components/ui/card.tsx` | `rounded-apple bg-white border border-[#e8e8ed]` pattern used everywhere |
| `Tabs` | `components/ui/tabs.tsx` | Pipeline drawer tabs, job detail tabs, status tabs (new) |
| `EmptyState` | `components/ui/empty-state.tsx` | Centered card with icon + message + optional CTA |
| `Skeleton` | `components/ui/skeleton.tsx` | `animate-pulse` patterns scattered across dashboard |

**Button API:**
```tsx
<Button variant="primary" size="md">Post a Job</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger">Close Job</Button>
<Button variant="ghost">Sign Out</Button>
```

Variants: `primary`, `secondary`, `danger`, `ghost`, `outline`
Sizes: `sm`, `md`, `lg`
States: default, hover, active, disabled, loading (with spinner)

**Badge API:**
```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">60%</Badge>
<Badge variant="default">TGT</Badge>
```

Variants: `default` (gray), `info` (blue), `success` (green), `warning` (amber), `danger` (red)

**Card API:**
```tsx
<Card>Content</Card>
<Card hover>Clickable content</Card>
<Card padding="lg">More space</Card>
```

#### 2. Migrate All Hex Values to Tailwind Config Tokens

Every existing component must use:
- `bg-surface` / `bg-surface-secondary` / `bg-surface-tertiary` instead of `bg-[#ffffff]` / `bg-[#f5f5f7]` / `bg-[#e8e8ed]`
- `text-ink` / `text-ink-secondary` / `text-ink-tertiary` instead of `text-[#1d1d1f]` / `text-[#86868b]` / `text-[#aeaeb2]`
- `bg-accent` / `hover:bg-accent-hover` / `active:bg-accent-pressed` instead of `bg-[#0071e3]` / `hover:bg-[#0077ed]` / `active:bg-[#004999]`
- `text-success` / `text-warning` / `text-danger` instead of `text-[#34c759]` / `text-[#ff9f0a]` / `text-[#ff3b30]`

This is a find-and-replace migration — no behavioral changes, just token usage.

#### 3. Elevation System

Add 3 shadow levels to `tailwind.config.ts`:

```
elevation-low:    0 1px 3px rgba(0, 0, 0, 0.04)
elevation-medium: 0 4px 12px rgba(0, 0, 0, 0.06)
elevation-high:   0 8px 30px rgba(0, 0, 0, 0.08)
```

Usage rules:
- `low` — static cards, sidebar
- `medium` — hovered cards, expanded rows, dropdowns
- `high` — modals, drawers (replaces `shadow-menu`)

Cards in list/table views get `shadow-elevation-low` instead of `border`. This single change transforms the flat look into premium depth.

#### 4. Motion System

Define consistent transition tokens in `tailwind.config.ts`:

```
transition-fast:   150ms ease-out
transition-normal: 200ms ease-out
transition-slow:   300ms ease-out
```

All interactive elements use `transition-normal` on color/background/shadow changes. Expand/collapse uses `transition-slow` with height animation.

#### 5. Consistent Border Radius Rules

- Interactive elements (buttons, inputs, selects): `rounded-apple` (10px)
- Containers (cards, modals, panels): `rounded-apple` (10px)
- Pills/badges/chips: `rounded-full`
- Table rows: no border-radius (square, full-width)

No other radius values anywhere. Remove all `rounded-lg` and `rounded-md` usage.

#### 6. Typography Scale

Formalize the type scale that's already loosely used:

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `text-page-title` | `text-2xl` | `font-bold tracking-tight` | Page H1 |
| `text-section-title` | `text-lg` | `font-semibold` | Card titles, section headers |
| `text-body` | `text-sm` | `font-normal` | Body text, table cells |
| `text-body-medium` | `text-sm` | `font-medium` | Emphasized body, nav items |
| `text-caption` | `text-xs` | `font-normal` | Secondary info, timestamps |
| `text-label` | `text-xs` | `font-medium uppercase tracking-wider` | Form labels, table headers |
| `text-badge` | `text-xs` | `font-medium` | Badges, chips, pills |

All numbers (scores, counts, stats) use `tabular-nums` in addition to their size class.

### Implementation Priority

The visual polish is **prerequisite** to the pipeline redesign. Building new components on the current inconsistent foundation would bake in the amateur feel. The order is:

1. Add elevation, motion, border-radius tokens to `tailwind.config.ts`
2. Create `components/ui/` primitives (Button, Input, Select, Badge, Card, Tabs, EmptyState, Skeleton)
3. Migrate existing components to use tokens + primitives (mechanical refactor, no behavior changes)
4. Build new pipeline components using tokens + primitives

---

## What's Out of Scope

- Bulk actions (select multiple candidates, move multiple stages)
- Server-side search/pagination (client-side filtering is sufficient for reasonable job sizes)
- Custom column ordering or hiding
- Export to CSV
- Pipeline analytics/dashboards
- Mobile responsiveness (desktop-first, same as current app)
- Real-time collaboration indicators
