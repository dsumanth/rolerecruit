import { describe, it, expect } from "vitest";
import { normalizeToE164 } from "../../convex/lib/phone";

describe("normalizeToE164", () => {
  it("returns undefined for null/undefined/empty/whitespace", () => {
    expect(normalizeToE164(null)).toBeUndefined();
    expect(normalizeToE164(undefined)).toBeUndefined();
    expect(normalizeToE164("")).toBeUndefined();
    expect(normalizeToE164("   ")).toBeUndefined();
  });

  it("assumes IN country code for bare 10-digit Indian mobiles", () => {
    expect(normalizeToE164("9876543210")).toBe("+919876543210");
  });

  it("normalizes IN mobiles already in E.164 form", () => {
    expect(normalizeToE164("+919876543210")).toBe("+919876543210");
  });

  it("strips spaces, dashes, parentheses, and dots from IN mobiles", () => {
    expect(normalizeToE164("+91 98765 43210")).toBe("+919876543210");
    expect(normalizeToE164("+91-98765-43210")).toBe("+919876543210");
    expect(normalizeToE164("(+91) 98765.43210")).toBe("+919876543210");
  });

  it("preserves explicit non-IN country codes", () => {
    expect(normalizeToE164("+1 415-555-2671")).toBe("+14155552671");
    expect(normalizeToE164("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("returns undefined for clearly invalid phones", () => {
    expect(normalizeToE164("abc")).toBeUndefined();
    expect(normalizeToE164("123")).toBeUndefined();
    expect(normalizeToE164("000")).toBeUndefined();
  });

  it("returns undefined when only formatting characters are present", () => {
    expect(normalizeToE164("+-()")).toBeUndefined();
  });
});
