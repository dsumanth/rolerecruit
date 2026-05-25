import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "../../../components/ui/page-header";

describe("PageHeader", () => {
  it("renders title", () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByText("Dashboard")).toBeDefined();
  });

  it("renders eyebrow above title when provided", () => {
    render(<PageHeader title="Dashboard" eyebrow="Welcome back, Sumanth" />);
    expect(screen.getByText("Welcome back, Sumanth")).toBeDefined();
  });

  it("renders subtitle when provided", () => {
    render(<PageHeader title="Dashboard" subtitle="4 open roles" />);
    expect(screen.getByText("4 open roles")).toBeDefined();
  });

  it("renders back link with href and label", () => {
    render(<PageHeader title="Detail" back={{ href: "/dashboard/jobs", label: "Jobs" }} />);
    const back = screen.getByText("Jobs").closest("a");
    expect(back?.getAttribute("href")).toBe("/dashboard/jobs");
  });

  it("renders actions slot on the right", () => {
    render(<PageHeader title="Dashboard" actions={<button>+ Post role</button>} />);
    expect(screen.getByText("+ Post role")).toBeDefined();
  });
});
