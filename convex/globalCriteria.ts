import { mutation, query, action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { scoreDimension, getRecommendation } from "./scoring";
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";

export const get = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("globalCriteria")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
  },
});

export const save = mutation({
  args: {
    schoolId: v.id("schools"),
    scoringRules: v.object({
      dimensions: v.array(
        v.object({
          name: v.string(),
          weight: v.number(),
          config: v.any(),
        })
      ),
      minimumScore: v.number(),
      autoRejectScore: v.number(),
      generatedBy: v.union(
        v.literal("agent"),
        v.literal("manual"),
        v.literal("agent_reviewed")
      ),
      version: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("globalCriteria")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();

    if (existing) {
      return await ctx.db.patch(existing._id, {
        scoringRules: {
          ...args.scoringRules,
          version: existing.scoringRules.version + 1,
        },
        updatedAt: Date.now(),
      });
    }

    return await ctx.db.insert("globalCriteria", {
      schoolId: args.schoolId,
      scoringRules: { ...args.scoringRules, version: 1 },
      updatedAt: Date.now(),
    });
  },
});

const GLOBAL_CRITERIA_SYSTEM = `You are an expert in K-12 teacher evaluation. Generate a global scoring rubric for evaluating teachers regardless of specific job postings. This rubric should assess overall teaching quality and fit for the school.

Important: use the school's board type to guide criteria. For example, CBSE schools value NCERT curriculum experience, ICSE schools value project-based learning, IB schools value inquiry-based teaching.

Rules should include dimensions with weights (summing to 1.0). Common dimensions:
- qualifications: required[] array (e.g., ["B.Ed", "CTET"])
- experience: minYears, idealYears numbers
- certifications: required[] array (e.g., ["CTET", "TET"])
- subjectMatch: subjects[] array (core subjects the school values)
- location: preferLocal boolean

Return ONLY a JSON object (no markdown, no explanation):
{
  "dimensions": [{"name": "string", "weight": number, "config": {}}],
  "minimumScore": number,
  "autoRejectScore": number
}`;

export const suggest = action({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const client = getLlmClient();
    if (!client) throw new Error("GOOGLE_API_KEY not configured");

    const school = await ctx.runQuery(api.schools.get as any, { schoolId: args.schoolId });
    if (!school) throw new Error("School not found");

    const response = await client.chat.completions.create({
      model: LLM_MODEL,
      max_tokens: 1024,
      temperature: 0,
      messages: [
        { role: "system", content: GLOBAL_CRITERIA_SYSTEM },
        {
          role: "user",
          content: `Generate global teacher evaluation criteria for ${school.name}, a ${school.board} board school in ${school.city}, ${school.state}.`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in criteria response");
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      dimensions: parsed.dimensions ?? [],
      minimumScore: parsed.minimumScore ?? 60,
      autoRejectScore: parsed.autoRejectScore ?? 30,
    };
  },
});

export const scoreAllCandidates = action({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const criteria = await ctx.runQuery(api.globalCriteria.get as any, {
      schoolId: args.schoolId,
    });
    if (!criteria) return;

    const apps = await ctx.runQuery(api.applications.getUnmatchedForSchool as any, {
      schoolId: args.schoolId,
    });

    for (const app of apps) {
      const candidate = app.candidate;
      if (!candidate) continue;

      const profile = {
        qualifications: candidate.qualifications ?? [],
        certifications: candidate.certifications ?? [],
        boardExperience: candidate.boardExperience ?? [],
        subjects: candidate.subjects ?? [],
        yearsExperience: candidate.yearsExperience,
      };

      const dimensionScores = criteria.scoringRules.dimensions.map((dim: any) => ({
        name: dim.name,
        score: scoreDimension(dim.name, dim.config, profile),
        weight: dim.weight,
        reason: `${dim.name} match score`,
      }));

      const totalScore = dimensionScores.reduce(
        (sum: number, d: any) => sum + d.score * d.weight,
        0
      );

      const recommendation = getRecommendation(
        totalScore,
        criteria.scoringRules.minimumScore,
        criteria.scoringRules.autoRejectScore
      );

      await ctx.runMutation(api.applications.patchScore as any, {
        applicationId: app._id,
        globalScore: Math.round(totalScore),
        scoringResult: {
          totalScore: Math.round(totalScore),
          dimensionScores,
          recommendation,
        },
      });
    }
  },
});
