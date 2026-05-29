// tests/convex/inputNormalize.test.ts
//
// Why this exists: production parse failure on a 16k-char resume. Gemini
// produced 56k chars and hit max_tokens, with the tail being solid tabs
// (greedy-decoding runaway on a tab-heavy OCR'd CV). Collapsing whitespace
// at the input boundary kills the trigger pattern AND shrinks input.

import { describe, it, expect } from "vitest";
import { normalizeResumeWhitespace } from "../../convex/lib/inputNormalize";

describe("normalizeResumeWhitespace", () => {
  it("collapses runs of spaces to a single space", () => {
    expect(normalizeResumeWhitespace("a    b")).toBe("a b");
  });

  it("collapses runs of tabs to a single space", () => {
    expect(normalizeResumeWhitespace("a\t\t\t\tb")).toBe("a b");
  });

  it("collapses mixed tab+space runs to a single space", () => {
    expect(normalizeResumeWhitespace("a \t \t  b")).toBe("a b");
  });

  it("caps runs of newlines at two", () => {
    expect(normalizeResumeWhitespace("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("preserves single and double newlines as paragraph breaks", () => {
    expect(normalizeResumeWhitespace("a\nb")).toBe("a\nb");
    expect(normalizeResumeWhitespace("a\n\nb")).toBe("a\n\nb");
  });

  it("strips trailing horizontal whitespace before a newline", () => {
    expect(normalizeResumeWhitespace("a   \nb")).toBe("a\nb");
    expect(normalizeResumeWhitespace("a\t\t\nb")).toBe("a\nb");
  });

  it("normalizes carriage returns to newlines", () => {
    expect(normalizeResumeWhitespace("a\r\nb")).toBe("a\nb");
    expect(normalizeResumeWhitespace("a\rb")).toBe("a\nb");
  });

  it("strips stray control characters (besides \\n and \\t)", () => {
    expect(normalizeResumeWhitespace("a\x00\x07\x1Fb")).toBe("ab");
  });

  it("trims leading and trailing whitespace overall", () => {
    expect(normalizeResumeWhitespace("\n\t  hello  \t\n")).toBe("hello");
  });

  it("preserves non-whitespace content intact (Unicode, punctuation, etc.)", () => {
    const input = "Priya Sharma — B.Ed (Delhi University), 5 yrs PGT Physics.";
    expect(normalizeResumeWhitespace(input)).toBe(input);
  });

  it("kills the pathological tab cascade pattern that triggers LLM runaway", () => {
    // 10k consecutive tabs (the production failure mode) collapses to a single space.
    const cascade = "Section A" + "\t".repeat(10000) + "Section B";
    expect(normalizeResumeWhitespace(cascade)).toBe("Section A Section B");
  });

  it("dramatically shrinks tab-heavy tabular OCR output", () => {
    // Tabular CV section (common from PDF tables via unpdf/vision):
    // "Field\t\t\tValue\n" repeated. Should remain semantically intact but
    // shorter, with no multi-tab runs.
    const tabular = Array.from({ length: 20 }, (_, i) => `Field${i}\t\t\tValue${i}`).join("\n");
    const out = normalizeResumeWhitespace(tabular);
    expect(out).not.toMatch(/\t/);
    expect(out).not.toMatch(/ {2,}/);
    expect(out.length).toBeLessThan(tabular.length);
    expect(out).toContain("Field0 Value0");
    expect(out).toContain("Field19 Value19");
  });
});
