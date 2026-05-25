# UI polish redesign

**Date:** 2026-05-25
**Owner:** Sumanth
**Status:** Approved (brainstorm phase)
**Brainstorm mockups:** `.superpowers/brainstorm/61364-1779717177/content/`

## Goals

Take Rolerecruit from "raw foundation" to "premium Apple-esque product" across every screen. The current codebase has the right tokens scaffolded (Apple ink/surface palette, SF Pro stack, basic primitives) but execution is uneven: inline hardcoded colors, missing primitives, no real depth or atmosphere, no icons in nav, no dark mode.

This spec is a full redesign of the visual language and a redesign pass of every route. The "soul" we preserve: Apple-esque restraint, generous whitespace, SF Pro typography, content-first hierarchy. The "premium" we add: atmospheric canvas, translucent chrome, a refined type scale, motion vocabulary, dark mode, a real icon system, and a cinematic public marketing surface.

## Decisions (locked during brainstorm)

| Decision | Choice | Reasoning |
| --- | --- | --- |
| Ambition level | Reimagine (Level 03) | Every surface gets a custom polish pass. Foundation + chrome + every screen + dark + marketing. |
| Visual dialect | Modern (Sonoma / Vision Pro) | Translucent surfaces, atmospheric canvas, hero gradients. More expressive than "Quiet Apple", more polished than "Structured SaaS". |
| Dark mode | In scope, designed together | Modern dialect was built for dark. Tokens are dark-aware from day one. |
| Command palette (⌘K) | Deferred | Out of scope for this pass; can be added later. |
| Public careers treatment | Marketing-tier (Apple.com style) | Distinct cinematic visual language for candidate-facing surfaces. Same DNA, more voltage. |
| Icon system | Lucide | Closest visual cousin to SF Symbols. MIT, wide coverage, mature React bindings. |
| Execution shape | Foundation first, then propagate | Phase 1 tokens, Phase 2 primitives, Phase 3 shell, Phase 4 internal, Phase 5 marketing, Phase 6 utility. Each ships independently. |

## Non-goals

* Adding new product features. We redesign what exists. Where I show subtitle copy that requires data the queries don't return (e.g., "2 closing this month"), that's flagged as a small extension, not a blocker.
* Custom icon set. Lucide is the answer. SF Symbols-style hand-rolled icons are deferred.
* Photography assets. Marketing hero uses gradient atmosphere; no stock photos are introduced.
* Full WCAG audit. Primitives are accessible-by-default; a dedicated a11y audit is a follow-up.
* Bundle / performance reengineering. The redesign respects existing bundle structure; we don't refactor data layer.
* Backward compatibility shims for old class names. We move forward and delete the old.

## Design language

### Atmosphere (the canvas)

Pages sit on a radial-gradient atmosphere, not flat color. This is the move that makes the product feel "Modern Apple" rather than generic SaaS.

**Light canvas:**
```css
background:
  radial-gradient(circle at 8% -5%, rgba(91,124,255,0.10) 0%, transparent 45%),
  radial-gradient(circle at 95% 100%, rgba(255,159,10,0.06) 0%, transparent 45%),
  #f0f1f7;
```

**Dark canvas:**
```css
background:
  radial-gradient(circle at 8% -5%, rgba(91,124,255,0.20) 0%, transparent 45%),
  radial-gradient(circle at 95% 100%, rgba(168,85,247,0.14) 0%, transparent 45%),
  #0a0a14;
```

**Marketing canvas** (public careers only) is off-white `#fafafa` with a separate, stronger hero atmosphere applied only at the top of each page. See `Marketing hero atmosphere` below.

The canvas is applied to `<body>` (or a high-level `<div>` wrapper) and never to content cards. Content cards are honest opaque surfaces over the atmosphere.

### Surfaces

Surfaces split into three categories. Every component picks one.

| Category | Use | Light | Dark |
| --- | --- | --- | --- |
| `chrome` | Sidebar, topbars, persistent navigation | `rgba(255,255,255,0.65)` + `backdrop-filter: blur(24px)` + 1px `rgba(255,255,255,0.7)` border | `rgba(20,20,28,0.6)` + same blur + 1px `rgba(255,255,255,0.06)` border |
| `floating` | Dropdowns, popovers, hovering context panels | `rgba(255,255,255,0.8)` + blur(20px) + 1px `rgba(255,255,255,0.7)` border | `rgba(28,28,38,0.7)` + same blur + 1px `rgba(255,255,255,0.06)` border |
| `card` | Tables, role cards, drawers, dialogs, stats, settings groups | `#ffffff` + 1px `rgba(0,0,0,0.06)` hairline + `elev-1` shadow | `#1a1a24` + 1px `rgba(255,255,255,0.06)` hairline + `elev-1` shadow |

