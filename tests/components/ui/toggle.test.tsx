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
