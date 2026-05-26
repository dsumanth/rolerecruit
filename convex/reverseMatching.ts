// convex/reverseMatching.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { scoreDimension, type ScoringRules } from "./scoring";
import { structuredMatchScore, weightedSemanticSimilarity, combinedScore } from "./hybridScoring";
import { DEFAULT_HYBRID_WEIGHTS, type HybridWeights } from "./types";
import OpenAI from "openai";

function getClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
}

const RERANK_SYSTEM = `You are a senior recruiter for Indian K-12 schools. Given a job and 10 pre-filtered candidates, rank them by fit and explain why with short phrases citing specific evidence.

Return ONLY a JSON array (no markdown):
[{"candidateIndex": 0, "score": 92, "reasons": ["7yr CBSE Physics", "led JEE prep program"]}]

score is 0-100. reasons is an array of short phrases (max 6 words each, cite specific facts).`;

interface MatchResult {
  candidateId: string;
  score: number;
  reasons: string[];
  structuredScore: number;
  semanticSimilarity: number;
  ruleScore: number;
  hybridWeights: HybridWeights;
}

interface ScoredCandidate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  candidate: any;
  structuredScore: number;
  semanticSimilarity: number;
  ruleScore: number;
  combined: number;
}

export const findCandidatesForJob = action({
  args: {
    jobId: v.id("jobPostings"),
    excludeCandidateIds: v.optional(v.array(v.id("candidates"))),
    limit: v.optional(v.number()),
    useLlmRerank: v.optional(v.boolean()),
    weights: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<MatchResult[]> => {
    const limit = args.limit ?? 10;
    const useLlmRerank = args.useLlmRerank ?? true;
    const weights: HybridWeights = (args.weights as HybridWeights) ?? DEFAULT_HYBRID_WEIGHTS;

    const job = await ctx.runQuery(api.jobs.get, { jobId: args.jobId });
    if (!job) return [];

    // ----- Stage 1: hard filter (gates) -----
    const filtered = await ctx.runQuery(api.candidates.hardFilter, {
      subjects: [job.subject],
      boards: [job.board],
      minYears: job.minExperience,
      limit: 200,
      excludeCandidateIds: args.excludeCandidateIds,
    });
    if (filtered.length === 0) return [];

    // ----- Stage 2: hybrid score -----
    let rules = job.scoringRules as ScoringRules | null;
    if (!rules) {
      rules = {
        dimensions: [
          { name: "qualifications", weight: 0.25, config: { required: job.qualifications ?? [], preferred: [] } },
          { name: "subjectMatch", weight: 0.35, config: { subjects: [job.subject] } },
          { name: "experience", weight: 0.25, config: { minYears: job.minExperience ?? 0, idealYears: (job.minExperience ?? 0) + 3 } },
          { name: "certifications", weight: 0.15, config: { required: [] } },
        ],
        minimumScore: 60,
        autoRejectScore: 30,
        generatedBy: "agent",
        version: 1,
      };
    }

    const scored = filtered.map((cand: any) => {
      const structured = structuredMatchScore(
        {
          subjects: [job.subject],
          boards: [job.board],
          qualifications: job.qualifications ?? [],
          minYears: job.minExperience ?? 0,
        },
        cand,
      );
      const sim = weightedSemanticSimilarity(job.roleEmbeddings, cand.facetEmbeddings, weights);
      const dims = rules!.dimensions.map((d) => ({
        name: d.name,
        score: scoreDimension(d.name, d.config, cand),
        weight: d.weight,
      }));
      const ruleScore = dims.reduce((s, d) => s + d.score * d.weight, 0);
      const combined = combinedScore(structured, sim, ruleScore, weights);
      return {
        candidate: cand,
        structuredScore: structured,
        semanticSimilarity: sim,
        ruleScore: Math.round(ruleScore),
        combined,
      };
    });
    (scored as ScoredCandidate[]).sort((a: ScoredCandidate, b: ScoredCandidate) => b.combined - a.combined);
    const top10: ScoredCandidate[] = scored.slice(0, 10);

    // ----- Stage 3: LLM rerank on top 10 -----
    if (useLlmRerank) {
      const client = getClient();
      if (client) {
        const profiles = top10.map((s: ScoredCandidate, i: number) => {
          const c = s.candidate;
          return `[${i}] ${c.candidateSummary || `${c.name}: ${c.qualifications.join(", ")}, ${c.subjects.join(", ")}, ${c.yearsExperience ?? "?"}y`}`;
        }).join("\n");

        try {
          const res = await client.chat.completions.create({
            model: "deepseek-v4-flash",
            max_tokens: 1024,
            temperature: 0,
            messages: [
              { role: "system", content: RERANK_SYSTEM },
              { role: "user", content: `Job: ${job.title} (${job.subject}, ${job.board}, ${job.level}, min ${job.minExperience ?? 0}y)\nDescription: ${job.naturalLanguageDescription}\n\nCandidates:\n${profiles}` },
            ],
          });
          const text = res.choices[0]?.message?.content ?? "";
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const ranked: Array<{ candidateIndex: number; score: number; reasons: string[] }> = JSON.parse(jsonMatch[0]);
            const final: MatchResult[] = ranked
              .map((r) => {
                const entry = top10[r.candidateIndex];
                if (!entry) return null;
                return {
                  candidateId: entry.candidate._id,
                  score: r.score,
                  reasons: r.reasons ?? [],
                  structuredScore: entry.structuredScore,
                  semanticSimilarity: entry.semanticSimilarity,
                  ruleScore: entry.ruleScore,
                  hybridWeights: weights,
                };
              })
              .filter((x): x is MatchResult => x !== null);
            return final.slice(0, limit);
          }
        } catch {
          /* fall through */
        }
      }
    }

    // No LLM rerank — hybrid-only with synthesized reasons
    return top10.slice(0, limit).map((s: ScoredCandidate) => ({
      candidateId: s.candidate._id,
      score: Math.round(s.combined),
      reasons: [
        s.candidate.subjects?.length ? `Subjects: ${s.candidate.subjects.join(", ")}` : "",
        s.candidate.boardExperience?.length ? `Boards: ${s.candidate.boardExperience.join(", ")}` : "",
        s.candidate.yearsExperience ? `${s.candidate.yearsExperience}y experience` : "",
      ].filter(Boolean),
      structuredScore: s.structuredScore,
      semanticSimilarity: s.semanticSimilarity,
      ruleScore: s.ruleScore,
      hybridWeights: weights,
    }));
  },
});

// Deprecated stub — delegates to the new flow
export const reverseMatchJob = action({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args): Promise<MatchResult[]> => {
    return await ctx.runAction(api.reverseMatching.findCandidatesForJob, { jobId: args.jobId });
  },
});
