import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InboxCard } from "../../components/evaluations/inbox-card";

const baseProps = {
  invite: {
    _id: "i1",
    status: "invited" as const,
    evaluatorRole: "principal" as const,
  },
  demo: {
    _id: "d1",
    scheduledAt: Date.now() + 3600000,
    mode: "live" as const,
    durationMinutes: 30,
    location: "Room 1",
  },
  candidateName: "Priya Sharma",
  formOpensAt: Date.now() + 3600000,
  formClosesAt: Date.now() + 5400000,
};

describe("InboxCard", () => {
  it("shows candidate name, demo time, and LIVE mode badge", () => {
    render(<InboxCard {...baseProps} />);
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("shows POST mode badge when demo.mode is post", () => {
    render(
      <InboxCard {...baseProps} demo={{ ...baseProps.demo, mode: "post" }} />,
    );
    expect(screen.getByText("POST")).toBeInTheDocument();
  });

  it("shows ASYNC mode badge when demo.mode is async", () => {
    render(
      <InboxCard {...baseProps} demo={{ ...baseProps.demo, mode: "async" }} />,
    );
    expect(screen.getByText("ASYNC")).toBeInTheDocument();
  });

  it("renders 'Form opens' when the form is not yet open", () => {
    render(
      <InboxCard
        {...baseProps}
        formOpensAt={Date.now() + 60000}
        formClosesAt={Date.now() + 120000}
      />,
    );
    expect(screen.getByText(/form opens/i)).toBeInTheDocument();
  });

  it("renders 'Open now' when the form window is active", () => {
    render(
      <InboxCard
        {...baseProps}
        formOpensAt={Date.now() - 60000}
        formClosesAt={Date.now() + 60000}
      />,
    );
    expect(screen.getByText(/open now/i)).toBeInTheDocument();
  });

  it("renders the demo location alongside scheduled time", () => {
    render(<InboxCard {...baseProps} />);
    expect(screen.getByText(/Room 1/)).toBeInTheDocument();
  });

  it("wraps the card in a link to /evaluations/[inviteId]", () => {
    const { container } = render(<InboxCard {...baseProps} />);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("/evaluations/i1");
  });
});
