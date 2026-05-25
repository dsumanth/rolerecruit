# Pipeline Redesign + Visual Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the pipeline view with list-first approach for scale, job status tabs, and inline expansion. First, establish a premium UI feel by creating reusable primitives and migrating to design tokens.

**Architecture:** Two-phase approach. Phase 1 establishes a `components/ui/` primitive library (Button, Input, Select, Badge, Card, Tabs, EmptyState, Skeleton) and migrates all hex color usage to Tailwind config tokens. Phase 2 builds the new pipeline on this foundation: job sidebar + status tabs, virtualized application table with inline expansion, and kanban as focus mode.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS 3, Convex, @hello-pangea/dnd, @tanstack/react-virtual

---

## Phase 1: Design System Foundation

### Task 1: Upgrade Tailwind Config with Design Tokens

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Add elevation, motion, and border-radius tokens**

Replace the `boxShadow` block and add `transitionDuration`, `transitionTimingFunction`, and default animation:

```ts
// tailwind.config.ts — replace boxShadow block and add new tokens
boxShadow: {
  "menu": "0 4px 24px rgba(0, 0, 0, 0.08)",        // keep existing
  "elevation-low": "0 1px 3px rgba(0, 0, 0, 0.04)",
  "elevation-medium": "0 4px 12px rgba(0, 0, 0, 0.06)",
  "elevation-high": "0 8px 30px rgba(0, 0, 0, 0.08)",
},
transitionDuration: {
  fast: "150ms",
  normal: "200ms",
  slow: "300ms",
},
transitionTimingFunction: {
  "apple-ease": "ease-out",
},
```

- [ ] **Step 2: Run build to verify config is valid**

```bash
bun run build
```

Expected: Build succeeds with no config errors.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: add elevation, motion, and border-radius design tokens"
```

---

### Task 2: Create ui/Button Primitive

**Files:**
- Create: `components/ui/button.tsx`

- [ ] **Step 1: Write the Button component**

```tsx
// components/ui/button.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover active:bg-accent-pressed",
  secondary:
    "bg-surface-secondary text-ink hover:bg-surface-tertiary active:bg-surface-tertiary",
  danger:
    "bg-red-50 text-danger hover:bg-red-100 active:bg-red-100",
  ghost:
    "text-ink-secondary hover:bg-surface-secondary hover:text-ink active:bg-surface-tertiary",
  outline:
    "border border-surface-tertiary text-ink hover:border-accent hover:text-accent active:bg-accent/5",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-apple font-medium transition-all duration-normal ease-apple-ease disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Run build to verify no import errors**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/ui/button.tsx
git commit -m "feat: add Button primitive with 5 variants and 3 sizes"
```

---

### Task 3: Create ui/Badge Primitive

**Files:**
- Create: `components/ui/badge.tsx`

- [ ] **Step 1: Write the Badge component**

```tsx
// components/ui/badge.tsx
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type BadgeVariant = "default" | "info" | "success" | "warning" | "danger";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-secondary text-ink-secondary",
  info: "bg-blue-50 text-accent",
  success: "bg-green-50 text-success",
  warning: "bg-amber-50 text-warning",
  danger: "bg-red-50 text-danger",
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Run build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/ui/badge.tsx
git commit -m "feat: add Badge primitive with 5 semantic variants"
```

---

### Task 4: Create ui/Card Primitive

**Files:**
- Create: `components/ui/card.tsx`

- [ ] **Step 1: Write the Card component**

```tsx
// components/ui/card.tsx
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
  className?: string;
}

const paddingClasses = {
  sm: "p-4",
  md: "p-5",
  lg: "p-8",
};

