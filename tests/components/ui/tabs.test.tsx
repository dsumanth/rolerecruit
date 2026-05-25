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
