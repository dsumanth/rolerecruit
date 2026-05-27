import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JobsList } from "../../components/jobs/jobs-list";

const ALL_MOCK_JOBS = [
  { _id: "1", title: "Math",    subject: "Mathematics", level: "Senior", board: "CBSE", status: "active", _creationTime: Date.now(), positions: 1 },
  { _id: "2", title: "Physics", subject: "Physics",     level: "Lead",   board: "ICSE", status: "draft",  _creationTime: Date.now(), positions: 1 },
  { _id: "3", title: "English", subject: "English",     level: "Mid",    board: "CBSE", status: "active", _creationTime: Date.now(), positions: 1 },
];

vi.mock("convex/react", () => ({
  useQuery: (_ref: string) => {
    return {};
  },
  usePaginatedQuery: (_ref: string, args: { filter?: { status?: string } }) => {
    const statusFilter = args?.filter?.status;
    const results = statusFilter
      ? ALL_MOCK_JOBS.filter((j) => j.status === statusFilter)
      : ALL_MOCK_JOBS;
    return { results, status: "Exhausted", loadMore: () => {} };
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    jobs: {
      listBySchool: "jobs.listBySchool",
      hiredCountsForSchool: "jobs.hiredCountsForSchool",
    },
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

describe("JobsList", () => {
  it("renders all jobs when filter is All", () => {
    render(<JobsList schoolId="s1" />);
    expect(screen.getByText("Math")).toBeDefined();
    expect(screen.getByText("Physics")).toBeDefined();
    expect(screen.getByText("English")).toBeDefined();
  });

  it("filters to only Active when active chip clicked", () => {
    render(<JobsList schoolId="s1" />);
    fireEvent.click(screen.getByRole("tab", { name: /Active/ }));
    expect(screen.getByText("Math")).toBeDefined();
    expect(screen.queryByText("Physics")).toBeNull();
    expect(screen.getByText("English")).toBeDefined();
  });

  it("shows counts on each chip", () => {
    render(<JobsList schoolId="s1" />);
    const allTab = screen.getByRole("tab", { name: /All/ });
    expect(allTab.textContent).toContain("3");
    const draftTab = screen.getByRole("tab", { name: /Draft/ });
    expect(draftTab.textContent).toContain("1");
  });
});