export function Card({
  children,
  hover = false,
  padding = "md",
  className,
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-apple bg-surface shadow-elevation-low transition-all duration-normal ease-apple-ease",
        hover && "hover:shadow-elevation-medium hover:border-accent/20",
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Run build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/ui/card.tsx
git commit -m "feat: add Card primitive with hover elevation and padding variants"
```

---

### Task 5: Create ui/Input, ui/Select, ui/Tabs Primitives

**Files:**
- Create: `components/ui/input.tsx`
- Create: `components/ui/select.tsx`
- Create: `components/ui/tabs.tsx`

- [ ] **Step 1: Write Input component**

```tsx
// components/ui/input.tsx
"use client";

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink placeholder:text-ink-tertiary transition-all duration-normal ease-apple-ease",
        "focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Write Select component**

```tsx
// components/ui/select.tsx
"use client";

import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes, ReactNode } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink appearance-none transition-all duration-normal ease-apple-ease",
        "focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
```

- [ ] **Step 3: Write Tabs component**

```tsx
// components/ui/tabs.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: readonly Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div className={cn("flex gap-1 border-b border-surface-tertiary", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
          className={cn(
            "text-xs font-medium px-3 py-2 border-b-2 transition-all duration-normal ease-apple-ease",
            activeTab === tab.key
              ? "border-accent text-accent"
              : "border-transparent text-ink-secondary hover:text-ink",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export type { Tab };
```

- [ ] **Step 4: Run build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/ui/input.tsx components/ui/select.tsx components/ui/tabs.tsx
git commit -m "feat: add Input, Select, and Tabs UI primitives"
```

---

### Task 6: Create ui/EmptyState and ui/Skeleton Primitives

**Files:**
- Create: `components/ui/empty-state.tsx`
- Create: `components/ui/skeleton.tsx`

- [ ] **Step 1: Write EmptyState component**

```tsx
// components/ui/empty-state.tsx
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-apple bg-surface shadow-elevation-low p-10 text-center",
        className,
      )}
    >
      {icon && (
        <div className="flex justify-center mb-4 text-ink-tertiary">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && (
        <p className="text-xs text-ink-secondary mt-1 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Write Skeleton component**

```tsx
// components/ui/skeleton.tsx
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-apple bg-surface-secondary",
        className,
      )}
    />
  );
}
```

- [ ] **Step 3: Run build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/ui/empty-state.tsx components/ui/skeleton.tsx
git commit -m "feat: add EmptyState and Skeleton UI primitives"
```

---

### Task 7: Migrate pipeline/application-drawer.tsx to Use UI Primitives

**Files:**
- Modify: `components/pipeline/application-drawer.tsx`

- [ ] **Step 1: Replace inline buttons with Button, inline tabs with Tabs, inline badges with Badge**

The key changes to `application-drawer.tsx`:

1. Import `Button` from `@/components/ui/button`, `Tabs` from `@/components/ui/tabs`, and `Badge` from `@/components/ui/badge`
2. Replace the `<select>` in EvaluateTab with `Select` from `@/components/ui/select`
3. Replace the inline tab buttons with `<Tabs>` component
4. Replace the "Request Evaluation" button with `<Button variant="primary" size="md" loading={sending}>`
5. Replace all `bg-[#...]` hex values with config tokens: `bg-surface` → `bg-surface`, `bg-[#f5f5f7]` → `bg-surface-secondary`, `text-[#86868b]` → `text-ink-secondary`, etc.
6. Replace `text-[#0071e3]` → `text-accent`, `text-[#34c759]` → `text-success`, `text-[#ff3b30]` → `text-danger`
7. Replace the close button `×` with a proper Button ghost

Keep all functionality identical. No behavioral changes.

- [ ] **Step 2: Run build to verify**

```bash
bun run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add components/pipeline/application-drawer.tsx
git commit -m "refactor: migrate application-drawer to UI primitives and design tokens"
```

---

### Task 8: Migrate Remaining Pipeline Components to Design Tokens

**Files:**
- Modify: `components/pipeline/kanban-board.tsx`
- Modify: `components/pipeline/candidate-card.tsx`
- Modify: `components/pipeline/evaluation-summary.tsx`

- [ ] **Step 1: Replace all hex colors in kanban-board.tsx with config tokens**

Find and replace:
- `bg-white` → `bg-surface`
- `bg-[#f5f5f7]` → `bg-surface-secondary`
- `border-[#e8e8ed]` → `border-surface-tertiary`
- `text-[#1d1d1f]` → `text-ink`
- `text-[#86868b]` → `text-ink-secondary`
- `border-[#0071e3]` → `border-accent`
- `bg-[#f0f7ff]` → `bg-accent/10`

- [ ] **Step 2: Replace all hex colors in candidate-card.tsx with config tokens**

- [ ] **Step 3: Replace all hex colors in evaluation-summary.tsx with config tokens**

- [ ] **Step 4: Run build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/pipeline/kanban-board.tsx components/pipeline/candidate-card.tsx components/pipeline/evaluation-summary.tsx
git commit -m "refactor: migrate pipeline components to Tailwind config tokens"
```

---

### Task 9: Migrate Dashboard Components to Design Tokens

**Files:**
- Modify: `components/dashboard/sidebar.tsx`
- Modify: `components/dashboard/stats-bar.tsx`
- Modify: `components/dashboard/role-cards.tsx`

- [ ] **Step 1: Replace all hex colors in sidebar.tsx with config tokens**

Use `bg-surface` for white backgrounds, `bg-surface-secondary` for hover states, `text-ink` for links, `text-ink-secondary` for muted text, `border-surface-tertiary` for borders.

- [ ] **Step 2: Replace all hex colors in stats-bar.tsx with config tokens**

- [ ] **Step 3: Replace all hex colors in role-cards.tsx with config tokens, use Badge primitive for status badges**

Replace inline status badges with `<Badge variant="success">Active</Badge>`, `<Badge variant="danger">Closed</Badge>`, etc.

- [ ] **Step 4: Run build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/sidebar.tsx components/dashboard/stats-bar.tsx components/dashboard/role-cards.tsx
git commit -m "refactor: migrate dashboard components to config tokens and Badge primitive"
```

---

### Task 10: Migrate Career Portal Components to Design Tokens

**Files:**
- Modify: `components/careers/JobCard.tsx`
- Modify: `components/careers/JobListings.tsx`
- Modify: `components/careers/SchoolHeader.tsx`
- Modify: `components/careers/ApplicationForm.tsx`

- [ ] **Step 1: Replace hex colors with config tokens in all 4 files**

Use `bg-surface`, `text-ink`, `text-ink-secondary`, `border-surface-tertiary`, `text-accent`, `bg-accent` consistently. Replace inline buttons with `<Button>`.

- [ ] **Step 2: Run build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/careers/JobCard.tsx components/careers/JobListings.tsx components/careers/SchoolHeader.tsx components/careers/ApplicationForm.tsx
git commit -m "refactor: migrate career portal components to config tokens and primitives"
```

---

### Task 11: Migrate Remaining Domain Components to Design Tokens

**Files:**
- Modify: `components/jobs/job-actions.tsx`
- Modify: `components/jobs/job-intake-form.tsx`
- Modify: `components/jobs/job-parsed-criteria.tsx`
- Modify: `components/auth/role-gate.tsx`
- Modify: `components/feedback/feedback-form.tsx`
- Modify: `components/sourcing/candidate-review-card.tsx`
- Modify: `components/outreach/message-composer.tsx`
- Modify: `components/outreach/demo-scheduler.tsx`
- Modify: `components/outreach/outreach-history.tsx`
- Modify: `components/tracking/ApplicationStatus.tsx`
- Modify: `components/dashboard/SuggestedMatches.tsx`
- Modify: `components/criteria/AISuggestedCriteria.tsx`
- Modify: `components/criteria/ScoringRuleEditor.tsx`

- [ ] **Step 1: Systematically replace hex colors and inline buttons/inputs/badges with primitives**

For each file:
- Replace `bg-[#ffffff]` / `bg-white` → `bg-surface`
- Replace `bg-[#f5f5f7]` → `bg-surface-secondary`  
- Replace `bg-[#e8e8ed]` → `bg-surface-tertiary`
- Replace `text-[#1d1d1f]` → `text-ink`
- Replace `text-[#86868b]` → `text-ink-secondary`
- Replace `text-[#aeaeb2]` → `text-ink-tertiary`
- Replace `text-[#0071e3]` / `bg-[#0071e3]` → `text-accent` / `bg-accent`
- Replace `border-[#e8e8ed]` → `border-surface-tertiary`
- Replace inline buttons with `<Button variant="..." size="...">`
- Replace inline inputs with `<Input>`
- Replace inline selects with `<Select>`
- Replace inline badges/chips with `<Badge>`

- [ ] **Step 2: Run build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/
git commit -m "refactor: migrate all remaining components to config tokens and UI primitives"
```

---

### Task 12: Run Full Test Suite — Verify No Regressions

**Files:**
- Test: `tests/` directory (run all tests)

- [ ] **Step 1: Install @tanstack/react-virtual (needed for Phase 2)**

```bash
bun add @tanstack/react-virtual
```

- [ ] **Step 2: Run typecheck**

```bash
bun run build
```

Expected: Build succeeds with zero errors.

- [ ] **Step 3: Run unit tests**

```bash
bun run test
```

Expected: All tests pass.

- [ ] **Step 4: Manual verification — run dev server and click through all pages**

```bash
bun run dev
```

Verify: Dashboard loads, sidebar looks correct, pipeline page loads, jobs page loads, talent page loads, settings page loads. No layout breaks, no missing colors, no text contrast issues.

- [ ] **Step 5: Stop dev server**

```bash
kill $(lsof -t -i:3000)
```

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: add @tanstack/react-virtual dependency, verify all tests pass"
```

---

## Phase 2: Pipeline Redesign

### Task 13: Create StatusTabs Component

**Files:**
- Create: `components/pipeline/status-tabs.tsx`

- [ ] **Step 1: Write StatusTabs component**

```tsx
// components/pipeline/status-tabs.tsx
"use client";

import { cn } from "@/lib/utils";

type JobStatus = "active" | "paused" | "filled" | "closed" | "draft";

interface StatusTab {
  key: JobStatus;
  label: string;
  count: number;
}

interface StatusTabsProps {
  tabs: StatusTab[];
  activeStatus: JobStatus;
  onStatusChange: (status: JobStatus) => void;
}

export function StatusTabs({ tabs, activeStatus, onStatusChange }: StatusTabsProps) {
  return (
    <div className="flex gap-1 border-b border-surface-tertiary">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onStatusChange(tab.key)}
          className={cn(
            "relative px-4 py-2.5 text-sm font-medium transition-all duration-normal ease-apple-ease",
            activeStatus === tab.key
              ? "text-accent"
              : "text-ink-secondary hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count > 0 && (
            <span
              className={cn(
                "ml-1.5 text-xs tabular-nums px-1.5 py-0.5 rounded-full",
                activeStatus === tab.key
                  ? "bg-accent/10 text-accent"
                  : "bg-surface-secondary text-ink-tertiary",
              )}
            >
              {tab.count}
            </span>
          )}
          {activeStatus === tab.key && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}

export type { JobStatus, StatusTab };
```

- [ ] **Step 2: Run build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/pipeline/status-tabs.tsx
git commit -m "feat: add StatusTabs component for job status filtering"
```

---

### Task 14: Create JobSidebar Component

**Files:**
- Create: `components/pipeline/job-sidebar.tsx`

- [ ] **Step 1: Write JobSidebar component**

```tsx
// components/pipeline/job-sidebar.tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface Job {
  _id: string;
  title: string;
  subject: string;
  level: string;
  status: string;
}

interface JobSidebarProps {
  jobs: Job[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  applicationCounts: Record<string, number>;
}

export function JobSidebar({
  jobs,
  selectedJobId,
  onSelectJob,
  applicationCounts,
}: JobSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = jobs.filter((j) =>
    j.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <aside
      className={cn(
        "shrink-0 border-r border-surface-tertiary bg-surface transition-all duration-slow ease-apple-ease flex flex-col",
        collapsed ? "w-12" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex items-center border-b border-surface-tertiary",
          collapsed ? "justify-center py-4" : "px-4 py-3 justify-between",
        )}
      >
        {!collapsed && (
          <span className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">
            Jobs
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-ink-tertiary hover:text-ink transition-colors duration-normal p-1 rounded-apple hover:bg-surface-secondary"
        >
          {collapsed ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 py-2">
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs py-1.5"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && !collapsed && (
          <div className="px-4 py-8 text-center text-xs text-ink-tertiary">
            {search ? "No jobs match your search" : "No jobs"}
          </div>
        )}
        {filtered.map((job) =>
          collapsed ? (
            <button
              key={job._id}
              onClick={() => onSelectJob(job._id)}
              className={cn(
                "w-full p-3 flex justify-center transition-colors duration-normal",
                selectedJobId === job._id
                  ? "text-accent bg-accent/5 border-r-2 border-accent"
                  : "text-ink-tertiary hover:text-ink hover:bg-surface-secondary",
              )}
              title={`${job.title} (${applicationCounts[job._id] ?? 0})`}
            >
              <span className="text-xs font-semibold tabular-nums">
                {applicationCounts[job._id] ?? 0}
              </span>
            </button>
          ) : (
            <button
              key={job._id}
              onClick={() => onSelectJob(job._id)}
              className={cn(
                "w-full text-left px-4 py-2.5 transition-colors duration-normal flex items-center justify-between",
                selectedJobId === job._id
                  ? "bg-accent/5 border-r-2 border-accent"
                  : "hover:bg-surface-secondary",
              )}
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm truncate",
                    selectedJobId === job._id
                      ? "font-medium text-accent"
                      : "text-ink",
                  )}
                >
                  {job.title}
                </p>
                <p className="text-xs text-ink-tertiary mt-0.5 truncate">
                  {job.subject} · {job.level}
                </p>
              </div>
              {(applicationCounts[job._id] ?? 0) > 0 && (
                <span className="text-xs tabular-nums text-ink-tertiary ml-2 shrink-0">
                  {applicationCounts[job._id]}
                </span>
              )}
            </button>
          ),
        )}
      </div>
    </aside>
  );
}

export type { Job };
```

- [ ] **Step 2: Run build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/pipeline/job-sidebar.tsx
git commit -m "feat: add collapsible JobSidebar with search and application counts"
```

---

### Task 15: Create InlineExpansion Component

**Files:**
- Create: `components/pipeline/inline-expansion.tsx`

- [ ] **Step 1: Write InlineExpansion — reusable inline tabbed detail panel**

```tsx
// components/pipeline/inline-expansion.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { MessageComposer } from "@/components/outreach/message-composer";
import { DemoScheduler } from "@/components/outreach/demo-scheduler";
import { useState } from "react";

const STAGE_LABELS: Record<string, string> = {
  sourced: "Sourced",
  screened: "Screened",
  demo_scheduled: "Demo Scheduled",
  demo_completed: "Demo Completed",
  offer_sent: "Offer Sent",
  hired: "Hired",
  rejected: "Rejected",
};

interface Application {
  _id: string;
  candidateId: string;
  stage: string;
  aiMatchScore?: number;
  candidate?: {
    _id: string;
    name: string;
    phone?: string;
    email?: string;
    location?: string;
    qualifications: string[];
    certifications: string[];
    boardExperience: string[];
    subjects: string[];
    yearsExperience?: number;
    currentSchool?: string;
    resumeUrl?: string;
  } | null;
}

interface InlineExpansionProps {
  app: Application;
}

export function InlineExpansion({ app }: InlineExpansionProps) {
  const [tab, setTab] = useState("info");

  const candidate = useQuery(api.candidates.get, {
    candidateId: app.candidateId as any,
  });

  const candidateName = candidate?.name ?? app.candidate?.name ?? "Candidate";
  const candidatePhone = candidate?.phone ?? app.candidate?.phone ?? "";

  return (
    <div className="border-t border-surface-tertiary bg-surface-secondary/50 px-6 py-4">
      <Tabs
        tabs={[
          { key: "info", label: "Info" },
          { key: "outreach", label: "Outreach" },
          { key: "demo", label: "Demo" },
          { key: "evaluate", label: "Evaluate" },
        ]}
        activeTab={tab}
        onTabChange={setTab}
      />

      <div className="mt-4">
        {tab === "info" && <InfoTabContent app={app} candidate={candidate} />}
        {tab === "outreach" && (
          <MessageComposer
            applicationId={app._id}
            candidateId={app.candidateId}
            candidateName={candidateName}
            candidatePhone={candidatePhone}
          />
        )}
        {tab === "demo" && (
          <DemoScheduler
            applicationId={app._id}
            candidateId={app.candidateId}
            candidateName={candidateName}
            candidatePhone={candidatePhone}
          />
        )}
        {tab === "evaluate" && <EvaluateTabContent applicationId={app._id} />}
      </div>
    </div>
  );
}

function InfoTabContent({
  app,
  candidate,
}: {
  app: Application;
  candidate: any;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-ink-tertiary mb-0.5">Stage</p>
        <p className="text-sm text-ink">{STAGE_LABELS[app.stage]}</p>
      </div>

      {app.aiMatchScore != null && (
        <div>
          <p className="text-xs text-ink-tertiary mb-0.5">AI Match Score</p>
          <span className="text-sm font-medium text-ink tabular-nums">
            {app.aiMatchScore}%
          </span>
        </div>
      )}

      {candidate?.location && (
        <div>
          <p className="text-xs text-ink-tertiary mb-0.5">Location</p>
          <p className="text-sm text-ink">{candidate.location}</p>
        </div>
      )}

      {candidate?.phone && (
        <div>
          <p className="text-xs text-ink-tertiary mb-0.5">Phone</p>
          <p className="text-sm text-ink">{candidate.phone}</p>
        </div>
      )}

      {candidate?.email && (
        <div>
          <p className="text-xs text-ink-tertiary mb-0.5">Email</p>
          <p className="text-sm text-accent">{candidate.email}</p>
        </div>
      )}

      {candidate?.currentSchool && (
        <div>
          <p className="text-xs text-ink-tertiary mb-0.5">Current School</p>
          <p className="text-sm text-ink">{candidate.currentSchool}</p>
        </div>
      )}

      {candidate?.yearsExperience != null && (
        <div>
          <p className="text-xs text-ink-tertiary mb-0.5">Experience</p>
          <p className="text-sm text-ink">{candidate.yearsExperience} years</p>
        </div>
      )}

      {candidate?.subjects && candidate.subjects.length > 0 && (
        <div className="col-span-2">
          <p className="text-xs text-ink-tertiary mb-1">Subjects</p>
          <div className="flex flex-wrap gap-1">
            {candidate.subjects.map((s: string) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        </div>
      )}

      {candidate?.qualifications && candidate.qualifications.length > 0 && (
        <div className="col-span-2">
          <p className="text-xs text-ink-tertiary mb-1">Qualifications</p>
          <div className="flex flex-wrap gap-1">
            {candidate.qualifications.map((q: string) => (
              <Badge key={q}>{q}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EvaluateTabContent({ applicationId }: { applicationId: string }) {
  const createEval = useMutation(api.evaluations.create);
  const [evaluatorRole, setEvaluatorRole] = useState<string>("principal");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [token, setToken] = useState("");

  const handleRequest = async () => {
    setSending(true);
    setResult(null);
    try {
      const evalResult = await createEval({
        applicationId: applicationId as any,
        evaluatorRole: evaluatorRole as "principal" | "hod" | "hr_admin",
      });
      setToken((evalResult as any).token ?? "");
      setResult("success");
    } catch {
      setResult("error");
    } finally {
      setSending(false);
    }
  };

  const feedbackUrl = token ? `/feedback/${token}` : "";

  return (
    <div className="space-y-4 max-w-md">
      <p className="text-sm text-ink-secondary">
        Request a demo lesson evaluation from a team member.
      </p>

      <div>
        <label className="block text-xs text-ink-secondary mb-1">Evaluator Role</label>
        <Select value={evaluatorRole} onChange={(e) => setEvaluatorRole(e.target.value)}>
          <option value="principal">Principal</option>
          <option value="hod">HOD</option>
          <option value="hr_admin">HR Admin</option>
        </Select>
      </div>

      {result === "success" && (
        <div className="px-3 py-2 rounded-apple bg-green-50 text-sm text-success">
          Evaluation request created. Share this link:
          <br />
          <code className="text-xs text-ink break-all">{feedbackUrl}</code>
        </div>
      )}
      {result === "error" && (
        <div className="px-3 py-2 rounded-apple bg-red-50 text-sm text-danger">
          Failed to create evaluation request.
        </div>
      )}

      <Button
        variant="primary"
        size="md"
        loading={sending}
        onClick={handleRequest}
        className="w-full"
      >
        Request Evaluation
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Run build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/pipeline/inline-expansion.tsx
git commit -m "feat: add InlineExpansion with Info/Outreach/Demo/Evaluate tabs"
```

---

### Task 16: Create ApplicationTable with Virtualization

**Files:**
- Create: `components/pipeline/application-table.tsx`

- [ ] **Step 1: Write ApplicationTable — virtualized, sortable, filterable table with inline expansion**

```tsx
// components/pipeline/application-table.tsx
"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { InlineExpansion } from "@/components/pipeline/inline-expansion";

interface Application {
  _id: string;
  candidateId: string;
  stage: string;
  aiMatchScore?: number;
  candidate?: {
    _id: string;
    name: string;
    location?: string;
    subjects: string[];
    yearsExperience?: number;
  } | null;
}

interface ApplicationTableProps {
  applications: Application[];
  sortBy: "newest" | "score" | "name";
  onSortChange: (sort: "newest" | "score" | "name") => void;
}

const STAGE_LABELS: Record<string, string> = {
  sourced: "Sourced",
  screened: "Screened",
  demo_scheduled: "Demo Scheduled",
  demo_completed: "Demo Completed",
  offer_sent: "Offer Sent",
  hired: "Hired",
  rejected: "Rejected",
};

function matchScoreVariant(score: number) {
  if (score >= 80) return "success" as const;
  if (score >= 50) return "warning" as const;
  return "default" as const;
}

export function ApplicationTable({
  applications,
  sortBy,
  onSortChange,
}: ApplicationTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => {
    const apps = [...applications];
    switch (sortBy) {
      case "score":
        return apps.sort((a, b) => (b.aiMatchScore ?? 0) - (a.aiMatchScore ?? 0));
      case "name":
        return apps.sort((a, b) =>
          (a.candidate?.name ?? "").localeCompare(b.candidate?.name ?? ""),
        );
      case "newest":
      default:
        return apps;
    }
  }, [applications, sortBy]);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(
      (index: number) => (sorted[index]._id === expandedId ? 320 : 48),
      [sorted, expandedId],
    ),
    overscan: 5,
  });

  return (
    <div className="rounded-apple bg-surface shadow-elevation-low overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-[1fr_80px_140px_1fr_80px_120px] gap-4 px-5 py-2.5 border-b border-surface-tertiary bg-surface-secondary/50 text-xs font-medium text-ink-secondary uppercase tracking-wider">
        <button
          onClick={() => onSortChange("name")}
          className={cn("text-left hover:text-ink transition-colors", sortBy === "name" && "text-accent")}
        >
          Candidate
        </button>
        <button
          onClick={() => onSortChange("score")}
          className={cn("text-center hover:text-ink transition-colors", sortBy === "score" && "text-accent")}
        >
          Score
        </button>
        <span>Stage</span>
        <span>Subjects</span>
        <span>Experience</span>
        <span>Location</span>
      </div>

      {/* Virtualized Rows */}
      <div ref={parentRef} className="max-h-[calc(100vh-320px)] overflow-y-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const app = sorted[virtualItem.index];
            const isExpanded = expandedId === app._id;

            return (
              <div
                key={app._id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : app._id)
                  }
                  className={cn(
                    "w-full grid grid-cols-[1fr_80px_140px_1fr_80px_120px] gap-4 px-5 py-3 text-sm text-left border-b border-surface-tertiary transition-colors duration-normal hover:bg-surface-secondary/50",
                    isExpanded && "bg-accent/5 border-l-2 border-l-accent",
                  )}
                >
                  <div>
                    <p className="font-medium text-ink">
                      {app.candidate?.name ?? "Unknown"}
                    </p>
                  </div>
                  <div className="text-center">
                    {app.aiMatchScore != null && (
                      <Badge variant={matchScoreVariant(app.aiMatchScore)}>
                        {app.aiMatchScore}%
                      </Badge>
                    )}
                  </div>
                  <div>
                    <Badge variant="default">
                      {STAGE_LABELS[app.stage] ?? app.stage}
                    </Badge>
                  </div>
                  <div className="text-ink-secondary truncate">
                    {app.candidate?.subjects?.join(", ")}
                  </div>
                  <div className="text-ink-secondary tabular-nums">
                    {app.candidate?.yearsExperience != null
                      ? `${app.candidate.yearsExperience}y`
                      : "—"}
                  </div>
                  <div className="text-ink-secondary truncate">
                    {app.candidate?.location ?? "—"}
                  </div>
                </button>

                {isExpanded && <InlineExpansion app={app} />}
              </div>
            );
          })}
        </div>
      </div>

      {sorted.length === 0 && (
        <div className="py-12 text-center text-sm text-ink-secondary">
          No applications match your filters
        </div>
      )}
    </div>
  );
}

export type { Application };
```

- [ ] **Step 2: Run build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/pipeline/application-table.tsx
git commit -m "feat: add virtualized ApplicationTable with inline expansion"
```

---

### Task 17: Create Pipeline Controls (Search, Stage Filters, Sort, View Toggle)

**Files:**
- Create: `components/pipeline/pipeline-controls.tsx`

- [ ] **Step 1: Write PipelineControls — search bar, stage filter pills, sort dropdown, list/kanban toggle**

```tsx
// components/pipeline/pipeline-controls.tsx
"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const PIPELINE_STAGES = [
  "sourced",
  "screened",
  "demo_scheduled",
  "demo_completed",
  "offer_sent",
  "hired",
] as const;

const STAGE_LABELS: Record<string, string> = {
  sourced: "Sourced",
  screened: "Screened",
  demo_scheduled: "Demo Scheduled",
  demo_completed: "Demo Completed",
  offer_sent: "Offer Sent",
  hired: "Hired",
};

type ViewMode = "list" | "kanban";
type SortMode = "newest" | "score" | "name";

interface PipelineControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedStages: string[];
  onStagesChange: (stages: string[]) => void;
  stageCounts: Record<string, number>;
  totalCount: number;
  filteredCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: SortMode;
  onSortChange: (sort: SortMode) => void;
  kanbanDisabled: boolean;
}

export function PipelineControls({
  searchQuery,
  onSearchChange,
  selectedStages,
  onStagesChange,
  stageCounts,
  totalCount,
  filteredCount,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  kanbanDisabled,
}: PipelineControlsProps) {
  const toggleStage = (stage: string) => {
    if (selectedStages.includes(stage)) {
      onStagesChange(selectedStages.filter((s) => s !== stage));
    } else {
      onStagesChange([...selectedStages, stage]);
    }
  };

  const allSelected = selectedStages.length === 0;

  return (
    <div className="space-y-3">
      {/* Top row: search + view toggle + sort */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-tertiary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            placeholder="Search candidates..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* View Toggle */}
        <div className="flex bg-surface-secondary rounded-apple p-0.5">
          <button
            onClick={() => onViewModeChange("list")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-[7px] transition-all duration-normal",
              viewMode === "list"
                ? "bg-surface text-ink shadow-elevation-low"
                : "text-ink-secondary hover:text-ink",
            )}
          >
            List
          </button>
          <button
            onClick={() => !kanbanDisabled && onViewModeChange("kanban")}
            disabled={kanbanDisabled}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-[7px] transition-all duration-normal",
              viewMode === "kanban"
                ? "bg-surface text-ink shadow-elevation-low"
                : "text-ink-secondary hover:text-ink",
              kanbanDisabled && "opacity-40 cursor-not-allowed",
            )}
            title={kanbanDisabled ? "Filter to 50 or fewer applications to use Kanban view" : undefined}
          >
            Kanban
          </button>
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortMode)}
          className="text-xs px-3 py-1.5 rounded-apple bg-surface border border-surface-tertiary text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent appearance-none"
        >
          <option value="newest">Newest</option>
          <option value="score">Highest Score</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>

      {/* Stage filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => onStagesChange([])}
          className={cn(
            "text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-normal",
            allSelected
              ? "bg-accent text-white"
              : "bg-surface-secondary text-ink-secondary hover:bg-surface-tertiary",
          )}
        >
          All
          <span className="ml-1 tabular-nums opacity-70">{totalCount}</span>
        </button>
        {PIPELINE_STAGES.map((stage) => (
          <button
            key={stage}
            onClick={() => toggleStage(stage)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-normal",
              selectedStages.includes(stage)
                ? "bg-accent text-white"
                : "bg-surface-secondary text-ink-secondary hover:bg-surface-tertiary",
            )}
          >
            {STAGE_LABELS[stage]}
            <span className="ml-1 tabular-nums opacity-70">
              {stageCounts[stage] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Row count */}
      <p className="text-xs text-ink-tertiary tabular-nums">
        {filteredCount === totalCount
          ? `${totalCount} application${totalCount !== 1 ? "s" : ""}`
          : `Showing ${filteredCount} of ${totalCount} applications`}
      </p>
    </div>
  );
}

