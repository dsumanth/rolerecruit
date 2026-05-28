import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleDemoWizard } from "../../components/demos/schedule-demo-wizard";

const staff = [
  { _id: "p" as any, name: "Mrs. Iyer", role: "principal" as const },
  { _id: "h" as any, name: "Mr. Khan", role: "hod" as const },
  { _id: "t" as any, name: "Ms. Rao", role: "hr_admin" as const },
];

describe("ScheduleDemoWizard", () => {
  it("collects schedule + mode + evaluators and calls onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ScheduleDemoWizard
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        applicationId={"a1" as any}
        schoolId={"s1" as any}
        candidateName="Priya"
        staffDirectory={staff as any}
      />,
    );
    await user.type(screen.getByLabelText(/date/i), "2026-06-01");
    await user.type(screen.getByLabelText(/time/i), "11:30");
    await user.clear(screen.getByLabelText(/duration/i));
    await user.type(screen.getByLabelText(/duration/i), "30");
    await user.click(screen.getByLabelText(/^live$/i));
    await user.click(screen.getByLabelText(/^classroom$/i));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByLabelText(/Mrs\. Iyer/));
    await user.click(screen.getByLabelText(/Mr\. Khan/));
    await user.click(screen.getByRole("button", { name: /review/i }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "live",
        format: "classroom",
        durationMinutes: 30,
        evaluators: expect.arrayContaining([
          { userId: "p", role: "principal" },
          { userId: "h", role: "hod" },
        ]),
      }),
    );
  });
});
