import { describe, it, expect } from "vitest";
import { sanitizeRawChunks } from "../../convex/rawChunks";

describe("sanitizeRawChunks", () => {
  it("normalizes an LLM-emitted 'education' section to 'other' (regression for ArgumentValidationError on reparse)", () => {
    const input = [
      { text: "John Doe — Math Teacher", section: "header", offset: 0 },
      { text: "Taught Algebra II", section: "experience", offset: 50 },
      { text: "M.Sc Physics, IIT Delhi 2018", section: "education", offset: 200 },
    ];
    const out = sanitizeRawChunks(input);
    expect(out).toEqual([
      { text: "John Doe — Math Teacher", section: "header", offset: 0 },
      { text: "Taught Algebra II", section: "experience", offset: 50 },
      { text: "M.Sc Physics, IIT Delhi 2018", section: "other", offset: 200 },
    ]);
  });

  it("passes through all canonical section labels unchanged", () => {
    const input = [
      { text: "a", section: "header", offset: 0 },
      { text: "b", section: "experience", offset: 1 },
      { text: "c", section: "pedagogy", offset: 2 },
      { text: "d", section: "achievements", offset: 3 },
      { text: "e", section: "leadership", offset: 4 },
      { text: "f", section: "other", offset: 5 },
    ];
    expect(sanitizeRawChunks(input)).toEqual(input);
  });

  it("normalizes any unknown section string to 'other'", () => {
    const input = [
      { text: "x", section: "Achievements", offset: 0 },
      { text: "y", section: "skills", offset: 1 },
      { text: "z", section: "", offset: 2 },
    ];
    expect(sanitizeRawChunks(input)).toEqual([
      { text: "x", section: "other", offset: 0 },
      { text: "y", section: "other", offset: 1 },
      { text: "z", section: "other", offset: 2 },
    ]);
  });

  it("normalizes non-string section (null, number, missing) to 'other'", () => {
    const input = [
      { text: "a", section: null, offset: 0 },
      { text: "b", section: 42, offset: 1 },
      { text: "c", offset: 2 },
    ];
    expect(sanitizeRawChunks(input)).toEqual([
      { text: "a", section: "other", offset: 0 },
      { text: "b", section: "other", offset: 1 },
      { text: "c", section: "other", offset: 2 },
    ]);
  });

  it("defaults a missing or non-numeric offset to 0 instead of dropping the chunk", () => {
    const input = [
      { text: "a", section: "header" },
      { text: "b", section: "experience", offset: "50" },
      { text: "c", section: "experience", offset: NaN },
    ];
    expect(sanitizeRawChunks(input)).toEqual([
      { text: "a", section: "header", offset: 0 },
      { text: "b", section: "experience", offset: 0 },
      { text: "c", section: "experience", offset: 0 },
    ]);
  });

  it("drops chunks that aren't objects or whose text is missing/empty", () => {
    const input = [
      null,
      "not an object",
      { section: "header", offset: 0 },
      { text: "", section: "header", offset: 0 },
      { text: "valid", section: "header", offset: 0 },
    ];
    expect(sanitizeRawChunks(input)).toEqual([
      { text: "valid", section: "header", offset: 0 },
    ]);
  });

  it("returns an empty array for non-array input", () => {
    expect(sanitizeRawChunks(undefined)).toEqual([]);
    expect(sanitizeRawChunks(null)).toEqual([]);
    expect(sanitizeRawChunks({})).toEqual([]);
    expect(sanitizeRawChunks("foo")).toEqual([]);
  });
});
