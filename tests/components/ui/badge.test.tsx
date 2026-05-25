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
