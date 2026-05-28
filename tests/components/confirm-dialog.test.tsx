import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";

describe("ConfirmDialog", () => {
  it("renders title and body when open", () => {
    render(
      <ConfirmDialog
        open
        title="Delete?"
        body="This is permanent."
        confirmLabel="Delete"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText("Delete?")).toBeDefined();
    expect(screen.getByText("This is permanent.")).toBeDefined();
  });

  it("invokes onConfirm and onCancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="T"
        body="B"
        confirmLabel="Yes"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText("Yes"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