**Rule:** any data-dense surface (tables, drawers, dialogs) uses `card`. Translucency is for chrome and floating UI only. This is non-negotiable for legibility.

### Palette

```ts
// tailwind.config.ts color tokens (CSS-variable-driven for theme switching)

// Ink (text)
--ink-1: light #0f0f12  dark #f5f5f7
--ink-2: light #6e6e76  dark #98989f
--ink-3: light #a1a1a8  dark #6e6e76
--ink-on-accent: white in both modes

// Accent (used as solid + gradient)
--accent: light #0071e3  dark #0a84ff
--accent-2: light #5b7cff dark #7c93ff
--accent-grad: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)
--accent-soft: light rgba(0,113,227,0.08) dark rgba(10,132,255,0.15)

// Status
--success: light #34c759 dark #30d158
--warning: light #ff9f0a dark #ff9f0a
--danger:  light #ff3b30 dark #ff453a
--purple:  light #a855f7 dark #bf5af2  (used for "evaluated" pipeline stage and stats accent variant)

// Hairlines
--hairline:        light rgba(0,0,0,0.06)  dark rgba(255,255,255,0.06)
--hairline-strong: light rgba(0,0,0,0.10)  dark rgba(255,255,255,0.10)
```

**Accent constant across modes:** the gradient `--accent-grad` is the brand constant. It appears as: the brand mark, the active-nav rail, primary CTAs on marketing surfaces, focus rings, and gradient text on hero words. Solid `--accent` is used for accent text and accent-soft backgrounds.

### Typography

SF Pro Display for >= 22px, SF Pro Text for everything smaller. The existing font stack in `tailwind.config.ts` already lists both as fallbacks of `-apple-system`, which is correct.

| Token | Size / line | Tracking | Weight | Use |
| --- | --- | --- | --- | --- |
| `display-xl` | 56 / 60 | -0.04em | 700 | Marketing hero only |
| `display-l` | 36 / 40 | -0.03em | 700 | Public page titles, large moments |
| `display-m` | 28 / 32 | -0.025em | 700 | Internal page titles |
| `display-s` | 22 / 28 | -0.02em | 600 | Section titles, role tile names |
| `title-l` | 17 / 24 | -0.01em | 600 | Card titles, list item titles |
| `title-m` | 15 / 22 | 0 | 600 | Sub-titles, dense list rows |
| `body-l` | 16 / 26 | 0 | 400 | Long-form content (public reading) |
| `body` | 14 / 20 | 0 | 400 | Default body |
| `body-s` | 13 / 18 | 0 | 400 | Secondary body, list metadata |
| `caption` | 12 / 16 | 0 | 400 | Helper text, table cell secondary |
| `micro` | 11 / 14 | 0.06em | 500 uppercase | Eyebrows, section labels |

**Tabular numerics** are mandatory on stat numbers, table cell numbers, dates, currencies. Apply via `font-variant-numeric: tabular-nums` (Tailwind: `tabular-nums`).

**Stat number gradient** (for the big numbers on dashboard stat cards and hero stats):

```css
background: linear-gradient(180deg, var(--ink-1) 0%, color-mix(in srgb, var(--ink-1) 70%, var(--ink-2)) 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

Applied via a utility class `.text-gradient-ink`. Used ONLY on stat numbers and one designated hero word.

### Elevation

Five tiers, all subtle. Hierarchy comes from shadow, not borders.

```css
--elev-1: 0 1px 3px rgba(0,0,0,0.04);                         /* card default */
--elev-2: 0 4px 16px rgba(0,0,0,0.06);                        /* hover, focused card */
--elev-3: 0 8px 30px rgba(0,0,0,0.10);                        /* dropdowns, popovers */
--elev-4: 0 24px 60px rgba(0,0,0,0.18);                       /* modals, dialogs */
```

Dark mode shadows deepen by ~40%: `rgba(0,0,0,0.20)` baseline for `elev-1`.

`floor` (no shadow) is for the page itself and for cards that intentionally recede.

### Motion

```css
--dur-instant: 100ms;  /* state changes that should feel immediate (checkbox, toggle knob) */
--dur-fast:    180ms;  /* hovers, taps, button press */
--dur-base:    240ms;  /* most state transitions, fade in/out, accordion */
--dur-slow:    360ms;  /* drawer open, page transitions, modal enter */

