import { describe, it, expect, vi } from "vitest";
import { lookupMetaCostUsd, computeBillableUsd } from "../../convex/lib/metaPricing";
import { countryFromPhone } from "../../convex/lib/phone";

describe("metaPricing", () => {
  it("looks up cost by country and category", () => {
    expect(lookupMetaCostUsd({ countryCode: "IN", category: "utility" })).toBe(0.0014);
    expect(lookupMetaCostUsd({ countryCode: "US", category: "marketing" })).toBe(0.025);
  });

  it("returns 0 for service regardless of country", () => {
    expect(lookupMetaCostUsd({ countryCode: "IN", category: "service" })).toBe(0);
    expect(lookupMetaCostUsd({ countryCode: "ZZ", category: "service" })).toBe(0);
  });

  it("falls back to US prices for unknown countries", () => {
    expect(lookupMetaCostUsd({ countryCode: "ZZ", category: "utility" })).toBe(0.014);
    expect(lookupMetaCostUsd({ countryCode: undefined, category: "utility" })).toBe(0.014);
  });

  it("warns once on fallback for an unmapped country, but not for a known one", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      lookupMetaCostUsd({ countryCode: "ZZ", category: "utility" });
      expect(warn).toHaveBeenCalledTimes(1);
      lookupMetaCostUsd({ countryCode: "IN", category: "utility" });
      expect(warn).toHaveBeenCalledTimes(1);
      // service is free and country-agnostic, so it must not warn
      lookupMetaCostUsd({ countryCode: "ZZ", category: "service" });
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it("computes billable with markup", () => {
    expect(computeBillableUsd(0.014, 20)).toBeCloseTo(0.0168, 6);
    expect(computeBillableUsd(0, 20)).toBe(0);
  });

  it("derives country from an E.164 phone", () => {
    expect(countryFromPhone("+919876543210")).toBe("IN");
    expect(countryFromPhone("+14155552671")).toBe("US");
  });
});
