import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "../../../components/ui/avatar";

describe("Avatar", () => {
  it("renders initial when no image", () => {
    render(<Avatar name="Sumanth Daggubati" />);
    expect(screen.getByText("S")).toBeDefined();
  });

  it("renders image when src provided", () => {
    render(<Avatar name="Sumanth" src="/sumanth.jpg" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/sumanth.jpg");
    expect(img.getAttribute("alt")).toBe("Sumanth");
  });

  it("renders ? when name is empty", () => {
    render(<Avatar name="" />);
    expect(screen.getByText("?")).toBeDefined();
  });

  it("applies size class", () => {
    const { container } = render(<Avatar name="A" size={40} />);
    expect(container.firstChild).toHaveStyle({ width: "40px", height: "40px" });
  });
});
