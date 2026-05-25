import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketingTopbar } from "../../components/careers/MarketingTopbar";

describe("MarketingTopbar", () => {
  it("renders school name and brand mark", () => {
    render(<MarketingTopbar schoolName="Riverside School" schoolSlug="riverside" />);
    expect(screen.getByText("Riverside School")).toBeDefined();
  });

  it("renders Apply CTA linking to apply route", () => {
    render(<MarketingTopbar schoolName="Riverside" schoolSlug="riverside" />);
    const apply = screen.getByText("Apply").closest("a");
    expect(apply?.getAttribute("href")).toBe("/careers/riverside/apply");
  });
});
