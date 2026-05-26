// convex/hybridScoring.ts
import type { FacetEmbeddings, RoleEmbeddings, HybridWeights } from "./types";
import { cosine } from "./embeddings";

interface JobCriteria {
  subjects: string[];
  boards: string[];
  qualifications: string[];
  minYears: number;
}

interface CandidateProfile {
  subjects: string[];
  boardExperience: string[];
  qualifications: string[];
  yearsExperience?: number;
}

export function structuredMatchScore(job: JobCriteria, cand: CandidateProfile): number {
  let score = 0;
  if (job.subjects.length > 0) {
    const hits = job.subjects.filter((s) =>
      cand.subjects.some((cs) => cs.toLowerCase().includes(s.toLowerCase()))
    ).length;
    score += (hits / job.subjects.length) * 30;
  } else score += 30;

  if (job.boards.length > 0) {
    const hits = job.boards.filter((b) =>
      cand.boardExperience.some((cb) => cb.toLowerCase().includes(b.toLowerCase()))
    ).length;
    score += (hits / job.boards.length) * 20;
  } else score += 20;

  if (job.qualifications.length > 0) {
    const hits = job.qualifications.filter((q) =>
      cand.qualifications.some((cq) => cq.toLowerCase().includes(q.toLowerCase()))
    ).length;
    score += (hits / job.qualifications.length) * 30;
  } else score += 30;

  const yrs = cand.yearsExperience ?? 0;
  if (job.minYears <= 0) score += 20;
  else if (yrs >= job.minYears) score += Math.min(20, 10 + (yrs - job.minYears) * 2);
  else score += 0;

  return Math.round(Math.min(100, score));
}

export function weightedSemanticSimilarity(
  role: RoleEmbeddings | undefined,
  cand: FacetEmbeddings | undefined,
  weights: HybridWeights,
): number {
  if (!role || !cand) return 0;
  const fw = weights.facetWeights;
  return (
    fw.overall      * cosine(role.overall,      cand.overall) +
    fw.experience   * cosine(role.experience,   cand.experience) +
    fw.pedagogy     * cosine(role.pedagogy,     cand.pedagogy) +
    fw.achievements * cosine(role.achievements, cand.achievements) +
    fw.leadership   * cosine(role.leadership,   cand.leadership)
  );
}

export function combinedScore(
  structured: number,
  semanticSim: number,
  ruleBased: number,
  weights: HybridWeights,
): number {
  return weights.w_struct * structured + weights.w_sem * (semanticSim * 100) + weights.w_rules * ruleBased;
}
