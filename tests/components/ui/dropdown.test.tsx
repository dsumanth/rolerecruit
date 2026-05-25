import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dropdown, DropdownItem } from "../../../components/ui/dropdown";

describe("Dropdown", () => {
  it("does not render items by default", () => {
    render(
      <Dropdown trigger={<button>Open</button>}>
        <DropdownItem onSelect={() => {}}>Hello</DropdownItem>
      </Dropdown>
    );
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("opens on trigger click and renders items", () => {
    render(
      <Dropdown trigger={<button>Open</button>}>
        <DropdownItem onSelect={() => {}}>Hello</DropdownItem>
      </Dropdown>
    );
    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByText("Hello")).toBeDefined();
  });

  it("closes after an item is selected and invokes the handler", () => {
    const handler = vi.fn();
    render(
      <Dropdown trigger={<button>Open</button>}>
        <DropdownItem onSelect={handler}>Hello</DropdownItem>
      </Dropdown>
    );
    fireEvent.click(screen.getByText("Open"));
    fireEvent.click(screen.getByText("Hello"));
    expect(handler).toHaveBeenCalled();
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("closes on Escape", () => {
    render(
      <Dropdown trigger={<button>Open</button>}>
        <DropdownItem onSelect={() => {}}>Hello</DropdownItem>
      </Dropdown>
    );
    fireEvent.click(screen.getByText("Open"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Hello")).toBeNull();
  });
});
