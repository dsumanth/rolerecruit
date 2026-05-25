import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../../../components/ui/button";

describe("Button (refined)", () => {
  it("renders gradient variant with gradient background class", () => {
    const { container } = render(<Button variant="gradient">Apply</Button>);
    expect(container.querySelector("button")?.className).toContain("bg-accent-grad");
  });

  it("renders ink variant", () => {
    const { container } = render(<Button variant="ink">Post role</Button>);
    expect(container.querySelector("button")?.className).toContain("bg-ink");
  });

  it("renders iconLeft as SVG before label", () => {
    const { container } = render(<Button iconLeft="Plus">Add</Button>);
    const button = container.querySelector("button");
    const firstChild = button?.firstChild as Element;
    expect(firstChild?.tagName?.toLowerCase()).toBe("svg");
  });

  it("renders iconRight as SVG after label", () => {
    const { container } = render(<Button iconRight="ArrowRight">Next</Button>);
    const button = container.querySelector("button");
    const lastChild = button?.lastChild as Element;
    expect(lastChild?.tagName?.toLowerCase()).toBe("svg");
  });
});
