import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "../../components/dashboard/sidebar";
import { ThemeProvider } from "../../components/ui/theme-provider";

vi.mock("@/components/auth/role-gate", () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

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
