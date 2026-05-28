import { describe, it, expect } from "vitest";
import { renderSwapEmail, renderSwapOutEmail } from "../../convex/notifications";

describe("renderSwapEmail", () => {
  it("includes the swapped-in user's name and the demo time", () => {
    const out = renderSwapEmail({
      newEvaluatorName: "Mrs Iyer",
      candidateName: "Priya",
      scheduledAt: new Date("2030-01-01T10:00:00Z").getTime(),
      tokenUrl: "https://example.com/feedback/abc",
    });
    expect(out.subject).toContain("Priya");
    expect(out.html).toContain("Mrs Iyer");
    expect(out.html).toContain("abc");
  });
});

describe("renderSwapOutEmail", () => {
  it("renders the swap-out notice including the candidate and demo time", () => {
    const out = renderSwapOutEmail({
      oldEvaluatorName: "Mr A",
      candidateName: "Priya",
      scheduledAt: new Date("2030-01-01T10:00:00Z").getTime(),
    });
    expect(out.subject).toContain("Priya");
    expect(out.html).toContain("Mr A");
    expect(out.html.toLowerCase()).toContain("swapped");
  });
});
