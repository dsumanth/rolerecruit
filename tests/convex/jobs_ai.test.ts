import { describe, it, expect } from "vitest";
import { normalizeLevel } from "../../convex/jobs_ai";

describe("normalizeLevel", () => {
  it("passes through valid enum values", () => {
    expect(normalizeLevel("PRT")).toBe("PRT");
    expect(normalizeLevel("TGT")).toBe("TGT");
    expect(normalizeLevel("PGT")).toBe("PGT");
    expect(normalizeLevel("Other")).toBe("Other");
  });

  it("normalizes case", () => {
    expect(normalizeLevel("pgt")).toBe("PGT");
    expect(normalizeLevel("tgt")).toBe("TGT");
    expect(normalizeLevel("other")).toBe("Other");
  });

  it("takes the first segment when LLM emits multiple", () => {
    // The bug case: 'PGT, TGT' for a role spanning two levels
    expect(normalizeLevel("PGT, TGT")).toBe("PGT");
    expect(normalizeLevel("TGT/PGT")).toBe("TGT");
  });

  it("falls back to Other for unknown labels", () => {
    expect(normalizeLevel("Subject Matter Expert")).toBe("Other");
    expect(normalizeLevel("Coordinator")).toBe("Other");
    expect(normalizeLevel("")).toBe("Other");
  });

  it("returns Other for non-string input", () => {
    expect(normalizeLevel(null)).toBe("Other");
    expect(normalizeLevel(undefined)).toBe("Other");
    expect(normalizeLevel(42)).toBe("Other");
  });
});
