import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BulkActionBar } from "../../components/ui/bulk-action-bar";

describe("BulkActionBar", () => {
  it("renders null when count is 0", () => {
    const { container } = render(
      <BulkActionBar count={0} onClear={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows count, actions, and clear", () => {
    const onClear = vi.fn();
    render(
      <BulkActionBar count={5} onClear={onClear}>
        <button>Delete</button>
      </BulkActionBar>
    );
    expect(screen.getByText("5 selected")).toBeDefined();
    fireEvent.click(screen.getByText("Clear"));
    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.getByText("Delete")).toBeDefined();
  });
});
