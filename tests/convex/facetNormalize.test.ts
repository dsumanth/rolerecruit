// tests/convex/facetNormalize.test.ts
import { describe, it, expect } from "vitest";
import {
  normalizeFacetArray,
  normalizeStringArray,
  normalizeOptionalString,
} from "../../convex/facetNormalize";

describe("normalizeFacetArray", () => {
  it("passes through canonical { value, evidence: {...} } shape", () => {
    const input = [
      {
        value: "English",
        evidence: {
          quote: "Taught English to higher secondary students.",
          offset: 430,
          context: "Online Tuitions, Ernakulam Taught English to higher secondary students.",
        },
      },
    ];
    expect(normalizeFacetArray(input)).toEqual(input);
  });

  it("normalizes flat LLM shape where value lives under a facet-named field", () => {
    // This is the exact shape the LLM emitted that caused the production error:
    // {context, language, offset, quote} → must become {value, evidence: {context, offset, quote}}
    const input = [
      {
        context:
          "Focuzfive Online Tuitions, Ernakulam Taught English, Biology & Biotechnology to higher secondary students.",
        language: "English",
        offset: 430,
        quote: "Taught English, Biology & Biotechnology to higher secondary students.",
      },
    ];
    expect(normalizeFacetArray(input)).toEqual([
      {
        value: "English",
        evidence: {
          quote: "Taught English, Biology & Biotechnology to higher secondary students.",
          offset: 430,
          context:
            "Focuzfive Online Tuitions, Ernakulam Taught English, Biology & Biotechnology to higher secondary students.",
        },
      },
    ]);
  });

  it("normalizes flat shape with arbitrary value-field names (subject, approach, role, flag)", () => {
    const input = [
      { subject: "Physics", quote: "PGT Physics", offset: 10, context: "5 years PGT Physics CBSE" },
      { approach: "inquiry_based", quote: "inquiry-driven labs", offset: 50, context: "I run inquiry-driven labs each week" },
    ];
    const out = normalizeFacetArray(input);
    expect(out).toHaveLength(2);
    expect(out[0].value).toBe("Physics");
    expect(out[1].value).toBe("inquiry_based");
    expect(out[0].evidence.quote).toBe("PGT Physics");
    expect(out[1].evidence.quote).toBe("inquiry-driven labs");
  });

  it("drops items missing evidence fields", () => {
    expect(normalizeFacetArray([{ value: "English" }])).toEqual([]);
    expect(normalizeFacetArray([{ language: "English" }])).toEqual([]);
    expect(
      normalizeFacetArray([{ language: "English", quote: "x", offset: 1 /* no context */ }]),
    ).toEqual([]);
  });

  it("returns empty array for non-array input", () => {
    expect(normalizeFacetArray(null)).toEqual([]);
    expect(normalizeFacetArray(undefined)).toEqual([]);
    expect(normalizeFacetArray({})).toEqual([]);
    expect(normalizeFacetArray("not an array")).toEqual([]);
  });

  it("ignores non-string value candidates", () => {
    // offset is a number — must not be picked as the 'value' field
    const input = [{ offset: 42, quote: "x", context: "y" }];
    expect(normalizeFacetArray(input)).toEqual([]);
  });

  it("filters out malformed items but keeps valid siblings in the same array", () => {
    const input = [
      { language: "English", quote: "Taught English", offset: 1, context: "ctx1" },
      { language: "Hindi" /* no evidence */ },
      {
        value: "Tamil",
        evidence: { quote: "Tamil literature", offset: 5, context: "ctx2" },
      },
    ];
    const out = normalizeFacetArray(input);
    expect(out).toHaveLength(2);
    expect(out.map((x) => x.value)).toEqual(["English", "Tamil"]);
  });
});

describe("normalizeStringArray", () => {
  it("passes through a plain string array", () => {
    expect(normalizeStringArray(["B.Ed", "M.Ed", "Ph.D"])).toEqual(["B.Ed", "M.Ed", "Ph.D"]);
  });

  it("extracts `value` from facet-objects (LLM facet-style emission)", () => {
    // Real Gemini emission for top-level `subjects` we observed:
    //   [{ value: "English", evidence: {...} }, { value: "Biology", evidence: {...} }]
    const input = [
      { value: "English", evidence: { quote: "Taught English", offset: 1, context: "x" } },
      { value: "Biology", evidence: { quote: "Biology", offset: 5, context: "y" } },
    ];
    expect(normalizeStringArray(input)).toEqual(["English", "Biology"]);
  });

  it("extracts `degree` from qualification-objects (LLM relationship-style emission)", () => {
    // Real Gemini emission for top-level `qualifications`:
    //   [{ degree: "B.Ed", university: "Calicut", yearStart: 2018, yearEnd: 2019 }]
    const input = [
      { degree: "B.Ed", university: "Calicut University", yearStart: 2018, yearEnd: 2019 },
      { degree: "M.Sc. Biotechnology", university: "St. Joseph's College" },
    ];
    expect(normalizeStringArray(input)).toEqual(["B.Ed", "M.Sc. Biotechnology"]);
  });

  it("dedupes and trims while preserving order", () => {
    expect(normalizeStringArray(["  CBSE  ", "ICSE", "CBSE"])).toEqual(["CBSE", "ICSE"]);
  });

  it("returns empty for non-array input", () => {
    expect(normalizeStringArray(null)).toEqual([]);
    expect(normalizeStringArray(undefined)).toEqual([]);
    expect(normalizeStringArray({})).toEqual([]);
    expect(normalizeStringArray("not array")).toEqual([]);
  });

  it("drops items with no usable string", () => {
    expect(normalizeStringArray([null, 42, { foo: "bar" }, ""])).toEqual([]);
  });
});

describe("normalizeOptionalString", () => {
  it("passes through plain strings", () => {
    expect(normalizeOptionalString("Focuzfive Online Tuitions")).toBe("Focuzfive Online Tuitions");
  });

  it("extracts `value` from a facet-object (LLM facet-style emission for currentSchool)", () => {
    expect(
      normalizeOptionalString({
        value: "Focuzfive Online Tuitions",
        evidence: { quote: "Focuzfive Online Tuitions", offset: 1, context: "x" },
      }),
    ).toBe("Focuzfive Online Tuitions");
  });

  it("returns null for null/undefined/empty", () => {
    expect(normalizeOptionalString(null)).toBeNull();
    expect(normalizeOptionalString(undefined)).toBeNull();
    expect(normalizeOptionalString("")).toBeNull();
    expect(normalizeOptionalString("   ")).toBeNull();
  });
});
