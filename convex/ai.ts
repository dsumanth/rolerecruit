import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";

const CANDIDATE_SCORING_SYSTEM = `You are an education hiring expert for Indian K-12 schools.

Score each candidate on a 0-100 scale considering:
- Qualification match: How well do their qualifications (B.Ed, D.El.Ed, M.Ed, etc.) match requirements?
- Certification match: CTET, State TET alignment
- Board experience: CBSE/ICSE/State/IB alignment with the job
- Subject expertise: Do they teach the required subjects?
- Years of relevant experience: vs minimum required

Return ONLY a JSON array (no markdown, no explanation):
[{"candidateIndex": 0, "score": 85, "reasoning": "Strong match: B.Ed qualified, CTET certified, 5 years CBSE Physics experience"}]`;

export const scoreCandidates = action({
  args: {
    parsedCriteria: v.any(),
    candidates: v.array(
      v.object({
        _id: v.id("candidates"),
        qualifications: v.array(v.string()),
        certifications: v.array(v.string()),
        boardExperience: v.array(v.string()),
        subjects: v.array(v.string()),
        yearsExperience: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const client = getLlmClient();
    if (!client) {
      return args.candidates.map((c) => ({
        candidateId: c._id,
        score: 50,
        reasoning: "AI scoring not configured (GOOGLE_API_KEY missing)",
      }));
    }

    const candidateProfiles = args.candidates.map((c, i) =>
      `[${i}] ${c.qualifications.join(", ")}, ${c.certifications.join(", ")}, Board: ${c.boardExperience.join(", ")}, Subjects: ${c.subjects.join(", ")}, Experience: ${c.yearsExperience ?? "unknown"} years`
    ).join("\n");

    try {
      const response = await client.chat.completions.create({
        model: LLM_MODEL,
        max_tokens: 4096,
        temperature: 0,
        messages: [
          { role: "system", content: CANDIDATE_SCORING_SYSTEM },
          { role: "user", content: `Job criteria: ${JSON.stringify(args.parsedCriteria)}\n\nCandidates:\n${candidateProfiles}` },
        ],
      });

      const text = response.choices[0]?.message?.content ?? "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array found in response");

      const scores = JSON.parse(jsonMatch[0]);

      const results = [];
      for (const s of scores) {
        const candidate = args.candidates[s.candidateIndex];
        if (candidate) {
          await ctx.runMutation(internal.candidates.updateScore as any, {
            candidateId: candidate._id,
            score: typeof s.score === "number" ? s.score : 50,
            reasoning: typeof s.reasoning === "string" ? s.reasoning : "",
          });
          results.push({ candidateId: candidate._id, score: s.score, reasoning: s.reasoning });
        }
      }

      return results;
    } catch (err: any) {
      return args.candidates.map((c) => ({
        candidateId: c._id,
        score: 50,
        reasoning: `Scoring failed: ${err.message?.substring(0, 200)}`,
      }));
    }
  },
});