export type { ViewMode, SortMode };
```

- [ ] **Step 2: Run build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/pipeline/pipeline-controls.tsx
git commit -m "feat: add PipelineControls with search, stage filters, sort, and view toggle"
```

---

### Task 18: Rewrite PipelineList to Use New Components

**Files:**
- Modify: `app/dashboard/pipeline/pipeline-list.tsx`
- Modify: `app/dashboard/pipeline/page.tsx`

- [ ] **Step 1: Rewrite pipeline-list.tsx**

```tsx
// app/dashboard/pipeline/pipeline-list.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatusTabs } from "@/components/pipeline/status-tabs";
import { JobSidebar } from "@/components/pipeline/job-sidebar";
import { PipelineControls } from "@/components/pipeline/pipeline-controls";
import { ApplicationTable } from "@/components/pipeline/application-table";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { EmptyState } from "@/components/ui/empty-state";
import type { ViewMode, SortMode } from "@/components/pipeline/pipeline-controls";
import type { JobStatus } from "@/components/pipeline/status-tabs";

export function PipelineList({ schoolId }: { schoolId: any }) {
  const [activeStatus, setActiveStatus] = useState<JobStatus>("active");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<SortMode>("newest");

  const moveStage = useMutation(api.applications.moveStage);

  const allJobs = useQuery(api.jobs.listBySchool, { schoolId }) || [];

  const pipeline = useQuery(
    api.applications.getPipelineForJob,
    selectedJobId ? { jobId: selectedJobId as any } : "skip",
  );

  // Compute status tab counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { active: 0, paused: 0, filled: 0, closed: 0, draft: 0 };
    allJobs.forEach((j: any) => {
      if (counts[j.status] !== undefined) counts[j.status]++;
    });
    return counts;
  }, [allJobs]);

  // Filter jobs by selected status
  const filteredJobs = useMemo(
    () => allJobs.filter((j: any) => j.status === activeStatus),
    [allJobs, activeStatus],
  );

  // Compute application counts per job
  const appCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredJobs.forEach((j: any) => {
      counts[j._id] = 0; // Will be populated lazily; could batch query later
    });
    return counts;
  }, [filteredJobs]);

  // Flatten pipeline into array
  const allApps = useMemo(() => {
    if (!pipeline) return [];
    return Object.values(pipeline).flat() as any[];
  }, [pipeline]);

  // Client-side filtering
  const filteredApps = useMemo(() => {
    let apps = allApps;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      apps = apps.filter(
        (app: any) =>
          (app.candidate?.name ?? "").toLowerCase().includes(q) ||
          (app.candidate?.location ?? "").toLowerCase().includes(q) ||
          (app.candidate?.subjects ?? []).some((s: string) =>
            s.toLowerCase().includes(q),
          ),
      );
    }

    if (selectedStages.length > 0) {
      apps = apps.filter((app: any) => selectedStages.includes(app.stage));
    }

    return apps;
  }, [allApps, searchQuery, selectedStages]);

  // Stage counts for filter pills
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allApps.forEach((app: any) => {
      counts[app.stage] = (counts[app.stage] || 0) + 1;
    });
    return counts;
  }, [allApps]);

  const kanbanDisabled = filteredApps.length > 50;

  const statusTabs = [
    { key: "active" as const, label: "Active", count: statusCounts.active },
    { key: "paused" as const, label: "Paused", count: statusCounts.paused },
    { key: "filled" as const, label: "Filled", count: statusCounts.filled },
    { key: "closed" as const, label: "Closed", count: statusCounts.closed },
    { key: "draft" as const, label: "Drafts", count: statusCounts.draft },
  ];

  const selectedJob = filteredJobs.find((j: any) => j._id === selectedJobId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Status Tabs */}
      <div className="px-6 pt-4">
        <StatusTabs
          tabs={statusTabs}
          activeStatus={activeStatus}
          onStatusChange={(status) => {
            setActiveStatus(status);
            setSelectedJobId(null);
          }}
        />
      </div>

      {/* Body: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        <JobSidebar
          jobs={filteredJobs}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
          applicationCounts={appCounts}
        />

        <main className="flex-1 overflow-y-auto p-6">
          {!selectedJobId ? (
            <EmptyState
              title="Select a job to view its pipeline"
              description="Choose a job from the sidebar to see all applications and manage your hiring pipeline."
            />
          ) : !pipeline ? (
            <div className="rounded-apple bg-surface shadow-elevation-low p-10 text-center">
              <p className="text-sm text-ink-secondary">Loading pipeline...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Job header */}
              <div>
                <h1 className="text-xl font-bold tracking-tight text-ink">
                  {selectedJob?.title}
                </h1>
                <p className="text-sm text-ink-secondary mt-0.5">
                  {selectedJob?.subject} · {selectedJob?.level}
                </p>
              </div>

              {/* Controls */}
              <PipelineControls
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedStages={selectedStages}
                onStagesChange={setSelectedStages}
                stageCounts={stageCounts}
                totalCount={allApps.length}
                filteredCount={filteredApps.length}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                sortBy={sortBy}
                onSortChange={setSortBy}
                kanbanDisabled={kanbanDisabled}
              />

              {/* Content: List or Kanban */}
              {viewMode === "list" ? (
                <ApplicationTable
                  applications={filteredApps}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                />
              ) : (
                <KanbanBoard
                  pipeline={pipeline}
                  onMove={(applicationId, newStage) => {
                    moveStage({ applicationId: applicationId as any, newStage: newStage as any });
                  }}
                  onSelectApplication={() => {}}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update page.tsx if needed**

The page.tsx is already correct — it just renders PipelineList with schoolId. No changes needed unless the prop interface changed (it hasn't).

- [ ] **Step 3: Run build**

```bash
bun run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/pipeline/pipeline-list.tsx
git commit -m "refactor: rewrite PipelineList with status tabs, sidebar, controls, and list view"
```

---

### Task 19: Update KanbanBoard for Inline Expansion and Proportional Widths

**Files:**
- Modify: `components/pipeline/kanban-board.tsx`

- [ ] **Step 1: Rewrite KanbanBoard with proportional columns, richer cards, inline expansion**

```tsx
// components/pipeline/kanban-board.tsx
"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { InlineExpansion } from "@/components/pipeline/inline-expansion";
import { EvaluationSummary } from "@/components/pipeline/evaluation-summary";

