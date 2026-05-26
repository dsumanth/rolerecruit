import { describe, it, expect } from "vitest";
import {
  structuredMatchScore,
  weightedSemanticSimilarity,
  combinedScore,
} from "../../convex/hybridScoring";
import { DEFAULT_HYBRID_WEIGHTS } from "../../convex/types";

describe("hybridScoring", () => {
  it("structuredMatchScore awards full marks for exact match", () => {
    const job = { subjects: ["Physics"], boards: ["CBSE"], qualifications: ["B.Ed"], minYears: 3 };
    const cand: any = {
      subjects: ["Physics"], boardExperience: ["CBSE"], qualifications: ["B.Ed"], yearsExperience: 5,
    };
    const s = structuredMatchScore(job, cand);
    expect(s).toBeGreaterThan(80);
  });

  it("weightedSemanticSimilarity returns 0 when embeddings missing", () => {
    const sim = weightedSemanticSimilarity(undefined, undefined, DEFAULT_HYBRID_WEIGHTS);
    expect(sim).toBe(0);
  });

  it("combinedScore is convex combination of the three terms", () => {
    const s = combinedScore(80, 0.5, 70, DEFAULT_HYBRID_WEIGHTS);
    // 0.5*80 + 0.3*(0.5*100) + 0.2*70 = 40 + 15 + 14 = 69
    expect(s).toBeCloseTo(69, 1);
  });
});
