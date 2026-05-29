import { describe, it, expect } from "vitest";
import { renderDemoEventPush } from "../../convex/notifications";

describe("renderDemoEventPush", () => {
  it("invite_created - names the candidate", () => {
    const out = renderDemoEventPush("invite_created", { candidateName: "Priya", subject: "Maths" });
    expect(out.title).toMatch(/invited/i);
    expect(out.body).toContain("Priya");
    expect(out.body).toContain("Maths");
  });

  it("form_opens - uses urgent copy", () => {
    const out = renderDemoEventPush("form_opens", { candidateName: "Priya" });
    expect(out.title).toMatch(/form|now open/i);
    expect(out.body).toContain("Priya");
  });

  it("demo_cancelled - apologetic copy", () => {
    const out = renderDemoEventPush("demo_cancelled", { candidateName: "Priya" });
    expect(out.title).toMatch(/cancel/i);
    expect(out.body).toContain("Priya");
  });

  it("evaluator_swap_in - welcomes the new evaluator", () => {
    const out = renderDemoEventPush("evaluator_swap_in", { candidateName: "Priya" });
    expect(out.body).toContain("Priya");
    expect(out.title).toMatch(/added|evaluator/i);
  });

  it("evaluator_swap_out - informs the removed evaluator", () => {
    const out = renderDemoEventPush("evaluator_swap_out", { candidateName: "Priya" });
    expect(out.title).toMatch(/swapped|removed/i);
    expect(out.body).toContain("Priya");
  });
});
