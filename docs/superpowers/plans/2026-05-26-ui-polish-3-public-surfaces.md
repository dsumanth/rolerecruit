# UI Polish (Part 3): Public Surfaces Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every public-facing route — `/careers/*`, `/book/[token]`, `/track/[token]`, `/feedback/[token]`, `/accept-invite/[token]` — to the new design system. After this plan ships, the entire app fully embodies the Modern Apple dialect, internal AND external.

**Architecture:** Two patterns to follow. **Pattern D** (marketing surfaces) wraps each careers page in an atmospheric hero block (radial gradients, `display-xl` title, body-l body, gradient CTA) followed by content on the off-white marketing canvas. **Pattern D2** (job detail variant) uses a smaller hero plus a 2-column layout with sticky `floating` apply rail. **Pattern F** (utility surfaces) uses the internal-app canvas (these are tools, not first impressions): school chip + role/candidate context + single-card body, max-width 480px. The accept-invite page also gets Pattern F treatment.

**Tech Stack:** Next.js 14 (app router), TypeScript, Tailwind CSS 3.4, Convex, Clerk, vitest + @testing-library/react, lucide-react, bun.

**Reference spec:** [`docs/superpowers/specs/2026-05-25-ui-polish-design.md`](../specs/2026-05-25-ui-polish-design.md)
**Plan 1 (prereq, shipped):** tag `ui-foundation-primitives-shell`
**Plan 2 (prereq, shipped):** tag `ui-internal-surfaces-migrated`

**Project rules (`.commandcode/taste/taste.md`):**
- Use `bun`, not `npm` (PATH: `export PATH="$HOME/.bun/bin:$PATH"`)
- No `—` (mdash) or `--` (double-dash) in code
- No `Co-authored-by` trailer in commits
- TDD: failing test first when adding new behavior. Pure visual migrations don't need new tests as long as existing tests still pass.
- Surgical: touch only what each task names

---

## What's already in place

### Primitives (`components/ui/`)
Full primitive set from Plan 1 + Plan 2 cleanup pass:
- `Button` — variants primary/secondary/danger/ghost/outline/gradient/ink. Sizes sm/md/lg. iconLeft/iconRight. loading.
- `Card` — surface card/chrome/floating. elevation floor/1-4. padding none/sm/md/lg. interactive.
- `Input` — sizes sm/md/lg, iconLeft.
- `Select` — Dropdown-backed: value, onChange, options[{value,label}], placeholder?
- `Badge` — variants neutral/info/success/warning/danger. dot variant.
- `Tabs`, `EmptyState`, `Skeleton`, `Toggle`, `Avatar` (+ `nameInitial` helper), `Tooltip`, `Dropdown`, `Dialog`, `Toast`, `Icon` (Lucide wrapper, type `IconName`).
- `PageHeader` — eyebrow, title, subtitle, back, status, actions.
- `BrandMark` — 26px gradient "R" square.

### Tokens
- Canvas: `bg-surface-marketing` (off-white marketing canvas, already on `/careers/*`), `bg-surface-canvas` (internal app canvas)
- Surface: `bg-surface`, `bg-surface-chrome`, `bg-surface-floating`
- Ink: `text-ink`, `text-ink-secondary`, `text-ink-tertiary`
- Accent: `bg-accent`, `text-accent`, `bg-accent-soft`, `bg-accent-grad`
- Semantic: `text-success`, `text-warning`, `text-danger`, `text-purple`
- Hairlines: `border-hairline`, `border-hairline-strong`, `border-chrome` (= hairline-strong)
- Elevation: `shadow-elev-1` through `shadow-elev-4`
- Radius: `rounded-xs/sm/md/lg/xl`
- Typography: `text-display-xl/l/m/s`, `text-title-l/m`, `text-body-l/body/body-s`, `text-caption`, `text-micro`, `text-gradient-ink`
- Backdrop: `backdrop-blur-20`, `backdrop-blur-24`
- Motion: `duration-instant/fast/base/slow`, `ease-apple-out/spring`

For success/error notices use the color-mix pattern:
```
bg-[color-mix(in_srgb,var(--success)_8%,transparent)] text-success
bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] text-danger
bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-accent
bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] text-warning
```

### Already shipped (Plan 1)
- `components/careers/MarketingTopbar.tsx` (Plan 1 Task 23): sticky topbar with school chip + nav links + apply CTA. Stays as-is.
- `app/careers/layout.tsx` (Plan 1 Task 24): root marketing canvas wrapper.
- `app/careers/[slug]/layout.tsx`: renders MarketingTopbar above children.

### Already token-cleaned (Plan 2 Task 16)
- Token-level legacy alias hits in all these surfaces (`bg-surface-secondary`, `border-surface-tertiary`, etc.) were swept to the new tokens. The structural migration (Card + Button + Input + Select + Badge primitives) is what this plan does on top.

---

## File map

### Files modified

**Marketing pages:**
- `app/careers/[slug]/page.tsx` (Task 1)
- `app/careers/[slug]/jobs/[jobId]/page.tsx` (Task 3)
- `app/careers/[slug]/apply/page.tsx` (Task 4)

**Marketing components:**
- `components/careers/SchoolHeader.tsx` (Task 1)
- `components/careers/JobListings.tsx` (Task 2)
- `components/careers/JobCard.tsx` (Task 2)
- `components/careers/ApplicationForm.tsx` (Task 4)

**Utility pages + components:**
- `app/book/[token]/page.tsx` (Task 5)
- `components/booking/booking-view.tsx` (Task 5)
- `components/booking/booking-page-content.tsx` (Task 5)
- `app/track/[token]/page.tsx` (Task 6)
- `components/tracking/ApplicationStatus.tsx` (Task 6)
- `app/feedback/[token]/page.tsx` (Task 7)
- `components/feedback/feedback-form.tsx` (Task 7)

**Auth utility:**
- `app/accept-invite/[token]/AcceptInviteClient.tsx` (Task 8)

### Files created

- `components/careers/MarketingHero.tsx` (Task 1) — shared hero with atmospheric backdrop, used by careers home, jobs listing slot, and apply page

### Files unchanged
- `components/careers/MarketingTopbar.tsx` — already Plan 1 chrome
- `app/careers/layout.tsx`, `app/careers/[slug]/layout.tsx` — already Plan 1 chrome
- `app/feedback/[token]/page.tsx`, `app/book/[token]/page.tsx` — wrap layouts only (touched only where needed)

---

## Pre-flight

### Task 0: Verify Plan 2 baseline

**Files:** none

- [ ] **Step 1: Confirm state**

```bash
git log --oneline -1
git tag --points-at HEAD || git tag --list "ui-*"
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
```

Expected: HEAD at `589a4cd` (or later). Tag `ui-internal-surfaces-migrated` exists at or behind HEAD. 131 tests pass.

