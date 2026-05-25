# UI Polish (Part 1): Foundation, Primitives, Shell

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Modern Apple design language foundation: dark-aware token system, theme switching, refined and new UI primitives, and the new chrome (sidebar + page header + marketing topbar + Clerk theming). After this plan ships, every later route migration is composition over the new primitives.

**Architecture:** CSS variables drive light/dark theming, surfaced through Tailwind config tokens. A `ThemeProvider` reads `localStorage` synchronously in a blocking head script to avoid theme flash. Primitives live in `components/ui/`. Each new primitive is built test-first with `vitest` + `@testing-library/react`. The shell (Sidebar, PageHeader, marketing topbar) consumes the primitives.

**Tech Stack:** Next.js 14 (app router), TypeScript, Tailwind CSS 3.4, Convex, Clerk, vitest + jsdom + @testing-library/react, lucide-react (added in Task 1), bun.

**Reference spec:** [`docs/superpowers/specs/2026-05-25-ui-polish-design.md`](../specs/2026-05-25-ui-polish-design.md)

**Project rules (from `.commandcode/taste/taste.md`):**
- Use `bun`, not `npm`
- No mdash (`—`) or double-dash (`--`) in code
- No `Co-authored-by` trailer in commits
- TDD: failing test first, then minimum code to pass, then commit
- Surgical changes; do not improve adjacent code

---

## File structure

### Created files

| Path | Responsibility |
| --- | --- |
| `components/ui/theme-provider.tsx` | React context that holds the active theme (`light` / `dark` / `system`), reads/writes `localStorage`, and exposes `useTheme()`. |
| `components/ui/theme-script.tsx` | Inline `<script>` rendered in `<head>` that sets `data-theme` on `<html>` before React hydrates (prevents flash). |
| `components/ui/theme-toggle.tsx` | The three-option (Light / Dark / Match system) radio control used inside the user menu. |
| `components/ui/icon.tsx` | Lucide wrapper that enforces consistent stroke widths. |
| `components/ui/toggle.tsx` | iOS-style toggle switch primitive. |
| `components/ui/avatar.tsx` | Round avatar (initial or image), 5 sizes. |
| `components/ui/tooltip.tsx` | Hover/focus tooltip primitive. |
| `components/ui/dropdown.tsx` | Menu anchored to a trigger. Foundation for menus, custom selects. |
| `components/ui/dialog.tsx` | Modal dialog with backdrop + drawer variant. |
| `components/ui/toast.tsx` + `components/ui/toast-provider.tsx` | Toast notifications with imperative API. |
| `components/ui/page-header.tsx` | Page header: eyebrow, title, subtitle, back link, status slot, actions slot. |
| `components/ui/index.ts` | Re-exports for ergonomic imports. |
| `components/careers/MarketingTopbar.tsx` | Translucent top bar used on `/careers/*` routes. |
| `lib/clerk-appearance.ts` | Clerk `appearance` config mapping our tokens to Clerk's variables and per-element classes. |
| `tests/components/ui/*.test.tsx` | One test file per new primitive. |

### Modified files

| Path | What changes |
| --- | --- |
| `package.json` | Add `lucide-react` dependency. |
| `tailwind.config.ts` | Rewrite tokens against CSS variables, add new typography utility classes, add motion + radius + elevation tokens. |
| `app/globals.css` | Add CSS variables for light/dark; canvas atmosphere on `body`; typography utility classes; `.text-gradient-ink` utility. |
| `app/layout.tsx` | Wrap children in `<ThemeProvider>`; inject `<ThemeScript />` in head; switch html attribute strategy. |
| `app/dashboard/layout.tsx` | Apply canvas atmosphere via shared classes; verify sidebar/main flex. |
| `app/careers/layout.tsx` | Apply off-white marketing canvas. |
| `app/careers/[slug]/layout.tsx` | Wire `<MarketingTopbar>`. |
| `app/sign-in/[[...sign-in]]/page.tsx` | Use `clerkAppearance` and shared layout chrome. |
| `app/sign-up/[[...sign-up]]/page.tsx` | Same as sign-in. |
| `components/dashboard/sidebar.tsx` | Full rewrite: brand mark, Lucide icons, active rail, user chip + theme dropdown. |
| `components/ui/button.tsx` | Add `gradient` and `ink` variants; add `iconLeft` / `iconRight` props. |
| `components/ui/card.tsx` | Add `surface` (card / chrome / floating) and `elevation` (floor / 1 / 2 / 3 / 4) props. Replace `hover` with `interactive`. |
| `components/ui/input.tsx` | Add `size` (sm / md / lg) and `iconLeft` props; refine focus ring. |
| `components/ui/select.tsx` | Rewrite using the new Dropdown; keep API compatible (string value + onChange). |
| `components/ui/badge.tsx` | Add `dot` variant; rename variants to status terminology. |
| `components/ui/tabs.tsx` | Replace underline with gradient indicator; add `count` slot per tab. |
| `components/ui/empty-state.tsx` | Add `illustration` slot. |
| `components/ui/skeleton.tsx` | Use new surface tokens; soften animation. |

---

## Pre-flight

### Task 0: Branch, install, and confirm test runner

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Create a working branch (skip if not using git)**

This project isn't currently a git repo. If you want history during the rollout, initialize one before starting:

```bash
git init
git add -A
git commit -m "chore: baseline before ui polish"
git checkout -b ui/foundation-primitives-shell
```

If you skip git, just commit-message text appears as instructions in each task; treat them as no-ops.

- [ ] **Step 2: Install lucide-react**

Run:
```bash
bun add lucide-react
```

Expected: `lucide-react` appears in `package.json` `dependencies`. Lockfile updates.

- [ ] **Step 3: Verify vitest + RTL pipeline still works**

Run:
```bash
bun run test -- tests/components/talent-controls.test.tsx
```

Expected: all 8 tests pass. If they don't, fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add lucide-react for icon system"
```

---

## Phase 1: Foundation

### Task 1: CSS variables and canvas atmosphere

Rewrite `globals.css` with light/dark CSS variables and the radial-gradient canvas atmosphere. This is the lowest-level change; everything else stacks on top.

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace `globals.css` with the new variable-driven content**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Ink */
    --ink-1: #0f0f12;
    --ink-2: #6e6e76;
    --ink-3: #a1a1a8;

    /* Accent */
    --accent: #0071e3;
    --accent-2: #5b7cff;
    --accent-soft: rgba(0, 113, 227, 0.08);

    /* Status */
    --success: #34c759;
    --warning: #ff9f0a;
    --danger:  #ff3b30;
    --purple:  #a855f7;

    /* Surfaces */
    --canvas-base: #f0f1f7;
    --canvas-atm-1: rgba(91, 124, 255, 0.10);
    --canvas-atm-2: rgba(255, 159, 10, 0.06);
    --card-bg: #ffffff;
    --card-elev-bg: #ffffff;
    --chrome-bg: rgba(255, 255, 255, 0.65);
    --chrome-border: rgba(255, 255, 255, 0.7);
    --floating-bg: rgba(255, 255, 255, 0.8);

    /* Hairlines */
    --hairline: rgba(0, 0, 0, 0.06);
    --hairline-strong: rgba(0, 0, 0, 0.10);

    /* Elevation shadows */
    --elev-1: 0 1px 3px rgba(0, 0, 0, 0.04);
    --elev-2: 0 4px 16px rgba(0, 0, 0, 0.06);
    --elev-3: 0 8px 30px rgba(0, 0, 0, 0.10);
    --elev-4: 0 24px 60px rgba(0, 0, 0, 0.18);

    /* Marketing canvas (separate, for /careers) */
    --marketing-base: #fafafa;
  }

  [data-theme="dark"] {
    --ink-1: #f5f5f7;
    --ink-2: #98989f;
    --ink-3: #6e6e76;

    --accent: #0a84ff;
    --accent-2: #7c93ff;
    --accent-soft: rgba(10, 132, 255, 0.15);

    --success: #30d158;
    --warning: #ff9f0a;
    --danger:  #ff453a;
    --purple:  #bf5af2;

    --canvas-base: #0a0a14;
    --canvas-atm-1: rgba(91, 124, 255, 0.20);
    --canvas-atm-2: rgba(168, 85, 247, 0.14);
    --card-bg: #1a1a24;
    --card-elev-bg: #22222e;
    --chrome-bg: rgba(20, 20, 28, 0.6);
    --chrome-border: rgba(255, 255, 255, 0.06);
    --floating-bg: rgba(28, 28, 38, 0.7);

    --hairline: rgba(255, 255, 255, 0.06);
    --hairline-strong: rgba(255, 255, 255, 0.10);

    --elev-1: 0 1px 3px rgba(0, 0, 0, 0.20);
    --elev-2: 0 4px 16px rgba(0, 0, 0, 0.30);
    --elev-3: 0 8px 30px rgba(0, 0, 0, 0.40);
    --elev-4: 0 24px 60px rgba(0, 0, 0, 0.50);
  }

  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  body {
    color: var(--ink-1);
    background-color: var(--canvas-base);
    background-image:
      radial-gradient(circle at 8% -5%, var(--canvas-atm-1) 0%, transparent 45%),
      radial-gradient(circle at 95% 100%, var(--canvas-atm-2) 0%, transparent 45%);
    background-attachment: fixed;
    min-height: 100vh;
  }

  body[data-canvas="marketing"] {
    background-color: var(--marketing-base);
    background-image: none;
  }
}

@layer utilities {
  /* Typography scale (also exposed as Tailwind utilities via config) */
  .text-display-xl { font-size: 56px; line-height: 60px; letter-spacing: -0.04em; font-weight: 700; }
  .text-display-l  { font-size: 36px; line-height: 40px; letter-spacing: -0.03em; font-weight: 700; }
  .text-display-m  { font-size: 28px; line-height: 32px; letter-spacing: -0.025em; font-weight: 700; }
  .text-display-s  { font-size: 22px; line-height: 28px; letter-spacing: -0.02em; font-weight: 600; }
  .text-title-l    { font-size: 17px; line-height: 24px; letter-spacing: -0.01em; font-weight: 600; }
  .text-title-m    { font-size: 15px; line-height: 22px; font-weight: 600; }
  .text-body-l     { font-size: 16px; line-height: 26px; font-weight: 400; }
  .text-body       { font-size: 14px; line-height: 20px; font-weight: 400; }
  .text-body-s     { font-size: 13px; line-height: 18px; font-weight: 400; }
  .text-caption    { font-size: 12px; line-height: 16px; font-weight: 400; }
  .text-micro      { font-size: 11px; line-height: 14px; letter-spacing: 0.06em; font-weight: 500; text-transform: uppercase; }

  .text-gradient-ink {
    background-image: linear-gradient(180deg, var(--ink-1) 0%, color-mix(in srgb, var(--ink-1) 65%, var(--ink-2)) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }
}
```

