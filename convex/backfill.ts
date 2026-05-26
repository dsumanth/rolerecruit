// convex/backfill.ts
import { action, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { PARSED_FACETS_VERSION, EMBEDDING_VERSION } from "./versions";

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
