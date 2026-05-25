import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { scoreDimension, getRecommendation, type ScoringRules } from "./scoring";
import OpenAI from "openai";

function getClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
}

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

async function suggestCriteria(job: any): Promise<ScoringRules | null> {
  const client = getClient();
  if (!client) return null;

  const response = await client.chat.completions.create({
    model: "deepseek-v4-flash",
    max_tokens: 1024,
    temperature: 0,
    messages: [
      { role: "system", content: SCORING_RULES_SYSTEM },
      { role: "user", content: `Suggest scoring criteria for: ${job.title}, ${job.subject}, ${job.board} board, ${job.level} level. Required: ${job.qualifications?.join(", ") ?? "none"}. Description: ${job.naturalLanguageDescription}` },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    dimensions: parsed.dimensions ?? [],
    minimumScore: parsed.minimumScore ?? 60,
    autoRejectScore: parsed.autoRejectScore ?? 30,
    generatedBy: "agent",
    version: 1,
  };
}

export const reverseMatchJob = action({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args): Promise<any[]> => {
    const job = await ctx.runQuery(api.jobs.get as any, { jobId: args.jobId });
    if (!job) throw new Error("Job not found");

    let rules = job.scoringRules as ScoringRules | null;
    if (!rules) {
      rules = await suggestCriteria(job);
      if (!rules) return [];
    }

    const unmatched = await ctx.runQuery(api.applications.getUnmatchedForSchool as any, {
      schoolId: job.schoolId,
    });

    const results = [];
    for (const app of unmatched) {
      const candidate = app.candidate;
      if (!candidate) continue;

      const dimensionScores = rules.dimensions.map((dim: any) => ({
        name: dim.name,
        score: scoreDimension(dim.name, dim.config, candidate),
        weight: dim.weight,
        reason: `${dim.name} match score`,
      }));

      const totalScore = dimensionScores.reduce((sum: number, d: any) => sum + d.score * d.weight, 0);

      if (totalScore >= rules.autoRejectScore) {
        results.push({
          applicationId: app._id,
          candidateId: candidate._id,
          score: Math.round(totalScore),
          dimensionScores,
          recommendation: getRecommendation(totalScore, rules.minimumScore, rules.autoRejectScore),
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  },
});
