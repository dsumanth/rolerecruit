import OpenAI from "openai";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const INDIAN_EDUCATION_TAXONOMY = `
You are an AI that parses natural language job descriptions for Indian K-12 schools into structured criteria.

Indian education context:
- Boards: CBSE, ICSE, IB, IGCSE, State Board
- Teaching levels: PRT (Primary Teacher, Classes 1-5), TGT (Trained Graduate Teacher, Classes 6-10), PGT (Post Graduate Teacher, Classes 11-12)
- Common qualifications: B.Ed, D.El.Ed, M.Ed, CTET, State TET, NET, Ph.D
- Subjects include: English, Hindi, Mathematics, Physics, Chemistry, Biology, History, Geography, Economics, Computer Science, Sanskrit, Regional Languages

Return a JSON object with this exact structure:
{
  "subjects": string[],
  "board": string,
  "level": string,
  "requiredQualifications": string[],
  "preferredQualifications": string[],
  "minExperience": number | null,
  "skills": string[]
}
`;

function getClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
}

export async function parseJobDescription(
  description: string
): Promise<{
  subjects: string[];
  board: string;
  level: string;
  requiredQualifications: string[];
  preferredQualifications: string[];
  minExperience: number | null;
  skills: string[];
}> {
  const client = getClient();
  if (!client) {
    return {
      subjects: [],
      board: "",
      level: "",
      requiredQualifications: [],
      preferredQualifications: [],
      minExperience: null,
      skills: [],
    };
  }

  const response = await client.chat.completions.create({
    model: "deepseek-v4-flash",
    max_tokens: 1024,
    temperature: 0,
    messages: [
      { role: "system", content: INDIAN_EDUCATION_TAXONOMY },
      { role: "user", content: `Parse this job description into structured criteria:\n\n${description}` },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("No JSON found in response");
  } catch (err) {
    throw new Error(`Failed to parse AI response: ${text.substring(0, 200)}`);
  }
}

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
    const client = getClient();
    if (!client) {
      return args.candidates.map((c) => ({
        candidateId: c._id,
        score: 50,
        reasoning: "AI scoring not configured (DEEPSEEK_API_KEY missing)",
      }));
    }

    const candidateProfiles = args.candidates.map((c, i) =>
      `[${i}] ${c.qualifications.join(", ")}, ${c.certifications.join(", ")}, Board: ${c.boardExperience.join(", ")}, Subjects: ${c.subjects.join(", ")}, Experience: ${c.yearsExperience ?? "unknown"} years`
    ).join("\n");

    try {
      const response = await client.chat.completions.create({
        model: "deepseek-v4-flash",
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

const PROFILE_PARSING_SYSTEM = `You are an AI that extracts structured information from resumes, profiles, and email notifications about Indian K-12 teacher candidates.

Extract the following fields where available. Use null or empty arrays for missing data. Return ONLY a JSON object (no markdown, no explanation):

{
  "name": string | null,
  "email": string | null,
  "phone": string | null,
  "location": string | null,
  "qualifications": string[],
  "certifications": string[],
  "boardExperience": string[],
  "subjects": string[],
  "yearsExperience": number | null,
  "currentSchool": string | null
}

Qualification examples: B.Ed, D.El.Ed, M.Ed, M.Sc, B.Sc, Ph.D
Certification examples: CTET, State TET, NET, UGC-NET
Board examples: CBSE, ICSE, IB, IGCSE, State Board
Subject examples: English, Hindi, Mathematics, Physics, Chemistry, Biology, History, Geography, Economics, Computer Science, Sanskrit`;

export const parseProfileFromText = action({
  args: {
    text: v.string(),
  },
  handler: async (_ctx, args) => {
    const client = getClient();
    if (!client) {
      return {
        name: null, email: null, phone: null, location: null,
        qualifications: [], certifications: [], boardExperience: [],
        subjects: [], yearsExperience: null, currentSchool: null,
      };
    }

    const response = await client.chat.completions.create({
      model: "deepseek-v4-flash",
      max_tokens: 512,
      temperature: 0,
      messages: [
        { role: "system", content: PROFILE_PARSING_SYSTEM },
        { role: "user", content: args.text.substring(0, 4000) },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error("No JSON found");
    } catch {
      return {
        name: null, email: null, phone: null, location: null,
        qualifications: [], certifications: [], boardExperience: [],
        subjects: [], yearsExperience: null, currentSchool: null,
      };
    }
  },
});