- [ ] **Step 2: Verify it builds**

Run:
```bash
bun run dev
```

Expected: Next.js dev server starts; no postcss/tailwind errors. Visit `http://localhost:3000` (any existing route) and confirm the body now has the soft radial atmosphere instead of a flat `#f5f5f7`. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): css variables and canvas atmosphere for light + dark"
```

---

### Task 2: Tailwind config tokens

Rewrite `tailwind.config.ts` so utilities like `bg-surface`, `text-ink`, `bg-accent`, and shadow/radius/transition tokens point at the new CSS variables. Keep `rounded-apple` as an alias for `md` (= 10px) so existing call sites do not break.

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Replace `tailwind.config.ts` with the new content**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--ink-1)",
          secondary: "var(--ink-2)",
          tertiary: "var(--ink-3)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          2: "var(--accent-2)",
          soft: "var(--accent-soft)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        purple: "var(--purple)",
        surface: {
          DEFAULT: "var(--card-bg)",
          elev: "var(--card-elev-bg)",
          chrome: "var(--chrome-bg)",
          floating: "var(--floating-bg)",
          canvas: "var(--canvas-base)",
          marketing: "var(--marketing-base)",
        },
        hairline: {
          DEFAULT: "var(--hairline)",
          strong: "var(--hairline-strong)",
        },
      },
      backgroundImage: {
        "accent-grad": "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
      },
      borderColor: {
        DEFAULT: "var(--hairline)",
        chrome: "var(--chrome-border)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: ['"SF Mono"', "Menlo", "Monaco", "monospace"],
      },
      borderRadius: {
        apple: "0.625rem", // legacy alias for md (= 10px)
        xs: "6px",
        sm: "8px",
        md: "10px",
        lg: "14px",
        xl: "20px",
      },
      boxShadow: {
        "elev-1": "var(--elev-1)",
        "elev-2": "var(--elev-2)",
        "elev-3": "var(--elev-3)",
        "elev-4": "var(--elev-4)",
        // legacy aliases used by existing call sites; remove after migration
        "elevation-low": "var(--elev-1)",
        "elevation-medium": "var(--elev-2)",
        "elevation-high": "var(--elev-3)",
        "menu": "var(--elev-3)",
      },
      transitionDuration: {
        instant: "100ms",
        fast: "180ms",
        base: "240ms",
        slow: "360ms",
        normal: "240ms", // legacy alias for base
      },
      transitionTimingFunction: {
        "apple-out": "cubic-bezier(0.2, 0.8, 0.2, 1)",
        "apple-spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "apple-ease": "cubic-bezier(0.2, 0.8, 0.2, 1)", // legacy alias
      },
      backdropBlur: {
        "20": "20px",
        "24": "24px",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Verify it builds**

Run:
```bash
bun run dev
```

Expected: dev server starts cleanly. Quick spot-check on `/dashboard`: existing classes like `bg-surface-secondary`, `text-ink-secondary` may need translation; some will look the same since aliases exist (e.g., `shadow-elevation-low`). Specifically the old `bg-surface-secondary` no longer exists. The existing pages will look slightly broken in places. That is expected; we migrate surfaces in Plan 2.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat(ui): rewrite tailwind tokens against css variables"
```

---

### Task 3: Theme provider + theme script

Build the React context + the head script that sets `data-theme` before hydration.

