import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "../../../components/ui/input";

describe("Input (refined)", () => {
  it("renders a text input by default", () => {
    render(<Input placeholder="Search" />);
    expect(screen.getByPlaceholderText("Search")).toBeDefined();
  });

  it("applies size=lg class", () => {
    render(<Input size="lg" placeholder="x" />);
    expect(screen.getByPlaceholderText("x").className).toContain("h-11");
  });

  it("renders iconLeft inside wrapper", () => {
    const { container } = render(<Input iconLeft="Search" placeholder="x" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
