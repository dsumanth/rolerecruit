import { describe, it, expect } from "vitest";
import { buildRescheduleReply } from "../../convex/conversation_reschedule";

describe("buildRescheduleReply", () => {
  it("returns a polite reply with the booking link", () => {
    const reply = buildRescheduleReply({
      candidateName: "Asha",
      bookingUrl: "https://rolerecruit.com/book/abc",
      schoolName: "Acme",
      rejected: false,
    });
    expect(reply).toContain("Asha");
    expect(reply).toContain("https://rolerecruit.com/book/abc");
  });

  it("returns the closed-role template when the application is rejected", () => {
    const reply = buildRescheduleReply({
      candidateName: "Asha",
      bookingUrl: "",
      schoolName: "Acme",
      rejected: true,
    });
    expect(reply.toLowerCase()).toContain("closed");
    expect(reply).not.toContain("http");
  });
});
