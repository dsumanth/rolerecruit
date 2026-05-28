import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UndoToast } from "../../components/ui/undo-toast";

describe("UndoToast", () => {
  it("renders label and calls onUndo when clicked", () => {
    const onUndo = vi.fn();
    render(<UndoToast label="5 deleted" onUndo={onUndo} onDismiss={() => {}} />);
    expect(screen.getByText("5 deleted")).toBeDefined();
    fireEvent.click(screen.getByText("Undo"));
    expect(onUndo).toHaveBeenCalledOnce();
  });
});
