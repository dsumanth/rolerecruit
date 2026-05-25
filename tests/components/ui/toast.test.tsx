import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastProvider, useToast } from "../../../components/ui/toast";

function Trigger() {
  const { toast } = useToast();
  return (
    <>
      <button onClick={() => toast({ variant: "success", message: "Saved" })}>save</button>
      <button onClick={() => toast({ variant: "error", message: "Failed" })}>fail</button>
    </>
  );
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("appears when toast() is called", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    act(() => {
      screen.getByText("save").click();
    });
    expect(screen.getByText("Saved")).toBeDefined();
  });

  it("auto-dismisses after the default duration", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    act(() => {
      screen.getByText("save").click();
    });
    expect(screen.getByText("Saved")).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(4500);
    });
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("stacks multiple toasts", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    act(() => {
      screen.getByText("save").click();
      screen.getByText("fail").click();
    });
    expect(screen.getByText("Saved")).toBeDefined();
    expect(screen.getByText("Failed")).toBeDefined();
  });
});
