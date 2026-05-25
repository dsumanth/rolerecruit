import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Icon } from "../../../components/ui/icon";

describe("Icon", () => {
  it("renders the named lucide icon as an SVG", () => {
    const { container } = render(<Icon name="Home" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("height")).toBe("16");
  });

  it("uses stroke width 2 for sizes > 14", () => {
    const { container } = render(<Icon name="Home" size={24} />);
    expect(container.querySelector("svg")?.getAttribute("stroke-width")).toBe("2");
  });

  it("uses stroke width 2.4 for sizes <= 14", () => {
    const { container } = render(<Icon name="Home" size={12} />);
    expect(container.querySelector("svg")?.getAttribute("stroke-width")).toBe("2.4");
  });
});
