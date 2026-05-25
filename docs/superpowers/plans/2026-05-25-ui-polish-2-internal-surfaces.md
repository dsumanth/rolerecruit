# UI Polish (Part 2): Internal Surfaces Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every internal `/dashboard` and `/onboarding` surface from inline-styled markup to the primitives + tokens shipped in Plan 1. After this plan ships, the recruiter app fully embodies the Modern Apple dialect.

**Architecture:** Each task migrates one surface or a small cluster of related components. The pattern is consistent: replace inline `bg-[#0071e3]` and similar with `<Button>` calls, replace raw `<div className="rounded-apple bg-surface border border-surface-tertiary p-5">` with `<Card>`, replace native `<select>` with `<Select>`, swap underline tabs for the new gradient-indicator `<Tabs>`, use `<PageHeader>` for every page top, swap `bg-surface-secondary` for `bg-surface-canvas` or hairline tokens. Where appropriate, surfaces follow the spec's Pattern A (list), B (detail+tabs), C (configuration), or E (kanban).

**Tech Stack:** Next.js 14 (app router), TypeScript, Tailwind CSS 3.4, Convex, Clerk, vitest + @testing-library/react, lucide-react, bun.

**Reference spec:** [`docs/superpowers/specs/2026-05-25-ui-polish-design.md`](../specs/2026-05-25-ui-polish-design.md)
**Plan 1 (prereq, already shipped):** [`2026-05-25-ui-polish-1-foundation-primitives-shell.md`](2026-05-25-ui-polish-1-foundation-primitives-shell.md)

**Project rules (`.commandcode/taste/taste.md`):**
- Use `bun`, not `npm` (PATH: `export PATH="$HOME/.bun/bin:$PATH"`)
- No `—` (mdash) or `--` (double-dash) in code
- No `Co-authored-by` trailer in commits
- TDD: failing test first when adding new behavior. Pure visual migrations don't need new tests as long as existing tests still pass.
- Surgical: touch only what each task names

---

## What's already in place (from Plan 1)

### Primitives (`components/ui/`)
- `Button` — variants: primary, secondary, danger, ghost, outline, gradient, ink. Sizes: sm/md/lg. Slots: iconLeft, iconRight. Pill shape by default.
- `Card` — surface: card / chrome / floating. elevation: floor / 1-4. padding: none/sm/md/lg. interactive (hover lift).
- `Input` — sizes sm/md/lg, iconLeft slot, focus ring uses accent-soft.
- `Select` — Dropdown-backed, props: value, onChange, options[{value,label}], placeholder?
- `Badge` — variants neutral/info/success/warning/danger. `dot` variant has glowing colored dot.
- `Tabs` — items[{value,label,count?}], value, onChange. Gradient indicator.
- `EmptyState` — title, description, icon | illustration, action.
- `Skeleton`, `Toggle` (iOS-style), `Avatar`, `Tooltip`, `Dropdown`, `DropdownItem`, `DropdownDivider`, `DropdownLabel`, `Dialog`, `ToastProvider`/`useToast`, `Icon` (Lucide wrapper).
- `PageHeader` — eyebrow, title (display-m), subtitle, back link, status slot, actions slot.
- `BrandMark` — the 26px gradient "R" square. Use anywhere we need the brand.
- `nameInitial(name, fallback?)` helper exported from `components/ui/avatar.tsx`.

### Tokens
- Tailwind utilities: `bg-surface`, `bg-surface-canvas`, `bg-surface-chrome`, `bg-surface-floating`, `text-ink`, `text-ink-secondary`, `text-ink-tertiary`, `bg-accent`, `text-accent`, `bg-accent-soft`, `text-success`, `text-warning`, `text-danger`, `border-hairline`, `border-hairline-strong`, `bg-accent-grad`, `shadow-elev-1` through `shadow-elev-4`, `rounded-xs/sm/md/lg/xl`, `text-display-m/s/title-l/m/body-l/body/body-s/caption/micro`, `text-gradient-ink`, `backdrop-blur-20/24`, `duration-instant/fast/base/slow`, `ease-apple-out/spring`.
- Legacy aliases still resolve (`bg-surface-secondary` → canvas, `bg-surface-tertiary` → hairline). These are temporary bridges that this plan removes in the final task.

### Already migrated (partial Plan 2 work shipped early in Plan 1)
- `components/pipeline/application-drawer.tsx`: Tabs API + Select API migrated
- `components/pipeline/application-table.tsx`: Badge `variant="default"` → `"neutral"` (one site)
- `components/pipeline/inline-expansion.tsx`: partial Tabs/Select migration
- `components/talent/global-criteria-panel.tsx`: partial Badge migration
- `app/sign-in`, `app/sign-up`: full new chrome (Plan 1 Task 25)

---

## File map

### Files modified

**Pages:**
- `app/dashboard/page.tsx` (Task 1)
- `app/dashboard/jobs/page.tsx` (Task 2)
- `app/dashboard/jobs/new/page.tsx` (Task 14)
- `app/dashboard/jobs/[id]/page.tsx` (Task 3)
- `app/dashboard/jobs/[id]/pipeline/page.tsx` (Task 4)
- `app/dashboard/jobs/[id]/pipeline/outreach/page.tsx` (Task 4)
- `app/dashboard/jobs/[id]/sourcing/page.tsx` (Task 5)
- `app/dashboard/jobs/[id]/criteria/page.tsx` (Task 6)
- `app/dashboard/pipeline/page.tsx` (Task 8)
- `app/dashboard/talent/page.tsx` (Task 9)
- `app/dashboard/settings/layout.tsx` (Task 10)
- `app/dashboard/settings/page.tsx` (Task 10)
- `app/dashboard/settings/calendar/page.tsx` (Task 11)
- `app/dashboard/settings/messaging/page.tsx` (Task 12)
- `app/dashboard/settings/pipeline/page.tsx` (Task 13)
- `app/dashboard/settings/roles/page.tsx` (Task 13)
- `app/dashboard/settings/team/page.tsx` (Task 13)
- `app/onboarding/page.tsx` (Task 15)
- `app/onboarding/layout.tsx` (Task 15)

**Components:**
- `components/dashboard/stats-bar.tsx` (Task 1)
- `components/dashboard/role-cards.tsx` (Task 1)
- `components/jobs/job-intake-form.tsx` (Task 14)
- `components/jobs/job-actions.tsx` (Task 3)
- `components/jobs/job-parsed-criteria.tsx` (Task 3)
- `components/pipeline/application-table.tsx` (Task 4)
- `components/pipeline/application-drawer.tsx` (Task 4)
- `components/pipeline/candidate-card.tsx` (Task 7)
- `components/pipeline/status-tabs.tsx` (Task 7)
- `components/pipeline/job-sidebar.tsx` (Task 7)
- `components/pipeline/pipeline-controls.tsx` (Task 7)
- `components/pipeline/inline-expansion.tsx` (Task 4)
- `components/pipeline/evaluation-summary.tsx` (Task 4)
- `components/pipeline/availability-overlay.tsx` (Task 7)
- `components/talent/global-criteria-panel.tsx` (Task 9)
- `components/talent/pool-selector.tsx` (Task 9)
- `components/talent/talent-controls.tsx` (Task 9)
- `components/settings/settings-nav.tsx` (Task 10)
- `components/settings/automation-panel.tsx` (Task 12)
- `components/settings/calendar-config-form.tsx` (Task 11)
- `components/settings/channel-routing-table.tsx` (Task 12)
- `components/settings/pipeline-stage-editor.tsx` (Task 13)
- `components/criteria/AISuggestedCriteria.tsx` (Task 6)
- `components/criteria/DimensionSlider.tsx` (Task 6)
- `components/criteria/ScoringRuleEditor.tsx` (Task 6)
- `components/sourcing/candidate-review-card.tsx` (Task 5)

