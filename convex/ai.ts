import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { EMPTY_PARSED_FACETS, buildFacetExtractionPrompt } from "./prompts/facetExtraction";
import type { ParsedProfile, RelationshipsHint, PreviousSchoolHint, QualificationHint } from "./types";
import { EMPTY_RELATIONSHIPS } from "./types";
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";

const VALID_REGIONS = new Set([
  "Delhi NCR", "Mumbai", "Bangalore", "Hyderabad", "Pune",
  "Chennai", "Kolkata", "Other",
]);

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
  const client = getLlmClient();
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
    model: LLM_MODEL,
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

function emptyProfile(): ParsedProfile {
  return {
    name: null, email: null, phone: null, location: null,
    qualifications: [], certifications: [], boardExperience: [],
    subjects: [], yearsExperience: null, currentSchool: null,
    parsedFacets: EMPTY_PARSED_FACETS,
    candidateSummary: "",
    rawChunks: [],
    relationships: EMPTY_RELATIONSHIPS,
  };
}

export const parseProfileFromText = action({
  args: { text: v.string() },
  handler: async (ctx, args): Promise<ParsedProfile> => {
    const client = getLlmClient();
    if (!client) return emptyProfile();

    // Phase 2: read promoted keys at runtime so the LLM extracts them as typed
    let promotedKeys: string[] = [];
    try {
      promotedKeys = await ctx.runQuery(api.facetPromotion.listPromotedKeys, {});
    } catch {
      promotedKeys = [];
    }

    const systemPrompt = buildFacetExtractionPrompt(promotedKeys);

    const response = await client.chat.completions.create({
      model: LLM_MODEL,
      max_tokens: 4096,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: args.text.substring(0, 12000) },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      const parsed = JSON.parse(jsonMatch[0]);

      // Merge LLM-emitted top-level promoted keys into parsedFacets.extras under __promoted__<key>
      const parsedFacets = { ...EMPTY_PARSED_FACETS, ...(parsed.parsedFacets ?? {}) };
      const extras = { ...((parsedFacets as any).extras ?? {}) };
      for (const k of promotedKeys) {
        if (parsed.parsedFacets?.[k]) {
          extras[`__promoted__${k}`] = parsed.parsedFacets[k];
          delete (parsedFacets as any)[k]; // remove from top-level — only typed/extras shape allowed
        }
      }
      (parsedFacets as any).extras = extras;

      // Phase 3a — normalize relationships block
      const rawRel = parsed.relationships ?? {};
      const relationships: RelationshipsHint = {
        previousSchools: Array.isArray(rawRel.previousSchools)
          ? rawRel.previousSchools.filter(
              (s: any): s is PreviousSchoolHint =>
                s !== null && typeof s === "object" && typeof s.name === "string",
            )
          : [],
        qualifications: Array.isArray(rawRel.qualifications)
          ? rawRel.qualifications.filter(
              (q: any): q is QualificationHint =>
                q !== null && typeof q === "object" && typeof q.degree === "string",
            )
          : [],
        certifications: Array.isArray(rawRel.certifications)
          ? rawRel.certifications.filter((c: any): c is string => typeof c === "string")
          : [],
        referredBy: typeof rawRel.referredBy === "string" ? rawRel.referredBy : undefined,
        region: typeof rawRel.region === "string" && VALID_REGIONS.has(rawRel.region)
          ? rawRel.region
          : (typeof rawRel.region === "string" ? "Other" : undefined),
      };

      return {
        ...emptyProfile(),
        ...parsed,
        parsedFacets: parsedFacets as any,
        rawChunks: Array.isArray(parsed.rawChunks) ? parsed.rawChunks : [],
        candidateSummary: typeof parsed.candidateSummary === "string" ? parsed.candidateSummary : "",
        relationships,
      };
    } catch {
      return emptyProfile();
    }
  },
});
