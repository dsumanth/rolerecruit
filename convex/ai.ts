import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { EMPTY_PARSED_FACETS, buildFacetExtractionPrompt } from "./prompts/facetExtraction";
import type { ParsedProfile, RelationshipsHint, PreviousSchoolHint, QualificationHint, FacetValue } from "./types";
import { EMPTY_RELATIONSHIPS } from "./types";
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";
import { repairJsonControlChars } from "./lib/jsonRepair";
import { normalizeFacetArray, normalizeStringArray, normalizeOptionalString } from "./facetNormalize";

const TYPED_FACET_KEYS = [
  "specializations", "gradeLevels", "pedagogicalApproach", "leadershipRoles",
  "extracurricular", "languages", "schoolTypes", "keyAchievements", "redFlags",
] as const;

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
      max_tokens: 8192,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: args.text.substring(0, 12000) },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const finishReason = response.choices[0]?.finish_reason;
    // Minimal diagnostic: surface input/output sizes + finish_reason so a
    // truncated or empty LLM response is visible in convex logs without dumping
    // full content. If a future upload comes back empty, these three numbers
    // tell us where it broke.
    console.log("[parseProfile]",
      `input=${args.text.length}ch`,
      `resp=${text.length}ch`,
      `finish=${finishReason ?? "?"}`,
    );
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log("[parseProfile] no-json-match; resp head:", text.substring(0, 300));
        throw new Error("No JSON");
      }
      // Gemini occasionally emits literal control characters (unescaped \n,
      // \t, etc.) inside string values when it copies source text into an
      // evidence.context field. JSON.parse rejects those. Try strict parse
      // first, then fall back to the repair pass — that way we keep parse
      // costs at zero for the happy path.
      let parsed: any;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (firstErr: any) {
        const repaired = repairJsonControlChars(jsonMatch[0]);
        parsed = JSON.parse(repaired);
        console.log("[parseProfile] used json-repair (strict-parse failed:", firstErr?.message, ")");
      }

      // Normalize the LLM's facets into the canonical { value, evidence } shape.
      // The model sometimes flattens evidence to the top level and stores the value
      // under a facet-named field (e.g. `language: "English"`); facetNormalize coerces
      // that back to the schema we persist.
      const rawFacets: Record<string, unknown> = parsed.parsedFacets ?? {};
      const parsedFacets: Record<string, FacetValue[] | Record<string, FacetValue[]>> = {
        ...EMPTY_PARSED_FACETS,
      };
      for (const k of TYPED_FACET_KEYS) {
        parsedFacets[k] = normalizeFacetArray(rawFacets[k]);
      }

      const extras: Record<string, FacetValue[]> = {};
      const rawExtras = (rawFacets.extras ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(rawExtras)) {
        const norm = normalizeFacetArray(v);
        if (norm.length > 0) extras[k] = norm;
      }
      for (const k of promotedKeys) {
        const norm = normalizeFacetArray(rawFacets[k]);
        if (norm.length > 0) extras[`__promoted__${k}`] = norm;
      }
      parsedFacets.extras = extras;

      // Phase 3a — normalize relationships block. We map+sanitize each entry
      // because the graph validator uses v.optional(v.string()) for fields like
      // `endReason`, which accepts ABSENT but rejects an explicit `null` — and
      // Gemini happily emits `null` for unknown optional fields.
      const rawRel = parsed.relationships ?? {};
      const sanitizePreviousSchool = (s: any): PreviousSchoolHint | null => {
        if (!s || typeof s !== "object" || typeof s.name !== "string") return null;
        const out: PreviousSchoolHint = { name: s.name };
        if (typeof s.role === "string") out.role = s.role;
        if (Array.isArray(s.subjects)) {
          const subjects = s.subjects.filter((x: any): x is string => typeof x === "string");
          if (subjects.length > 0) out.subjects = subjects;
        }
        if (typeof s.yearStart === "number" && Number.isFinite(s.yearStart)) out.yearStart = s.yearStart;
        if (typeof s.yearEnd === "number" && Number.isFinite(s.yearEnd)) out.yearEnd = s.yearEnd;
        if (typeof s.endReason === "string" && s.endReason.trim()) out.endReason = s.endReason;
        return out;
      };
      const sanitizeQualificationHint = (q: any): QualificationHint | null => {
        if (!q || typeof q !== "object" || typeof q.degree !== "string") return null;
        const out: QualificationHint = { degree: q.degree };
        if (typeof q.university === "string") out.university = q.university;
        if (typeof q.yearStart === "number" && Number.isFinite(q.yearStart)) out.yearStart = q.yearStart;
        if (typeof q.yearEnd === "number" && Number.isFinite(q.yearEnd)) out.yearEnd = q.yearEnd;
        return out;
      };
      const relationships: RelationshipsHint = {
        previousSchools: Array.isArray(rawRel.previousSchools)
          ? rawRel.previousSchools.map(sanitizePreviousSchool).filter((x: PreviousSchoolHint | null): x is PreviousSchoolHint => x !== null)
          : [],
        qualifications: Array.isArray(rawRel.qualifications)
          ? rawRel.qualifications.map(sanitizeQualificationHint).filter((x: QualificationHint | null): x is QualificationHint => x !== null)
          : [],
        certifications: normalizeStringArray(rawRel.certifications),
        referredBy: typeof rawRel.referredBy === "string" && rawRel.referredBy.trim() ? rawRel.referredBy : undefined,
        region: typeof rawRel.region === "string" && VALID_REGIONS.has(rawRel.region)
          ? rawRel.region
          : (typeof rawRel.region === "string" && rawRel.region.trim() ? "Other" : undefined),
      };

      // Top-level string fields the LLM may emit as facet-objects rather than
      // plain strings. Coerce them through normalizeOptionalString/Array so the
      // downstream mutation (which expects scalars) accepts them.
      const yrs = parsed.yearsExperience;
      return {
        ...emptyProfile(),
        name: normalizeOptionalString(parsed.name),
        email: normalizeOptionalString(parsed.email),
        phone: normalizeOptionalString(parsed.phone),
        location: normalizeOptionalString(parsed.location),
        currentSchool: normalizeOptionalString(parsed.currentSchool),
        qualifications: normalizeStringArray(parsed.qualifications),
        certifications: normalizeStringArray(parsed.certifications),
        boardExperience: normalizeStringArray(parsed.boardExperience),
        subjects: normalizeStringArray(parsed.subjects),
        yearsExperience: typeof yrs === "number" && Number.isFinite(yrs) ? yrs : null,
        parsedFacets: parsedFacets as any,
        rawChunks: Array.isArray(parsed.rawChunks) ? parsed.rawChunks : [],
        candidateSummary: typeof parsed.candidateSummary === "string" ? parsed.candidateSummary : "",
        relationships,
      };
    } catch (err: any) {
      console.log("[parseProfile] parse-failed:", err?.message ?? String(err), "resp tail:", text.substring(Math.max(0, text.length - 300)));
      return emptyProfile();
    }
  },
});
