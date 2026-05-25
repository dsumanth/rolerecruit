import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TalentControls } from "../../components/talent/talent-controls";

describe("TalentControls", () => {
  const defaultProps = {
    searchQuery: "",
    onSearchChange: vi.fn(),
    selectedPoolId: "all" as const,
    onPoolChange: vi.fn(),
    pools: [
      { _id: "p1", name: "TGT English", count: 5 },
      { _id: "p2", name: "PGT Mathematics", count: 3 },
    ],
    selectedStages: [],
    onStagesChange: vi.fn(),
    stageCounts: { sourced: 8, screened: 3 },
    sortBy: "newest" as const,
    onSortChange: vi.fn(),
    totalCount: 10,
    filteredCount: 10,
  };

  it("renders pool pills with counts", () => {
    render(<TalentControls {...defaultProps} />);
    const allButtons = screen.getAllByText("All");
    expect(allButtons.length).toBeGreaterThan(0);
    expect(screen.getByText("TGT English")).toBeDefined();
    expect(screen.getByText("PGT Mathematics")).toBeDefined();
  });

  it("calls onPoolChange when a pool pill is clicked", () => {
    const onPoolChange = vi.fn();
    render(<TalentControls {...defaultProps} onPoolChange={onPoolChange} />);

    fireEvent.click(screen.getByText("TGT English"));
    expect(onPoolChange).toHaveBeenCalledWith("p1");
  });

  it("calls onPoolChange with 'all' when All pool pill is clicked", () => {
    const onPoolChange = vi.fn();
    render(
      <TalentControls {...defaultProps} selectedPoolId="p1" onPoolChange={onPoolChange} />
    );

    const allButtons = screen.getAllByText("All");
    // The pool "All" button is the first one when pools exist
    fireEvent.click(allButtons[0]);
    expect(onPoolChange).toHaveBeenCalledWith("all");
  });

  it("renders stage pills", () => {
    render(<TalentControls {...defaultProps} />);
    expect(screen.getByText("Sourced")).toBeDefined();
    expect(screen.getByText("Screened")).toBeDefined();
  });

  it("toggles stage selection", () => {
    const onStagesChange = vi.fn();
    render(<TalentControls {...defaultProps} onStagesChange={onStagesChange} />);

    fireEvent.click(screen.getByText("Sourced"));
    expect(onStagesChange).toHaveBeenCalledWith(["sourced"]);
  });

  it("shows filtered count when filters are active", () => {
    render(
      <TalentControls {...defaultProps} filteredCount={5} totalCount={10} selectedStages={["sourced"]} />
    );

    expect(screen.getByText("Showing 5 of 10 candidates")).toBeDefined();
  });

  it("shows total count when no filters are active", () => {
    render(<TalentControls {...defaultProps} />);
    expect(screen.getByText("10 candidates")).toBeDefined();
  });

  it("calls onSortChange when sort dropdown changes", () => {
    const onSortChange = vi.fn();
    render(<TalentControls {...defaultProps} onSortChange={onSortChange} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "score" } });
    expect(onSortChange).toHaveBeenCalledWith("score");
  });
});
