// convex/intake.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { validateEvidence } from "./evidenceValidator";
import type { ParsedProfile, RawChunk } from "./types";

function sectionText(chunks: RawChunk[], section: RawChunk["section"]): string {
  return chunks.filter((c) => c.section === section).map((c) => c.text).join("\n");
}

function fullText(chunks: RawChunk[]): string {
  return chunks.map((c) => c.text).join("\n");
}

export const parseAndStoreCandidate = action({
  args: {
    candidateId: v.id("candidates"),
    rawText: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // 1. Parse facets + chunks + summary
    let parsed: ParsedProfile = await ctx.runAction(api.ai.parseProfileFromText, { text: args.rawText });

    // 2. Validate evidence; if validation fails, retry parse once
    let parsingNotes: string | undefined = undefined;
    if (parsed.rawChunks.length > 0) {
      const result = validateEvidence(parsed.parsedFacets, parsed.rawChunks);
      if (!result.ok) {
        parsed = await ctx.runAction(api.ai.parseProfileFromText, { text: args.rawText });
        const retry = validateEvidence(parsed.parsedFacets, parsed.rawChunks);
        if (!retry.ok) {
          parsingNotes = `Evidence validation failed on retry: ${retry.invalidFacets.length} invalid facet(s). First: ${retry.invalidFacets[0]?.reason ?? "unknown"}`;
        }
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

    // 4. Persist
    await ctx.runMutation(internal.candidates.writeCompiledData, {
      candidateId: args.candidateId,
      parsedFacets: parsed.parsedFacets,
      candidateSummary: parsed.candidateSummary,
      rawChunks: parsed.rawChunks,
      facetEmbeddings: facetEmbeddings ?? undefined,
      parsingNotes,
    });
  },
});