**Files:**
- Create: `components/ui/theme-provider.tsx`
- Create: `components/ui/theme-script.tsx`
- Test: `tests/components/ui/theme-provider.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/theme-provider.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../../../components/ui/theme-provider";

function ThemeReader() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme("dark")}>set-dark</button>
      <button onClick={() => setTheme("light")}>set-light</button>
      <button onClick={() => setTheme("system")}>set-system</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to system theme when nothing stored", () => {
    render(
      <ThemeProvider>
        <ThemeReader />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme").textContent).toBe("system");
  });

  it("setTheme updates the resolved theme and sets data-theme on <html>", () => {
    render(
      <ThemeProvider>
        <ThemeReader />
      </ThemeProvider>
    );
    act(() => {
      screen.getByText("set-dark").click();
    });
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("persists theme choice to localStorage", () => {
    render(
      <ThemeProvider>
        <ThemeReader />
      </ThemeProvider>
    );
    act(() => {
      screen.getByText("set-light").click();
    });
    expect(window.localStorage.getItem("rr-theme")).toBe("light");
  });

  it("system resolves via prefers-color-scheme", () => {
    // jsdom matchMedia is a no-op by default. Stub it.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (q: string) => ({
        matches: q === "(prefers-color-scheme: dark)",
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
    render(
      <ThemeProvider>
        <ThemeReader />
      </ThemeProvider>
    );
    act(() => {
      screen.getByText("set-system").click();
    });
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

Run:
```bash
bun run test -- tests/components/ui/theme-provider.test.tsx
```

Expected: FAIL with "Cannot find module" pointing at `theme-provider`.

- [ ] **Step 3: Implement `theme-provider.tsx`**

Create `components/ui/theme-provider.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (next: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "rr-theme";

function readSystem(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStored(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

function resolve(theme: Theme): ResolvedTheme {
  return theme === "system" ? readSystem() : theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStored());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolve(readStored()));

  const apply = useCallback((next: Theme) => {
    const r = resolve(next);
    setResolvedTheme(r);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", r);
    }
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      apply(next);
    },
    [apply]
  );

  useEffect(() => {
    apply(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => apply("system");
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [theme, apply]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
```

- [ ] **Step 4: Implement `theme-script.tsx`**

Create `components/ui/theme-script.tsx`:

```tsx
const SCRIPT = `(function(){try{var t=localStorage.getItem("rr-theme")||"system";var r=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;document.documentElement.setAttribute("data-theme",r);}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
```

- [ ] **Step 5: Run the test; expect PASS**

Run:
```bash
bun run test -- tests/components/ui/theme-provider.test.tsx
```

Expected: all 4 tests pass.

- [ ] **Step 6: Wire into `app/layout.tsx`**

Replace `app/layout.tsx` content with:

```tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { ThemeScript } from "@/components/ui/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoleRecruit",
  description: "AI-powered hiring for schools",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <ThemeScript />
        </head>
        <body className="font-sans antialiased">
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 7: Manual smoke test**

Run `bun run dev` and visit any page. In devtools console:
```js
document.documentElement.setAttribute("data-theme", "dark")
```
Expected: page background flips to dark canvas. Reset to `light`. Stop server.

- [ ] **Step 8: Commit**

```bash
git add components/ui/theme-provider.tsx components/ui/theme-script.tsx app/layout.tsx tests/components/ui/theme-provider.test.tsx
git commit -m "feat(ui): theme provider with system/light/dark and ssr-safe script"
```

---

## Phase 2: Primitives

The primitives split into two groups: NEW (built test-first) and REFINED (existing primitives with added variants or surface tokens).

### Task 4: Icon wrapper

Thin wrapper around `lucide-react` that enforces stroke-width norms and exposes a uniform `<Icon name="..." />` API.

**Files:**
- Create: `components/ui/icon.tsx`
- Test: `tests/components/ui/icon.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/icon.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Icon } from "../../../components/ui/icon";

describe("Icon", () => {
  it("renders the named lucide icon as an SVG", () => {
    const { container } = render(<Icon name="Home" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("height")).toBe("16");
  });

  it("uses stroke width 2 for sizes > 14", () => {
    const { container } = render(<Icon name="Home" size={24} />);
    expect(container.querySelector("svg")?.getAttribute("stroke-width")).toBe("2");
  });

  it("uses stroke width 2.4 for sizes <= 14", () => {
    const { container } = render(<Icon name="Home" size={12} />);
    expect(container.querySelector("svg")?.getAttribute("stroke-width")).toBe("2.4");
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

Run:
```bash
bun run test -- tests/components/ui/icon.test.tsx
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement `icon.tsx`**

Create `components/ui/icon.tsx`:

```tsx
import { icons, type LucideProps } from "lucide-react";

export type IconName = keyof typeof icons;

interface IconProps extends Omit<LucideProps, "ref"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, strokeWidth, ...props }: IconProps) {
  const Cmp = icons[name];
  if (!Cmp) return null;
  return <Cmp size={size} strokeWidth={strokeWidth ?? (size <= 14 ? 2.4 : 2)} {...props} />;
}
```

- [ ] **Step 4: Run the test; expect PASS**

Run:
```bash
bun run test -- tests/components/ui/icon.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/icon.tsx tests/components/ui/icon.test.tsx
git commit -m "feat(ui): icon wrapper around lucide-react"
```

---

### Task 5: Toggle (iOS-style switch)

**Files:**
- Create: `components/ui/toggle.tsx`
- Test: `tests/components/ui/toggle.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/toggle.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Toggle } from "../../../components/ui/toggle";

describe("Toggle", () => {
  it("renders with role switch and aria-checked", () => {
    render(<Toggle checked={false} onCheckedChange={() => {}} label="Sync" />);
    const btn = screen.getByRole("switch");
    expect(btn.getAttribute("aria-checked")).toBe("false");
  });

  it("aria-checked reflects checked prop", () => {
    render(<Toggle checked={true} onCheckedChange={() => {}} label="Sync" />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("calls onCheckedChange with the inverted value on click", () => {
    const handler = vi.fn();
    render(<Toggle checked={false} onCheckedChange={handler} label="Sync" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(handler).toHaveBeenCalledWith(true);
  });

  it("does not fire onCheckedChange when disabled", () => {
    const handler = vi.fn();
    render(<Toggle checked={false} onCheckedChange={handler} label="Sync" disabled />);
    fireEvent.click(screen.getByRole("switch"));
    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

```bash
bun run test -- tests/components/ui/toggle.test.tsx
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement `toggle.tsx`**

Create `components/ui/toggle.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onCheckedChange, label, disabled, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-[22px] w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-fast ease-apple-out",
        checked ? "bg-success" : "bg-[var(--hairline-strong)]",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "absolute h-[18px] w-[18px] rounded-full bg-white shadow-elev-1 transition-[left] duration-base ease-apple-out",
          checked ? "left-[16px]" : "left-[2px]",
        )}
      />
    </button>
  );
}
```

- [ ] **Step 4: Run the test; expect PASS**

```bash
bun run test -- tests/components/ui/toggle.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/toggle.tsx tests/components/ui/toggle.test.tsx
git commit -m "feat(ui): ios-style toggle primitive"
```

---

### Task 6: Avatar

**Files:**
- Create: `components/ui/avatar.tsx`
- Test: `tests/components/ui/avatar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/avatar.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "../../../components/ui/avatar";

describe("Avatar", () => {
  it("renders initial when no image", () => {
    render(<Avatar name="Sumanth Daggubati" />);
    expect(screen.getByText("S")).toBeDefined();
  });

  it("renders image when src provided", () => {
    render(<Avatar name="Sumanth" src="/sumanth.jpg" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/sumanth.jpg");
    expect(img.getAttribute("alt")).toBe("Sumanth");
  });

  it("renders ? when name is empty", () => {
    render(<Avatar name="" />);
    expect(screen.getByText("?")).toBeDefined();
  });

  it("applies size class", () => {
    const { container } = render(<Avatar name="A" size={40} />);
    expect(container.firstChild).toHaveStyle({ width: "40px", height: "40px" });
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

```bash
bun run test -- tests/components/ui/avatar.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `avatar.tsx`**

Create `components/ui/avatar.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  src?: string;
  size?: 20 | 24 | 28 | 32 | 40;
  className?: string;
}

function initial(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t[0].toUpperCase();
}

export function Avatar({ name, src, size = 28, className }: AvatarProps) {
  const fontSize = size <= 24 ? 10 : size <= 32 ? 12 : 14;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-white font-semibold tracking-tight bg-accent-grad",
        className,
      )}
    >
      {initial(name)}
    </div>
  );
}
```

- [ ] **Step 4: Run the test; expect PASS**

```bash
bun run test -- tests/components/ui/avatar.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/avatar.tsx tests/components/ui/avatar.test.tsx
git commit -m "feat(ui): avatar primitive with initial fallback"
```

---

### Task 7: Tooltip

**Files:**
- Create: `components/ui/tooltip.tsx`
- Test: `tests/components/ui/tooltip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/tooltip.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Tooltip } from "../../../components/ui/tooltip";

describe("Tooltip", () => {
  it("does not show tooltip content by default", () => {
    render(
      <Tooltip content="Open settings" delay={0}>
        <button>Trigger</button>
      </Tooltip>
    );
    expect(screen.queryByText("Open settings")).toBeNull();
  });

  it("shows tooltip content on hover after delay", async () => {
    render(
      <Tooltip content="Open settings" delay={0}>
        <button>Trigger</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByText("Trigger"));
    await waitFor(() => {
      expect(screen.getByText("Open settings")).toBeDefined();
    });
  });

  it("hides tooltip on mouse leave", async () => {
    render(
      <Tooltip content="Open settings" delay={0}>
        <button>Trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByText("Trigger");
    fireEvent.mouseEnter(trigger);
    await waitFor(() => expect(screen.getByText("Open settings")).toBeDefined());
    fireEvent.mouseLeave(trigger);
    await waitFor(() => expect(screen.queryByText("Open settings")).toBeNull());
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

```bash
bun run test -- tests/components/ui/tooltip.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `tooltip.tsx`**

Create `components/ui/tooltip.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  delay?: number;
  side?: "top" | "bottom";
}

export function Tooltip({ content, children, delay = 400, side = "top" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={
            "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-sm bg-[var(--ink-1)] px-2 py-1 text-caption text-[var(--card-bg)] shadow-elev-2 " +
            (side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5")
          }
        >
          {content}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run the test; expect PASS**

```bash
bun run test -- tests/components/ui/tooltip.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/tooltip.tsx tests/components/ui/tooltip.test.tsx
git commit -m "feat(ui): tooltip primitive"
```

---

### Task 8: Dropdown

Dropdown menu anchored to a trigger. Foundation for menus and the custom Select.

**Files:**
- Create: `components/ui/dropdown.tsx`
- Test: `tests/components/ui/dropdown.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/dropdown.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dropdown, DropdownItem } from "../../../components/ui/dropdown";

describe("Dropdown", () => {
  it("does not render items by default", () => {
    render(
      <Dropdown trigger={<button>Open</button>}>
        <DropdownItem onSelect={() => {}}>Hello</DropdownItem>
      </Dropdown>
    );
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("opens on trigger click and renders items", () => {
    render(
      <Dropdown trigger={<button>Open</button>}>
        <DropdownItem onSelect={() => {}}>Hello</DropdownItem>
      </Dropdown>
    );
    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByText("Hello")).toBeDefined();
  });

  it("closes after an item is selected and invokes the handler", () => {
    const handler = vi.fn();
    render(
      <Dropdown trigger={<button>Open</button>}>
        <DropdownItem onSelect={handler}>Hello</DropdownItem>
      </Dropdown>
    );
    fireEvent.click(screen.getByText("Open"));
    fireEvent.click(screen.getByText("Hello"));
    expect(handler).toHaveBeenCalled();
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("closes on Escape", () => {
    render(
      <Dropdown trigger={<button>Open</button>}>
        <DropdownItem onSelect={() => {}}>Hello</DropdownItem>
      </Dropdown>
    );
    fireEvent.click(screen.getByText("Open"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Hello")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

```bash
bun run test -- tests/components/ui/dropdown.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `dropdown.tsx`**

Create `components/ui/dropdown.tsx`:

```tsx
"use client";

import React, {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DropdownProps {
  trigger: ReactElement;
  children: ReactNode;
  align?: "start" | "end";
  side?: "top" | "bottom";
  className?: string;
}

const DropdownCloseContext = createContext<() => void>(() => {});

export function Dropdown({ trigger, children, align = "start", side = "bottom", className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, close]);

  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger, {
        onClick: (e: React.MouseEvent) => {
          (trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
          setOpen((v) => !v);
        },
      } as React.HTMLAttributes<HTMLElement>)
    : trigger;

  return (
    <div ref={wrapRef} className="relative inline-block">
      {triggerEl}
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 min-w-[200px] rounded-md border bg-[var(--floating-bg)] backdrop-blur-20 p-1 shadow-elev-3",
            side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
          style={{ borderColor: "var(--chrome-border)" }}
        >
          <DropdownCloseContext.Provider value={close}>{children}</DropdownCloseContext.Provider>
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  onSelect: () => void;
  children: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

export function DropdownItem({ onSelect, children, destructive, disabled }: DropdownItemProps) {
  const close = useContext(DropdownCloseContext);
  return (
    <button
      role="menuitem"
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onSelect();
        close();
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-body-s text-left transition-colors duration-fast ease-apple-out",
        destructive
          ? "text-danger hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]"
          : "text-ink hover:bg-accent-soft",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

export function DropdownDivider() {
  return <div className="my-1 h-px bg-hairline" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-1.5 pb-0.5 text-micro text-ink-secondary">{children}</div>;
}
```

- [ ] **Step 4: Run the test; expect PASS**

```bash
bun run test -- tests/components/ui/dropdown.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/dropdown.tsx tests/components/ui/dropdown.test.tsx
git commit -m "feat(ui): dropdown primitive with item + divider + label"
```

---

### Task 9: Dialog

Modal dialog with backdrop and a drawer-from-right variant.

**Files:**
- Create: `components/ui/dialog.tsx`
- Test: `tests/components/ui/dialog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/dialog.test.tsx`:

```tsx
import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog } from "../../../components/ui/dialog";

function Harness({ onOpenChange }: { onOpenChange?: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          onOpenChange?.(v);
        }}
        title="Confirm delete"
      >
        <p>Are you sure?</p>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("does not render content when closed", () => {
    render(<Harness />);
    expect(screen.queryByText("Confirm delete")).toBeNull();
  });

  it("renders content when open", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Open dialog"));
    expect(screen.getByText("Confirm delete")).toBeDefined();
    expect(screen.getByText("Are you sure?")).toBeDefined();
  });

  it("calls onOpenChange(false) when Escape pressed", () => {
    const handler = vi.fn();
    render(<Harness onOpenChange={handler} />);
    fireEvent.click(screen.getByText("Open dialog"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handler).toHaveBeenCalledWith(false);
  });

  it("close button calls onOpenChange(false)", () => {
    const handler = vi.fn();
    render(<Harness onOpenChange={handler} />);
    fireEvent.click(screen.getByText("Open dialog"));
    fireEvent.click(screen.getByLabelText("Close"));
    expect(handler).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

```bash
bun run test -- tests/components/ui/dialog.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `dialog.tsx`**

Create `components/ui/dialog.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

interface DialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description?: string;
  variant?: "center" | "drawer";
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  variant = "center",
  children,
  footer,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const isDrawer = variant === "drawer";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex"
      style={{ alignItems: isDrawer ? "stretch" : "center", justifyContent: isDrawer ? "flex-end" : "center" }}
    >
      <div
        aria-hidden
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/30 backdrop-blur-[12px] animate-in fade-in duration-base"
      />
      <div
        className={cn(
          "relative bg-surface shadow-elev-4 border border-hairline animate-in",
          isDrawer
            ? "h-full w-full max-w-[480px] rounded-l-lg slide-in-from-right duration-slow ease-apple-out"
            : "max-w-[480px] w-[92vw] rounded-lg fade-in zoom-in-95 duration-base ease-apple-out",
        )}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-hairline">
          <div className="min-w-0">
            <h2 className="text-title-l text-ink">{title}</h2>
            {description && <p className="mt-1 text-body-s text-ink-secondary">{description}</p>}
          </div>
          <button
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="shrink-0 rounded-sm p-1 text-ink-secondary hover:bg-accent-soft hover:text-ink transition-colors duration-fast"
          >
            <Icon name="X" size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-hairline">{footer}</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test; expect PASS**

```bash
bun run test -- tests/components/ui/dialog.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/dialog.tsx tests/components/ui/dialog.test.tsx
git commit -m "feat(ui): dialog primitive with center and drawer variants"
```

---

### Task 10: Toast + ToastProvider

**Files:**
- Create: `components/ui/toast.tsx`
- Test: `tests/components/ui/toast.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/toast.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastProvider, useToast } from "../../../components/ui/toast";

function Trigger() {
  const { toast } = useToast();
  return (
    <>
      <button onClick={() => toast({ variant: "success", message: "Saved" })}>save</button>
      <button onClick={() => toast({ variant: "error", message: "Failed" })}>fail</button>
    </>
  );
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("appears when toast() is called", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    act(() => {
      screen.getByText("save").click();
    });
    expect(screen.getByText("Saved")).toBeDefined();
  });

  it("auto-dismisses after the default duration", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    act(() => {
      screen.getByText("save").click();
    });
    expect(screen.getByText("Saved")).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(4500);
    });
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("stacks multiple toasts", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    act(() => {
      screen.getByText("save").click();
      screen.getByText("fail").click();
    });
    expect(screen.getByText("Saved")).toBeDefined();
    expect(screen.getByText("Failed")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

```bash
bun run test -- tests/components/ui/toast.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `toast.tsx`**

Create `components/ui/toast.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icon";

type ToastVariant = "success" | "error" | "info";

interface ToastInput {
  variant?: ToastVariant;
  message: string;
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastInput, "duration">> {
  id: number;
  duration: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_ICON: Record<ToastVariant, IconName> = {
  success: "CheckCircle2",
  error: "XCircle",
  info: "Info",
};

const VARIANT_COLOR: Record<ToastVariant, string> = {
  success: "var(--success)",
  error: "var(--danger)",
  info: "var(--accent)",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.random();
    const next: ToastItem = {
      id,
      variant: input.variant ?? "info",
      message: input.message,
      duration: input.duration ?? 4000,
    };
    setItems((prev) => [...prev, next]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <ToastRow key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, item.duration);
    return () => clearTimeout(t);
  }, [item.duration, onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-center gap-3 rounded-md bg-surface-floating backdrop-blur-20 border border-hairline shadow-elev-3 px-4 py-3 min-w-[260px] max-w-[420px]",
      )}
      style={{ borderLeft: `3px solid ${VARIANT_COLOR[item.variant]}` }}
    >
      <Icon name={VARIANT_ICON[item.variant]} size={16} color={VARIANT_COLOR[item.variant]} />
      <div className="text-body-s text-ink flex-1">{item.message}</div>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
```

- [ ] **Step 4: Run the test; expect PASS**

```bash
bun run test -- tests/components/ui/toast.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Wire `<ToastProvider>` into `app/layout.tsx`**

Modify `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { ThemeScript } from "@/components/ui/theme-script";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoleRecruit",
  description: "AI-powered hiring for schools",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <ThemeScript />
        </head>
        <body className="font-sans antialiased">
          <ThemeProvider>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/ui/toast.tsx tests/components/ui/toast.test.tsx app/layout.tsx
git commit -m "feat(ui): toast primitive with provider and auto-dismiss"
```

---

### Task 11: Theme toggle

The three-radio control inside the user menu. Uses `useTheme()` and renders three pills (Light / Dark / Match system).

**Files:**
- Create: `components/ui/theme-toggle.tsx`
- Test: `tests/components/ui/theme-toggle.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/theme-toggle.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "../../../components/ui/theme-provider";
import { ThemeToggle } from "../../../components/ui/theme-toggle";

function withProvider() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders three theme options", () => {
    withProvider();
    expect(screen.getByRole("radio", { name: /light/i })).toBeDefined();
    expect(screen.getByRole("radio", { name: /dark/i })).toBeDefined();
    expect(screen.getByRole("radio", { name: /system/i })).toBeDefined();
  });

  it("marks system selected by default", () => {
    withProvider();
    expect(screen.getByRole("radio", { name: /system/i }).getAttribute("aria-checked")).toBe("true");
  });

  it("changes theme when an option is clicked", () => {
    withProvider();
    fireEvent.click(screen.getByRole("radio", { name: /dark/i }));
    expect(window.localStorage.getItem("rr-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

```bash
bun run test -- tests/components/ui/theme-toggle.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `theme-toggle.tsx`**

Create `components/ui/theme-toggle.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { useTheme, type Theme } from "./theme-provider";

const OPTIONS: Array<{ value: Theme; label: string; icon: "Sun" | "Moon" | "Monitor" }> = [
  { value: "light", label: "Light", icon: "Sun" },
  { value: "dark", label: "Dark", icon: "Moon" },
  { value: "system", label: "Match system", icon: "Monitor" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-md bg-hairline p-1">
      {OPTIONS.map((o) => {
        const active = theme === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            onClick={() => setTheme(o.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-caption font-medium transition-colors duration-fast ease-apple-out",
              active ? "bg-surface text-ink shadow-elev-1" : "text-ink-secondary hover:text-ink",
            )}
          >
            <Icon name={o.icon} size={13} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run the test; expect PASS**

```bash
bun run test -- tests/components/ui/theme-toggle.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/theme-toggle.tsx tests/components/ui/theme-toggle.test.tsx
git commit -m "feat(ui): theme toggle with three options"
```

---

### Task 12: Button (refine)

Add `gradient` and `ink` variants. Add `iconLeft` and `iconRight` props for Lucide icons.

**Files:**
- Modify: `components/ui/button.tsx`
- Test: `tests/components/ui/button.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/button.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../../../components/ui/button";

describe("Button (refined)", () => {
  it("renders gradient variant with gradient background class", () => {
    const { container } = render(<Button variant="gradient">Apply</Button>);
    expect(container.querySelector("button")?.className).toContain("bg-accent-grad");
  });

  it("renders ink variant", () => {
    const { container } = render(<Button variant="ink">Post role</Button>);
    expect(container.querySelector("button")?.className).toContain("bg-ink");
  });

  it("renders iconLeft as SVG before label", () => {
    const { container } = render(<Button iconLeft="Plus">Add</Button>);
    const button = container.querySelector("button");
    const firstChild = button?.firstChild as Element;
    expect(firstChild?.tagName?.toLowerCase()).toBe("svg");
  });

  it("renders iconRight as SVG after label", () => {
    const { container } = render(<Button iconRight="ArrowRight">Next</Button>);
    const button = container.querySelector("button");
    const lastChild = button?.lastChild as Element;
    expect(lastChild?.tagName?.toLowerCase()).toBe("svg");
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

```bash
bun run test -- tests/components/ui/button.test.tsx
```

Expected: FAIL (the new variants don't exist yet).

- [ ] **Step 3: Replace `components/ui/button.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icon";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline" | "gradient" | "ink";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:opacity-90 active:opacity-100",
  secondary: "bg-surface-canvas text-ink hover:bg-hairline",
  danger: "bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-danger hover:bg-[color-mix(in_srgb,var(--danger)_15%,transparent)]",
  ghost: "text-ink-secondary hover:bg-accent-soft hover:text-ink",
  outline: "border border-hairline-strong text-ink hover:border-accent hover:text-accent",
  gradient: "bg-accent-grad text-white shadow-[0_2px_4px_rgba(0,113,227,0.2),0_8px_24px_rgba(0,113,227,0.2)] hover:opacity-95",
  ink: "bg-ink text-surface-canvas shadow-[0_1px_2px_rgba(0,0,0,0.1),0_4px_12px_rgba(0,0,0,0.12)] hover:translate-y-[-1px]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-caption gap-1.5",
  md: "px-4 py-2 text-body-s gap-1.5",
  lg: "px-6 py-2.5 text-body gap-2",
};

const iconSize: Record<ButtonSize, number> = { sm: 13, md: 14, lg: 16 };

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  iconLeft,
  iconRight,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition-all duration-fast ease-apple-out disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        iconLeft && <Icon name={iconLeft} size={iconSize[size]} />
      )}
      {children}
      {!loading && iconRight && <Icon name={iconRight} size={iconSize[size]} />}
    </button>
  );
}
```

Note: shape change is to `rounded-full` (was `rounded-apple`). This aligns every button to a pill. For variants where you want the legacy 10px radius (e.g., a button inside a card row), pass `className="rounded-md"`.

- [ ] **Step 4: Run the test; expect PASS**

```bash
bun run test -- tests/components/ui/button.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/button.tsx tests/components/ui/button.test.tsx
git commit -m "feat(ui): button gains gradient + ink variants and icon slots"
```

---

### Task 13: Card (refine)

Add `surface` (card / chrome / floating) and `elevation` (floor / 1 / 2 / 3 / 4) props. Replace `hover` with `interactive` (lifts on hover).

**Files:**
- Modify: `components/ui/card.tsx`
- Test: `tests/components/ui/card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/card.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Card } from "../../../components/ui/card";

describe("Card (refined)", () => {
  it("renders chrome surface with translucent class", () => {
    const { container } = render(<Card surface="chrome">x</Card>);
    expect(container.firstChild).toHaveClass("bg-surface-chrome");
  });

  it("renders floating surface", () => {
    const { container } = render(<Card surface="floating">x</Card>);
    expect(container.firstChild).toHaveClass("bg-surface-floating");
  });

  it("applies elev-2 class for elevation=2", () => {
    const { container } = render(<Card elevation={2}>x</Card>);
    expect(container.firstChild).toHaveClass("shadow-elev-2");
  });

  it("applies no shadow for elevation=floor", () => {
    const { container } = render(<Card elevation="floor">x</Card>);
    const cls = (container.firstChild as HTMLElement).className;
    expect(cls).not.toContain("shadow-elev");
  });

  it("interactive=true adds hover lift class", () => {
    const { container } = render(<Card interactive>x</Card>);
    expect(container.firstChild).toHaveClass("hover:shadow-elev-2");
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

```bash
bun run test -- tests/components/ui/card.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Replace `components/ui/card.tsx`**

```tsx
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Surface = "card" | "chrome" | "floating";
type Elevation = "floor" | 1 | 2 | 3 | 4;
type Padding = "none" | "sm" | "md" | "lg";

interface CardProps {
  children: ReactNode;
  surface?: Surface;
  elevation?: Elevation;
  interactive?: boolean;
  padding?: Padding;
  className?: string;
}

const surfaceClasses: Record<Surface, string> = {
  card: "bg-surface border border-hairline",
  chrome: "bg-surface-chrome backdrop-blur-24 border border-chrome",
  floating: "bg-surface-floating backdrop-blur-20 border border-chrome",
};

const elevationClasses: Record<string, string> = {
  floor: "",
  "1": "shadow-elev-1",
  "2": "shadow-elev-2",
  "3": "shadow-elev-3",
  "4": "shadow-elev-4",
};

const paddingClasses: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-8",
};

export function Card({
  children,
  surface = "card",
  elevation = 1,
  interactive = false,
  padding = "md",
  className,
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg transition-all duration-base ease-apple-out",
        surfaceClasses[surface],
        elevationClasses[String(elevation)],
        interactive && "hover:shadow-elev-2 cursor-pointer",
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run the test; expect PASS**

```bash
bun run test -- tests/components/ui/card.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/card.tsx tests/components/ui/card.test.tsx
git commit -m "feat(ui): card adds surface and elevation props"
```

---

### Task 14: Input (refine)

Add `size` and `iconLeft` props. Improve focus ring.

**Files:**
- Modify: `components/ui/input.tsx`
- Test: `tests/components/ui/input.test.tsx`

- [ ] **Step 1: Read current `input.tsx`**

Read the current `components/ui/input.tsx` so the new version preserves the existing API.

- [ ] **Step 2: Write the failing test**

Create `tests/components/ui/input.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "../../../components/ui/input";

describe("Input (refined)", () => {
  it("renders a text input by default", () => {
    render(<Input placeholder="Search" />);
    expect(screen.getByPlaceholderText("Search")).toBeDefined();
  });

  it("applies size=lg class", () => {
    render(<Input size="lg" placeholder="x" />);
    expect(screen.getByPlaceholderText("x").className).toContain("h-11");
  });

  it("renders iconLeft inside wrapper", () => {
    const { container } = render(<Input iconLeft="Search" placeholder="x" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run the test; expect FAIL**

```bash
bun run test -- tests/components/ui/input.test.tsx
```

Expected: FAIL (the new size or iconLeft props don't exist).

- [ ] **Step 4: Replace `components/ui/input.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";
import { Icon, type IconName } from "./icon";

type InputSize = "sm" | "md" | "lg";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: InputSize;
  iconLeft?: IconName;
}

const sizeClasses: Record<InputSize, string> = {
  sm: "h-8 text-caption px-3",
  md: "h-[38px] text-body-s px-3",
  lg: "h-11 text-body px-4",
};

export function Input({ size = "md", iconLeft, className, ...props }: InputProps) {
  if (iconLeft) {
    return (
      <div className="relative inline-flex w-full">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary">
          <Icon name={iconLeft} size={size === "sm" ? 13 : 14} />
        </span>
        <input
          {...props}
          className={cn(
            "w-full rounded-sm bg-surface border border-hairline-strong text-ink placeholder:text-ink-tertiary outline-none transition-all duration-fast ease-apple-out focus:border-accent focus:ring-2 focus:ring-accent-soft",
            "pl-8",
            sizeClasses[size],
            className,
          )}
        />
      </div>
    );
  }

  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-sm bg-surface border border-hairline-strong text-ink placeholder:text-ink-tertiary outline-none transition-all duration-fast ease-apple-out focus:border-accent focus:ring-2 focus:ring-accent-soft",
        sizeClasses[size],
        className,
      )}
    />
  );
}
```

- [ ] **Step 5: Run the test; expect PASS**

```bash
bun run test -- tests/components/ui/input.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/ui/input.tsx tests/components/ui/input.test.tsx
git commit -m "feat(ui): input gains size variants and iconLeft slot"
```

---

### Task 15: Badge (refine)

Add `dot` variant. Rename variants to status terminology.

**Files:**
- Modify: `components/ui/badge.tsx`
- Test: `tests/components/ui/badge.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/badge.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../../../components/ui/badge";

describe("Badge (refined)", () => {
  it("renders neutral by default", () => {
    render(<Badge>Hello</Badge>);
    expect(screen.getByText("Hello")).toBeDefined();
  });

  it("renders success variant", () => {
    const { container } = render(<Badge variant="success">Active</Badge>);
    expect(container.firstChild?.textContent).toBe("Active");
  });

  it("dot variant shows a colored dot", () => {
    const { container } = render(<Badge dot variant="success">Active</Badge>);
    const dot = container.querySelector("[data-dot]");
    expect(dot).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

```bash
bun run test -- tests/components/ui/badge.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Replace `components/ui/badge.tsx`**

```tsx
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const VARIANT_BG: Record<BadgeVariant, string> = {
  neutral: "bg-hairline text-ink",
  info: "bg-accent-soft text-accent",
  success: "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[color-mix(in_srgb,var(--success)_75%,var(--ink-1))]",
  warning: "bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[color-mix(in_srgb,var(--warning)_75%,var(--ink-1))]",
  danger: "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger",
};

const DOT_COLOR: Record<BadgeVariant, string> = {
  neutral: "var(--ink-3)",
  info: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

export function Badge({ children, variant = "neutral", dot, className }: BadgeProps) {
  if (dot) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-caption font-medium text-ink",
          className,
        )}
      >
        <span
          data-dot
          className="h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: DOT_COLOR[variant],
            boxShadow: `0 0 0 3px color-mix(in srgb, ${DOT_COLOR[variant]} 18%, transparent)`,
          }}
        />
        {children}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs px-2 py-0.5 text-caption font-medium",
        VARIANT_BG[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Run the test; expect PASS**

```bash
bun run test -- tests/components/ui/badge.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/badge.tsx tests/components/ui/badge.test.tsx
git commit -m "feat(ui): badge dot variant and status-named variants"
```

---

### Task 16: Tabs (refine)

Gradient indicator. `count` slot per tab.

**Files:**
- Modify: `components/ui/tabs.tsx`
- Test: `tests/components/ui/tabs.test.tsx`

- [ ] **Step 1: Read current `tabs.tsx`** to see its current API and preserve compatible call sites.

- [ ] **Step 2: Write the failing test**

Create `tests/components/ui/tabs.test.tsx`:

```tsx
import React, { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "../../../components/ui/tabs";

function Harness() {
  const [value, setValue] = useState("pipeline");
  return (
    <Tabs
      value={value}
      onChange={setValue}
      items={[
        { value: "pipeline", label: "Pipeline", count: 11 },
        { value: "sourcing", label: "Sourcing" },
        { value: "criteria", label: "Criteria" },
      ]}
    />
  );
}

describe("Tabs (refined)", () => {
  it("renders all tabs with labels", () => {
    render(<Harness />);
    expect(screen.getByText("Pipeline")).toBeDefined();
    expect(screen.getByText("Sourcing")).toBeDefined();
    expect(screen.getByText("Criteria")).toBeDefined();
  });

  it("renders count when provided", () => {
    render(<Harness />);
    expect(screen.getByText("11")).toBeDefined();
  });

  it("clicking a tab updates the active state", () => {
    render(<Harness />);
    const sourcing = screen.getByText("Sourcing");
    fireEvent.click(sourcing);
    expect(sourcing.closest("button")?.getAttribute("aria-selected")).toBe("true");
  });
});
```

- [ ] **Step 3: Run the test; expect FAIL**

```bash
bun run test -- tests/components/ui/tabs.test.tsx
```

Expected: FAIL (count slot doesn't exist or API differs).

- [ ] **Step 4: Replace `components/ui/tabs.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";

interface TabItem {
  value: string;
  label: string;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div role="tablist" className={cn("flex gap-1 border-b border-hairline", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative px-3.5 py-2 text-body-s transition-colors duration-fast ease-apple-out",
              active ? "text-ink font-semibold" : "text-ink-secondary hover:text-ink",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {item.label}
              {item.count != null && (
                <span className="text-caption text-ink-tertiary tabular-nums">{item.count}</span>
              )}
            </span>
            {active && (
              <span
                aria-hidden
                className="absolute left-3.5 right-3.5 -bottom-px h-[2px] rounded-full bg-accent-grad"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Run the test; expect PASS**

```bash
bun run test -- tests/components/ui/tabs.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/ui/tabs.tsx tests/components/ui/tabs.test.tsx
git commit -m "feat(ui): tabs gradient indicator with count slot"
```

---

### Task 17: Select (rewrite)

Replace the native `<select>` styling with a custom dropdown-backed Select that uses the Dropdown primitive. Keep the API close to the current one (`value`, `onChange`, `options`).

**Files:**
- Modify: `components/ui/select.tsx`
- Test: `tests/components/ui/select.test.tsx`

- [ ] **Step 1: Read current `select.tsx`** to capture the existing prop names and any call sites.

- [ ] **Step 2: Write the failing test**

Create `tests/components/ui/select.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Select } from "../../../components/ui/select";

describe("Select", () => {
  const options = [
    { value: "15", label: "15 minutes" },
    { value: "30", label: "30 minutes" },
    { value: "45", label: "45 minutes" },
  ];

  it("renders the current option label as the trigger", () => {
    render(<Select value="30" onChange={() => {}} options={options} />);
    expect(screen.getByText("30 minutes")).toBeDefined();
  });

  it("opens menu on trigger click and shows all options", () => {
    render(<Select value="30" onChange={() => {}} options={options} />);
    fireEvent.click(screen.getByText("30 minutes"));
    expect(screen.getByText("15 minutes")).toBeDefined();
    expect(screen.getByText("45 minutes")).toBeDefined();
  });

  it("calls onChange with the selected value", () => {
    const handler = vi.fn();
    render(<Select value="30" onChange={handler} options={options} />);
    fireEvent.click(screen.getByText("30 minutes"));
    fireEvent.click(screen.getByText("45 minutes"));
    expect(handler).toHaveBeenCalledWith("45");
  });
});
```

- [ ] **Step 3: Run the test; expect FAIL**

```bash
bun run test -- tests/components/ui/select.test.tsx
```

Expected: FAIL.

- [ ] **Step 4: Replace `components/ui/select.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Dropdown, DropdownItem } from "./dropdown";
import { Icon } from "./icon";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export function Select({ value, onChange, options, placeholder = "Choose", className }: SelectProps) {
  const current = options.find((o) => o.value === value);
  return (
    <Dropdown
      align="end"
      trigger={
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-sm border border-hairline-strong bg-surface px-3 py-[7px] text-body-s text-ink hover:border-accent transition-colors duration-fast",
            className,
          )}
        >
          <span>{current?.label ?? placeholder}</span>
          <Icon name="ChevronDown" size={13} color="var(--ink-3)" />
        </button>
      }
    >
      {options.map((o) => (
        <DropdownItem key={o.value} onSelect={() => onChange(o.value)}>
          {o.label}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
```

- [ ] **Step 5: Run the test; expect PASS**

```bash
bun run test -- tests/components/ui/select.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 6: Verify the existing `TalentControls` test still passes**

The existing `tests/components/talent-controls.test.tsx` uses `getByRole("combobox")` and `fireEvent.change(select, { target: { value: "score" } })`. The new `<Select>` is a button-based dropdown, not a `<select>` element, so this query will fail.

If the test runs against the new Select, update it (in the existing file) to click the trigger and then click the option:

```tsx
it("calls onSortChange when sort dropdown changes", () => {
  const onSortChange = vi.fn();
  render(<TalentControls {...defaultProps} onSortChange={onSortChange} />);

  // Open the sort menu and pick "Match score"
  fireEvent.click(screen.getByText(/newest/i));
  fireEvent.click(screen.getByText(/match score/i));
  expect(onSortChange).toHaveBeenCalledWith("score");
});
```

Only update if it's failing. If `TalentControls` is using a different control internally (or hasn't been migrated to the new Select yet), leave its test as-is.

Run:
```bash
bun run test -- tests/components/talent-controls.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/ui/select.tsx tests/components/ui/select.test.tsx tests/components/talent-controls.test.tsx
git commit -m "feat(ui): rewrite select as a custom dropdown-backed control"
```

---

### Task 18: EmptyState (refine)

Add `illustration` slot.

**Files:**
- Modify: `components/ui/empty-state.tsx`

- [ ] **Step 1: Read current `empty-state.tsx`**

- [ ] **Step 2: Replace with refined version**

```tsx
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  illustration?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, illustration, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-6", className)}>
      {illustration ? (
        <div className="mb-5">{illustration}</div>
      ) : icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-accent-soft text-accent">
          {icon}
        </div>
      ) : null}
      <h3 className="text-title-l text-ink">{title}</h3>
      {description && <p className="mt-1 text-body-s text-ink-secondary max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/empty-state.tsx
git commit -m "refactor(ui): empty-state gains illustration slot and refined tokens"
```

---

### Task 19: Skeleton (refine)

Use new surface tokens; soften the animation.

**Files:**
- Modify: `components/ui/skeleton.tsx`

- [ ] **Step 1: Replace `components/ui/skeleton.tsx`**

```tsx
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("rounded-sm bg-hairline animate-pulse", className)} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/skeleton.tsx
git commit -m "refactor(ui): skeleton uses new hairline token"
```

---

### Task 20: UI barrel exports

**Files:**
- Create: `components/ui/index.ts`

- [ ] **Step 1: Create the barrel**

```ts
export { Avatar } from "./avatar";
export { Badge } from "./badge";
export { Button } from "./button";
export { Card } from "./card";
export { Dialog } from "./dialog";
export { Dropdown, DropdownItem, DropdownDivider, DropdownLabel } from "./dropdown";
export { EmptyState } from "./empty-state";
export { Icon, type IconName } from "./icon";
export { Input } from "./input";
export { PageHeader } from "./page-header"; // created in Task 21
export { Select } from "./select";
export { Skeleton } from "./skeleton";
export { Tabs } from "./tabs";
export { ThemeProvider, useTheme } from "./theme-provider";
export { ThemeScript } from "./theme-script";
export { ThemeToggle } from "./theme-toggle";
export { ToastProvider, useToast } from "./toast";
export { Toggle } from "./toggle";
export { Tooltip } from "./tooltip";
```

Note: the `PageHeader` export will fail until Task 21 lands. Commit after Task 21.

---

## Phase 3: Shell

### Task 21: PageHeader

**Files:**
- Create: `components/ui/page-header.tsx`
- Test: `tests/components/ui/page-header.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/ui/page-header.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "../../../components/ui/page-header";

describe("PageHeader", () => {
  it("renders title", () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByText("Dashboard")).toBeDefined();
  });

  it("renders eyebrow above title when provided", () => {
    render(<PageHeader title="Dashboard" eyebrow="Welcome back, Sumanth" />);
    expect(screen.getByText("Welcome back, Sumanth")).toBeDefined();
  });

  it("renders subtitle when provided", () => {
    render(<PageHeader title="Dashboard" subtitle="4 open roles" />);
    expect(screen.getByText("4 open roles")).toBeDefined();
  });

  it("renders back link with href and label", () => {
    render(<PageHeader title="Detail" back={{ href: "/dashboard/jobs", label: "Jobs" }} />);
    const back = screen.getByText("Jobs").closest("a");
    expect(back?.getAttribute("href")).toBe("/dashboard/jobs");
  });

  it("renders actions slot on the right", () => {
    render(<PageHeader title="Dashboard" actions={<button>+ Post role</button>} />);
    expect(screen.getByText("+ Post role")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

```bash
bun run test -- tests/components/ui/page-header.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `page-header.tsx`**

Create `components/ui/page-header.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  back?: { href: string; label: string };
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, eyebrow, subtitle, back, status, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-7", className)}>
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1 text-body-s font-medium text-ink-secondary hover:text-ink mb-3 transition-colors"
        >
          <Icon name="ChevronLeft" size={14} />
          {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="text-caption font-medium text-ink-secondary mb-1">{eyebrow}</div>}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-display-m text-ink">{title}</h1>
            {status}
          </div>
          {subtitle && <p className="text-body-s text-ink-secondary mt-1.5">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test; expect PASS**

```bash
bun run test -- tests/components/ui/page-header.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit (includes the barrel from Task 20)**

```bash
git add components/ui/page-header.tsx components/ui/index.ts tests/components/ui/page-header.test.tsx
git commit -m "feat(ui): page-header primitive and ui barrel"
```

---

### Task 22: Sidebar rewrite

Full rewrite per the Shell spec section.

**Files:**
- Modify: `components/dashboard/sidebar.tsx`
- Test: `tests/components/sidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/sidebar.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "../../components/dashboard/sidebar";
import { ThemeProvider } from "../../components/ui/theme-provider";

// Stub the role gate to always render its children (since we don't have a Convex client in tests).
vi.mock("@/components/auth/role-gate", () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Stub usePathname so active state can be deterministic.
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

function wrap() {
  return render(
    <ThemeProvider>
      <Sidebar userName="Sumanth" userRole="Admin · Riverside" />
    </ThemeProvider>
  );
}

describe("Sidebar", () => {
  it("renders the brand wordmark", () => {
    wrap();
    expect(screen.getByText("RoleRecruit")).toBeDefined();
  });

  it("renders nav items", () => {
    wrap();
    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("Jobs")).toBeDefined();
    expect(screen.getByText("Pipeline")).toBeDefined();
    expect(screen.getByText("Talent Bank")).toBeDefined();
  });

  it("marks the active route item with aria-current=page", () => {
    wrap();
    const dashboard = screen.getByText("Dashboard").closest("a");
    expect(dashboard?.getAttribute("aria-current")).toBe("page");
  });

  it("user chip shows the user name and role", () => {
    wrap();
    expect(screen.getByText("Sumanth")).toBeDefined();
    expect(screen.getByText("Admin · Riverside")).toBeDefined();
  });

  it("clicking the user chip opens the theme menu", () => {
    wrap();
    fireEvent.click(screen.getByText("Sumanth"));
    expect(screen.getByText(/sign out/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

```bash
bun run test -- tests/components/sidebar.test.tsx
```

Expected: FAIL (the new sidebar API requires userName / userRole props that don't exist).

- [ ] **Step 3: Replace `components/dashboard/sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RoleGate } from "@/components/auth/role-gate";
import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
import { Dropdown, DropdownDivider, DropdownItem, DropdownLabel } from "@/components/ui/dropdown";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
  icon: IconName;
}

const PRIMARY_NAV: NavLink[] = [
  { href: "/dashboard",          label: "Dashboard",   icon: "Home" },
  { href: "/dashboard/jobs",     label: "Jobs",        icon: "Briefcase" },
  { href: "/dashboard/pipeline", label: "Pipeline",    icon: "Kanban" },
  { href: "/dashboard/talent",   label: "Talent Bank", icon: "Users" },
];

interface SidebarProps {
  userName: string;
  userRole?: string;
}

export function Sidebar({ userName, userRole }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-[232px] shrink-0 bg-surface-chrome backdrop-blur-24 border-r border-chrome flex flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-5">
        <div className="h-[26px] w-[26px] rounded-[7px] bg-accent-grad text-white text-[14px] font-bold flex items-center justify-center tracking-tight shadow-[0_2px_6px_rgba(0,113,227,0.3)]">
          R
        </div>
        <span className="text-title-m text-ink">RoleRecruit</span>
      </div>

      <nav className="flex-1 px-3.5 flex flex-col gap-px">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        <RoleGate requiredAction="settings" fallback={null}>
          <div className="text-micro text-ink-tertiary px-3 pt-4 pb-1.5">Manage</div>
          <NavLink
            item={{ href: "/dashboard/settings", label: "Settings", icon: "Settings" }}
            active={pathname.startsWith("/dashboard/settings")}
          />
        </RoleGate>
      </nav>

      <div className="px-3.5 pb-4 pt-3">
        <Dropdown
          side="top"
          align="start"
          trigger={
            <button
              type="button"
              className="w-full flex items-center gap-2.5 rounded-md bg-surface-floating border border-chrome px-2.5 py-2 text-left hover:bg-accent-soft transition-colors duration-fast"
            >
              <Avatar name={userName} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-body-s font-semibold text-ink leading-tight truncate">{userName}</div>
                {userRole && <div className="text-caption text-ink-secondary leading-tight truncate">{userRole}</div>}
              </div>
              <Icon name="ChevronUp" size={14} color="var(--ink-3)" />
            </button>
          }
        >
          <DropdownLabel>Theme</DropdownLabel>
          <div className="px-2.5 py-1.5">
            <ThemeToggle />
          </div>
          <DropdownDivider />
          <DropdownItem
            onSelect={() => {
              window.location.href = "/sign-out";
            }}
          >
            Sign out
          </DropdownItem>
        </Dropdown>
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavLink; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-[11px] rounded-sm px-3 py-2 text-body-s font-medium transition-colors duration-fast ease-apple-out",
        active
          ? "bg-surface-floating shadow-elev-1 text-ink"
          : "text-ink hover:bg-accent-soft",
      )}
    >
      <Icon name={item.icon} size={16} color={active ? "var(--accent)" : "var(--ink-2)"} />
      {item.label}
      {active && (
        <span
          aria-hidden
          className="absolute left-[-14px] top-2 bottom-2 w-[3px] rounded-r-sm bg-accent-grad"
        />
      )}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}
```

- [ ] **Step 4: Update `app/dashboard/layout.tsx` to pass user props**

The current layout discards the `requireProfile()` return value and wraps everything in `<ConvexClientProvider>`. The new Sidebar needs `userName` (and optionally `userRole`), so we keep the provider, capture the profile, and pass its fields:

```tsx
import { requireProfile } from "@/lib/auth";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();

  return (
    <ConvexClientProvider>
      <div className="flex min-h-screen">
        <Sidebar
          userName={profile.fullName ?? profile.email ?? "User"}
          userRole={profile.role}
        />
        <main className="flex-1 p-8 min-w-0">{children}</main>
      </div>
    </ConvexClientProvider>
  );
}
```

If `profile.fullName` / `profile.email` / `profile.role` don't exist on the shape returned by `api.users.getProfile`, read `convex/users.ts` to find the actual field names and substitute. Common variants: `name`, `displayName`, `roleName`.

- [ ] **Step 5: Run the test; expect PASS**

```bash
bun run test -- tests/components/sidebar.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 6: Manual smoke test**

```bash
bun run dev
```

Visit `/dashboard`. Confirm: sidebar shows the brand mark + wordmark, Lucide icons next to each nav label, active rail on Dashboard, user chip at bottom, clicking the chip opens a menu with theme picker and Sign out. Sign out submits to `/sign-out`. Theme picker switches the canvas background and persists across reloads.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/sidebar.tsx app/dashboard/layout.tsx tests/components/sidebar.test.tsx
git commit -m "feat(shell): new sidebar with brand, icons, active rail, theme menu"
```

---

### Task 23: Marketing topbar

**Files:**
- Create: `components/careers/MarketingTopbar.tsx`
- Test: `tests/components/marketing-topbar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/marketing-topbar.test.tsx`:

```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketingTopbar } from "../../components/careers/MarketingTopbar";

describe("MarketingTopbar", () => {
  it("renders school name and brand mark", () => {
    render(<MarketingTopbar schoolName="Riverside School" schoolSlug="riverside" />);
    expect(screen.getByText("Riverside School")).toBeDefined();
  });

  it("renders Apply CTA linking to apply route", () => {
    render(<MarketingTopbar schoolName="Riverside" schoolSlug="riverside" />);
    const apply = screen.getByText("Apply").closest("a");
    expect(apply?.getAttribute("href")).toBe("/careers/riverside/apply");
  });
});
```

- [ ] **Step 2: Run the test; expect FAIL**

```bash
bun run test -- tests/components/marketing-topbar.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `MarketingTopbar.tsx`**

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";

interface MarketingTopbarProps {
  schoolName: string;
  schoolSlug: string;
  className?: string;
}

function initial(name: string): string {
  const t = name.trim();
  return t ? t[0].toUpperCase() : "·";
}

export function MarketingTopbar({ schoolName, schoolSlug, className }: MarketingTopbarProps) {
  return (
    <header className={cn(
      "sticky top-0 z-30 flex items-center justify-between px-9 py-4 bg-[rgba(250,250,250,0.75)] backdrop-blur-20 border-b border-hairline",
      className,
    )}>
      <Link href={`/careers/${schoolSlug}`} className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-sm bg-gradient-to-br from-[#1d1d1f] to-[#4a4a52] text-white text-[14px] font-bold flex items-center justify-center tracking-tight">
          {initial(schoolName)}
        </div>
        <span className="text-title-m text-ink">{schoolName}</span>
      </Link>
      <nav className="flex items-center gap-4">
        <Link href={`/careers/${schoolSlug}`} className="text-body-s font-medium text-ink-secondary hover:text-ink transition-colors">
          About
        </Link>
        <Link href={`/careers/${schoolSlug}/jobs`} className="text-body-s font-medium text-ink-secondary hover:text-ink transition-colors">
          Open roles
        </Link>
        <Link
          href={`/careers/${schoolSlug}/apply`}
          className="rounded-full bg-ink text-surface-canvas px-3.5 py-1.5 text-body-s font-medium hover:opacity-90 transition-opacity"
        >
          Apply
        </Link>
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: Run the test; expect PASS**

```bash
bun run test -- tests/components/marketing-topbar.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/careers/MarketingTopbar.tsx tests/components/marketing-topbar.test.tsx
git commit -m "feat(marketing): translucent topbar for careers routes"
```

---

### Task 24: Careers layouts (marketing canvas)

The marketing canvas is the off-white variant. We set it via the `data-canvas="marketing"` body attribute. Since this is server-side, we apply it through a layout file using `<body>` is not possible directly; we'll use a wrapper div that overrides the canvas instead.

**Files:**
- Modify: `app/careers/layout.tsx`
- Modify: `app/careers/[slug]/layout.tsx`

- [ ] **Step 1: Replace `app/careers/layout.tsx`**

```tsx
import "../globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexClientProvider>
      <div className="min-h-screen bg-surface-marketing">
        {children}
      </div>
    </ConvexClientProvider>
  );
}
```

If the existing file has additional imports or wrappers, preserve those; only the wrapper class + Marketing canvas matter.

- [ ] **Step 2: Replace `app/careers/[slug]/layout.tsx`**

The existing `app/careers/[slug]/page.tsx` is a client component that uses `useQuery(api.careers.getSchoolBySlug, { slug })`. The layout has to render a server component (so the topbar can SSR), so it uses Convex's server fetch helper instead:

```tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { MarketingTopbar } from "@/components/careers/MarketingTopbar";

export default async function SchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const school = await fetchQuery(api.careers.getSchoolBySlug, { slug: params.slug });

  if (!school) {
    // Fall through to the page, which renders its own "School not found" UI.
    return <>{children}</>;
  }

  return (
    <>
      <MarketingTopbar schoolName={school.name} schoolSlug={params.slug} />
      {children}
    </>
  );
}
```

If `api.careers.getSchoolBySlug` returns a different shape (e.g., property named `displayName` not `name`), open `convex/careers.ts` to check and substitute. The fetch is unauthenticated; if it requires auth and fails, fall back to the slug as the display name.

- [ ] **Step 3: Manual smoke test**

```bash
bun run dev
```

Visit `/careers/riverside` (use an existing school slug from the DB; if none exists, seed one or check Convex dashboard). Expected: off-white background instead of atmospheric blue, sticky topbar at the top, school name shown.

- [ ] **Step 4: Commit**

```bash
git add app/careers/layout.tsx app/careers/[slug]/layout.tsx
git commit -m "feat(marketing): careers layout uses marketing canvas + topbar"
```

---

### Task 25: Clerk theming

Wire Clerk's `appearance` prop to our tokens so sign-in / sign-up cards look like the rest of the app.

**Files:**
- Create: `lib/clerk-appearance.ts`
- Modify: `app/sign-in/[[...sign-in]]/page.tsx`
- Modify: `app/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: Create `lib/clerk-appearance.ts`**

```ts
import type { Appearance } from "@clerk/types";

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: "#0071e3",
    colorBackground: "transparent",
    colorText: "var(--ink-1)",
    colorTextSecondary: "var(--ink-2)",
    colorInputBackground: "var(--card-bg)",
    colorInputText: "var(--ink-1)",
    borderRadius: "10px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontSize: "14px",
  },
  elements: {
    card: "shadow-elev-3 border border-hairline bg-surface backdrop-blur-20",
    formButtonPrimary: "bg-accent hover:opacity-90 rounded-full text-body-s font-medium",
    socialButtonsBlockButton: "rounded-md border-hairline-strong",
    footerActionLink: "text-accent",
    formFieldInput: "border-hairline-strong focus:border-accent focus:ring-2 focus:ring-accent-soft rounded-sm",
    headerTitle: "text-display-s text-ink",
    headerSubtitle: "text-body-s text-ink-secondary",
  },
};
```

- [ ] **Step 2: Update `app/sign-in/[[...sign-in]]/page.tsx`**

Read the current file, then replace with:

```tsx
import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center gap-2.5 px-9 py-5">
        <div className="h-[26px] w-[26px] rounded-[7px] bg-accent-grad text-white text-[14px] font-bold flex items-center justify-center tracking-tight">
          R
        </div>
        <span className="text-title-m text-ink">RoleRecruit</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <SignIn appearance={clerkAppearance} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `app/sign-up/[[...sign-up]]/page.tsx`** with the same pattern, swapping `SignIn` for `SignUp`.

- [ ] **Step 4: Manual smoke test**

```bash
bun run dev
```

Visit `/sign-in` (signed-out browser session). Expected: brand chip top-left, Clerk card centered, primary button uses accent color, inputs match our radius and border. Switch theme to dark in another tab (writing to localStorage `rr-theme`) and reload `/sign-in` to confirm tokens follow.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add lib/clerk-appearance.ts app/sign-in/[[...sign-in]]/page.tsx app/sign-up/[[...sign-up]]/page.tsx
git commit -m "feat(auth): clerk theme uses our tokens"
```

---

### Task 26: Full primitives + shell verification

A final pass to make sure everything composes and the new tokens cover the existing screens without obvious regression.

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
bun run test
```

Expected: all tests pass. Investigate any regression.

- [ ] **Step 2: Run typecheck**

```bash
bunx tsc --noEmit
```

Expected: zero errors. Common gotchas: a removed Tailwind utility (e.g., the old `bg-surface-secondary`) called from a screen we haven't migrated yet. Add a temporary alias to `tailwind.config.ts` `extend.colors.surface` if needed (e.g., `secondary: "var(--canvas-base)"`) OR migrate the offending call site if it's small.

- [ ] **Step 3: Manual cross-screen smoke test**

```bash
bun run dev
```

Visit each of these and screenshot or note any visual regression. The goal is to confirm nothing is broken; explicit redesigns happen in Plan 2.

1. `/dashboard` (home)
2. `/dashboard/jobs`
3. `/dashboard/pipeline`
4. `/dashboard/talent`
5. `/dashboard/settings`
6. `/onboarding` (if you have a signed-in test user without a school)
7. `/sign-in`
8. `/careers/<seeded-slug>`

For each: does the new sidebar render? Theme toggle in the user menu? Canvas atmosphere? No console errors?

If any screen has broken Tailwind classes (e.g., `bg-surface-secondary` no longer maps), either:
* add a temporary alias in `tailwind.config.ts` (`surface.secondary: "var(--canvas-base)"`), or
* fix the call site if it's a small change.

The principle: visual regressions are acceptable in this plan; functional regressions are not.

- [ ] **Step 4: Commit any small fixups**

```bash
git add -A
git commit -m "fix(ui): bridge regressions from token migration"
```

- [ ] **Step 5: Tag the milestone (optional)**

```bash
git tag ui-foundation-primitives-shell
```

This marks where Plan 1 ends. Plan 2 will migrate every internal surface to the new language.

---

## Plan complete

After Task 26, the application has:
* CSS variable-driven dark mode + light mode, persisted across reloads, with system option
* Atmospheric canvas behind every internal page; off-white canvas on `/careers/*`
* Refined Button, Card, Input, Select, Badge, Tabs, EmptyState, Skeleton
* New Dialog, Toast, Dropdown, Tooltip, Avatar, Toggle, Theme Toggle, Icon wrapper, PageHeader
* New sidebar with brand mark, Lucide icons, accent-gradient active rail, user chip + theme menu, sign out
* Marketing topbar on `/careers/*`
* Clerk pages themed to our tokens

The existing internal screens (Dashboard, Jobs, Pipeline, Talent, Settings) will look mixed: new chrome around them but inline-styled content inside. That's expected. Plan 2 migrates every surface in Phase 4.

**Next:** Write Plan 2 (internal surfaces) when ready.
