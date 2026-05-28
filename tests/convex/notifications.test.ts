import { describe, it, expect } from "vitest";
import { renderInviteEmail } from "../../convex/notifications";

describe("notifications.renderInviteEmail", () => {
  it("includes the candidate name and the deep-link URL", () => {
    const html = renderInviteEmail({
      candidateName: "Priya Sharma",
      role: "principal",
      scheduledAt: new Date("2026-06-01T11:30:00Z").getTime(),
      formUrl: "https://app.example/evaluations/abc?token=xyz",
    });
    expect(html).toContain("Priya Sharma");
    expect(html).toContain("https://app.example/evaluations/abc?token=xyz");
    expect(html.toLowerCase()).toContain("principal");
  });
});
