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
