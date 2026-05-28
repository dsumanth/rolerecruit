import { describe, it, expect } from "vitest";
import { renderBrief } from "../../convex/morningBrief_render";

describe("renderBrief", () => {
  it("returns a subject line that includes the school name and date", () => {
    const out = renderBrief({
      schoolName: "Acme School",
      stats: {
        newApps24h: { count: 0, top: [] },
        strongAvailable: [],
        stalled: [],
        demosToday: 0,
        escalatedInboxCount: 0,
      },
      todayLabel: "May 28",
    });
    expect(out.subject).toContain("Acme School");
    expect(out.subject).toContain("May 28");
  });

  it("textBody is non-empty even for an empty day", () => {
    const out = renderBrief({
      schoolName: "Empty",
      stats: {
        newApps24h: { count: 0, top: [] },
        strongAvailable: [],
        stalled: [],
        demosToday: 0,
        escalatedInboxCount: 0,
      },
      todayLabel: "May 28",
    });
    expect(out.textBody.length).toBeGreaterThan(0);
    expect(out.htmlBody.length).toBeGreaterThan(0);
  });

  it("includes counts and candidate names in the text body", () => {
    const out = renderBrief({
      schoolName: "Acme",
      stats: {
        newApps24h: { count: 3, top: [{ candidateName: "Asha", score: 82 }] },
        strongAvailable: [{ applicationId: "a1" as any, candidateName: "Bina", score: 88 }],
        stalled: [{ applicationId: "a2" as any, candidateName: "Carl", lastOutboundAt: 0 }],
        demosToday: 2,
        escalatedInboxCount: 1,
      },
      todayLabel: "May 28",
    });
    expect(out.textBody).toContain("3 new");
    expect(out.textBody).toContain("Asha");
    expect(out.textBody).toContain("Bina");
    expect(out.textBody).toContain("Carl");
    expect(out.textBody).toContain("2 demo");
    expect(out.textBody).toContain("1 conversation");
  });
});