const STAGE_LABELS: Record<string, string> = {
  sourced: "Sourced",
  screened: "Screened",
  demo_scheduled: "Demo Scheduled",
  demo_completed: "Demo Completed",
  offer_sent: "Offer Sent",
  hired: "Hired",
};

interface Candidate {
  _id: string;
  name: string;
  location?: string;
  qualifications: string[];
  subjects: string[];
}

interface Application {
  _id: string;
  candidateId: string;
  stage: string;
  aiMatchScore?: number;
  candidate?: Candidate | null;
}

interface KanbanBoardProps {
  pipeline: Record<string, Application[]>;
  onMove: (applicationId: string, newStage: string) => void;
  onSelectApplication: (app: Application) => void;
}

function matchScoreVariant(score: number) {
  if (score >= 80) return "success" as const;
  if (score >= 50) return "warning" as const;
  return "default" as const;
}

const stages = [
  "sourced",
  "screened",
  "demo_scheduled",
  "demo_completed",
  "offer_sent",
  "hired",
];

export function KanbanBoard({ pipeline, onMove, onSelectApplication }: KanbanBoardProps) {
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    onMove(draggableId, destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[400px]">
        {stages.map((stage) => (
          <Droppable key={stage} droppableId={stage}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "flex flex-col flex-1 min-w-0 rounded-apple bg-surface shadow-elevation-low transition-all duration-normal",
                  snapshot.isDraggingOver && "ring-2 ring-accent/20 bg-accent/5",
                )}
              >
                <div className="px-4 py-3 border-b border-surface-tertiary">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink uppercase tracking-wide">
                      {STAGE_LABELS[stage]}
                    </span>
                    <span className="text-xs text-ink-secondary tabular-nums">
                      {(pipeline[stage] || []).length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {(pipeline[stage] || []).map((app, index) => (
                    <div key={app._id}>
                      <Draggable draggableId={app._id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedAppId(
                                  expandedAppId === app._id ? null : app._id,
                                );
                                onSelectApplication(app);
                              }}
                              className={cn(
                                "w-full text-left p-3 rounded-apple bg-surface-secondary transition-shadow duration-normal",
                                snapshot.isDragging && "shadow-elevation-medium rotate-1 bg-surface",
                                expandedAppId === app._id && "ring-1 ring-accent/30",
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-ink">
                                  {app.candidate?.name ?? "Unknown"}
                                </p>
                                {app.aiMatchScore != null && (
                                  <Badge variant={matchScoreVariant(app.aiMatchScore)}>
                                    {app.aiMatchScore}%
                                  </Badge>
                                )}
                              </div>
                              {app.candidate?.location && (
                                <p className="text-xs text-ink-tertiary mt-0.5">
                                  {app.candidate.location}
                                </p>
                              )}
                              {app.candidate?.subjects && app.candidate.subjects.length > 0 && (
                                <p className="text-xs text-ink-tertiary mt-0.5 truncate">
                                  {app.candidate.subjects.join(", ")}
                                </p>
                              )}
                            </button>
                          </div>
                        )}
                      </Draggable>

                      {expandedAppId === app._id && (
                        <div className="mt-2 rounded-apple bg-surface-secondary overflow-hidden">
                          <InlineExpansion app={app as any} />
                        </div>
                      )}

                      {(stage === "demo_completed" ||
                        stage === "offer_sent" ||
                        stage === "hired") && (
                        <EvaluationSummary applicationId={app._id} />
                      )}
                    </div>
                  ))}
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
```

- [ ] **Step 2: Run build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/pipeline/kanban-board.tsx
git commit -m "refactor: update KanbanBoard with proportional widths, inline expansion, and design tokens"
```

---

### Task 20: Verify Full Pipeline Works End-to-End

**Files:**
- Test: manual verification

- [ ] **Step 1: Run dev server**

```bash
bun run dev
```

- [ ] **Step 2: Manual test checklist**

- [ ] Dashboard loads with sidebar using new tokens (no visual regressions)
- [ ] Pipeline page shows status tabs (Active, Paused, Filled, Closed, Drafts)
- [ ] Switching status tabs filters the job sidebar correctly
- [ ] Job sidebar shows jobs, search filters by title, collapse/expand works
- [ ] Selecting a job loads its pipeline in list view
- [ ] Stage filter pills work — clicking filters to that stage, "All" resets
- [ ] Search filters by name/subject/location
- [ ] Sort changes order (score, name)
- [ ] View toggle switches between list and kanban
- [ ] Kanban is disabled when > 50 filtered apps
- [ ] Clicking a row in list view expands inline with Info/Outreach/Demo/Evaluate tabs
- [ ] Expanding a new row collapses the previous one
- [ ] Inline expansion tabs switch correctly
- [ ] Drag-and-drop in kanban works and updates stage
- [ ] Inline expansion in kanban works (click card → expand below)
- [ ] Evaluation summary shows in kanban for demo_completed/offer_sent/hired
- [ ] Empty states show correctly (no job selected, no applications)
- [ ] All other pages (jobs, talent, settings, team) still look correct with new tokens

- [ ] **Step 3: Stop dev server**

```bash
kill $(lsof -t -i:3000)
```

- [ ] **Step 4: Run full test suite**

```bash
bun run test
bun run build
```

Expected: All tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: complete pipeline redesign with visual polish — list view, status tabs, sidebar, inline expansion"
```
