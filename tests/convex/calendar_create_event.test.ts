import { describe, it, expect } from "vitest";
import { buildEventInsertBody } from "../../convex/calendar";

describe("buildEventInsertBody", () => {
  it("includes summary, start/end ISO, all attendees, and a Meet conference request", () => {
    const body = buildEventInsertBody({
      summary: "Demo Lesson - Math",
      startMs: Date.UTC(2026, 5, 1, 9, 0),
      endMs: Date.UTC(2026, 5, 1, 9, 45),
      attendeeEmails: ["i1@s.com", "i2@s.com", "cand@x.com"],
    });
    expect(body.summary).toBe("Demo Lesson - Math");
    expect(body.start.dateTime).toBe(new Date(Date.UTC(2026, 5, 1, 9, 0)).toISOString());
    expect(body.end.dateTime).toBe(new Date(Date.UTC(2026, 5, 1, 9, 45)).toISOString());
    expect(body.attendees.map((a) => a.email)).toEqual(["i1@s.com", "i2@s.com", "cand@x.com"]);
    expect(body.conferenceData.createRequest.requestId).toBeTruthy();
  });
});
