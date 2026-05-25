import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dialog } from "../../../components/ui/dialog";

function Harness({ onOpenChange }: { onOpenChange?: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          onOpenChange?.(v);
        }}
        title="Confirm delete"
      >
        <p>Are you sure?</p>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("does not render content when closed", () => {
    render(<Harness />);
    expect(screen.queryByText("Confirm delete")).toBeNull();
  });

  it("renders content when open", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Open dialog"));
    expect(screen.getByText("Confirm delete")).toBeDefined();
    expect(screen.getByText("Are you sure?")).toBeDefined();
  });

  it("calls onOpenChange(false) when Escape pressed", () => {
    const handler = vi.fn();
    render(<Harness onOpenChange={handler} />);
    fireEvent.click(screen.getByText("Open dialog"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handler).toHaveBeenCalledWith(false);
  });

  it("close button calls onOpenChange(false)", () => {
    const handler = vi.fn();
    render(<Harness onOpenChange={handler} />);
    fireEvent.click(screen.getByText("Open dialog"));
    fireEvent.click(screen.getByLabelText("Close"));
    expect(handler).toHaveBeenCalledWith(false);
  });
});