- [ ] **Step 2: Confirm clean typecheck**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bunx tsc --noEmit 2>&1 | grep error | wc -l
```

Expected: 0 errors.

If there are errors, investigate before continuing — they should not exist after Plan 2 Task 16.

---

## Phase A: Marketing (Pattern D)

### Task 1: Careers home + MarketingHero + SchoolHeader

The anchor marketing surface. Build the shared MarketingHero component and use it on the careers home page.

**Files:**
- Create: `components/careers/MarketingHero.tsx`
- Modify: `components/careers/SchoolHeader.tsx`
- Modify: `app/careers/[slug]/page.tsx`

- [ ] **Step 1: Create `components/careers/MarketingHero.tsx`**

Shared hero with atmospheric backdrop. Used by careers home, jobs listing, apply pages.

```tsx
import { cn } from "@/lib/utils";

interface MarketingHeroProps {
  eyebrow?: string;
  title: string;
  body?: string;
  cta?: React.ReactNode;
  className?: string;
  size?: "default" | "compact";
}

export function MarketingHero({ eyebrow, title, body, cta, className, size = "default" }: MarketingHeroProps) {
  return (
    <section className={cn("relative overflow-hidden", className)}>
      {/* Three radial gradients for the atmospheric backdrop */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-120px] left-[20%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_60%)] blur-[40px]" />
        <div className="absolute top-[60px] right-[-60px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--purple)_14%,transparent),transparent_60%)] blur-[40px]" />
        <div className="absolute bottom-[-80px] left-[40%] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_60%)] blur-[40px]" />
      </div>

      <div className={cn(
        "relative max-w-[880px] mx-auto px-6 text-center",
        size === "compact" ? "py-14" : "py-24",
      )}>
        {eyebrow && (
          <p className="text-micro text-ink-secondary mb-4 uppercase tracking-[0.06em]">{eyebrow}</p>
        )}
        <h1 className={cn(
          "text-ink tracking-tight",
          size === "compact" ? "text-display-l" : "text-display-xl",
        )}>
          {title}
        </h1>
        {body && (
          <p className="text-body-l text-ink-secondary mt-5 max-w-[640px] mx-auto leading-relaxed">{body}</p>
        )}
        {cta && (
          <div className="mt-8 flex items-center justify-center gap-3">{cta}</div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Refresh `components/careers/SchoolHeader.tsx`**

Currently a 19-LOC bordered strip with school name + board chip + city. Demote it — the MarketingTopbar handles the persistent chrome. SchoolHeader becomes a small contextual stub used inline (or removed entirely if not needed). Read the file to see its callers, then either:

(a) Keep it as a small content block (preferred), with retokenized chips:

```tsx
import { Badge } from "@/components/ui";

interface Props {
  name: string;
  board: string;
  city: string;
}

export function SchoolHeader({ name, board, city }: Props) {
  return (
    <div className="border-b border-hairline">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-display-s text-ink tracking-tight">{name}</h1>
        <div className="flex items-center gap-3 mt-2">
          <Badge variant="neutral">{board}</Badge>
          <span className="text-body-s text-ink-secondary">{city}</span>
        </div>
      </div>
    </div>
  );
}
```

(b) If the careers home replaces it with the new MarketingHero entirely (recommended), delete the import and call from `app/careers/[slug]/page.tsx`. Don't delete the file itself unless it's truly unused — keep it available in case other surfaces need it (jobs detail uses it currently).

For this task: keep the file but refresh tokens as in (a).

- [ ] **Step 3: Rewrite `app/careers/[slug]/page.tsx`**

Replace SchoolHeader with MarketingHero. Move the open positions list into a content section on the marketing canvas. Replace the inline "General Application" CTA card with a Card + Button.

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { MarketingHero } from "@/components/careers/MarketingHero";
import { JobListings } from "@/components/careers/JobListings";
import { Card, Button } from "@/components/ui";
import Link from "next/link";

export default function CareersPage() {
  const { slug } = useParams<{ slug: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });
  const jobs = useQuery(api.careers.getOpenJobs, school ? { schoolId: school._id } : "skip");

  if (school === undefined) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">Loading...</p></div>;
  }

  if (!school) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">School not found</p></div>;
  }

  return (
    <div>
      <MarketingHero
        eyebrow={`${school.board} · ${school.city}`}
        title={`Teach at ${school.name}`}
        body="Join a school that invests in great teachers. Browse open roles below or submit a general application."
        cta={
          <Link href={`/careers/${slug}/apply`}>
            <Button variant="gradient" size="lg" iconRight="ArrowRight">Submit a general application</Button>
          </Link>
        }
      />

      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-title-l text-ink">Open positions</h2>
          {jobs && jobs.length > 0 && (
            <span className="text-body-s text-ink-secondary tabular-nums">{jobs.length} {jobs.length === 1 ? "role" : "roles"}</span>
          )}
        </div>
        <JobListings jobs={jobs ?? []} slug={slug} />

        <Card padding="lg" elevation={1} className="mt-10 text-center">
          <h3 className="text-title-m text-ink">Don't see the right role?</h3>
          <p className="text-body-s text-ink-secondary mt-1 mb-5 max-w-md mx-auto">
            Submit a general application and we'll contact you when a matching position opens.
          </p>
          <Link href={`/careers/${slug}/apply`} className="inline-block">
            <Button variant="ink" iconRight="ArrowRight">General application</Button>
          </Link>
        </Card>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
bunx tsc --noEmit 2>&1 | grep -E "(careers/|MarketingHero|SchoolHeader)" | head
```

All tests still pass (131). No new TS errors in touched files.

- [ ] **Step 5: Commit**

```bash
git add components/careers/MarketingHero.tsx components/careers/SchoolHeader.tsx app/careers/[slug]/page.tsx
git commit -m "feat(careers): marketing hero and refreshed home page"
```

---

### Task 2: Careers jobs listing (Pattern D + role tile grid)

The current home page renders `<JobListings>` inline. We also need a dedicated `/careers/[slug]/jobs` page (referenced by the MarketingTopbar "Open roles" link). Check if that page exists; if not, create it.

**Files:**
- Modify: `components/careers/JobListings.tsx`
- Modify: `components/careers/JobCard.tsx`
- Create or modify: `app/careers/[slug]/jobs/page.tsx` (only if it doesn't exist or is broken)

- [ ] **Step 1: Audit current state**

```bash
ls app/careers/[slug]/jobs/ 2>/dev/null
```

If `app/careers/[slug]/jobs/page.tsx` doesn't exist, the topbar link 404s. Create it. If it exists, modify it.

- [ ] **Step 2: Rewrite `components/careers/JobCard.tsx`**

Replace inline `rounded-apple bg-surface border border-hairline` with `<Card interactive elevation={1} padding="md">`. Replace inline chips with `<Badge>`.

```tsx
import Link from "next/link";
import { Card, Badge, Icon } from "@/components/ui";

interface Props {
  jobId: string;
  title: string;
  subject: string;
  level: string;
  qualifications: string[];
  minExperience?: number;
  slug: string;
}

export function JobCard({ jobId, title, subject, level, qualifications, minExperience, slug }: Props) {
  return (
    <Link href={`/careers/${slug}/jobs/${jobId}`} className="block">
      <Card padding="md" elevation={1} interactive>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-title-m text-ink truncate">{title}</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="info">{subject}</Badge>
              <Badge variant="neutral">{level}</Badge>
            </div>
            <p className="text-body-s text-ink-secondary mt-3">
              {qualifications.join(", ")}
              {minExperience != null && <span className="text-ink-tertiary"> · {minExperience}+ years</span>}
            </p>
          </div>
          <Icon name="ArrowRight" size={16} color="var(--ink-3)" className="mt-1 flex-shrink-0" />
        </div>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 3: Rewrite `components/careers/JobListings.tsx`**

Replace native `<input>` with `<Input>`. Keep the search filter logic.

```tsx
"use client";

import { useState } from "react";
import { JobCard } from "./JobCard";
import { Input, EmptyState } from "@/components/ui";

interface Job {
  _id: string;
  title: string;
  subject: string;
  level: string;
  qualifications: string[];
  minExperience?: number;
}

interface Props {
  jobs: Job[];
  slug: string;
}

export function JobListings({ jobs, slug }: Props) {
  const [search, setSearch] = useState("");

  const filtered = jobs.filter((job) =>
    !search ||
    job.title.toLowerCase().includes(search.toLowerCase()) ||
    job.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <Input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by title or subject..."
        iconLeft="Search"
        className="max-w-md"
      />
      {filtered.length === 0 ? (
        jobs.length === 0 ? (
          <EmptyState
            title="No open positions yet"
            description="Check back soon — new roles are posted regularly."
          />
        ) : (
          <p className="text-body-s text-ink-secondary py-8 text-center">No positions matching your search.</p>
        )
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((job) => (
            <JobCard key={job._id} jobId={job._id} slug={slug} {...job} />
          ))}
        </div>
      )}
    </div>
  );
}
```

Note: the grid switched to `md:grid-cols-2` to make it a role-tile grid per spec. If the tiles feel too narrow on smaller widths, drop back to `grid gap-3` and ship as a single column.

- [ ] **Step 4: If `app/careers/[slug]/jobs/page.tsx` doesn't exist, create it**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { MarketingHero } from "@/components/careers/MarketingHero";
import { JobListings } from "@/components/careers/JobListings";

export default function JobsListingPage() {
  const { slug } = useParams<{ slug: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });
  const jobs = useQuery(api.careers.getOpenJobs, school ? { schoolId: school._id } : "skip");

  if (!school) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">Loading...</p></div>;
  }

  return (
    <div>
      <MarketingHero
        size="compact"
        eyebrow={school.name}
        title="Open positions"
        body="Browse all current openings. New roles are posted regularly."
      />
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <JobListings jobs={jobs ?? []} slug={slug} />
      </section>
    </div>
  );
}
```

If the file already exists, modify it to follow the same pattern.

- [ ] **Step 5: Verify**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
bunx tsc --noEmit 2>&1 | grep -E "(careers/)" | head
```

Tests pass; no TS errors in touched files.

- [ ] **Step 6: Commit**

```bash
git add components/careers/JobListings.tsx components/careers/JobCard.tsx app/careers/[slug]/jobs/
git commit -m "feat(careers): jobs listing uses Pattern D + role tile grid"
```

---

### Task 3: Careers job detail (Pattern D2 with sticky apply rail)

The single most marketing-heavy page. Compact hero + 2-column body with sticky apply rail.

**Files:**
- Modify: `app/careers/[slug]/jobs/[jobId]/page.tsx`

- [ ] **Step 1: Read current**

49 LOC client component. Uses `SchoolHeader` + 2 stacked cards (job details, ApplicationForm). Will be replaced with a compact MarketingHero + 2-column body.

- [ ] **Step 2: Rewrite**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { ApplicationForm } from "@/components/careers/ApplicationForm";
import { MarketingHero } from "@/components/careers/MarketingHero";
import { Card, Badge, Icon } from "@/components/ui";
import Link from "next/link";

export default function JobDetailPage() {
  const { slug, jobId } = useParams<{ slug: string; jobId: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });
  const job = useQuery(api.careers.getJob, jobId ? { jobId: jobId as any } : "skip");

  if (school === undefined || job === undefined) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">Loading...</p></div>;
  }
  if (!school || !job) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">Not found</p></div>;
  }

  return (
    <div>
      <MarketingHero
        size="compact"
        eyebrow={school.name}
        title={job.title}
        body={[job.subject, job.level, job.board].filter(Boolean).join(" · ")}
      />

      <div className="max-w-5xl mx-auto px-6 pb-20">
        <Link
          href={`/careers/${slug}`}
          className="inline-flex items-center gap-1 text-body-s text-accent hover:underline mb-6"
        >
          <Icon name="ChevronLeft" size={14} /> All positions
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 items-start">
          <main className="min-w-0">
            <Card padding="lg" elevation={1}>
              <div className="flex flex-wrap gap-2 mb-5">
                <Badge variant="info">{job.subject}</Badge>
                <Badge variant="neutral">{job.level}</Badge>
                <Badge variant="neutral">{job.board}</Badge>
              </div>
              {job.naturalLanguageDescription && (
                <p className="text-body-l text-ink leading-relaxed whitespace-pre-line">
                  {job.naturalLanguageDescription}
                </p>
              )}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 mt-8 pt-6 border-t border-hairline">
                {job.qualifications && job.qualifications.length > 0 && (
                  <Fact label="Qualifications" value={job.qualifications.join(", ")} wide />
                )}
                {job.minExperience != null && (
                  <Fact label="Experience" value={`${job.minExperience}+ years`} />
                )}
                {job.salaryRange && <Fact label="Salary" value={job.salaryRange} />}
              </dl>
            </Card>

            <section className="mt-10">
              <h2 className="text-title-l text-ink mb-4">Apply for this position</h2>
              <Card padding="lg" elevation={1}>
                <ApplicationForm schoolId={school._id} jobId={jobId} slug={slug} />
              </Card>
            </section>
          </main>

          <aside className="hidden lg:block lg:sticky lg:top-24">
            <div className="rounded-lg bg-surface-floating backdrop-blur-20 border border-chrome p-6 shadow-elev-2">
              <p className="text-micro text-ink-secondary uppercase tracking-[0.06em] mb-3">Apply now</p>
              <h3 className="text-title-m text-ink mb-3">{job.title}</h3>
              <p className="text-body-s text-ink-secondary mb-5">
                Submit your application in under 2 minutes.
              </p>
              <a
                href="#apply"
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector("form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="inline-flex items-center justify-center gap-1.5 w-full rounded-full bg-accent-grad text-white px-4 py-2.5 text-body-s font-medium hover:opacity-95 transition-opacity"
              >
                Start application
              </a>

              <dl className="mt-6 pt-5 border-t border-hairline space-y-3">
                <Fact label="Subject" value={job.subject} />
                <Fact label="Level" value={job.level} />
                <Fact label="Board" value={job.board} />
                {job.minExperience != null && (
                  <Fact label="Experience" value={`${job.minExperience}+ years`} />
                )}
                {job.salaryRange && <Fact label="Salary" value={job.salaryRange} />}
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-micro text-ink-secondary mb-0.5">{label}</dt>
      <dd className="text-body-s text-ink">{value}</dd>
    </div>
  );
}
```

Note: the sticky apply rail is hidden on mobile (`hidden lg:block`); the main column form serves mobile. The "Start application" CTA scrolls to the form. The rail uses the floating translucent surface per spec.

- [ ] **Step 3: Verify**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
bunx tsc --noEmit 2>&1 | grep -E "(careers/.*/jobs/)" | head
```

