import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { EMPTY_PARSED_FACETS, buildFacetExtractionPrompt } from "./prompts/facetExtraction";
import type { ParsedProfile, RelationshipsHint, PreviousSchoolHint, QualificationHint, FacetValue } from "./types";
import { EMPTY_RELATIONSHIPS } from "./types";
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";
import { repairJsonControlChars } from "./lib/jsonRepair";
import { normalizeResumeWhitespace } from "./lib/inputNormalize";
import { normalizeFacetArray, normalizeStringArray, normalizeOptionalString } from "./facetNormalize";
import { sanitizeRawChunks } from "./rawChunks";

const TYPED_FACET_KEYS = [
  "specializations", "gradeLevels", "pedagogicalApproach", "leadershipRoles",
  "extracurricular", "languages", "schoolTypes", "keyAchievements", "redFlags",
] as const;

const VALID_REGIONS = new Set([
  "Delhi NCR", "Mumbai", "Bangalore", "Hyderabad", "Pune",
  "Chennai", "Kolkata", "Other",
]);

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

    // The output schema is verbose — every facet value carries an evidence
    // block (quote + ~80 chars of context), plus a full rawChunks transcript of
    // the input. A real resume can blow past 8k tokens easily; 8192 cut off
    // mid-JSON in production. 32768 leaves ~4x headroom under Gemini 2.5
    // Flash-Lite's 65k output ceiling. max_tokens is a ceiling, not a quota —
    // the model still stops when it's done.
    //
    // INPUT_CHAR_CAP: safety net only. Real resumes top out around 20k chars
    // and Flash-Lite accepts ~1M input tokens, so 50k is well within bounds.
    // Log if hit so we know to raise it.
    //
    // Whitespace normalization runs BEFORE the cap: OCR'd PDFs and Word tables
    // dump runs of tabs/spaces that (a) waste cap budget and (b) trigger a
    // greedy-decoding tab cascade in the model that exhausts max_tokens.
    const normalizedText = normalizeResumeWhitespace(args.text);
    const INPUT_CHAR_CAP = 50_000;
    if (normalizedText.length > INPUT_CHAR_CAP) {
      console.log("[parseProfile] input-truncated", normalizedText.length);
    }
    const response = await client.chat.completions.create({
      model: LLM_MODEL,
      max_tokens: 32768,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: normalizedText.substring(0, INPUT_CHAR_CAP) },
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
    // finish_reason "length" means max_tokens was hit. The trailing JSON is
    // guaranteed truncated, and observed failures show the model spent its
    // budget in a runaway whitespace loop. Parsing the partial response either
    // throws on malformed structure or silently yields a fragmentary profile
    // (e.g. name parsed, qualifications missing) that downstream pipelines
    // can't distinguish from a real-but-sparse candidate. Fail closed instead.
    if (finishReason === "length") {
      console.log("[parseProfile] truncated by max_tokens; returning empty profile");
      return emptyProfile();
    }
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
        rawChunks: sanitizeRawChunks(parsed.rawChunks),
        candidateSummary: typeof parsed.candidateSummary === "string" ? parsed.candidateSummary : "",
        relationships,
      };
    } catch (err: any) {
      console.log("[parseProfile] parse-failed:", err?.message ?? String(err), "resp tail:", text.substring(Math.max(0, text.length - 300)));
      return emptyProfile();
    }
  },
});
