// convex/prompts/jobSectionSplitter.ts

export const JOB_SECTION_SPLITTER_SYSTEM = `You take a natural-language job description for an Indian K-12 teaching role and split it into 5 sections corresponding to candidate facet embeddings.

Return ONLY a JSON object (no markdown):
{
  "overall": "1-2 paragraph summary of the role",
  "experience": "what experience profile the ideal candidate would have",
  "pedagogy": "what teaching approach/philosophy the role calls for",
  "achievements": "what kinds of outcomes/wins matter",
  "leadership": "what leadership/management aspects (if any) the role has"
}

If a section isn't relevant (e.g., no leadership component), still produce a short string describing what would be neutral/preferred. Never return an empty string.`;
