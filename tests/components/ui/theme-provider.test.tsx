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