Tests pass; no TS errors.

- [ ] **Step 4: Commit**

```bash
git add app/careers/[slug]/jobs/[jobId]/page.tsx
git commit -m "feat(careers): job detail uses Pattern D2 with sticky apply rail"
```

---

### Task 4: Apply form (marketing hero strip + form)

**Files:**
- Modify: `app/careers/[slug]/apply/page.tsx`
- Modify: `components/careers/ApplicationForm.tsx`

- [ ] **Step 1: Read current**

29 LOC page. Wraps `ApplicationForm` in a basic page chrome. 120 LOC component.

- [ ] **Step 2: Rewrite `app/careers/[slug]/apply/page.tsx`**

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { ApplicationForm } from "@/components/careers/ApplicationForm";
import { MarketingHero } from "@/components/careers/MarketingHero";
import { Card } from "@/components/ui";

export default function ApplyPage() {
  const { slug } = useParams<{ slug: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });

  if (school === undefined) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">Loading...</p></div>;
  }
  if (!school) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">School not found</p></div>;
  }

  return (
    <div>
      <MarketingHero
        size="compact"
        eyebrow={school.name}
        title="General application"
        body="Submit your application and we'll reach out when a matching position opens."
      />
      <section className="max-w-[640px] mx-auto px-6 pb-20">
        <Card padding="lg" elevation={1}>
          <ApplicationForm schoolId={school._id} slug={slug} />
        </Card>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `components/careers/ApplicationForm.tsx`**

Replace all native `<input>` with `<Input size="lg">` (warmer reading scale per spec Phase 5.4 callout). Replace the submit `<button>` with `<Button variant="primary" size="lg" loading={submitting}>`. Replace error alert with color-mix pattern. Replace done state with Card.

```tsx
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Input, Button, Card } from "@/components/ui";

interface Props {
  schoolId: string;
  jobId?: string;
  slug: string;
}

export function ApplicationForm({ schoolId, jobId, slug }: Props) {
  const submitApplication = useMutation(api.careers.submitApplication);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    qualifications: "",
    certifications: "",
    boardExperience: "",
    subjects: "",
    yearsExperience: "",
    currentSchool: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || (!form.phone && !form.email)) {
      setError("Please provide your name and either phone or email.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await submitApplication({
        schoolId: schoolId as any,
        jobId: jobId ? (jobId as any) : undefined,
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        qualifications: form.qualifications.split(",").map((s) => s.trim()).filter(Boolean),
        certifications: form.certifications.split(",").map((s) => s.trim()).filter(Boolean),
        boardExperience: form.boardExperience.split(",").map((s) => s.trim()).filter(Boolean),
        subjects: form.subjects.split(",").map((s) => s.trim()).filter(Boolean),
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : undefined,
        currentSchool: form.currentSchool || undefined,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-6">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success mb-4 text-2xl">✓</div>
        <h3 className="text-title-m text-ink mb-2">Application submitted</h3>
        <p className="text-body-s text-ink-secondary">You'll receive a tracking link on your phone or email shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Full name" required>
        <Input
          size="lg"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Rajesh Kumar"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Phone">
          <Input size="lg" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" />
        </Field>
        <Field label="Email">
          <Input size="lg" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="rajesh@email.com" />
        </Field>
      </div>

      <Field label="Qualifications (comma separated)">
        <Input size="lg" value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} placeholder="B.Ed, M.Sc Physics" />
      </Field>
      <Field label="Certifications (comma separated)">
        <Input size="lg" value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} placeholder="CTET, NET" />
      </Field>
      <Field label="Subjects you teach (comma separated)">
        <Input size="lg" value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} placeholder="Physics, Mathematics" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Years experience">
          <Input size="lg" type="number" value={form.yearsExperience} onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })} placeholder="5" />
        </Field>
        <Field label="Current school">
          <Input size="lg" value={form.currentSchool} onChange={(e) => setForm({ ...form, currentSchool: e.target.value })} placeholder="Delhi Public School" />
        </Field>
      </div>

      <Field label="Board experience (comma separated)">
        <Input size="lg" value={form.boardExperience} onChange={(e) => setForm({ ...form, boardExperience: e.target.value })} placeholder="CBSE, ICSE" />
      </Field>

      {error && (
        <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger">
          {error}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
        Submit application
      </Button>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-body-s font-medium text-ink mb-1.5">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Verify + commit**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
git add app/careers/[slug]/apply/page.tsx components/careers/ApplicationForm.tsx
git commit -m "feat(careers): apply form uses marketing hero + Configuration body"
```

---

## Phase B: Utility (Pattern F)

### Task 5: Book page (Pattern F: calendar + slot picker)

**Files:**
- Modify: `app/book/[token]/page.tsx`
- Modify: `components/booking/booking-page-content.tsx`
- Modify: `components/booking/booking-view.tsx`

- [ ] **Step 1: `app/book/[token]/page.tsx`**

Already minimal (12 LOC). Just verify layout uses the internal canvas. Keep as-is unless a tweak is needed.

If you tweak: ensure the wrapper is `bg-surface-canvas min-h-screen flex items-center justify-center p-6` — that's the Pattern F canvas.

- [ ] **Step 2: `components/booking/booking-page-content.tsx`**

Migrate the invalid-link branch and loading state to use Card + new typography tokens.

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BookingView } from "./booking-view";
import { Card } from "@/components/ui";

