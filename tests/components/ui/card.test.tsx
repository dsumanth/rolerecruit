import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Card } from "../../../components/ui/card";

describe("Card (refined)", () => {
  it("renders chrome surface with translucent class", () => {
    const { container } = render(<Card surface="chrome">x</Card>);
    expect(container.firstChild).toHaveClass("bg-surface-chrome");
  });

  it("renders floating surface", () => {
    const { container } = render(<Card surface="floating">x</Card>);
    expect(container.firstChild).toHaveClass("bg-surface-floating");
  });

  it("applies elev-2 class for elevation=2", () => {
    const { container } = render(<Card elevation={2}>x</Card>);
    expect(container.firstChild).toHaveClass("shadow-elev-2");
  });

  it("applies no shadow for elevation=floor", () => {
    const { container } = render(<Card elevation="floor">x</Card>);
    const cls = (container.firstChild as HTMLElement).className;
    expect(cls).not.toContain("shadow-elev");
  });

  it("interactive=true adds hover lift class", () => {
    const { container } = render(<Card interactive>x</Card>);
    expect(container.firstChild).toHaveClass("hover:shadow-elev-2");
  });
});
