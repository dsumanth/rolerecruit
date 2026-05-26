// tests/convex/evidenceValidator.test.ts
import { describe, it, expect } from "vitest";
import { validateEvidence } from "../../convex/evidenceValidator";
import type { ParsedFacets, RawChunk } from "../../convex/types";

const chunks: RawChunk[] = [
  { text: "B.Ed and 7 years PGT Physics at DPS Delhi", section: "header", offset: 0 },
  { text: "Led JEE prep coaching with 80% clearance", section: "achievements", offset: 50 },
];

const valid: ParsedFacets = {
  specializations: [{ value: "JEE_prep", evidence: { quote: "Led JEE prep", offset: 50, context: "..." } }],
  gradeLevels: [], pedagogicalApproach: [], leadershipRoles: [],
  extracurricular: [], languages: [], schoolTypes: [],
  keyAchievements: [], redFlags: [], extras: {},
};

const invalidOffset: ParsedFacets = {
  ...valid,
  specializations: [{ value: "JEE_prep", evidence: { quote: "Led JEE prep", offset: 999, context: "..." } }],
};

const invalidQuote: ParsedFacets = {
  ...valid,
  specializations: [{ value: "JEE_prep", evidence: { quote: "completely fabricated", offset: 50, context: "..." } }],
};

describe("evidenceValidator", () => {
  it("accepts valid evidence", () => {
    const r = validateEvidence(valid, chunks);
    expect(r.ok).toBe(true);
    expect(r.invalidFacets).toHaveLength(0);
  });

  it("rejects evidence with wrong offset", () => {
    const r = validateEvidence(invalidOffset, chunks);
    expect(r.ok).toBe(false);
    expect(r.invalidFacets[0]).toMatchObject({ facetType: "specializations", reason: expect.stringContaining("offset") });
  });

  it("rejects evidence whose quote isn't in any chunk", () => {
    const r = validateEvidence(invalidQuote, chunks);
    expect(r.ok).toBe(false);
    expect(r.invalidFacets[0].reason).toContain("not found");
  });
});