interface Props {
  token: string;
}

export function BookingPageContent({ token }: Props) {
  const bookingData = useQuery(api.booking.getBookingByToken, { token });

  if (!bookingData) {
    return (
      <Card padding="lg" elevation={1} className="max-w-md mx-auto text-center">
        <p className="text-body-s text-ink-secondary">Loading...</p>
      </Card>
    );
  }

  if (!bookingData.valid) {
    return (
      <Card padding="lg" elevation={1} className="max-w-md mx-auto text-center">
        <h2 className="text-title-m text-ink mb-2">
          {bookingData.reason === "expired" ? "Booking link expired" :
           bookingData.reason === "used" ? "Already booked" : "Invalid link"}
        </h2>
        <p className="text-body-s text-ink-secondary">
          {bookingData.reason === "expired" && "This booking link has expired. Please contact the school for a new link."}
          {bookingData.reason === "used" && "You've already booked a slot using this link."}
          {bookingData.reason === "not_found" && "This booking link is invalid."}
        </p>
      </Card>
    );
  }

  return (
    <BookingView
      token={token}
      schoolId={bookingData.schoolId}
      jobTitle={bookingData.jobTitle}
      schoolName={bookingData.schoolName}
    />
  );
}
```

- [ ] **Step 3: `components/booking/booking-view.tsx`**

165 LOC. The biggest utility migration. Migrate:
- Wrap the active body in `<Card padding="lg" elevation={1} className="max-w-[480px]">`
- Top header: school chip pattern. Use the `nameInitial` helper for the avatar.
- Title: `text-display-s text-ink`
- Subtitle: `text-body-s text-ink-secondary`
- Date picker buttons: keep `<button>` (custom day pills), use accent-soft for selected, hairline border for normal, opacity-40 for weekends.
- Slot picker buttons: same pattern, smaller.
- Confirm button: `<Button variant="gradient" size="lg" loading={loading} className="w-full">`
- Confirmed state: Card with success icon and tabular info.

```tsx
"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, Button, Icon } from "@/components/ui";
import { nameInitial } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Slot {
  start: string;
  end: string;
  startMs: number;
  endMs: number;
}

