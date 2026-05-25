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
  // Single lazy initializer reads localStorage once and derives both values.
  const [{ theme, resolvedTheme }, setThemeState] = useState<{
    theme: Theme;
    resolvedTheme: ResolvedTheme;
  }>(() => {
    const t = readStored();
    return { theme: t, resolvedTheme: resolve(t) };
  });

  const apply = useCallback((next: Theme) => {
    const r = resolve(next);
    setThemeState((prev) => ({ ...prev, resolvedTheme: r }));
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", r);
    }
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState((prev) => ({ ...prev, theme: next }));
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
