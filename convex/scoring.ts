import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";

export interface ScoringRules {
  dimensions: Array<{ name: string; weight: number; config: any }>;
  minimumScore: number;
  autoRejectScore: number;
  generatedBy: "agent" | "manual" | "agent_reviewed";
  version: number;
}

export interface CandidateProfile {
  qualifications: string[];
  certifications: string[];
  boardExperience: string[];
  subjects: string[];
  yearsExperience?: number;
}

export function scoreDimension(name: string, config: any, candidate: CandidateProfile): number {
  switch (name) {
    case "qualifications": {
      const required = (config.required as string[]) ?? [];
      const preferred = (config.preferred as string[]) ?? [];
      if (required.length === 0) return 100;
      let score = 0;
      for (const q of required) {
        if (candidate.qualifications.some((cq) => cq.toLowerCase().includes(q.toLowerCase()))) {
          score += 50 / required.length;
        }
      }
      for (const p of preferred) {
        if (candidate.qualifications.some((cq) => cq.toLowerCase().includes(p.toLowerCase()))) {
          score += 50 / Math.max(preferred.length, 1);
        }
      }
      return Math.min(100, Math.round(score));
    }
    case "experience": {
      const minYears = (config.minYears as number) ?? 0;
      const idealYears = (config.idealYears as number) ?? minYears;
      const yrs = candidate.yearsExperience ?? 0;
      if (yrs < minYears) return 0;
      if (yrs >= idealYears) return 100;
      return Math.round(((yrs - minYears) / (idealYears - minYears)) * 100);
    }
    case "certifications": {
      const required = (config.required as string[]) ?? [];
      if (required.length === 0) return 100;
      let score = 0;
      for (const c of required) {
        if (candidate.certifications.some((cc) => cc.toLowerCase().includes(c.toLowerCase()))) {
          score += 100 / required.length;
        }
      }
      return Math.round(score);
    }
    case "subjectMatch": {
      const subjects = (config.subjects as string[]) ?? [];
      if (subjects.length === 0) return 100;
      let matches = 0;
      for (const s of subjects) {
        if (candidate.subjects.some((cs) => cs.toLowerCase().includes(s.toLowerCase()))) {
          matches++;
        }
      }
      return Math.round((matches / subjects.length) * 100);
    }
    case "location": {
      return candidate.boardExperience.length > 0 ? 80 : 100;
    }
    default:
      return 100;
  }
}

export function getRecommendation(totalScore: number, minimumScore: number, autoRejectScore: number): string {
  if (totalScore < autoRejectScore) return "skip";
  if (totalScore >= 85) return "strong";
  if (totalScore >= minimumScore) return "good";
  return "weak";
}

export const testScoreCandidate = action({
  args: {
    candidate: v.object({
      qualifications: v.array(v.string()),
      certifications: v.array(v.string()),
      boardExperience: v.array(v.string()),
      subjects: v.array(v.string()),
      yearsExperience: v.optional(v.number()),
    }),
    rules: v.any(),
  },
  handler: async (_ctx, args) => {
    const rules = args.rules as ScoringRules;
    const candidate = args.candidate;
    const dimensionScores = rules.dimensions.map((dim) => ({
      name: dim.name,
      score: scoreDimension(dim.name, dim.config, candidate),
      weight: dim.weight,
      reason: `${dim.name} match score`,
    }));

    const totalScore = dimensionScores.reduce((sum, d) => sum + d.score * d.weight, 0);
    const recommendation = getRecommendation(totalScore, rules.minimumScore, rules.autoRejectScore);

    return { totalScore: Math.round(totalScore), dimensionScores, recommendation };
  },
});

const SCORING_RULES_SYSTEM = `You are an expert in Indian K-12 teacher recruitment. Generate structured scoring rules from natural language criteria.

Rules should include dimensions with weights (summing to 1.0) and configuration. Common dimensions:
- qualifications: required[], preferred[] arrays
- experience: minYears, idealYears numbers
- certifications: required[] array
- subjectMatch: subjects[] array
- location: preferLocal boolean

Return ONLY a JSON object (no markdown, no explanation):
{
  "dimensions": [{"name": "string", "weight": number, "config": {}}],
  "minimumScore": number,
  "autoRejectScore": number
}`;

export const generateScoringRules = internalAction({
  args: {
    jobId: v.id("jobPostings"),
    nlCriteria: v.string(),
  },
  handler: async (ctx, args) => {
    const client = getLlmClient();
    if (!client) throw new Error("GOOGLE_API_KEY not configured");

    const response = await client.chat.completions.create({
      model: LLM_MODEL,
      max_tokens: 1024,
      temperature: 0,
      messages: [
        { role: "system", content: SCORING_RULES_SYSTEM },
        { role: "user", content: args.nlCriteria },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in scoring rules response");
    const parsed = JSON.parse(jsonMatch[0]);

    const rules: ScoringRules = {
      dimensions: parsed.dimensions ?? [],
      minimumScore: parsed.minimumScore ?? 60,
      autoRejectScore: parsed.autoRejectScore ?? 30,
      generatedBy: "agent",
      version: 1,
    };

    await ctx.runMutation(api.jobs.saveScoringRules as any, {
      jobId: args.jobId,
      scoringRules: rules,
    });

    return rules;
  },
});

export const suggestCriteria = action({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args) => {
    const client = getLlmClient();
    if (!client) throw new Error("GOOGLE_API_KEY not configured");

    const job = await ctx.runQuery(api.jobs.get as any, { jobId: args.jobId });
    if (!job) throw new Error("Job not found");

    const response = await client.chat.completions.create({
      model: LLM_MODEL,
      max_tokens: 1024,
      temperature: 0,
      messages: [
        { role: "system", content: SCORING_RULES_SYSTEM },
        { role: "user", content: `Suggest scoring criteria for: ${job.title}, ${job.subject}, ${job.board} board, ${job.level} level. Required: ${job.qualifications?.join(", ") ?? "none"}. Description: ${job.naturalLanguageDescription}` },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      dimensions: parsed.dimensions ?? [],
      minimumScore: parsed.minimumScore ?? 60,
      autoRejectScore: parsed.autoRejectScore ?? 30,
    };
  },
});