interface Props {
  token: string;
  schoolId: Id<"schools">;
  jobTitle: string;
  schoolName: string;
}

export function BookingView({ token, schoolId, jobTitle, schoolName }: Props) {
  const getSlots = useAction(api.slot_calculator.getAvailableSlotsForDate);
  const confirmBooking = useMutation(api.booking.confirmBooking);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }

  const handleDateSelect = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setError(null);
    setLoading(true);
    try {
      const result = await getSlots({ schoolId, date: dateStr });
      setSlots(Array.isArray(result) ? result : []);
    } catch {
      setError("Could not load available slots. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setLoading(true);
    setError(null);
    try {
      await confirmBooking({ token, startMs: selectedSlot.startMs, endMs: selectedSlot.endMs });
      setConfirmed(true);
    } catch (e: any) {
      setError(e.message ?? "Booking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (confirmed) {
    return (
      <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success mb-4 text-2xl">✓</div>
        <h2 className="text-title-l text-ink mb-2">Booking confirmed</h2>
        <p className="text-body-s text-ink-secondary mb-1">
          Demo lesson at <span className="text-ink font-medium">{schoolName}</span>
        </p>
        <p className="text-body-s text-ink-secondary">
          {selectedDate} · {selectedSlot?.start}
        </p>
        <p className="text-caption text-ink-tertiary mt-4">
          You will receive a calendar invitation shortly.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto">
      {/* School chip + context */}
      <div className="flex items-center gap-2.5 pb-5 mb-5 border-b border-hairline">
        <div className="h-8 w-8 rounded-sm bg-gradient-to-br from-[#1d1d1f] to-[#4a4a52] text-white text-body-s font-bold flex items-center justify-center">
          {nameInitial(schoolName, "·")}
        </div>
        <div className="min-w-0">
          <p className="text-body-s font-medium text-ink truncate">{schoolName}</p>
          <p className="text-caption text-ink-secondary truncate">{jobTitle}</p>
        </div>
      </div>

      <h2 className="text-display-s text-ink mb-1">Book your demo lesson</h2>
      <p className="text-body-s text-ink-secondary mb-6">Pick a date and time that works for you.</p>

      <div className="mb-6">
        <p className="text-micro text-ink-secondary uppercase tracking-[0.06em] mb-3">Select a date</p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {dates.map((d) => {
            const dateStr = d.toISOString().split("T")[0];
            const isSelected = dateStr === selectedDate;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => handleDateSelect(dateStr)}
                disabled={isWeekend}
                className={cn(
                  "flex-shrink-0 rounded-md text-center min-w-[64px] py-2 transition-colors duration-fast",
                  isSelected
                    ? "bg-accent-soft border border-accent/30 text-accent"
                    : isWeekend
                      ? "bg-surface-canvas text-ink-tertiary opacity-40 cursor-not-allowed border border-hairline"
                      : "bg-surface border border-hairline text-ink hover:bg-accent-soft",
                )}
              >
                <div className="text-caption">{d.toLocaleDateString("en", { weekday: "short" })}</div>
                <div className="text-title-m font-semibold tabular-nums">{d.getDate()}</div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="mb-6">
          <p className="text-micro text-ink-secondary uppercase tracking-[0.06em] mb-3">Available times</p>
          {loading ? (
            <p className="text-body-s text-ink-secondary">Loading slots...</p>
          ) : slots.length === 0 ? (
            <p className="text-body-s text-ink-secondary">No available slots for this date.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    "px-4 py-2 rounded-md text-body-s font-medium transition-colors duration-fast border",
                    selectedSlot?.startMs === slot.startMs
                      ? "bg-accent-soft border-accent/30 text-accent"
                      : "bg-surface border-hairline text-ink hover:border-accent",
                  )}
                >
                  {slot.start}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger mb-4">
          {error}
        </div>
      )}

      <Button
        variant="gradient"
        size="lg"
        loading={loading}
        disabled={!selectedSlot}
        onClick={handleConfirm}
        className="w-full"
      >
        Confirm booking
      </Button>
    </Card>
  );
}
```

- [ ] **Step 4: Verify + commit**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
git add app/book/[token]/page.tsx components/booking/
git commit -m "feat(book): booking page uses Pattern F"
```

---

### Task 6: Track page (Pattern F: status + timeline)

**Files:**
- Modify: `app/track/[token]/page.tsx`
- Modify: `components/tracking/ApplicationStatus.tsx`

- [ ] **Step 1: `app/track/[token]/page.tsx`**

Migrate loading/not-found states to Card. Update outer wrapper to Pattern F canvas.

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { ApplicationStatus } from "@/components/tracking/ApplicationStatus";
import { Card } from "@/components/ui";

export default function TrackPage() {
  const { token } = useParams<{ token: string }>();
  const app = useQuery(api.tracking.getByToken, token ? { token } : "skip");

  if (app === undefined) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center p-6">
        <Card padding="lg" elevation={1} className="max-w-[480px] text-center">
          <p className="text-body-s text-ink-secondary">Loading...</p>
        </Card>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center p-6">
        <Card padding="lg" elevation={1} className="max-w-[480px] text-center">
          <h2 className="text-title-l text-ink mb-2">Application not found</h2>
          <p className="text-body-s text-ink-secondary">This tracking link is invalid or has expired.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas flex items-center justify-center p-6">
      <ApplicationStatus
        stage={app.stage}
        jobTitle={app.job?.title}
        candidateName={app.candidate?.name ?? "Candidate"}
        schoolName={app.school?.name ?? ""}
      />
    </div>
  );
}
```

- [ ] **Step 2: `components/tracking/ApplicationStatus.tsx`**

Migrate to Card + Badge + new typography. Add a vertical timeline showing all stages with the current stage highlighted.

```tsx
import { Card, Badge, Icon, type IconName } from "@/components/ui";
import { cn } from "@/lib/utils";
import { nameInitial } from "@/components/ui/avatar";

interface Props {
  stage: string;
  jobTitle?: string;
  candidateName: string;
  schoolName: string;
}

interface StageDef {
  key: string;
  label: string;
  icon: IconName;
}

const TIMELINE: StageDef[] = [
  { key: "sourced",        label: "Application received", icon: "Inbox" },
  { key: "screened",       label: "Under review",          icon: "Search" },
  { key: "demo_scheduled", label: "Demo scheduled",        icon: "Calendar" },
  { key: "demo_completed", label: "Demo completed",        icon: "CheckCircle2" },
  { key: "offer_sent",     label: "Offer sent",            icon: "Mail" },
  { key: "hired",          label: "Hired",                 icon: "PartyPopper" },
];

const STAGE_LABELS: Record<string, string> = {
  sourced: "Application received",
  screened: "Under review",
  demo_scheduled: "Demo scheduled",
  demo_completed: "Demo completed",
  offer_sent: "Offer sent",
  hired: "Hired",
  rejected: "Not selected",
  on_hold: "On hold",
};

export function ApplicationStatus({ stage, jobTitle, candidateName, schoolName }: Props) {
  const label = STAGE_LABELS[stage] ?? stage;
  const currentIndex = TIMELINE.findIndex((s) => s.key === stage);

  return (
    <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto">
      <div className="flex items-center gap-2.5 pb-5 mb-5 border-b border-hairline">
        <div className="h-8 w-8 rounded-sm bg-gradient-to-br from-[#1d1d1f] to-[#4a4a52] text-white text-body-s font-bold flex items-center justify-center">
          {nameInitial(schoolName, "·")}
        </div>
        <div className="min-w-0">
          <p className="text-body-s font-medium text-ink truncate">{schoolName}</p>
          {jobTitle && <p className="text-caption text-ink-secondary truncate">{jobTitle}</p>}
        </div>
      </div>

      <h2 className="text-display-s text-ink mb-1">Hi {candidateName}</h2>
      <p className="text-body-s text-ink-secondary mb-5">Here's where your application stands.</p>

      <div className="mb-6">
        {stage === "rejected" ? (
          <Badge dot variant="neutral">Not selected</Badge>
        ) : stage === "on_hold" ? (
          <Badge dot variant="warning">On hold</Badge>
        ) : stage === "hired" ? (
          <Badge dot variant="success">{label}</Badge>
        ) : stage === "offer_sent" ? (
          <Badge dot variant="warning">{label}</Badge>
        ) : (
          <Badge dot variant="info">{label}</Badge>
        )}
      </div>

      {currentIndex >= 0 && (
        <div className="space-y-3">
          {TIMELINE.map((s, i) => {
            const isPast = i < currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div key={s.key} className="flex items-start gap-3">
                <div className={cn(
                  "flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center",
                  isCurrent
                    ? "bg-accent-soft text-accent"
                    : isPast
                      ? "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success"
                      : "bg-hairline text-ink-tertiary",
                )}>
                  <Icon name={isPast ? "Check" : s.icon} size={14} />
                </div>
                <div className={cn(
                  "pt-1 text-body-s",
                  isCurrent ? "text-ink font-medium" : isPast ? "text-ink-secondary" : "text-ink-tertiary",
                )}>
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {stage === "rejected" && (
        <p className="text-body-s text-ink-secondary mt-6 pt-5 border-t border-hairline">
          The position has been filled. We encourage you to apply for other openings.
        </p>
      )}
      {stage === "offer_sent" && (
        <div className="mt-6 pt-5 border-t border-hairline rounded-md bg-[color-mix(in_srgb,var(--success)_8%,transparent)] -mx-2 px-4 py-3">
          <p className="text-body-s text-success font-medium">Congratulations! An offer letter has been sent.</p>
        </div>
      )}
    </Card>
  );
}
```

If a Lucide icon name from the timeline (e.g., `Inbox`, `PartyPopper`) doesn't exist in the installed version, swap to a similar icon (`Mail`, `Star`). The Icon wrapper returns null silently if the name doesn't resolve — visible bug if so. Verify by running the page in dev.

- [ ] **Step 3: Verify + commit**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
git add app/track/[token]/page.tsx components/tracking/ApplicationStatus.tsx
git commit -m "feat(track): status page uses Pattern F + timeline"
```

---

### Task 7: Feedback page (Pattern F: rating + textareas + recommendation)

**Files:**
- Modify: `app/feedback/[token]/page.tsx`
- Modify: `components/feedback/feedback-form.tsx`

- [ ] **Step 1: `app/feedback/[token]/page.tsx`**

Currently 12 LOC. Verify the wrapper uses Pattern F canvas (`bg-surface-canvas min-h-screen flex items-center justify-center p-6`).

- [ ] **Step 2: `components/feedback/feedback-form.tsx`**

204 LOC. Substantial migration:
- Wrap form in `<Card padding="lg" elevation={1} className="max-w-[480px]">`
- School chip header at the top
- Title: `text-display-s text-ink`
- Star rating: keep custom buttons but use `text-warning` and `text-hairline` (already migrated in Plan 2.1 cleanup)
- Textarea: use the token classes pattern (`rounded-sm bg-surface border border-hairline-strong px-3 py-2 ... focus:border-accent focus:ring-2 focus:ring-accent-soft`)
- Recommendation pills: replace the custom three-color-state with `<Button variant="primary|danger|outline">` per option, OR keep custom buttons but use color-mix tokens for the active state
- Submit: `<Button variant="ink" size="lg" loading={submitting} className="w-full">` (dark ink CTA per spec for school-staff action)
- Error alert: color-mix pattern
- Done state: Card with success icon

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, Button } from "@/components/ui";
import { nameInitial } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Props {
  token: string;
}

const DIMENSIONS = [
  { key: "subjectKnowledge", label: "Subject knowledge" },
  { key: "classroomManagement", label: "Classroom management" },
  { key: "communication", label: "Communication" },
  { key: "overallFit", label: "Overall fit" },
] as const;

const RECOMMENDATIONS = [
  { value: "hire" as const, label: "Hire" },
  { value: "maybe" as const, label: "Maybe" },
  { value: "reject" as const, label: "Reject" },
];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={cn(
            "text-2xl transition-colors duration-fast",
            star <= value ? "text-warning" : "text-hairline hover:text-ink-tertiary",
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function FeedbackForm({ token }: Props) {
  const submission = useQuery(api.evaluations.getByToken, { token });
  const submit = useMutation(api.evaluations.submitFeedback);

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState("");
  const [recommendation, setRecommendation] = useState<"hire" | "maybe" | "reject" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!submission) {
    return (
      <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto text-center">
        <p className="text-body-s text-ink-secondary">Loading...</p>
      </Card>
    );
  }

  if (!submission._id) {
    return (
      <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto text-center">
        <h1 className="text-title-l text-ink mb-2">Invalid link</h1>
        <p className="text-body-s text-ink-secondary">This feedback link is invalid or has expired.</p>
      </Card>
    );
  }

  if (submission.submitted || done) {
    return (
      <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success mb-4 text-2xl">✓</div>
        <h1 className="text-title-l text-ink mb-2">Feedback submitted</h1>
        <p className="text-body-s text-ink-secondary">Thank you. Your evaluation has been recorded.</p>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const missing = DIMENSIONS.filter((d) => !ratings[d.key]);
    if (missing.length > 0 || !recommendation) {
      setError("Please complete all ratings and select a recommendation.");
      return;
    }

    setSubmitting(true);
    try {
      await submit({
        token,
        subjectKnowledge: ratings.subjectKnowledge!,
        classroomManagement: ratings.classroomManagement!,
        communication: ratings.communication!,
        overallFit: ratings.overallFit!,
        comments: comments || undefined,
        recommendation,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const candidateName = submission.candidate?.name ?? "Candidate";

  return (
    <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto">
      <div className="flex items-center gap-2.5 pb-5 mb-5 border-b border-hairline">
        <div className="h-8 w-8 rounded-sm bg-gradient-to-br from-[#1d1d1f] to-[#4a4a52] text-white text-body-s font-bold flex items-center justify-center">
          {nameInitial(candidateName, "·")}
        </div>
        <div className="min-w-0">
          <p className="text-body-s font-medium text-ink truncate">{candidateName}</p>
          {submission.candidate?.subjects?.length ? (
            <p className="text-caption text-ink-secondary truncate">{submission.candidate.subjects.join(", ")}</p>
          ) : null}
        </div>
      </div>

      <h1 className="text-display-s text-ink mb-1">Demo lesson feedback</h1>
      <p className="text-body-s text-ink-secondary mb-6">Rate each dimension and share your overall recommendation.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {DIMENSIONS.map((dim) => (
          <div key={dim.key} className="flex items-center justify-between">
            <label className="text-body-s font-medium text-ink">{dim.label}</label>
            <StarRating
              value={ratings[dim.key] ?? 0}
              onChange={(v) => setRatings((prev) => ({ ...prev, [dim.key]: v }))}
            />
          </div>
        ))}

        <div>
          <label className="block text-body-s font-medium text-ink mb-1.5">Comments</label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            className="w-full rounded-sm bg-surface border border-hairline-strong px-3 py-2 text-body-s text-ink placeholder:text-ink-tertiary outline-none transition-all duration-fast focus:border-accent focus:ring-2 focus:ring-accent-soft resize-none"
            placeholder="Any additional notes about the candidate..."
          />
        </div>

        <div>
          <label className="block text-body-s font-medium text-ink mb-2">Recommendation</label>
          <div className="grid grid-cols-3 gap-2">
            {RECOMMENDATIONS.map((r) => {
              const active = recommendation === r.value;
              const activeClasses = r.value === "hire"
                ? "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] border-[color-mix(in_srgb,var(--success)_45%,transparent)] text-success"
                : r.value === "reject"
                  ? "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] border-[color-mix(in_srgb,var(--danger)_45%,transparent)] text-danger"
                  : "bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] border-[color-mix(in_srgb,var(--warning)_45%,transparent)] text-warning";
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRecommendation(r.value)}
                  className={cn(
                    "py-2 rounded-md text-body-s font-medium transition-colors duration-fast border",
                    active ? activeClasses : "bg-surface text-ink-secondary border-hairline hover:text-ink",
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger">
            {error}
          </div>
        )}

        <Button type="submit" variant="ink" size="lg" loading={submitting} className="w-full">
          Submit feedback
        </Button>
      </form>
    </Card>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
git add app/feedback/[token]/page.tsx components/feedback/feedback-form.tsx
git commit -m "feat(feedback): demo feedback uses Pattern F"
```

---

## Phase C: Auth utility

### Task 8: Accept-invite page

**Files:**
- Modify: `app/accept-invite/[token]/AcceptInviteClient.tsx`

- [ ] **Step 1: Read current**

179 LOC. Three branches: invalid invite, not signed in (sign-in/sign-up CTAs), and accept invitation form. Still has hardcoded hex (`bg-[#0071e3]`, `bg-[#fff2f0]`, `bg-[#fff9f0]`).

- [ ] **Step 2: Migrate**

Apply Pattern F shape. Three branches all wrap in Card:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Card, Button } from "@/components/ui";
import { nameInitial } from "@/components/ui/avatar";
import Link from "next/link";

type InviteData = {
  token: string;
  email: string;
  role: string;
  status: string;
  expiresAt: number;
  schoolName: string;
};

const ROLE_LABELS: Record<string, string> = {
  hr_admin: "HR admin",
  principal: "Principal",
  hod: "HOD",
  viewer: "Viewer",
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

function AcceptInviteInner({ invite, token }: { invite: InviteData; token: string }) {
  const router = useRouter();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const acceptInvite = useMutation(api.invitations.accept);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  const isValid = invite.status === "pending" && Date.now() < invite.expiresAt;

  if (!isValid) {
    const reason =
      invite.status === "accepted"
        ? "This invitation has already been accepted."
        : invite.status === "revoked"
          ? "This invitation has been revoked."
          : invite.status === "expired" || Date.now() > invite.expiresAt
            ? "This invitation has expired."
            : "This invitation is no longer valid.";

    return (
      <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto text-center">
        <h1 className="text-title-l text-ink mb-2">Invitation no longer available</h1>
        <p className="text-body-s text-ink-secondary">{reason}</p>
      </Card>
    );
  }

  if (!authLoaded) {
    return (
      <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto text-center">
        <p className="text-body-s text-ink-secondary">Loading...</p>
      </Card>
    );
  }

  if (!isSignedIn) {
    const returnUrl = `/accept-invite/${token}`;
    return (
      <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto">
        <div className="flex items-center gap-2.5 pb-5 mb-5 border-b border-hairline">
          <div className="h-8 w-8 rounded-sm bg-gradient-to-br from-[#1d1d1f] to-[#4a4a52] text-white text-body-s font-bold flex items-center justify-center">
            {nameInitial(invite.schoolName, "·")}
          </div>
          <div className="min-w-0">
            <p className="text-body-s font-medium text-ink truncate">{invite.schoolName}</p>
            <p className="text-caption text-ink-secondary truncate">{roleLabel(invite.role)} invitation</p>
          </div>
        </div>
        <h1 className="text-display-s text-ink mb-2">You're invited</h1>
        <p className="text-body-s text-ink-secondary mb-6">
          Sign in or create an account to accept this invitation.
        </p>
        <div className="flex gap-3">
          <Link href={`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`} className="flex-1">
            <Button variant="secondary" size="lg" className="w-full">Sign in</Button>
          </Link>
          <Link href={`/sign-up?redirect_url=${encodeURIComponent(returnUrl)}`} className="flex-1">
            <Button variant="primary" size="lg" className="w-full">Sign up</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const emailMismatch =
    user?.primaryEmailAddress?.emailAddress &&
    user.primaryEmailAddress.emailAddress.toLowerCase() !== invite.email.toLowerCase();

  const handleAccept = async () => {
    if (!user) return;
    setError("");
    setAccepting(true);
    try {
      await acceptInvite({
        token,
        userId: user.id,
        name: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "User",
        email: user.primaryEmailAddress?.emailAddress ?? "",
      });
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
      setAccepting(false);
    }
  };

  return (
    <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto">
      <div className="flex items-center gap-2.5 pb-5 mb-5 border-b border-hairline">
        <div className="h-8 w-8 rounded-sm bg-gradient-to-br from-[#1d1d1f] to-[#4a4a52] text-white text-body-s font-bold flex items-center justify-center">
          {nameInitial(invite.schoolName, "·")}
        </div>
        <div className="min-w-0">
          <p className="text-body-s font-medium text-ink truncate">{invite.schoolName}</p>
          <p className="text-caption text-ink-secondary truncate">{roleLabel(invite.role)} invitation</p>
        </div>
      </div>

      <h1 className="text-display-s text-ink mb-1">Accept invitation</h1>
      <p className="text-body-s text-ink-secondary mb-6">
        Joining as <span className="text-ink font-medium">{roleLabel(invite.role)}</span> at{" "}
        <span className="text-ink font-medium">{invite.schoolName}</span>.
      </p>

      {emailMismatch ? (
        <div className="rounded-md bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] border border-[color-mix(in_srgb,var(--warning)_25%,transparent)] px-4 py-3 text-body-s text-warning">
          This invitation was sent to <span className="font-medium">{invite.email}</span>.
          You're signed in as <span className="font-medium">{user?.primaryEmailAddress?.emailAddress}</span>.
          Please sign in with the invited email address.
        </div>
      ) : (
        <>
          {error && (
            <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger mb-4">
              {error}
            </div>
          )}
          <Button onClick={handleAccept} variant="primary" size="lg" loading={accepting} className="w-full">
            Accept invitation
          </Button>
        </>
      )}
    </Card>
  );
}

export function AcceptInviteClient({ invite, token }: { invite: InviteData; token: string }) {
  return (
    <div className="min-h-screen bg-surface-canvas flex items-center justify-center p-6">
      <ConvexClientProvider>
        <AcceptInviteInner invite={invite} token={token} />
      </ConvexClientProvider>
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -5
bunx tsc --noEmit 2>&1 | grep -E "(accept-invite)" | head
git add app/accept-invite/[token]/AcceptInviteClient.tsx
git commit -m "feat(invite): accept invite uses Pattern F"
```

---

## Phase D: Final verification

### Task 9: Smoke test + tag

**Files:** none (verification + tag only)

- [ ] **Step 1: Audit no leftover hardcoded hex**

```bash
grep -rE "(bg-\[#0071e3\]|bg-\[#34c759\]|bg-\[#e8e8ed\]|bg-\[#fff2f0\]|bg-\[#fff9f0\]|bg-\[#0077ed\]|bg-\[#ff3b30\]|bg-\[#ff9500\])" \
  --include="*.tsx" --include="*.ts" \
  app components lib 2>/dev/null | grep -v "AcceptInviteClient\|MarketingTopbar"
```

The `from-[#1d1d1f] to-[#4a4a52]` gradient on the school chip is intentional (it's a contextual dark gradient distinct from the brand-mark gradient). It's fine to remain.

Expected: zero matches for app-color hex codes. If hits remain, migrate them.

- [ ] **Step 2: Audit no leftover `rounded-apple`**

```bash
grep -rn "rounded-apple" --include="*.tsx" --include="*.ts" app components lib 2>/dev/null
```

Expected: zero matches across `app/`, `components/`, `lib/`. If hits remain, migrate to `rounded-md` / `rounded-lg` / `rounded-xl` per visual intent.

- [ ] **Step 3: Audit no leftover `shadow-elevation-low|medium|high|menu`**

```bash
grep -rn "shadow-elevation-" --include="*.tsx" --include="*.ts" app components lib 2>/dev/null
```

Expected: zero matches.

- [ ] **Step 4: Audit no leftover native `<select>` in app/components**

```bash
grep -rn "<select" --include="*.tsx" app components 2>/dev/null | grep -v "Select"
```

Most surfaces should be empty; some intentional native selects (e.g., inside Clerk-controlled DOM) may remain — that's fine.

- [ ] **Step 5: Run full test suite + typecheck + build**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run test 2>&1 | tail -10
bunx tsc --noEmit 2>&1 | grep error | wc -l
bun run build 2>&1 | tail -10
```

Expected: 131 tests pass (or higher if Task 2 added a JobListings test). Zero TS errors. Build succeeds.

- [ ] **Step 6: Manual smoke across surfaces**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run dev > /tmp/devsmoke3.log 2>&1 &
DEVPID=$!
sleep 8

for route in "/careers/test-school" "/careers/test-school/jobs" "/book/test-token" "/track/test-token" "/feedback/test-token" "/accept-invite/test-token"; do
  echo "GET $route"
  curl -s -o /dev/null -w "  status=%{http_code}\n" "http://localhost:3000$route" || echo "  no response"
done

kill $DEVPID 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 1
tail -20 /tmp/devsmoke3.log
```

Expected: every route responds (any code is fine; the public routes likely return 404 for invalid slugs/tokens, which is not a crash).

- [ ] **Step 7: Tag the milestone**

```bash
git tag ui-public-surfaces-migrated
git log --oneline -15
git tag --list "ui-*"
```

Expected three tags: `ui-foundation-primitives-shell`, `ui-internal-surfaces-migrated`, `ui-public-surfaces-migrated`.

---

## Plan complete

After Task 9, every public-facing surface uses the new design system. The codebase no longer has:
- Inline `bg-[#0071e3]` button colors in any surface (`AcceptInviteClient` fixed in Task 8)
- Native `<select>` in any application surface
- `rounded-apple bg-surface border ...` raw card patterns
- `shadow-elevation-low` / `shadow-elevation-medium` etc.
- Hardcoded `bg-[#fff2f0]` / `bg-[#fff9f0]` alert backgrounds
- `bg-green-50` / `bg-red-50` / `bg-amber-50` pill notices

The spec is fully realized.

---

## Open issues to surface to humans

1. **`SuggestedMatches` is an orphan component** (no imports). Either delete or wire up. Out of scope for this plan; flag for a future cleanup commit.

2. **Hero stats strip on careers home omitted.** The spec called out optional 4-stat strip (Students, Teachers, Years). The `schools` table doesn't expose those fields. The spec's "open extensions" section said to defer this until the schema supports it. The plan leaves the hero without the strip and the design holds together.

3. **No JobListings test added.** A test for filter behavior would be valuable but the component is dense with Convex data wiring (currently uses props, not hooks). A test would need to render with various `jobs` props. Worth adding as a future enhancement.

4. **Email/phone validation client-side.** The application form's "Please provide your name and either phone or email" is alert-style validation. A future enhancement could surface inline field-level errors instead. Out of scope.

5. **`AcceptInviteClient` server data path uses string `_id`s loosely.** Same as before. Touching that would be a Convex types pass, not a UI migration. Out of scope.
