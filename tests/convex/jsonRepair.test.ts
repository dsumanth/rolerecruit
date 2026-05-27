// tests/convex/jsonRepair.test.ts
import { describe, it, expect } from "vitest";
import { repairJsonControlChars } from "../../convex/lib/jsonRepair";

describe("repairJsonControlChars", () => {
  it("returns identical output for well-formed JSON", () => {
    const input = '{"a": "hello", "b": ["one", "two"], "n": 42}';
    expect(repairJsonControlChars(input)).toBe(input);
    expect(() => JSON.parse(repairJsonControlChars(input))).not.toThrow();
  });

  it("escapes a literal newline inside a string literal", () => {
    // This is the exact failure we hit: LLM emitted an unescaped \n inside a
    // string value. JSON.parse rejects it; the repair should escape it as \\n.
    const broken = '{"context": "Line one\nLine two"}';
    const repaired = repairJsonControlChars(broken);
    expect(repaired).toBe('{"context": "Line one\\nLine two"}');
    expect(JSON.parse(repaired)).toEqual({ context: "Line one\nLine two" });
  });

  it("escapes tabs and carriage returns inside string literals", () => {
    const broken = '{"a": "tab\there", "b": "cr\rhere"}';
    const repaired = repairJsonControlChars(broken);
    expect(JSON.parse(repaired)).toEqual({ a: "tab\there", b: "cr\rhere" });
  });

  it("escapes arbitrary low control chars as \\uXXXX inside strings", () => {
    const broken = '{"x": "before\x07after"}';
    const repaired = repairJsonControlChars(broken);
    expect(repaired).toBe('{"x": "before\\u0007after"}');
    expect(JSON.parse(repaired)).toEqual({ x: "before\x07after" });
  });

  it("does NOT touch control chars outside of string literals (whitespace, etc.)", () => {
    // Real-world JSON has newlines between tokens; those must be preserved
    // as-is for the JSON spec to accept them.
    const input = '{\n  "a": "ok",\n  "b": 1\n}';
    const repaired = repairJsonControlChars(input);
    expect(repaired).toBe(input);
    expect(JSON.parse(repaired)).toEqual({ a: "ok", b: 1 });
  });

  it("respects backslash escapes — does not double-escape already-escaped chars", () => {
    const input = '{"a": "already \\n escaped", "b": "quote \\" inside"}';
    const repaired = repairJsonControlChars(input);
    expect(repaired).toBe(input);
    expect(JSON.parse(repaired)).toEqual({ a: "already \n escaped", b: 'quote " inside' });
  });

  it("handles a multi-string object with mixed broken/clean values", () => {
    const broken = '{"good": "abc", "bad": "line\nbreak", "alsoGood": "xyz"}';
    const repaired = repairJsonControlChars(broken);
    expect(JSON.parse(repaired)).toEqual({ good: "abc", bad: "line\nbreak", alsoGood: "xyz" });
  });

  it("handles the actual failure pattern (control char near LLM-emitted context)", () => {
    // Mimics the structure that broke us in production: an `evidence.context`
    // field with a literal newline copied from the source resume.
    const broken = `{
  "parsedFacets": {
    "languages": [
      {
        "value": "Tamil",
        "evidence": {
          "quote": "Tamil Nadu University",
          "offset": 42,
          "context": "Born in Tamil Nadu
University of Madras"
        }
      }
    ]
  }
}`;
    const repaired = repairJsonControlChars(broken);
    const parsed = JSON.parse(repaired);
    expect(parsed.parsedFacets.languages[0].value).toBe("Tamil");
    expect(parsed.parsedFacets.languages[0].evidence.context).toContain("Tamil Nadu");
  });
});
