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
