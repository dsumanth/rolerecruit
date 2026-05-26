// convex/prompts/facetExtraction.ts

const STATIC_VOCAB = `FACET VOCABULARY (use these when applicable; coin new ones for novelty):
- specializations: JEE_prep, NEET_prep, Olympiad, remedial, gifted, special_needs, ESL
- gradeLevels: Pre_Primary, Primary, Middle, Secondary, Senior_Secondary
- pedagogicalApproach: inquiry_based, experiential, traditional, montessori, project_based
- leadershipRoles: HOD_<Subject>, curriculum_committee, examination_coordinator, mentor
- schoolTypes: CBSE_private, ICSE_private, IB_international, government_aided, government
- languages: English, Hindi, Marathi, Tamil, Telugu, Kannada, Bengali, regional
- redFlags: short_tenures, employment_gap, frequent_school_switches, terminated_role`;

export function buildFacetExtractionPrompt(promotedKeys: string[]): string {
  const promotedSection = promotedKeys.length > 0
    ? `\n\nADDITIONAL TYPED FACETS (auto-promoted from past corpus — extract these as typed facets, NOT into extras):\n${promotedKeys.map((k) => `- ${k}`).join("\n")}\n`
    : "";

  return `You are an AI that compiles candidate resumes for Indian K-12 teacher hiring into a structured, queryable form. Your output runs as the candidate's permanent profile in our database — extract EVERYTHING the system might need to match this candidate against any future role.

CRITICAL GROUNDING RULES:
1. Every facet value you emit MUST be supported by a quote from the resume text.
2. The quote you provide must appear LITERALLY in the resume text — you may not paraphrase.
3. The "offset" you provide must be the character position where the quote begins.
4. The "context" should be ~50 characters from the resume surrounding the quote.

INDIAN EDUCATION CONTEXT:
- Boards: CBSE, ICSE, IB, IGCSE, State Board
- Levels: PRT (Primary, Classes 1-5), TGT (Grades 6-10), PGT (Grades 11-12)
- Qualifications: B.Ed, D.El.Ed, M.Ed, M.Sc, B.Sc, Ph.D
- Certifications: CTET, State TET, NET, UGC-NET

${STATIC_VOCAB}${promotedSection}

EXTRAS BAG: Anything that doesn't fit a typed facet but seems important goes into "extras" — an open-vocabulary record. Use snake_case keys. The system tracks frequency and graduates popular extras to typed facets later — so be liberal.

For PROMOTED facets, emit values under the typed slot key (e.g., "AI_curriculum_design": [...]) inside parsedFacets, NOT inside extras.

RAW CHUNKS: Also split the resume into sections labeled header|experience|pedagogy|achievements|leadership|other. These are the source-of-truth for evidence validation and future re-extraction. "header" is for top-of-resume identity/qualifications; never use "overall".

CANDIDATE SUMMARY: A 1-paragraph (~80 words) job-agnostic third-person description of the candidate. No bullets. No subjective claims.

OUTPUT — return ONLY a JSON object (no markdown, no explanation) matching the same schema as before, with the additional promoted facets appearing as top-level keys in parsedFacets when applicable.`;
}

// Preserved for compatibility — same as buildFacetExtractionPrompt([])
// DO NOT REMOVE until all callers migrate to buildFacetExtractionPrompt
export const FACET_EXTRACTION_SYSTEM = buildFacetExtractionPrompt([]);

export const EMPTY_PARSED_FACETS = {
  specializations: [], gradeLevels: [], pedagogicalApproach: [],
  leadershipRoles: [], extracurricular: [], languages: [],
  schoolTypes: [], keyAchievements: [], redFlags: [], extras: {},
};
