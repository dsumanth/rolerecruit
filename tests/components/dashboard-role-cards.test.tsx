import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleCards } from "../../components/dashboard/role-cards";

const ALL_MOCK_JOBS = [
  { _id: "j1", title: "SME Science", subject: "Science", level: "TGT", board: "CBSE", status: "active", _creationTime: Date.now() },
  { _id: "j2", title: "Untitled Role", subject: "Science", level: "TGT", board: "CBSE", status: "closed", _creationTime: Date.now() },
  { _id: "j3", title: "Draft Role",   subject: "Math",    level: "PGT", board: "CBSE", status: "draft",  _creationTime: Date.now() },
  { _id: "j4", title: "Filled Role",  subject: "English", level: "TGT", board: "CBSE", status: "filled", _creationTime: Date.now() },
];

let capturedFilter: { status?: string } | undefined;

vi.mock("convex/react", () => ({
  useQuery: (_ref: string) => ({}),
  usePaginatedQuery: (_ref: string, args: { filter?: { status?: string } }) => {
    capturedFilter = args?.filter;
    const statusFilter = args?.filter?.status;
    const results = statusFilter
      ? ALL_MOCK_JOBS.filter((j) => j.status === statusFilter)
      : ALL_MOCK_JOBS;
    return { results, status: "Exhausted", loadMore: () => {} };
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    jobs: { listBySchool: "jobs.listBySchool" },
    dashboard: { getPipelineBreakdown: "dashboard.getPipelineBreakdown" },
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

describe("RoleCards (dashboard)", () => {
  it("requests only active roles from the query", () => {
    capturedFilter = undefined;
    render(<RoleCards schoolId="s1" />);
    expect(capturedFilter?.status).toBe("active");
  });

  it("renders only active roles, hiding closed/draft/filled", () => {
    render(<RoleCards schoolId="s1" />);
    expect(screen.getByText("SME Science")).toBeDefined();
    expect(screen.queryByText("Untitled Role")).toBeNull();
    expect(screen.queryByText("Draft Role")).toBeNull();
    expect(screen.queryByText("Filled Role")).toBeNull();
  });
});
