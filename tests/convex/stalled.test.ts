import { describe, it, expect } from "vitest";
import { isStalled, STALLED_DAYS } from "../../convex/lib/stalled";

const DAY = 24 * 60 * 60 * 1000;

describe("isStalled", () => {
  const now = 1_700_000_000_000;

  it("returns false for an application with no outbound messages", () => {
    expect(isStalled({ now, lastOutboundAt: null, lastInboundAt: null, stage: "shortlisted" })).toBe(false);
  });

  it("returns false at 4 days since last outbound (under threshold)", () => {
    expect(isStalled({ now, lastOutboundAt: now - 4 * DAY, lastInboundAt: null, stage: "shortlisted" })).toBe(false);
  });

  it("returns true at exactly 5 days since last outbound", () => {
    expect(isStalled({ now, lastOutboundAt: now - 5 * DAY, lastInboundAt: null, stage: "shortlisted" })).toBe(true);
  });

  it("returns false when an inbound reply landed after the outbound", () => {
    expect(isStalled({
      now,
      lastOutboundAt: now - 6 * DAY,
      lastInboundAt: now - 3 * DAY,
      stage: "shortlisted",
    })).toBe(false);
  });

  it("returns false for terminal stages", () => {
    expect(isStalled({ now, lastOutboundAt: now - 10 * DAY, lastInboundAt: null, stage: "rejected" })).toBe(false);
    expect(isStalled({ now, lastOutboundAt: now - 10 * DAY, lastInboundAt: null, stage: "hired" })).toBe(false);
    expect(isStalled({ now, lastOutboundAt: now - 10 * DAY, lastInboundAt: null, stage: "withdrawn" })).toBe(false);
  });

  it("exposes STALLED_DAYS as 5", () => {
    expect(STALLED_DAYS).toBe(5);
  });
});
