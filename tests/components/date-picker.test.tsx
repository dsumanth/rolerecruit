import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DatePicker } from "../../components/ui/date-picker";

describe("DatePicker", () => {
  it("renders placeholder when no value", () => {
    render(<DatePicker value="" onChange={() => {}} placeholder="Pick a date" />);
    expect(screen.getByText("Pick a date")).toBeDefined();
  });

  it("renders formatted value when set", () => {
    render(<DatePicker value="2026-05-28" onChange={() => {}} />);
    expect(screen.getByText("May 28, 2026")).toBeDefined();
  });

  it("opens calendar grid on trigger click", () => {
    render(<DatePicker value="2026-05-28" onChange={() => {}} />);
    expect(screen.queryByRole("grid")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /pick a date|may 28, 2026/i }));
    expect(screen.getByRole("grid")).toBeDefined();
  });

  it("calls onChange with ISO YYYY-MM-DD when a day is selected", () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-05-28" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /may 28, 2026/i }));
    const dayButton = screen.getByRole("button", { name: /15.*may.*2026|may.*15.*2026/i });
    fireEvent.click(dayButton);
    expect(onChange).toHaveBeenCalledWith("2026-05-15");
  });

  it("closes on Escape", () => {
    render(<DatePicker value="2026-05-28" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /may 28, 2026/i }));
    expect(screen.getByRole("grid")).toBeDefined();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("grid")).toBeNull();
  });
});
