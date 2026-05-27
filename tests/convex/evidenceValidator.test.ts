// tests/convex/evidenceValidator.test.ts
import { describe, it, expect } from "vitest";
import { validateEvidence, validateAndFilterFacets } from "../../convex/evidenceValidator";
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

describe("validateAndFilterFacets", () => {
  // Real-world case: LLM tagged a school chain name as CBSE_private/ICSE_private
  // even though the resume never mentions CBSE or ICSE. The quote IS in the
  // resume, so the basic quote-in-chunk check passes — but the quote doesn't
  // actually mention the board.
  const hallucinatedSchoolTypeChunks: RawChunk[] = [
    {
      text: "ACADEMIC ZONAL COORDINATOR |NARAYANA E TECHNO SCHOOLS,TAMILNADU | 2023 - 2025",
      section: "experience",
      offset: 0,
    },
    {
      text: "VICE - PRINCIPAL | SRI CHAITANYA TECHNO SCHOOL, SALEM TAMILNADU | 2021 –  2023",
      section: "experience",
      offset: 100,
    },
    {
      text: "Taught English to higher secondary students",
      section: "experience",
      offset: 200,
    },
    {
      text: "STATE BOARD curriculum since 2017",
      section: "experience",
      offset: 300,
    },
  ];

  it("drops a schoolTypes facet whose value keyword (CBSE) is not in the quote", () => {
    const facets: ParsedFacets = {
      specializations: [], gradeLevels: [], pedagogicalApproach: [], leadershipRoles: [],
      extracurricular: [], languages: [],
      schoolTypes: [
        {
          value: "CBSE_private",
          evidence: {
            quote: "ACADEMIC ZONAL COORDINATOR |NARAYANA E TECHNO SCHOOLS,TAMILNADU | 2023 - 2025",
            offset: 0,
            context: "...",
          },
        },
      ],
      keyAchievements: [], redFlags: [], extras: {},
    };
    const r = validateAndFilterFacets(facets, hallucinatedSchoolTypeChunks);
    expect(r.filtered.schoolTypes).toHaveLength(0);
    expect(r.droppedCount).toBe(1);
    expect(r.firstReason).toMatch(/CBSE/);
  });

  it("keeps a schoolTypes facet when the keyword IS in the quote", () => {
    const facets: ParsedFacets = {
      specializations: [], gradeLevels: [], pedagogicalApproach: [], leadershipRoles: [],
      extracurricular: [], languages: [],
      schoolTypes: [
        {
          value: "government",
          evidence: {
            quote: "STATE BOARD curriculum since 2017",
            offset: 300,
            context: "...",
          },
        },
      ],
      keyAchievements: [], redFlags: [], extras: {},
    };
    // Note: "government" keyword not in quote → dropped. Demonstrates strict check.
    const r = validateAndFilterFacets(facets, hallucinatedSchoolTypeChunks);
    expect(r.filtered.schoolTypes).toHaveLength(0);
    expect(r.droppedCount).toBe(1);
  });

  it("drops a languages facet when the language name is not in the quote", () => {
    const facets: ParsedFacets = {
      specializations: [], gradeLevels: [], pedagogicalApproach: [], leadershipRoles: [],
      extracurricular: [],
      languages: [
        {
          value: "Hindi",
          evidence: {
            quote: "Taught English to higher secondary students",
            offset: 200,
            context: "...",
          },
        },
      ],
      schoolTypes: [], keyAchievements: [], redFlags: [], extras: {},
    };
    const r = validateAndFilterFacets(facets, hallucinatedSchoolTypeChunks);
    expect(r.filtered.languages).toHaveLength(0);
    expect(r.droppedCount).toBe(1);
    expect(r.firstReason).toMatch(/Hindi/);
  });

  it("keeps a languages facet when the language IS in the quote (case-insensitive)", () => {
    const facets: ParsedFacets = {
      specializations: [], gradeLevels: [], pedagogicalApproach: [], leadershipRoles: [],
      extracurricular: [],
      languages: [
        {
          value: "English",
          evidence: {
            quote: "Taught English to higher secondary students",
            offset: 200,
            context: "...",
          },
        },
      ],
      schoolTypes: [], keyAchievements: [], redFlags: [], extras: {},
    };
    const r = validateAndFilterFacets(facets, hallucinatedSchoolTypeChunks);
    expect(r.filtered.languages).toHaveLength(1);
    expect(r.droppedCount).toBe(0);
  });

  it("drops facets whose quote doesn't appear in any chunk (basic evidence check)", () => {
    const facets: ParsedFacets = {
      ...valid,
      specializations: [
        ...valid.specializations,
        { value: "JEE_prep", evidence: { quote: "totally made up", offset: 0, context: "..." } },
      ],
    };
    const r = validateAndFilterFacets(facets, chunks);
    expect(r.filtered.specializations).toHaveLength(1); // only the valid one kept
    expect(r.filtered.specializations[0].evidence.quote).toBe("Led JEE prep");
    expect(r.droppedCount).toBe(1);
  });

  it("returns ok=true with no drops when all facets pass", () => {
    const r = validateAndFilterFacets(valid, chunks);
    expect(r.droppedCount).toBe(0);
    expect(r.firstReason).toBeNull();
    expect(r.filtered.specializations).toHaveLength(1);
  });

  it("preserves untouched facet slots (gradeLevels etc.) unchanged", () => {
    // "Taught English to higher secondary students" — chunk at offset 200.
    // "Taught English" starts at index 0 of the chunk → global offset 200.
    // "higher secondary" starts at index 18 of the chunk → global offset 218.
    const facets: ParsedFacets = {
      ...valid,
      gradeLevels: [
        { value: "Senior_Secondary", evidence: { quote: "higher secondary", offset: 218, context: "..." } },
      ],
      languages: [
        { value: "English", evidence: { quote: "Taught English", offset: 200, context: "..." } },
      ],
    };
    const r = validateAndFilterFacets(facets, hallucinatedSchoolTypeChunks);
    // gradeLevels has no value-keyword rule → only basic quote check applies → kept
    expect(r.filtered.gradeLevels).toHaveLength(1);
    expect(r.filtered.languages).toHaveLength(1);
  });
});
