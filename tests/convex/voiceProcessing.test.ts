import { describe, it, expect } from "vitest";
import { buildSummaryPrompt, parseSummaryResponse } from "../../convex/voiceProcessing";

describe("voiceProcessing helpers", () => {
  it("buildSummaryPrompt includes the transcript and the field label hint", () => {
    const p = buildSummaryPrompt({
      transcript: "Priya was strong on fractions and engaged students.",
      fieldKey: "comments",
      language: "en-IN",
    });
    expect(p).toContain("Priya was strong on fractions");
    expect(p.toLowerCase()).toContain("3 to 5");
  });

  it("parseSummaryResponse extracts bullets from a numbered list", () => {
    const raw = `1. Strong on fractions concept
2. Engaged quieter students
3. Slow pacing on word problems`;
    expect(parseSummaryResponse(raw)).toEqual([
      "Strong on fractions concept",
      "Engaged quieter students",
      "Slow pacing on word problems",
    ]);
  });

  it("parseSummaryResponse handles bullet-style markers", () => {
    const raw = `- A\n- B\n- C\n- D`;
    expect(parseSummaryResponse(raw)).toEqual(["A", "B", "C", "D"]);
  });

  it("parseSummaryResponse truncates bullets over 120 chars", () => {
    const long = "x".repeat(200);
    const out = parseSummaryResponse(`1. ${long}`);
    expect(out[0].length).toBeLessThanOrEqual(120);
  });

  it("parseSummaryResponse caps at 5 bullets", () => {
    const raw = `1. A\n2. B\n3. C\n4. D\n5. E\n6. F\n7. G`;
    expect(parseSummaryResponse(raw)).toHaveLength(5);
  });
});
