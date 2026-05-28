// convex/intake.ts
import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { validateAndFilterFacets } from "./evidenceValidator";
import type { ParsedProfile, RawChunk } from "./types";

export const generateResumeUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

function sectionText(chunks: RawChunk[], section: RawChunk["section"]): string {
  return chunks.filter((c) => c.section === section).map((c) => c.text).join("\n");
}

function fullText(chunks: RawChunk[]): string {
  return chunks.map((c) => c.text).join("\n");
}

function isEmptyRelationships(p: ParsedProfile): boolean {
  const r = p.relationships;
  return r.previousSchools.length === 0
    && r.qualifications.length === 0
    && r.certifications.length === 0
    && !r.referredBy
    && !r.region;
}

export const parseAndStoreCandidate = action({
  args: {
    candidateId: v.id("candidates"),
    rawText: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // 1. Parse facets + chunks + summary + relationships
    let parsed: ParsedProfile = await ctx.runAction(api.ai_candidate_parsing.parseProfileFromText, { text: args.rawText });

    // 2. Filter out hallucinated/unsupported facets. We don't just *warn* — we
    //    actually drop items whose evidence quote isn't in any rawChunk, or
    //    (for schoolTypes/languages) whose value keyword isn't in the quote.
    //    Retrying the LLM on bad data tends to produce the same hallucinations,
    //    so we skip retry and just keep the salvageable facets.
    let parsingNotes: string | undefined = undefined;
    if (parsed.rawChunks.length > 0) {
      const result = validateAndFilterFacets(parsed.parsedFacets, parsed.rawChunks);
      parsed = { ...parsed, parsedFacets: result.filtered };
      if (result.droppedCount > 0) {
        parsingNotes = `Dropped ${result.droppedCount} unsupported facet(s). First: ${result.firstReason ?? "unknown"}`;
      }
    }

    // 3. Compute the 5 facet embeddings
    const chunks = parsed.rawChunks;
    const overall = parsed.candidateSummary && parsed.candidateSummary.length > 20
      ? parsed.candidateSummary
      : (fullText(chunks) || args.rawText);

    const facetEmbeddings = await ctx.runAction(api.embeddings.embedBatch, {
      sections: {
        overall,
        experience: sectionText(chunks, "experience") || overall,
        pedagogy: sectionText(chunks, "pedagogy") || overall,
        achievements: sectionText(chunks, "achievements") || overall,
        leadership: sectionText(chunks, "leadership") || overall,
      },
    });

    // 4. Persist compiled data — including top-level identity/profile fields
    //    so the candidate row reflects the parsed resume, not just placeholders
    //    from the initial upload (name=filename, qualifications=[], etc.).
    await ctx.runMutation(internal.candidates.writeCompiledData, {
      candidateId: args.candidateId,
      parsedFacets: parsed.parsedFacets,
      candidateSummary: parsed.candidateSummary,
      rawChunks: parsed.rawChunks,
      facetEmbeddings: facetEmbeddings ?? undefined,
      parsingNotes,
      name: parsed.name ?? undefined,
      email: parsed.email ?? undefined,
      phone: parsed.phone ?? undefined,
      location: parsed.location ?? undefined,
      currentSchool: parsed.currentSchool ?? undefined,
      qualifications: parsed.qualifications,
      certifications: parsed.certifications,
      boardExperience: parsed.boardExperience,
      subjects: parsed.subjects,
      yearsExperience: parsed.yearsExperience ?? undefined,
    });

    // 5. Materialize the knowledge graph (skip if relationships are all empty —
    //    happens when no LLM key is configured or the LLM emitted nothing)
    if (!isEmptyRelationships(parsed)) {
      // Need the candidate's own subjects/boardExperience for SPECIALIZES_IN/BELONGS_TO edges
      const c = await ctx.runQuery(api.candidates.get, { candidateId: args.candidateId });
      await ctx.runMutation(api.graph.materializeGraphFromIntake, {
        candidateId: args.candidateId,
        relationships: parsed.relationships,
        subjects: c?.subjects ?? [],
        boardExperience: c?.boardExperience ?? [],
      });
    }

    // 6. Mark the candidate's parse pipeline as done so the UI can stop showing
    //    "Parsing…" pills. (extractTextFromResume also sets this after itself,
    //    but the text-only careers path comes in here directly with no wrapper.)
    await ctx.runMutation(internal.candidates.setParseStatus, {
      candidateId: args.candidateId,
      status: "done",
    });
  },
});
