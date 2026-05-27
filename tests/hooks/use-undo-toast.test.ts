import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoToast } from "../../hooks/use-undo-toast";

describe("useUndoToast", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("shows a toast and auto-dismisses after the TTL", () => {
    const { result } = renderHook(() => useUndoToast());
    act(() => {
      result.current.show({ label: "5 deleted", onUndo: vi.fn() });
    });
    expect(result.current.toasts.length).toBe(1);
    act(() => { vi.advanceTimersByTime(10_500); });
    expect(result.current.toasts.length).toBe(0);
  });

  it("calls onUndo when undo is invoked and dismisses", async () => {
    const { result } = renderHook(() => useUndoToast());
    const onUndo = vi.fn();
    let toastId = "";
    act(() => {
      toastId = result.current.show({ label: "5 deleted", onUndo });
    });
    await act(async () => { await result.current.undo(toastId); });
    expect(onUndo).toHaveBeenCalledOnce();
    expect(result.current.toasts.length).toBe(0);
  });
});
