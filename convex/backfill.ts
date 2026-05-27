// convex/backfill.ts
import { action, internalAction, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { PARSED_FACETS_VERSION, EMBEDDING_VERSION, GRAPH_VERSION } from "./versions";

const DEFAULT_GRAPH_PAGE_SIZE = 200;

export const findStaleCandidates = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const all = await ctx.db.query("candidates").take(500);
    return all
      .filter((c) =>
        !c.parsedVersion || c.parsedVersion !== PARSED_FACETS_VERSION ||
        !c.embeddingVersion || c.embeddingVersion !== EMBEDDING_VERSION
      )
      .slice(0, limit);
  },
});

export const runBackfillBatch = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const stale = await ctx.runQuery(api.backfill.findStaleCandidates, { limit: args.limit ?? 20 });
    let processed = 0;
    for (const c of stale) {
      const text = c.rawChunks?.length
        ? c.rawChunks.map((ch: any) => ch.text).join("\n")
        : [
            c.name,
            c.qualifications.join(", "),
            c.certifications.join(", "),
            `Boards: ${c.boardExperience.join(", ")}`,
            `Subjects: ${c.subjects.join(", ")}`,
            c.yearsExperience ? `${c.yearsExperience} years experience` : "",
            c.currentSchool ? `Currently at ${c.currentSchool}` : "",
          ].filter(Boolean).join(". ");
      await ctx.runAction(api.intake.parseAndStoreCandidate, {
        candidateId: c._id,
        rawText: text,
      });
      processed++;
    }
    return { processed };
  },
});

// ============================================================================
// Phase 3a — graph backfill
// ============================================================================

export const candidatesMissingGraphPage = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("candidates").paginate({
      cursor: args.cursor,
      numItems: args.numItems ?? DEFAULT_GRAPH_PAGE_SIZE,
    });
    return {
      page: result.page.filter((c) => c.graphVersion !== GRAPH_VERSION),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/**
 * backfillGraph — for every candidate whose graphVersion ≠ current GRAPH_VERSION,
 * call materializeGraphFromIntake.
 *
 * For Phase 3a we DO NOT re-run the LLM during backfill (that would be expensive
 * at scale). Instead we synthesize a RelationshipsHint from the structured
 * candidate fields already in the row (subjects, boardExperience, currentSchool,
 * certifications) — yielding a partial but useful graph. A separate LLM-driven
 * backfill (Phase 3b) can re-extract previousSchools + universities from
 * rawChunks for richer signal.
 */
export const backfillGraph = internalAction({
  args: { pageSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ processed: number; failed: number }> => {
    const pageSize = args.pageSize ?? DEFAULT_GRAPH_PAGE_SIZE;
    let cursor: string | null = null;
    let processed = 0;
    let failed = 0;

    while (true) {
      const result: { page: Array<any>; isDone: boolean; continueCursor: string } =
        await ctx.runQuery(internal.backfill.candidatesMissingGraphPage, {
          cursor, numItems: pageSize,
        });
      for (const c of result.page) {
        // Synthesize a minimal relationships block from the structured fields.
        // currentSchool → previousSchools (best-effort; without yearStart/yearEnd).
        const synthetic = {
          previousSchools: c.currentSchool ? [{ name: c.currentSchool }] : [],
          qualifications: [],
          certifications: c.certifications ?? [],
        };
        try {
          await ctx.runMutation(api.graph.materializeGraphFromIntake, {
            candidateId: c._id,
            relationships: synthetic,
            subjects: c.subjects ?? [],
            boardExperience: c.boardExperience ?? [],
          });
          processed++;
        } catch (err) {
          failed++;
          console.error(`[backfillGraph] candidate ${c._id} failed:`, err);
          // continue — don't let one bad candidate block the entire backfill
        }
      }
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    return { processed, failed };
  },
});