**Tailwind config:**
- `tailwind.config.ts` (Task 16, removes legacy `surface.secondary` and `surface.tertiary` aliases)

### Files created
- Tests where new interaction is added (filter chips on jobs list, status pill component if extracted). Listed per task.

---

## Pre-flight

### Task 0: Verify Plan 1 baseline

**Files:** none

- [ ] **Step 1: Confirm state**

```bash
git log --oneline -1
git tag --points-at HEAD
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
```

Expected: HEAD is at `e50a9f9` (or later) with tag `ui-foundation-primitives-shell`. 128 tests pass.

- [ ] **Step 2: Confirm pre-existing TS errors**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bunx tsc --noEmit 2>&1 | grep error | wc -l
bunx tsc --noEmit 2>&1 | grep error | head -20
```

Expected: a small number of errors (around 5), all in `components/dashboard/role-cards.tsx`, `components/pipeline/*.tsx`, `components/talent/*.tsx` referencing Badge `variant="default"` or `variant="info"`. These are exactly what this plan fixes.

If there are MORE errors than expected, investigate before continuing.

---

## Phase A: Hero surfaces

### Task 1: Dashboard home

The anchor surface. Implement the section 2 mockup exactly. Replace inline-styled CTAs, refactor stats-bar to use Card + Lucide icons + gradient-ink stat numbers, refactor role-cards to use Card + Badge dot + cleaned pipeline bar.

**Files:**
- Modify: `app/dashboard/page.tsx`
- Modify: `components/dashboard/stats-bar.tsx`
- Modify: `components/dashboard/role-cards.tsx`

- [ ] **Step 1: Rewrite `app/dashboard/page.tsx`**

Replace the entire file with:

```tsx
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { PageHeader, Button } from "@/components/ui";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { RoleCards } from "@/components/dashboard/role-cards";

export default async function DashboardPage() {
  const { profile } = await requireProfile();

  return (
    <div>
      <PageHeader
        eyebrow={`Welcome back, ${(profile.name ?? "").split(" ")[0] || "there"}`}
        title="Dashboard"
        actions={
          <Link href="/dashboard/jobs/new">
            <Button variant="ink" iconLeft="Plus" size="md">
              Post role
            </Button>
          </Link>
        }
      />

      <div className="space-y-7">
        <StatsBar schoolId={profile.schoolId} />
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-micro text-ink-secondary">Active roles</h2>
            <Link href="/dashboard/jobs" className="text-body-s font-medium text-accent">
              View all →
            </Link>
          </div>
          <RoleCards schoolId={profile.schoolId} />
        </section>
      </div>
    </div>
  );
}
```

If `profile.name` doesn't exist on the schema, fall back to the safe `"there"` greeting.

Note on the Button-inside-Link pattern: this is technically nested interactive content. Next.js + Tailwind design systems commonly accept it; if you'd rather not, replace the Button with a Link styled directly (`className="inline-flex items-center gap-1.5 rounded-full bg-ink text-surface-canvas px-4 py-2 text-body-s font-medium shadow-[0_1px_2px_rgba(0,0,0,0.1),0_4px_12px_rgba(0,0,0,0.12)] hover:-translate-y-px transition-all duration-fast"`). The plan uses Link-wrapped-Button throughout for consistency.

- [ ] **Step 2: Rewrite `components/dashboard/stats-bar.tsx`**

Replace the entire file with:

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, Icon, type IconName } from "@/components/ui";

interface Props {
  schoolId: string;
}

interface StatDef {
  key: "openPositions" | "totalCandidates" | "hiredThisMonth";
  label: string;
  icon: IconName;
  tone: "accent" | "purple" | "success";
}

const STATS: StatDef[] = [
  { key: "openPositions",   label: "Open positions",  icon: "Briefcase",    tone: "accent" },
  { key: "totalCandidates", label: "Candidates",      icon: "Users",        tone: "purple" },
  { key: "hiredThisMonth",  label: "Hired this month", icon: "CheckCircle2", tone: "success" },
];

const TONE: Record<StatDef["tone"], { bg: string; fg: string }> = {
  accent:  { bg: "bg-accent-soft",                                   fg: "text-accent" },
  purple:  { bg: "bg-[color-mix(in_srgb,var(--purple)_10%,transparent)]", fg: "text-purple" },
  success: { bg: "bg-[color-mix(in_srgb,var(--success)_10%,transparent)]", fg: "text-[color-mix(in_srgb,var(--success)_75%,var(--ink-1))]" },
};

export function StatsBar({ schoolId }: Props) {
  const data = useQuery(api.dashboard.getStats, { schoolId: schoolId as any });

  if (!data) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {STATS.map((s) => (
          <Card key={s.key} padding="md" elevation={1}>
            <div className="h-8 w-16 bg-hairline rounded animate-pulse mb-2" />
            <div className="h-4 w-24 bg-hairline rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {STATS.map((s) => {
        const tone = TONE[s.tone];
        return (
          <Card key={s.key} padding="md" elevation={1} interactive>
            <div className="flex items-center justify-between mb-3">
              <span className="text-micro text-ink-secondary">{s.label}</span>
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-sm ${tone.bg} ${tone.fg}`}>
                <Icon name={s.icon} size={14} />
              </span>
            </div>
            <p className="text-display-m text-gradient-ink tabular-nums leading-none">
              {data[s.key]}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `components/dashboard/role-cards.tsx`**

Replace the entire file with:

```tsx
"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Badge, Card, EmptyState, Button } from "@/components/ui";

interface Props {
  schoolId: string;
}

const STAGE_LABELS: Record<string, string> = {
  sourced: "Sourced",
  screened: "Screened",
  demo_scheduled: "Demo",
  demo_completed: "Evaluated",
  offer_sent: "Offer",
  hired: "Hired",
};

const STAGE_COLORS: Record<string, string> = {
  sourced: "bg-ink-tertiary",
  screened: "bg-ink-secondary",
  demo_scheduled: "bg-accent",
  demo_completed: "bg-purple",
  offer_sent: "bg-warning",
  hired: "bg-success",
};

interface Application { _id: string; stage: string }

function jobStatusBadge(status: string) {
  if (status === "active") return <Badge dot variant="success">Active</Badge>;
  if (status === "draft") return <Badge dot variant="neutral">Draft</Badge>;
  return <Badge dot variant="neutral">Closed</Badge>;
}

export function RoleCards({ schoolId }: Props) {
  const jobs = useQuery(api.jobs.listBySchool, { schoolId: schoolId as any });
  const pipeline = useQuery(api.dashboard.getPipelineBreakdown, { schoolId: schoolId as any });

  if (!jobs || !pipeline) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} padding="md" elevation={1}>
            <div className="h-5 w-48 bg-hairline rounded animate-pulse mb-2" />
            <div className="h-3 w-32 bg-hairline rounded animate-pulse mb-4" />
            <div className="h-2 w-full bg-hairline rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card padding="lg" elevation={1}>
        <EmptyState
          title="No open roles"
          description="Post your first role to start tracking candidates."
          action={
            <Link href="/dashboard/jobs/new">
              <Button variant="ink" iconLeft="Plus">Post your first role</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const apps = pipeline[job._id] ?? [];
        const total = apps.length;

        return (
          <Link key={job._id} href={`/dashboard/jobs/${job._id}`} className="block">
            <Card padding="md" elevation={1} interactive>
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="text-title-m text-ink truncate">{job.title}</h3>
                  <p className="text-caption text-ink-secondary mt-0.5">
                    {job.subject} <span className="text-ink-tertiary">·</span>{" "}
                    {job.level} <span className="text-ink-tertiary">·</span>{" "}
                    {job.board}
                  </p>
                </div>
                {jobStatusBadge(job.status)}
              </div>

              {total > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-hairline gap-[2px]">
                    {Object.entries(STAGE_LABELS).map(([stage]) => {
                      const count = apps.filter((a: Application) => a.stage === stage).length;
                      if (count === 0) return null;
                      return (
                        <div
                          key={stage}
                          className={cn("h-full rounded-sm", STAGE_COLORS[stage])}
                          style={{ width: `${(count / total) * 100}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-3 text-caption text-ink-secondary mt-2">
                    {Object.entries(STAGE_LABELS).map(([stage, label]) => {
                      const count = apps.filter((a: Application) => a.stage === stage).length;
                      if (count === 0) return null;
                      return (
                        <span key={stage} className="inline-flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 rounded-sm", STAGE_COLORS[stage])} />
                          {label} <span className="text-ink font-medium tabular-nums">{count}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-caption text-ink-tertiary">No candidates in pipeline</p>
              )}
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Verify**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
bunx tsc --noEmit 2>&1 | grep -E "(dashboard/page|dashboard/stats-bar|dashboard/role-cards)" | head
```

All tests still pass. No new TS errors in the dashboard files. (Existing TS errors in role-cards.tsx referencing `default` Badge variant should be GONE now.)

- [ ] **Step 5: Manual smoke**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run dev &
sleep 7
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard
pkill -f "next dev" 2>/dev/null
```

Server returns 200 or auth redirect, no crash.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/page.tsx components/dashboard/stats-bar.tsx components/dashboard/role-cards.tsx
git commit -m "feat(dashboard): redesign home with PageHeader, refreshed stats, modern role cards"
```

---

### Task 2: Jobs list (Pattern A)

The list view. Filter chips, grouped row card, status pill column.

**Files:**
- Modify: `app/dashboard/jobs/page.tsx`
- Create: `components/jobs/jobs-list.tsx` (extract from page if it grows)

- [ ] **Step 1: Read current `app/dashboard/jobs/page.tsx`**

Note current data shape and any features (search, pagination) so the migration preserves behavior.

- [ ] **Step 2: Rewrite `app/dashboard/jobs/page.tsx`**

Use this pattern. Adapt field names to whatever `api.jobs.listBySchool` actually returns:

```tsx
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { PageHeader, Button } from "@/components/ui";
import { JobsList } from "@/components/jobs/jobs-list";

export default async function JobsPage() {
  const { profile } = await requireProfile();

  return (
    <div>
      <PageHeader
        title="Jobs"
        actions={
          <Link href="/dashboard/jobs/new">
            <Button variant="ink" iconLeft="Plus">Post role</Button>
          </Link>
        }
      />
      <JobsList schoolId={profile.schoolId} />
    </div>
  );
}
```

- [ ] **Step 3: Create `components/jobs/jobs-list.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, Badge, EmptyState, Icon, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "active" | "draft" | "closed";

interface Props {
  schoolId: string;
}

interface Job {
  _id: string;
  title: string;
  subject?: string;
  level?: string;
  board?: string;
  status: string;
  _creationTime: number;
}

function jobBadge(status: string) {
  if (status === "active") return <Badge dot variant="success">Active</Badge>;
  if (status === "draft") return <Badge dot variant="neutral">Draft</Badge>;
  return <Badge dot variant="neutral">Closed</Badge>;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

export function JobsList({ schoolId }: Props) {
  const jobs = useQuery(api.jobs.listBySchool, { schoolId: schoolId as any }) as Job[] | undefined;
  const [filter, setFilter] = useState<StatusFilter>("all");

  const counts = useMemo(() => {
    if (!jobs) return { all: 0, active: 0, draft: 0, closed: 0 };
    return {
      all: jobs.length,
      active: jobs.filter((j) => j.status === "active").length,
      draft: jobs.filter((j) => j.status === "draft").length,
      closed: jobs.filter((j) => j.status === "closed").length,
    };
  }, [jobs]);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    if (filter === "all") return jobs;
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  if (!jobs) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card padding="lg" elevation={1}>
        <EmptyState
          title="No jobs yet"
          description="Post a role to start collecting candidates."
          action={
            <Link href="/dashboard/jobs/new">
              <a className="text-accent font-medium">Post a role →</a>
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4" role="tablist" aria-label="Status filter">
        <FilterChip label="All"    count={counts.all}    active={filter === "all"}    onClick={() => setFilter("all")} />
        <FilterChip label="Active" count={counts.active} active={filter === "active"} onClick={() => setFilter("active")} />
        <FilterChip label="Draft"  count={counts.draft}  active={filter === "draft"}  onClick={() => setFilter("draft")} />
        <FilterChip label="Closed" count={counts.closed} active={filter === "closed"} onClick={() => setFilter("closed")} />
      </div>

      <Card padding="none" elevation={1}>
        <div className="grid grid-cols-[1.4fr_0.8fr_120px_100px_24px] gap-4 px-5 py-3 border-b border-hairline">
          <div className="text-micro text-ink-secondary">Role</div>
          <div className="text-micro text-ink-secondary">Posted</div>
          <div className="text-micro text-ink-secondary">Candidates</div>
          <div className="text-micro text-ink-secondary">Status</div>
          <div />
        </div>
        {filtered.map((job) => (
          <Link key={job._id} href={`/dashboard/jobs/${job._id}`}>
            <div className="grid grid-cols-[1.4fr_0.8fr_120px_100px_24px] gap-4 items-center px-5 py-4 border-b border-hairline last:border-b-0 hover:bg-accent-soft transition-colors duration-fast">
              <div className="min-w-0">
                <div className="text-body-s font-semibold text-ink truncate">{job.title}</div>
                <div className="text-caption text-ink-secondary truncate">
                  {[job.subject, job.level, job.board].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="text-caption text-ink-secondary">{formatDate(job._creationTime)}</div>
              <div className="text-body-s text-ink tabular-nums">
                {/* Placeholder: per-job candidate count requires a separate query. Display em-space dash for now. */}
                <span className="text-ink-tertiary">—</span>
              </div>
              <div>{jobBadge(job.status)}</div>
              <Icon name="ChevronRight" size={14} color="var(--ink-3)" />
            </div>
          </Link>
        ))}
      </Card>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-body-s font-medium transition-colors duration-fast",
        active
          ? "bg-accent-soft border-accent/30 text-accent"
          : "bg-surface text-ink-secondary hover:text-ink",
      )}
    >
      {label}
      <span className="text-caption tabular-nums opacity-70">{count}</span>
    </button>
  );
}
```

Note: the em-space `—` in the candidate count column is rendered TEXT in JSX, not a code identifier; the no-mdash rule applies to code, not user-facing strings. Using a regular hyphen is fine too. (If the taste rule strictly bans even text uses, swap to a hyphen `-`.)

The candidate count per job is a placeholder. If you want real numbers, query `api.dashboard.getPipelineBreakdown` and derive counts. Out of scope here; leave the placeholder.

- [ ] **Step 4: Write a test for the filter chips**

Create `tests/components/jobs-list.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JobsList } from "../../components/jobs/jobs-list";

