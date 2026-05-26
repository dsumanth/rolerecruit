// convex/versions.ts
// Bump these when the corresponding prompt or model changes.
// The backfill action re-extracts candidates whose stamps no longer match.

export const PARSED_FACETS_VERSION = "facets-v1";
export const EMBEDDING_VERSION = "emb-text3sm-v1";
export const JOB_EMBEDDING_VERSION = "emb-text3sm-v1";
export const TRIAGE_PROMPT_VERSION = "triage-v1";
export const NL_SEARCH_PROMPT_VERSION = "nl-v1";
export const OUTREACH_DRAFT_PROMPT_VERSION = "outreach-v1";

// Embedding dimensionality — vectorIndex declares this statically.
export const EMBEDDING_DIMS = 1536;

// Five facet sections used for both candidate and job embeddings.
export const FACET_SECTIONS = ["overall", "experience", "pedagogy", "achievements", "leadership"] as const;