--ease-out:   cubic-bezier(0.2, 0.8, 0.2, 1);    /* default for everything */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* playful pops (drag pickup, badge appear) */
```

**No flashy entrance animations.** Components fade in over 240ms with a 2-4px upward translate. Drag pickup uses spring + 2deg rotation + elev-3 shadow. Drawer slides in over 360ms with ease-out.

### Radius

| Token | Value | Use |
| --- | --- | --- |
| `xs` | 6px | Chips inside cards, small inline pills |
| `sm` | 8px | Inputs, small buttons, small cards |
| `md` | 10px | Most cards (replaces existing `rounded-apple`) |
| `lg` | 14px | Page-level cards, stats, role cards, dialogs |
| `xl` | 20px | Marketing role tiles, hero containers |
| `full` | 9999px | Pills, CTAs, avatars, status dots |

The existing `rounded-apple: 0.625rem` (= 10px) maps to `md`. We keep it as an alias so existing call sites don't break during phased rollout, then remove once everything is migrated.

### Iconography

* Library: `lucide-react`.
* Default stroke width: `2`. For very small icons (12px), use `2.4`.
* Color: `currentColor` (inherits text color). Active-state nav icons get `--accent`. Brand mark gets `--accent-grad` via SVG fill (small custom inline SVG, not Lucide).
* Size scale: 12, 14, 16 (default in chrome and inline), 20, 24.

### Subject accents (marketing only)

Public-side role tiles get a 3px gradient accent bar derived from the role's `subject` field. Mapping table:

```ts
const SUBJECT_GRADIENT: Record<string, [string, string]> = {
  mathematics: ['#0071e3', '#5b7cff'],
  math: ['#0071e3', '#5b7cff'],
  physics: ['#a855f7', '#d946ef'],
  chemistry: ['#34c759', '#5ed478'],
  biology: ['#10b981', '#34d399'],
  english: ['#ff3b30', '#ff7a73'],
  history: ['#92400e', '#b45309'],
  geography: ['#0891b2', '#22d3ee'],
  computer_science: ['#ff9f0a', '#ff6b00'],
  cs: ['#ff9f0a', '#ff6b00'],
  art: ['#ec4899', '#f472b6'],
  music: ['#8b5cf6', '#a78bfa'],
  pe: ['#22c55e', '#4ade80'],
  // default fallback: accent gradient
};
```

Subject color is also used as the eyebrow text color on role tiles. Internal app does NOT use subject colors (kept neutral for working environments).

## Primitives

Located in `components/ui/`. Each primitive owns its variants. No raw inline styling in pages.

### Existing primitives (refine)

| Primitive | Current state | What changes |
| --- | --- | --- |
| `Button` | Solid foundation, 5 variants, 3 sizes | Add `gradient` variant (the accent-gradient pill used on marketing apply rails). Add `ink` variant (the black/white pill primary CTA). Refine `outline` to use hairline tokens. Add `iconLeft`/`iconRight` props for Lucide icons. |
| `Card` | Good base | Add `surface` prop: `card` (default), `chrome`, `floating`. Add `elevation` prop: `floor`, `1`, `2`, `3`, `4`. Replace `hover` shorthand with `interactive` prop that adds elev bump + hairline tint on hover. |
| `Input` | Solid | Add `size` prop (`sm` 32px, `md` 38px default, `lg` 44px for marketing apply form). Improve focus ring to use accent-soft + 2px accent border. Add `iconLeft` prop. |
| `Select` | Native styled | Replace with a custom dropdown using the new `Dropdown` primitive (better visual control). Keep API compatible. |
| `Badge` | 5 variants | Add `dot` variant (the status pill with glowing dot). Rename variants to match status terminology (`success`/`warning`/`danger`/`info`/`neutral`). |
| `Tabs` | Underline active state | Replace underline with gradient indicator (3px tall, 999px radius, accent-grad, inset 14px from tab edges). Add `count` slot per tab. |
| `EmptyState` | Good | Add `illustration` slot (for marketing-tier empty states). |
| `Skeleton` | Basic | Refine: use the new surface tokens for the base, fade in/out instead of pulse, optional `shimmer` variant. |

### New primitives

| Primitive | Purpose |
| --- | --- |
| `Dialog` | Modal dialogs (confirm, edit) and side drawers. Uses `card` surface + `elev-4`. Backdrop is `rgba(0,0,0,0.30)` with 12px blur. Drawer variant slides from right at `dur-slow` with `ease-out`. |
| `Toast` | Notifications. Bottom-right stack. `floating` surface + `elev-3`. Auto-dismiss 4s default. Variants: `success` (left border accent), `error`, `info`. Imperative API via `useToast()` hook. |
| `Dropdown` | Menus anchored to a trigger. `floating` surface + `elev-3`. Used for: user menu (theme toggle + sign out), table row actions, sort/filter menus. Built on the radix-style headless pattern, no external dep. |
| `Tooltip` | Hover/focus reveals. Tiny, `floating` surface, `caption` typography. Delay 400ms. Used on icon-only buttons and truncated text. |
| `Avatar` | Round image or initial. Sizes: 20/24/28/32/40. Initial-only variant uses accent-grad background + white initial with `-0.02em` tracking. Used in sidebar user chip, talent list, candidate cards, kanban cards. |
| `ThemeProvider` | Light/dark/system theme management. Persists choice in localStorage. SSR-safe (no flash). |
| `ThemeToggle` | The picker used inside the user menu dropdown: three options (Light, Dark, Match system). Default: Match system. |

### Icon wrapper

Thin wrapper `components/ui/icon.tsx`:

```tsx
import { LucideProps, icons } from 'lucide-react';
type IconName = keyof typeof icons;
export function Icon({ name, size = 16, ...props }: { name: IconName; size?: number } & LucideProps) {
  const Cmp = icons[name];
  return <Cmp size={size} strokeWidth={size <= 14 ? 2.4 : 2} {...props} />;
}
```

This gives us a single point to enforce stroke-width and size norms.

## Patterns

Every route in the app maps to one of these patterns. The spec captures the canonical anatomy; surface inventory below maps routes to patterns.

### Pattern A: List

Used by Jobs, Talent Bank, Sourcing lists, and the table view of `/dashboard/pipeline`.

**Anatomy** (top to bottom):
1. `PageHeader` (eyebrow optional, `display-m` title, page subtitle, primary action right)
2. Filter chips row (segmented status filters with counts; single-select per the existing taste rule on pipeline stage filters)
3. Search bar (optional, right-aligned with chips)
4. `Card` (`elevation: 1`) wrapping a grouped list:
   * Header row: `micro` uppercase column labels, sticky on long lists. Sortable columns show a 10px chevron-down/up next to the label and toggle direction on click. Default sort indicated on first render.
   * Data rows: grid columns sized by content type, `hairline` bottom borders, last row no border, right-end chevron in `ink-3`
   * Hover: row gets `accent-soft` background
   * Status pill column uses the `Badge dot` variant

**Row anatomy** (left to right): title block (title + meta), date/source, count cell (tabular-nums), status pill, chevron.

### Pattern B: Detail + tabs

Used by `/dashboard/jobs/[id]` and its sub-pages, candidate detail drawer.

**Anatomy:**
1. Back link (Lucide chevron-left + parent route name) in `ink-2`
2. `PageHeader` with inline status pill next to title
3. `Tabs` row (gradient indicator)
4. Two-column body: main content (left, `min-width: 0`) + right rail (280-320px, `floating` surface, sticky)
   * Right rail holds context metadata as labeled fields
   * For pipeline tab on job detail: main content is the kanban (Pattern E)

### Pattern C: Configuration

Used by all `/dashboard/settings/*` pages, the onboarding form, the job intake form, the apply form (with marketing canvas).

**Anatomy:**
1. `PageHeader`
2. Two-column body (settings only): left = sub-nav (200px), right = content
3. Content is a stack of `SettingsGroup` cards:
   * Group header: title + description
   * Stack of `SettingsRow`: label + description on left, control on right
   * Controls: `Input`, `Select`, `Toggle`, `Button` (gradient or ghost)
   * Hairline separators between rows
4. Sticky footer bar (when applicable) with Save + Cancel

For non-settings configuration pages (onboarding, job-new, apply form), drop the sub-nav and use a single-column layout, max-width 720px.

### Pattern D: Marketing surface

Used by `/careers/[slug]`, `/careers/[slug]/jobs`, `/careers/[slug]/jobs/[jobId]`, `/careers/[slug]/apply`.

**Anatomy** (top to bottom):
1. Thin sticky topbar with school chip (left) and navigation links + apply CTA (right)
2. **Hero block:** atmospheric backdrop (three radial gradients), centered content (max-width 880px), eyebrow + `display-xl` title + `body-l` paragraph + CTA row + optional 4-stat strip
3. **Content section(s)** on the off-white canvas with 56-80px vertical padding
4. **Footer** (school address + contact)

The careers home, jobs listing, and apply form all share this hero pattern but with different content. Job detail (D2) is a variant.

#### D2: Job detail (marketing variant)

* Hero atmosphere (smaller than careers home, ~400px deep)
* Back link → subject tag → `display-l` title → school meta line → fact pills row
* Body section on off-white: two-column layout, main content (`body-l`, reading width) + sticky right rail
* Right rail is the "Apply" card: `floating` surface, eyebrow + apply-by date + meta + gradient CTA + meta facts (salary, start date, etc.)

### Pattern E: Kanban

Used inside the Pipeline tab of `/dashboard/jobs/[id]` and as a view-toggle option on `/dashboard/pipeline`.

**Anatomy:**
* `chrome` surface columns (translucent, blur 20px), one per pipeline stage
* Column header: `micro` uppercase stage name + colored swatch (matches `STAGE_COLORS`) + count chip
* `card` surface candidate cards inside columns: name (`title-m`), meta (subject + experience), match score badge (gradient accent-soft pill)
* Drag state: 2deg rotation + `elev-3` shadow + spring easing (180ms)
* Drop placeholder: dashed hairline outline with `accent-soft` fill

Stage colors source from a per-stage `color` field on the `pipelineStages` table (target state per the taste rule on dynamic stages). If the field isn't present yet, the implementation plan adds it with sensible defaults that match the legacy hardcoded `STAGE_COLORS` map in `components/dashboard/role-cards.tsx:22-29`, so we don't regress the visual while the data layer catches up.

### Pattern F: Utility (single-task public)

Used by `/book/[token]`, `/track/[token]`, `/feedback/[token]`.

**Anatomy:**
* Canvas: internal-app atmosphere (not marketing off-white). These are tools, not first impressions.
* Top: school chip + role/candidate context (single line)
* Page title (`display-s`) + subtitle (`body-s`)
* Single content `Card` (or stack of 2-3 cards), max-width 480px, centered
* One primary CTA at the bottom:
  * Gradient pill if candidate-facing action (book, track navigation)
  * Dark ink pill if school-staff action (submit feedback)

## Shell

The shell wraps every internal route (everything under `/dashboard`).

### Sidebar

* 232px wide, full-height
* `chrome` surface (translucent, 24px blur, right hairline border)
* 22px top padding, 14px horizontal, 18px bottom
* **Brand block** (top): 26px gradient brand mark with the letter "R" (white, weight 700) + wordmark "RoleRecruit" (`title-m`, weight 600)
* **Nav** (flex-1): vertical stack of nav items, 1px gap
  * Item: `body-s` weight 500, 8px vertical, 12px horizontal, 8px radius, Lucide icon (16px) left
  * Hover: `rgba(0,0,0,0.04)` background (light) / `rgba(255,255,255,0.04)` (dark)
  * Active: `chrome` raised tint background + `elev-1` shadow + 3px accent-grad rail on the left (positioned `left: -14px` to bleed into the sidebar padding)
  * Active icon gets `--accent` color
* **Section label** (optional, used for "Manage" before Settings): `micro` uppercase in `ink-3`
* **User chip** (bottom): full-width `floating` surface card, 28px avatar (initial + accent-grad bg) + name (`body-s` weight 600) + role line (`caption`) + chevron-up. Click opens dropdown.

**User dropdown** anchored above the chip, 240px wide:
* Theme picker (three radio options: Light / Dark / Match system)
* Divider
* Sign out

### Nav items (in order)

1. Dashboard — `Home` icon → `/dashboard`
2. Jobs — `Briefcase` icon → `/dashboard/jobs`
3. Pipeline — `Kanban` icon → `/dashboard/pipeline`
4. Talent Bank — `Users` icon → `/dashboard/talent`
5. ⎯⎯⎯ section label: "Manage" ⎯⎯⎯ (only renders if settings is accessible)
6. Settings — `Settings` icon → `/dashboard/settings` (wrapped in `RoleGate`)

The existing `<RoleGate>` wrapper stays. We render the section label conditionally with the gate.

### Page header

Used at the top of every internal page main content:

```tsx
<PageHeader
  eyebrow="Welcome back, Sumanth"   // optional, only on dashboard home and high-context pages
  title="Dashboard"                  // display-m
  subtitle="4 open roles, 3 hires this month"  // optional, body-s in ink-2
  back={{ href: '/dashboard/jobs', label: 'Jobs' }}  // optional, renders ChevronLeft + label
  status={<StatusPill ... />}        // optional inline pill next to title
  actions={<Button variant="ink">+ Post role</Button>}  // primary right-aligned
/>
```

## Surface inventory

Every route gets a pattern assignment. Components inherit their pattern's anatomy; only screen-specific content varies.

| Route | Pattern | Notes |
| --- | --- | --- |
| `/` | Redirect | No UI change. |
| `/sign-in` | Auth | Clerk SignIn wrapped in canvas + brand chip. Clerk theme uses our tokens. |
| `/sign-up` | Auth | Same as sign-in. |
| `/accept-invite/[token]` | Auth | Custom invite acceptance, single-card centered layout on canvas. |
| `/sign-out` | Auth | Redirect; no UI. |
| `/onboarding` | C (Config, no sub-nav, single column) | Welcome screen + form. Use marketing canvas (off-white) because this is a "first impression" surface. |
| `/dashboard` | Custom (Dashboard home) | Stats + role list. See Section 2 mockup. |
| `/dashboard/jobs` | A (List) | Filters: All, Active, Draft, Closed. Columns: Role, Posted, Candidates, Status, chevron. |
| `/dashboard/jobs/new` | C (single column) | Job intake form. |
| `/dashboard/jobs/[id]` | B (Detail + tabs) | Tabs: Pipeline, Sourcing, Criteria, Settings. Right rail shows job metadata. |
| `/dashboard/jobs/[id]/pipeline` | B/E | Kanban inside Pipeline tab. |
| `/dashboard/jobs/[id]/pipeline/outreach` | B (sub-route) | Renders inside the Pipeline tab context. Lays out outreach controls in a `Card`. |
| `/dashboard/jobs/[id]/sourcing` | B/A | Sourcing list inside Sourcing tab. |
| `/dashboard/jobs/[id]/criteria` | B/C | Criteria editor inside Criteria tab (config-style controls). |
| `/dashboard/pipeline` | A (with E toggle) | Default = table view (Pattern A applied to applications). Optional view toggle to kanban (Pattern E) grouped by stage. |
| `/dashboard/talent` | A (List) | Same anatomy as Jobs list. Columns: Name (with avatar), Tags, Last activity, Status, chevron. |
| `/dashboard/settings` | C | Sub-nav (left): Calendar, Messaging, Pipeline stages, Roles, Team. Index page = Calendar by default or a settings landing summary. |
| `/dashboard/settings/calendar` | C | Working hours, sync, buffers, defaults. |
| `/dashboard/settings/messaging` | C | Channel routing, templates, automations editor. |
| `/dashboard/settings/pipeline` | C + custom | Pipeline stage editor: settings groups for general config, plus a custom stage list (drag-reorder). |
| `/dashboard/settings/roles` | C + custom | Roles + permissions matrix table inside settings group. |
| `/dashboard/settings/team` | A (mini, inside settings) | Team member list with role + invite control. |
| `/careers/[slug]` | D (Marketing) | Hero + 3-up open roles tiles. |
| `/careers/[slug]/jobs` | D (Marketing) | Same hero (smaller), then `display-l` "Open roles" section + full grid of role tiles. |
| `/careers/[slug]/jobs/[jobId]` | D2 (Marketing variant) | Job detail with sticky apply rail. |
| `/careers/[slug]/apply` | D + C body | Marketing hero strip, then Configuration pattern form on off-white canvas. |
| `/book/[token]` | F (Utility) | Calendar + slot picker. |
| `/track/[token]` | F (Utility) | Status card + timeline. |
| `/feedback/[token]` | F (Utility) | Rating, text fields, recommendation, dark CTA. |

## Implementation phases

Each phase is a discrete chunk of work that can ship independently. The plan-writing step turns each phase into ordered tasks.

### Phase 1: Foundation (tokens + theming)

* Rewrite `tailwind.config.ts`: surface/ink/accent/status/hairline as CSS-variable references; radius + shadow + transition tokens; new typography utility classes (display-*, title-*, body-*, etc.).
* Rewrite `app/globals.css`: CSS variables for light + dark, applied via `:root` and `[data-theme="dark"]`; canvas background applied to `<body>` with the radial gradient atmosphere; `.text-gradient-ink` utility.
* Build `components/ui/theme-provider.tsx`: light/dark/system with SSR-safe initial render.
* Build `components/ui/theme-toggle.tsx`: the radio control inside the user menu dropdown.
* Wire `<ThemeProvider>` into `app/layout.tsx`.

**Visible payoff:** dark mode works app-wide for any element using token colors. Atmosphere appears behind every page.

### Phase 2: Primitives

* Refine existing primitives per the "Existing primitives" table above. Update all internal call sites that pass raw hex colors to use the new variant props.
* Build new primitives: Dialog, Toast, Dropdown, Tooltip, Avatar.
* Install `lucide-react`. Build `components/ui/icon.tsx` wrapper.

**Visible payoff:** primitives look right in light and dark, with proper hairlines and shadows. Toast/Dialog/Dropdown immediately usable.

### Phase 3: Shell + global chrome

* Rewrite `components/dashboard/sidebar.tsx` per the Shell spec: brand mark, lucide nav icons, active rail, user chip + dropdown.
* Build `components/ui/page-header.tsx`: the shared header with eyebrow / title / subtitle / back / status / actions.
* Update `app/dashboard/layout.tsx`: ensure body canvas is applied; sidebar + main flex layout; replace the existing `p-8` with the page-header-aware spacing pattern (24-36px outer, page-header handles its own bottom margin).
* Update `app/careers/[slug]/layout.tsx`: marketing topbar + canvas (off-white).

**Visible payoff:** every internal page already feels premium because the shell looks premium. Marketing pages get their distinct chrome.

### Phase 4: Internal surfaces

In priority order (highest first):

1. **Dashboard home** (`app/dashboard/page.tsx`, `components/dashboard/stats-bar.tsx`, `components/dashboard/role-cards.tsx`): the anchor surface. Implement the design from section 2 mockup exactly. Replace inline-styled CTAs with `<Button variant="ink">`. Use `<Card>` and `<Badge dot>`.
2. **Jobs list** (`app/dashboard/jobs/page.tsx`): Pattern A. Status filter chips, grouped row card, sortable header. Replace `app/dashboard/jobs/[id]` link list with the new row anatomy.
3. **Job detail** (`app/dashboard/jobs/[id]/page.tsx` + sub-routes): Pattern B. Tabs with gradient indicator. Right-rail context panel (`floating` surface). The pipeline tab embeds kanban (Pattern E).
4. **Pipeline page** (`app/dashboard/pipeline/page.tsx` + `components/pipeline/*`): Pattern A table view + Pattern E kanban toggle. Refresh `application-table.tsx`, `candidate-card.tsx`, `application-drawer.tsx`, `status-tabs.tsx`, `evaluation-summary.tsx` to use new tokens.
5. **Talent Bank** (`app/dashboard/talent/page.tsx`): Pattern A applied to people. Add `<Avatar>` per row.
6. **Settings** (`app/dashboard/settings/*` + `components/settings/*`): Pattern C. `<SettingsNav>`, `<SettingsGroup>`, `<SettingsRow>`, `<Toggle>` primitive.
7. **Job intake** (`app/dashboard/jobs/new/page.tsx`, `components/jobs/job-intake-form.tsx`): Pattern C single-column.
8. **Onboarding** (`app/onboarding/page.tsx`): Pattern C single-column on the internal canvas. No sidebar (user hasn't reached the dashboard yet); replace it with a slim header containing only the brand mark + wordmark. Max-width 560px, vertically centered. First field auto-focused.
9. **Auth** (`app/sign-in/`, `app/sign-up/`, `app/accept-invite/`): Clerk's `<SignIn>`/`<SignUp>` themed via the `appearance` prop. We pass a shared `clerkAppearance` config (in `lib/clerk-appearance.ts`) that maps our token CSS variables onto Clerk's `variables` and overrides per-element classes for buttons and form fields to match our primitives. Layout: brand mark top-left, canvas background, Clerk card centered. `accept-invite` keeps its custom UI but uses the new primitives.

**Visible payoff:** the recruiter app looks fully Modern Apple.

### Phase 5: Public marketing

1. **Careers home** (`app/careers/[slug]/page.tsx`, `components/careers/SchoolHeader.tsx`): Pattern D hero + 3-up role tiles with subject accents.
2. **Careers jobs listing** (`app/careers/[slug]/jobs/page.tsx`, `components/careers/JobListings.tsx`, `components/careers/JobCard.tsx`): Pattern D + role tile grid.
3. **Careers job detail** (`app/careers/[slug]/jobs/[jobId]/page.tsx`): Pattern D2 with sticky apply rail.
4. **Apply form** (`app/careers/[slug]/apply/page.tsx`, `components/careers/ApplicationForm.tsx`): Marketing hero strip + Pattern C single-column body. Larger inputs (`size="lg"`) for the warmer reading scale.

**Visible payoff:** candidate first-impression goes from "basic job board" to "premium school brand".

### Phase 6: Public utility

1. **Book** (`app/book/[token]/page.tsx`, `components/booking/*`): Pattern F. Calendar grid + slot picker + gradient CTA.
2. **Track** (`app/track/[token]/page.tsx`, `components/tracking/*`): Pattern F. Status card + vertical timeline.
3. **Feedback** (`app/feedback/[token]/page.tsx`, `components/feedback/*`): Pattern F. Rating + textareas + recommendation row + dark CTA.

**Visible payoff:** every public-facing utility feels intentional and on-brand.

## Open extensions (call out, don't block)

These would make the design fully realized but require small backend additions. They're flagged so the implementation plan can decide whether to include them.

* **Dashboard subtitle copy** like "2 closing this month": requires `closeDate` field on jobs or a derived query. If unavailable, drop the subtitle.
* **Hero stats strip** on careers home (Students, Teachers, Years in operation): these don't exist on the school record. Either add fields to the `schools` table OR omit the stats strip for now (hero still works without it). Recommendation: omit until schools can edit them in Settings.
* **Salary, start date, reports to** on the job detail apply rail: extending the `jobs` schema. Show only if data exists; the apply rail gracefully handles missing fields.

## Risks

| Risk | Mitigation |
| --- | --- |
| `backdrop-filter` browser support | Safari 14+, Chrome 76+, Firefox 103+ all support. For older browsers, the `chrome` surface degrades to opaque white (light) / opaque dark gray (dark). Acceptable graceful fallback. |
| Dark-mode regressions on existing primitives | Phase 2 includes a full pass through every primitive in light and dark. Storybook-like visual check page added to `/dashboard/_debug/components` during dev (no production exposure). |
| Performance from translucent surfaces | Backdrop-filter has GPU cost. We only apply it to sidebar (rendered once per page) and floating UI (rare). Tables/drawers stay opaque. |
| Existing inline-styled call sites | Phase 4 surfaces each include "kill the inline styles" as part of the work. The `bg-[#0071e3]` pattern in `app/dashboard/page.tsx:17-20` is a representative example. |
| Theme flash on initial load | `ThemeProvider` reads from localStorage synchronously in a blocking script tag in `<head>`. Tested SSR-safe pattern; documented in the provider. |
| Existing tests | Component primitive tests (where they exist) need updates for new variants. New primitives need new tests. Implementation plan covers test scope per phase. |

## What we are NOT changing

* Data layer (Convex queries, mutations, schema).
* Routing structure.
* Authentication flow.
* The `RoleGate` pattern.
* The pipeline stage configuration (we render whatever the DB returns).
* The job intake parsing logic.

This redesign is purely visual + presentational. Any data-shape extension noted above is opt-in.

## Next step

After this spec is approved, hand off to the writing-plans skill to produce the phased implementation plan with ordered tasks, file-level granularity, and test scope per phase.
