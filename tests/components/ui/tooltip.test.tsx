import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Tooltip } from "../../../components/ui/tooltip";

describe("Tooltip", () => {
  it("does not show tooltip content by default", () => {
    render(
      <Tooltip content="Open settings" delay={0}>
        <button>Trigger</button>
      </Tooltip>
    );
    expect(screen.queryByText("Open settings")).toBeNull();
  });

  it("shows tooltip content on hover after delay", async () => {
    render(
      <Tooltip content="Open settings" delay={0}>
        <button>Trigger</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByText("Trigger"));
    await waitFor(() => {
      expect(screen.getByText("Open settings")).toBeDefined();
    });
  });

  it("hides tooltip on mouse leave", async () => {
    render(
      <Tooltip content="Open settings" delay={0}>
        <button>Trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByText("Trigger");
    fireEvent.mouseEnter(trigger);
    await waitFor(() => expect(screen.getByText("Open settings")).toBeDefined());
    fireEvent.mouseLeave(trigger);
    await waitFor(() => expect(screen.queryByText("Open settings")).toBeNull());
  });
});