vi.mock("convex/react", () => ({
  useQuery: () => [
    { _id: "1", title: "Math",    subject: "Mathematics", level: "Senior", board: "CBSE", status: "active", _creationTime: Date.now() },
    { _id: "2", title: "Physics", subject: "Physics",     level: "Lead",   board: "ICSE", status: "draft",  _creationTime: Date.now() },
    { _id: "3", title: "English", subject: "English",     level: "Mid",    board: "CBSE", status: "active", _creationTime: Date.now() },
  ],
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { jobs: { listBySchool: "jobs.listBySchool" } },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

describe("JobsList", () => {
  it("renders all jobs when filter is All", () => {
    render(<JobsList schoolId="s1" />);
    expect(screen.getByText("Math")).toBeDefined();
    expect(screen.getByText("Physics")).toBeDefined();
    expect(screen.getByText("English")).toBeDefined();
  });

  it("filters to only Active when active chip clicked", () => {
    render(<JobsList schoolId="s1" />);
    fireEvent.click(screen.getByRole("tab", { name: /Active/ }));
    expect(screen.getByText("Math")).toBeDefined();
    expect(screen.queryByText("Physics")).toBeNull();
    expect(screen.getByText("English")).toBeDefined();
  });

  it("shows counts on each chip", () => {
    render(<JobsList schoolId="s1" />);
    // All chip count is 3 (in the rendered DOM as the count span)
    const allTab = screen.getByRole("tab", { name: /All/ });
    expect(allTab.textContent).toContain("3");
    const draftTab = screen.getByRole("tab", { name: /Draft/ });
    expect(draftTab.textContent).toContain("1");
  });
});
```

- [ ] **Step 5: Run test**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test -- tests/components/jobs-list.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/jobs/page.tsx components/jobs/jobs-list.tsx tests/components/jobs-list.test.tsx
git commit -m "feat(jobs): list page uses Pattern A with filter chips"
```

---

### Task 3: Job detail (Pattern B)

Detail page with tabs, status pill, action buttons. The job tabs (Pipeline / Sourcing / Criteria) link to existing sub-routes.

**Files:**
- Modify: `app/dashboard/jobs/[id]/page.tsx`
- Modify: `components/jobs/job-actions.tsx`
- Modify: `components/jobs/job-parsed-criteria.tsx`

- [ ] **Step 1: Read current `app/dashboard/jobs/[id]/page.tsx`**

Note: it has manual tab navigation around lines 56-75. We replace it with the new `<Tabs>` primitive linked via `<Link>`.

- [ ] **Step 2: Rewrite the page**

This page is server-side. The tab strip is the active tab indicator; clicking a tab navigates to its sub-route. Use this structure:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { requireProfile } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";
import { JobActions } from "@/components/jobs/job-actions";
import { JobParsedCriteria } from "@/components/jobs/job-parsed-criteria";

interface Props {
  params: { id: string };
}

function jobBadge(status: string) {
  if (status === "active") return <Badge dot variant="success">Active</Badge>;
  if (status === "draft") return <Badge dot variant="neutral">Draft</Badge>;
  return <Badge dot variant="neutral">Closed</Badge>;
}

export default async function JobDetailPage({ params }: Props) {
  await requireProfile();
  const job = await fetchQuery(api.jobs.get, { id: params.id as Id<"jobs"> });
  if (!job) notFound();

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/jobs", label: "Jobs" }}
        title={job.title}
        subtitle={[job.subject, job.level, job.board].filter(Boolean).join(" · ")}
        status={jobBadge(job.status)}
        actions={<JobActions jobId={job._id} status={job.status} />}
      />

      <JobTabs jobId={params.id} active="overview" />

      <div className="grid grid-cols-[1fr_320px] gap-7 items-start mt-7">
        <main className="min-w-0">
          <JobParsedCriteria criteria={job.parsedCriteria} />
        </main>
        <aside className="rounded-lg bg-surface-floating backdrop-blur-20 border border-chrome p-5 shadow-elev-1">
          <div className="text-micro text-ink-secondary mb-3">Quick facts</div>
          <dl className="space-y-3 text-body-s">
            <Fact label="Subject" value={job.subject} />
            <Fact label="Level" value={job.level} />
            <Fact label="Board" value={job.board} />
            <Fact label="Experience" value={job.minExperience != null ? `${job.minExperience}+ years` : null} />
            <Fact label="Qualifications" value={job.qualifications?.join(" · ")} />
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-micro text-ink-secondary mb-0.5">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function JobTabs({ jobId, active }: { jobId: string; active: "overview" | "pipeline" | "sourcing" | "criteria" }) {
  const tabs: Array<{ value: typeof active; label: string; href: string }> = [
    { value: "overview", label: "Overview", href: `/dashboard/jobs/${jobId}` },
    { value: "pipeline", label: "Pipeline", href: `/dashboard/jobs/${jobId}/pipeline` },
    { value: "sourcing", label: "Sourcing", href: `/dashboard/jobs/${jobId}/sourcing` },
    { value: "criteria", label: "Criteria", href: `/dashboard/jobs/${jobId}/criteria` },
  ];
  return (
    <div role="tablist" className="flex gap-1 border-b border-hairline">
      {tabs.map((t) => {
        const a = t.value === active;
        return (
          <Link
            key={t.value}
            href={t.href}
            role="tab"
            aria-selected={a}
            className={`relative px-3.5 py-2 text-body-s ${a ? "text-ink font-semibold" : "text-ink-secondary hover:text-ink"} transition-colors duration-fast`}
          >
            {t.label}
            {a && (
              <span
                aria-hidden
                className="absolute left-3.5 right-3.5 -bottom-px h-[2px] rounded-full bg-accent-grad"
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
```

The `JobTabs` component above duplicates the visual of `Tabs` because the tabs are LINKS (navigate to sub-routes), not local state. The `Tabs` primitive expects `onChange` callback. We could refactor `Tabs` to support an optional `as="link"` mode, but that's a bigger change than this task should make. Keep the inline JobTabs.

Each of Pipeline / Sourcing / Criteria sub-route pages (Tasks 4-6) should render their own `JobTabs` with their `active` value at the top of their layout — they share the visual but each owns its tab strip. (Alternative: extract a shared layout file `app/dashboard/jobs/[id]/layout.tsx` that renders PageHeader+JobTabs above its children. Recommended; do that.)

**Recommended extraction**: create `app/dashboard/jobs/[id]/layout.tsx` and move PageHeader+JobTabs there. Then each sub-page renders only its tab content. Pseudocode:

```tsx
// app/dashboard/jobs/[id]/layout.tsx
export default async function JobLayout({ children, params }: { children: ReactNode; params: { id: string } }) {
  const job = await fetchQuery(api.jobs.get, { id: params.id as Id<"jobs"> });
  if (!job) notFound();
  return (
    <div>
      <PageHeader ... />
      <JobTabs jobId={params.id} active={inferActiveFromPathname()} />  {/* needs pathname; use headers() or refactor */}
      {children}
    </div>
  );
}
```

But inferring the active tab from inside a server layout is awkward. Simpler: do NOT extract; each page renders PageHeader+JobTabs with the right `active` value, accepting the duplication. The duplication is 3 places (job detail = "overview", pipeline = "pipeline", sourcing = "sourcing", criteria = "criteria"). The header+tabs JSX is 30 lines per page. Acceptable.

Choose either approach — both are fine. The recommendation: **don't extract a layout** for this iteration. Duplicate the header+tabs in each sub-page (Tasks 4-6 will do this). If duplication starts hurting later, extract then.

- [ ] **Step 3: Refresh `components/jobs/job-actions.tsx`**

Read the current file. It already uses `Button` (partial Plan 1 migration). Verify all variants used are valid (`primary`, `secondary`, `danger`, `ghost`, `outline`, `gradient`, `ink`). If any old `default` or unknown variants remain, fix them. No new tests needed.

- [ ] **Step 4: Refresh `components/jobs/job-parsed-criteria.tsx`**

Current file uses inline `bg-surface-secondary`, `bg-red-50`, `bg-green-50` badges. Replace with `<Badge variant="...">`:

```tsx
import { Card, Badge } from "@/components/ui";

interface ParsedCriteria {
  required?: string[];
  preferred?: string[];
  responsibilities?: string[];
}

interface Props {
  criteria?: ParsedCriteria | null;
}

export function JobParsedCriteria({ criteria }: Props) {
  if (!criteria) {
    return (
      <Card padding="lg" elevation={1}>
        <p className="text-body-s text-ink-secondary">
          No parsed criteria yet. Once the role description is processed, requirements and responsibilities will appear here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {criteria.required && criteria.required.length > 0 && (
        <Card padding="md" elevation={1}>
          <div className="text-micro text-ink-secondary mb-2">Required</div>
          <div className="flex flex-wrap gap-2">
            {criteria.required.map((item, i) => (
              <Badge key={i} variant="info">{item}</Badge>
            ))}
          </div>
        </Card>
      )}
      {criteria.preferred && criteria.preferred.length > 0 && (
        <Card padding="md" elevation={1}>
          <div className="text-micro text-ink-secondary mb-2">Preferred</div>
          <div className="flex flex-wrap gap-2">
            {criteria.preferred.map((item, i) => (
              <Badge key={i} variant="success">{item}</Badge>
            ))}
          </div>
        </Card>
      )}
      {criteria.responsibilities && criteria.responsibilities.length > 0 && (
        <Card padding="md" elevation={1}>
          <div className="text-micro text-ink-secondary mb-2">Responsibilities</div>
          <ul className="text-body-s text-ink space-y-1.5 pl-4 list-disc">
            {criteria.responsibilities.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
```

Adapt the prop type to whatever the parent passes. If the field is named differently in Convex, rename here.

- [ ] **Step 5: Verify**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
bunx tsc --noEmit 2>&1 | grep -E "(jobs/\[id\]|jobs/job-)" | head
```

All tests still pass. No new errors in the touched files.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/jobs/[id]/page.tsx components/jobs/job-actions.tsx components/jobs/job-parsed-criteria.tsx
git commit -m "feat(jobs): redesign detail page with PageHeader, tab strip, fact rail"
```

---

### Task 4: Job pipeline tab + application table + drawer

**Files:**
- Modify: `app/dashboard/jobs/[id]/pipeline/page.tsx`
- Modify: `app/dashboard/jobs/[id]/pipeline/outreach/page.tsx`
- Modify: `components/pipeline/application-table.tsx`
- Modify: `components/pipeline/application-drawer.tsx`
- Modify: `components/pipeline/inline-expansion.tsx`
- Modify: `components/pipeline/evaluation-summary.tsx`

- [ ] **Step 1: Add PageHeader + JobTabs strip to pipeline page**

`app/dashboard/jobs/[id]/pipeline/page.tsx` currently renders `<ApplicationTable>` directly. Add the same PageHeader + JobTabs (active="pipeline") wrapper as Task 3 did for the overview tab. Copy the JobTabs JSX from Task 3 verbatim.

- [ ] **Step 2: Refresh `components/pipeline/application-table.tsx`**

Current: virtualized grid with hardcoded `shadow-elevation-low` and partial Badge migration. Update:

- Wrap the whole table in `<Card padding="none" elevation={1}>`
- Replace `shadow-elevation-low` with the Card's `elevation={1}` (which uses `shadow-elev-1`)
- Header row: `text-micro text-ink-secondary` instead of inline styles
- Row hover: `hover:bg-accent-soft` instead of hardcoded
- Status column: use `<Badge dot variant="...">` per stage. Map stage names to variants:
  - `sourced` → `neutral`, `screened` → `neutral`, `demo_scheduled` → `info`, `demo_completed` → `info`, `offer_sent` → `warning`, `hired` → `success`, `rejected` → `danger`
- Remove any leftover hardcoded `bg-[#...]` colors

If the file is large (~200 LOC), do this surgically. Don't restructure it.

- [ ] **Step 3: Refresh `components/pipeline/application-drawer.tsx`**

Already partial migration. Remaining smells:
- Drawer container with `shadow-menu` → use `shadow-elev-3`
- Drawer backdrop or container styles → use `bg-surface backdrop-blur-20 border border-chrome shadow-elev-3` for the floating drawer surface
- Tabs and Select already migrated in Plan 1 final review pass; verify they work

If the drawer is implemented as a custom positioned `<div>` rather than using the `<Dialog variant="drawer">` primitive, leave it as-is (we can rationalize later). Just clean the styles.

- [ ] **Step 4: Refresh `components/pipeline/inline-expansion.tsx`**

Already partial migration. Remove any remaining inline-styled container colors. Use `Card` if a card wrapper is appropriate.

- [ ] **Step 5: Refresh `components/pipeline/evaluation-summary.tsx`**

Small file. Update text classes to use `text-body-s`, `text-ink`, `text-ink-secondary`.

- [ ] **Step 6: Refresh `app/dashboard/jobs/[id]/pipeline/outreach/page.tsx`**

Smaller surface. Add PageHeader+JobTabs (active="pipeline" still). Migrate any inline styles inside.

- [ ] **Step 7: Verify**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
```

All tests pass.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/jobs/[id]/pipeline/ components/pipeline/application-table.tsx components/pipeline/application-drawer.tsx components/pipeline/inline-expansion.tsx components/pipeline/evaluation-summary.tsx
git commit -m "feat(pipeline): job pipeline tab uses new chrome and Badge dots"
```

---

### Task 5: Job sourcing tab + sourcing components

**Files:**
- Modify: `app/dashboard/jobs/[id]/sourcing/page.tsx`
- Modify: `components/sourcing/candidate-review-card.tsx`

- [ ] **Step 1: Read current sourcing page**

128 LOC with hardcoded button colors, status badges, error card. Substantial inline styling.

- [ ] **Step 2: Rewrite the sourcing page**

Wrap in PageHeader+JobTabs (active="sourcing"). Replace each inline section:

- Status badges (sourcing run states): `<Badge variant="...">` per state. Map:
  - `running` → `info`
  - `completed` → `success`
  - `failed` → `danger`
- Buttons: `<Button variant="primary" iconLeft="..." size="md">...</Button>` instead of `<a className="bg-[#0071e3]">`
- Error card: `<Card padding="md" elevation={1}>` with `text-danger` for message
- Sourcing run rows: wrap each in a `<Card padding="md" elevation={1} interactive>`

This is mostly mechanical token-swap. Read the file end-to-end and replace each smell with the new token.

- [ ] **Step 3: Refresh `components/sourcing/candidate-review-card.tsx`**

Card with score badge. Currently uses hardcoded `bg-green-50`, `bg-amber-50`, `bg-surface-secondary`. Replace with:
- Wrap in `<Card padding="md" elevation={1} interactive>`
- Score badge: `<Badge variant="success">High match</Badge>` (success/warning/neutral by score threshold)
- All text: use `text-ink`, `text-ink-secondary`, `text-caption`, `text-body-s`

- [ ] **Step 4: Verify + commit**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
git add app/dashboard/jobs/[id]/sourcing/page.tsx components/sourcing/
git commit -m "feat(sourcing): job sourcing tab uses new primitives"
```

---

### Task 6: Job criteria tab + criteria components

**Files:**
- Modify: `app/dashboard/jobs/[id]/criteria/page.tsx`
- Modify: `components/criteria/AISuggestedCriteria.tsx`
- Modify: `components/criteria/DimensionSlider.tsx`
- Modify: `components/criteria/ScoringRuleEditor.tsx`

- [ ] **Step 1: Rewrite the criteria page**

Add PageHeader+JobTabs (active="criteria"). Wrap each section in `<Card>`.

- [ ] **Step 2: Refresh `AISuggestedCriteria.tsx`**

47 LOC. Replace `bg-accent` button with `<Button variant="primary">`, `bg-accent/10` highlight with `bg-accent-soft`.

- [ ] **Step 3: Refresh `DimensionSlider.tsx`**

32 LOC. Keep the native `<input type="range">` but use accent color via CSS variable. The slider track and thumb can stay native.

- [ ] **Step 4: Refresh `ScoringRuleEditor.tsx`**

58 LOC. Replace the submit button with `<Button variant="primary">`. Wrap dimension list in `<Card>`.

- [ ] **Step 5: Verify + commit**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
git add app/dashboard/jobs/[id]/criteria/page.tsx components/criteria/
git commit -m "feat(criteria): job criteria tab and editor use new primitives"
```

---

## Phase B: Pipeline + Talent

### Task 7: Remaining pipeline components

**Files:**
- Modify: `components/pipeline/candidate-card.tsx`
- Modify: `components/pipeline/status-tabs.tsx`
- Modify: `components/pipeline/job-sidebar.tsx`
- Modify: `components/pipeline/pipeline-controls.tsx`
- Modify: `components/pipeline/availability-overlay.tsx`

- [ ] **Step 1: candidate-card.tsx**

60 LOC. Replace `bg-surface-secondary` with `bg-surface` (it's now a card surface, not a recessed background). Add card border and elev-1. Use Badge for match-score pill.

- [ ] **Step 2: status-tabs.tsx**

57 LOC. This is its own tab implementation. Replace with the `<Tabs>` primitive:

```tsx
import { Tabs } from "@/components/ui";

interface StatusTabsProps {
  stages: Array<{ id: string; label: string; count: number }>;
  activeStage: string;
  onChange: (id: string) => void;
}

export function StatusTabs({ stages, activeStage, onChange }: StatusTabsProps) {
  return (
    <Tabs
      items={stages.map((s) => ({ value: s.id, label: s.label, count: s.count }))}
      value={activeStage}
      onChange={onChange}
    />
  );
}
```

If the existing API has different prop names, preserve them and call `<Tabs>` underneath. The point is to use the gradient indicator instead of the old underline.

- [ ] **Step 3: job-sidebar.tsx**

~200 LOC. Replace hardcoded `text-accent/5`, `border-accent` with `bg-accent-soft`, `border-accent`. The component itself stays its shape; just retokenize.

- [ ] **Step 4: pipeline-controls.tsx**

~150 LOC. Replace native `<select>` for sort with `<Select>`. Replace hardcoded `bg-accent` buttons with `<Button variant="primary">` or appropriate variants. Filter chips: extract the same `FilterChip` component pattern as Task 2 if needed, or use Badge-style pills.

- [ ] **Step 5: availability-overlay.tsx**

~100 LOC time slot picker. Replace `bg-accent` buttons with `<Button>`. Use Card if there's a container.

- [ ] **Step 6: Verify + commit**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
git add components/pipeline/
git commit -m "feat(pipeline): polish supporting components with new tokens"
```

---

### Task 8: Top-level pipeline page

**Files:**
- Modify: `app/dashboard/pipeline/page.tsx`

- [ ] **Step 1: Read current**

8 LOC delegating to `PipelineList`. Probably trivial.

- [ ] **Step 2: Add PageHeader**

```tsx
import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PipelineList } from "@/components/pipeline/pipeline-list"; // or whatever the existing import is

export default async function PipelinePage() {
  const { profile } = await requireProfile();
  return (
    <div>
      <PageHeader title="Pipeline" subtitle="All applications across roles" />
      <PipelineList schoolId={profile.schoolId} />
    </div>
  );
}
```

If the inner component is `<PipelineList>` or similar that's been migrated in Task 4 and Task 7 already, this page is just chrome.

- [ ] **Step 3: Verify + commit**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
git add app/dashboard/pipeline/page.tsx
git commit -m "feat(pipeline): top-level page uses PageHeader"
```

---

### Task 9: Talent Bank + components

**Files:**
- Modify: `app/dashboard/talent/page.tsx`
- Modify: `components/talent/global-criteria-panel.tsx`
- Modify: `components/talent/pool-selector.tsx`
- Modify: `components/talent/talent-controls.tsx`

- [ ] **Step 1: Rewrite talent page**

Replace top chrome with PageHeader. Use Card for content sections. Keep talent-controls + table grid. Add Avatar to each talent row.

Pattern:

```tsx
import { PageHeader, Card } from "@/components/ui";

export default async function TalentPage() {
  // existing data fetching
  return (
    <div>
      <PageHeader title="Talent Bank" subtitle={`${total} candidates`} />
      <TalentControls ... />
      <Card padding="none" elevation={1} className="mt-4">
        {/* talent rows with <Avatar name={...} size={28} /> */}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: global-criteria-panel.tsx**

Already partial Badge migration in Plan 1 final review. Finish remaining smells. Wrap in Card if there's a container div.

- [ ] **Step 3: pool-selector.tsx**

CRUD UI for pools. Migrate inline card styles to Card. Migrate inline buttons to Button.

- [ ] **Step 4: talent-controls.tsx**

Already uses new Input + Badge. Remaining: replace native `<select>` for sort with `<Select>`. Update the existing `tests/components/talent-controls.test.tsx` test for the sort dropdown to click trigger then click option (button-based interaction).

```tsx
// in tests/components/talent-controls.test.tsx, replace the "calls onSortChange" test:
it("calls onSortChange when sort dropdown changes", () => {
  const onSortChange = vi.fn();
  render(<TalentControls {...defaultProps} onSortChange={onSortChange} />);
  fireEvent.click(screen.getByText(/newest/i));  // open Select
  fireEvent.click(screen.getByText(/match score/i));  // pick option
  expect(onSortChange).toHaveBeenCalledWith("score");
});
```

- [ ] **Step 5: Verify + commit**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
git add app/dashboard/talent/page.tsx components/talent/ tests/components/talent-controls.test.tsx
git commit -m "feat(talent): redesign list page and finish controls migration"
```

---

## Phase C: Settings

### Task 10: Settings layout, nav, general

**Files:**
- Modify: `app/dashboard/settings/layout.tsx`
- Modify: `app/dashboard/settings/page.tsx`
- Modify: `components/settings/settings-nav.tsx`

- [ ] **Step 1: settings/layout.tsx**

Current: 15 LOC delegating to SettingsNav. Wrap with PageHeader:

```tsx
import { PageHeader } from "@/components/ui";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure how RoleRecruit works for your school" />
      <div className="grid grid-cols-[200px_1fr] gap-7 items-start">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: settings-nav.tsx**

58 LOC. Replace `bg-surface-secondary` active state with `bg-surface-floating` (raised translucent). Use the same nav-item shape as Sidebar (`text-body-s font-medium`, hover bg-accent-soft). Use Lucide icons:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui";
import { cn } from "@/lib/utils";

interface NavItem { href: string; label: string; icon: IconName }

const ITEMS: NavItem[] = [
  { href: "/dashboard/settings",          label: "General",          icon: "Settings" },
  { href: "/dashboard/settings/calendar", label: "Calendar",         icon: "Calendar" },
  { href: "/dashboard/settings/messaging",label: "Messaging",        icon: "MessageSquare" },
  { href: "/dashboard/settings/pipeline", label: "Pipeline stages",  icon: "Kanban" },
  { href: "/dashboard/settings/roles",    label: "Roles",            icon: "Shield" },
  { href: "/dashboard/settings/team",     label: "Team",             icon: "Users" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-px">
      {ITEMS.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard/settings" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-[11px] rounded-sm px-3 py-2 text-body-s font-medium transition-colors duration-fast",
              active
                ? "bg-surface-floating shadow-elev-1 text-ink"
                : "text-ink hover:bg-accent-soft",
            )}
          >
            <Icon name={item.icon} size={16} color={active ? "var(--accent)" : "var(--ink-2)"} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: settings/page.tsx (general)**

196 LOC. Major migration. Sections to migrate:

- Wrap each settings section in `<Card padding="md" elevation={1}>` instead of the inline `rounded-apple bg-surface border border-surface-tertiary p-5` card pattern.
- Toggle: replace the custom `<button>` with hardcoded `bg-[#34c759]`/`bg-[#e8e8ed]` with the `<Toggle>` primitive.
- Inputs: replace raw `<input>` + `bg-surface-secondary border` with `<Input>`.
- Buttons: replace `<button className="bg-[#0071e3]...">` with `<Button variant="primary">`.
- Error alert: replace hardcoded `bg-[#fff2f0]` with the new pattern:
  ```tsx
  {error && (
    <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger">
      {error}
    </div>
  )}
  ```

The page is structured around school settings (name, logo, working hours, etc.). Don't change the data flow; just retokenize.

- [ ] **Step 4: Verify + commit**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
git add app/dashboard/settings/layout.tsx app/dashboard/settings/page.tsx components/settings/settings-nav.tsx
git commit -m "feat(settings): general page and nav use new tokens"
```

---

### Task 11: Settings calendar

**Files:**
- Modify: `app/dashboard/settings/calendar/page.tsx`
- Modify: `components/settings/calendar-config-form.tsx`

- [ ] **Step 1: page.tsx** delegates to the component; minimal change. Just verify the layout pattern is OK.

- [ ] **Step 2: calendar-config-form.tsx**

~150 LOC. Migrate:
- Buttons → `<Button>`
- Number inputs → `<Input>` with `iconLeft` for clock icons where helpful
- Wrap form sections in Card with description headers (the Configuration pattern)
- Each setting row: paired `label + control` grid using:
  ```tsx
  <div className="grid grid-cols-[1fr_240px] gap-6 py-4 border-b border-hairline last:border-b-0 items-center">
    <div>
      <div className="text-body-s font-medium text-ink">Buffer before meetings</div>
      <div className="text-caption text-ink-secondary mt-0.5">Don't let candidates book within this window.</div>
    </div>
    <Select value={...} onChange={...} options={[...]} />
  </div>
  ```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/settings/calendar/page.tsx components/settings/calendar-config-form.tsx
git commit -m "feat(settings): calendar uses Configuration pattern"
```

---

### Task 12: Settings messaging + channel routing + automation

**Files:**
- Modify: `app/dashboard/settings/messaging/page.tsx`
- Modify: `components/settings/channel-routing-table.tsx`
- Modify: `components/settings/automation-panel.tsx`

- [ ] **Step 1: messaging/page.tsx** delegates; minimal.

- [ ] **Step 2: channel-routing-table.tsx**

~150 LOC table with checkbox grid. Migrate:
- Table header `bg-surface-secondary` → `bg-hairline/50` or just hairline border treatment
- Wrap whole table in `<Card padding="none" elevation={1}>`
- Toggle checkboxes already are HTML checkboxes; style their accent color via CSS

- [ ] **Step 3: automation-panel.tsx**

~150 LOC modal with toggle switches + message template editor. Migrate:
- Modal: use `<Dialog>` primitive
- Toggle switches: use `<Toggle>` primitive
- Buttons: use `<Button>`

- [ ] **Step 4: Verify + commit**

```bash
git add app/dashboard/settings/messaging/page.tsx components/settings/channel-routing-table.tsx components/settings/automation-panel.tsx
git commit -m "feat(settings): messaging and automation use new dialogs and toggles"
```

---

### Task 13: Settings pipeline, roles, team

**Files:**
- Modify: `app/dashboard/settings/pipeline/page.tsx`
- Modify: `app/dashboard/settings/roles/page.tsx`
- Modify: `app/dashboard/settings/team/page.tsx`
- Modify: `components/settings/pipeline-stage-editor.tsx`

- [ ] **Step 1: pipeline-stage-editor.tsx**

Complex editor (~200 LOC) with drag/reorder + transition matrix + `window.prompt` for confirmation. Substantial migration:
- Replace `window.prompt` with a `<Dialog>` containing an `<Input>` and Confirm/Cancel buttons
- Stage rows: wrap each in `<Card padding="sm" elevation={1}>` and use drag handle
- Buttons: `<Button>`
- Transition matrix: wrap in Card, use hairline borders

This is the largest file in Phase C. Budget more time. If the migration grows beyond ~4 hours of work, ship in two commits.

- [ ] **Step 2: roles/page.tsx**

278 LOC. Migrate:
- Role cards: `<Card padding="md" elevation={1} interactive>`
- Permission badges: `<Badge variant="info">`
- Buttons: `<Button variant="primary">` for save, `<Button variant="danger">` for delete
- Hardcoded `bg-[#e8f0fe]` permission chips → `bg-accent-soft text-accent`
- Error alert: same `<div className="rounded-md bg-[color-mix...]">` pattern from Task 10
- Form inputs/selects → `<Input>` / `<Select>`

- [ ] **Step 3: team/page.tsx**

192 LOC. Migrate:
- Invite form: `<Input>` for email, `<Select>` for role
- Table header `bg-[#fff9f0]` → `bg-hairline/30` or remove header background entirely
- Action buttons: `<Button>`
- Pending invitations row: `<Card padding="sm" elevation={1}>` per row, or grouped Card with row dividers
- Member rows: same grouped pattern

- [ ] **Step 4: Verify + commit**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
git add app/dashboard/settings/pipeline/page.tsx app/dashboard/settings/roles/page.tsx app/dashboard/settings/team/page.tsx components/settings/pipeline-stage-editor.tsx
git commit -m "feat(settings): pipeline stages, roles, team use new chrome"
```

---

## Phase D: Form pages

### Task 14: Job intake

**Files:**
- Modify: `app/dashboard/jobs/new/page.tsx`
- Modify: `components/jobs/job-intake-form.tsx`

- [ ] **Step 1: page.tsx**

Add PageHeader + back link to /dashboard/jobs. Wrap form in a max-width-720px centered container:

```tsx
import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { JobIntakeForm } from "@/components/jobs/job-intake-form";

export default async function NewJobPage() {
  const { profile } = await requireProfile();
  return (
    <div className="max-w-[720px] mx-auto">
      <PageHeader
        back={{ href: "/dashboard/jobs", label: "Jobs" }}
        title="Post a new role"
        subtitle="Tell us what you're hiring for; we'll generate the candidate-facing posting."
      />
      <JobIntakeForm schoolId={profile.schoolId} />
    </div>
  );
}
```

- [ ] **Step 2: job-intake-form.tsx**

~150 LOC. Migrate:
- Wrap in `<Card padding="lg" elevation={1}>` if it's not already
- Native `<select>` → `<Select>` for board, level, etc.
- Raw `<input>` → `<Input size="md">`
- Submit button: `<Button variant="primary" size="lg" loading={submitting}>Post role</Button>`
- Textarea for description: keep native (we don't have a Textarea primitive yet) but apply the same border/focus tokens manually:
  ```tsx
  <textarea
    className="w-full rounded-sm bg-surface border border-hairline-strong px-3 py-2 text-body-s text-ink placeholder:text-ink-tertiary outline-none transition-all duration-fast focus:border-accent focus:ring-2 focus:ring-accent-soft min-h-[120px]"
    ...
  />
  ```

- [ ] **Step 3: Verify + commit**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
git add app/dashboard/jobs/new/page.tsx components/jobs/job-intake-form.tsx
git commit -m "feat(jobs): intake form uses new inputs and selects"
```

---

### Task 15: Onboarding

**Files:**
- Modify: `app/onboarding/page.tsx`
- Modify: `app/onboarding/layout.tsx`

- [ ] **Step 1: onboarding/layout.tsx**

Currently a thin wrapper. Update to provide a slim header with the brand mark and centered content:

```tsx
import { BrandMark } from "@/components/ui";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-2.5 px-9 py-5 border-b border-hairline">
        <BrandMark />
        <span className="text-title-m text-ink">RoleRecruit</span>
      </header>
      <main className="max-w-[560px] mx-auto px-6 py-12">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: onboarding/page.tsx**

150 LOC form. Migrate:
- Page title: replace inline `<h1 className="text-2xl font-bold">...</h1>` with the spec's heading style: `<h1 className="text-display-s text-ink mb-2">Welcome to RoleRecruit</h1>`
- Form group: wrap in `<Card padding="lg" elevation={1}>`
- Inputs: `<Input size="md">` for school name, city, state, etc.
- Selects: `<Select>` for board
- Submit button: `<Button variant="primary" size="lg" loading={submitting} className="w-full">Get started</Button>`
- Error alert: same color-mix div pattern as Task 10

- [ ] **Step 3: Verify + commit**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
git add app/onboarding/page.tsx app/onboarding/layout.tsx
git commit -m "feat(onboarding): use brand chip header and Configuration form"
```

---

## Phase E: Cleanup

### Task 16: Remove legacy Tailwind aliases + final verification

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Audit remaining call sites**

```bash
grep -rE "(bg-surface-secondary|bg-surface-tertiary|border-surface-tertiary)" \
  --include="*.tsx" --include="*.ts" \
  app components lib 2>/dev/null
```

Expected: any remaining hits live in files this plan didn't touch yet. Fix them inline OR add them to a follow-up commit.

Common remaining uses: `border-surface-tertiary` (use `border-hairline` or `border-hairline-strong`), `bg-surface-secondary` (use `bg-surface-canvas` or `bg-hairline` depending on intent).

- [ ] **Step 2: Remove the legacy aliases**

Open `tailwind.config.ts`. In the `theme.extend.colors.surface` object, remove these lines (added in Plan 1 Task 26):

```ts
secondary: "var(--canvas-base)",
tertiary: "var(--hairline)",
```

Verify the build succeeds without them:

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run build 2>&1 | tail -20
```

If the build fails because some surface still uses the legacy classes, you missed them in Step 1. Go back and migrate.

- [ ] **Step 3: Run full test suite + typecheck**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
bunx tsc --noEmit 2>&1 | grep error | head -10
```

Expected: all tests pass. Zero TypeScript errors.

- [ ] **Step 4: Manual smoke across surfaces**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run dev &
sleep 8

for route in "/" "/sign-in" "/onboarding" "/dashboard" "/dashboard/jobs" "/dashboard/jobs/new" "/dashboard/pipeline" "/dashboard/talent" "/dashboard/settings" "/dashboard/settings/calendar" "/dashboard/settings/team"; do
  echo "GET $route"
  curl -s -o /dev/null -w "  status=%{http_code}\n" "http://localhost:3000$route" || echo "  no response"
done

pkill -f "next dev" 2>/dev/null
```

Expected: every route responds (any code is fine; not a crash).

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts
# any cleanup migrations from Step 1 also get staged
git add -A
git commit -m "chore(ui): remove legacy surface aliases after migration"
```

- [ ] **Step 6: Tag**

```bash
git tag ui-internal-surfaces-migrated
git log --oneline -25
```

---

## Plan complete

After Task 16, every internal surface in `/dashboard` and `/onboarding` uses the new design system. The codebase no longer has:
- Inline `bg-[#0071e3]` button colors
- `rounded-apple bg-surface border border-surface-tertiary p-5` raw card pattern
- Native `<select>` outside of Clerk's own UI
- Hardcoded `bg-[#34c759]` / `bg-[#e8e8ed]` toggle switches
- Legacy `surface.secondary` / `surface.tertiary` Tailwind aliases

What remains for Plan 3:
- Public marketing surfaces (`/careers/*`): redesign careers home, jobs listing, job detail with apply rail, apply form
- Public utility surfaces (`/book/[token]`, `/track/[token]`, `/feedback/[token]`)

After Plan 3 ships, the spec is fully realized.

---

## Open issues to surface to humans

These came up while writing this plan:

1. **Tabs primitive doesn't support link mode.** Job detail tabs link to sub-routes; we duplicate the visual via inline `<Link role="tab">` JSX in each sub-page. A future enhancement to `Tabs` could accept `as="link"` to consolidate. Out of scope for Plan 2.

2. **Per-job candidate counts in jobs list.** Currently displayed as `—`. To populate, query `api.dashboard.getPipelineBreakdown` in `JobsList` and derive counts. Small data-shape extension. Out of scope.

3. **Textarea primitive.** The job intake form and onboarding use native textareas with inline styles. Worth extracting a `<Textarea>` primitive in a future cleanup; not blocking.

4. **Drawer primitive.** `<Dialog variant="drawer">` exists but the application drawer in pipeline still uses custom positioning. Either migrate to the primitive (medium effort, would unify the drawer chrome) or leave as-is. Out of scope.
