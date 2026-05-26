// convex/facetPromotion.ts
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  PROMOTION_OCCURRENCE_THRESHOLD,
  PROMOTION_PERCENT_THRESHOLD,
  PROMOTION_WINDOW_DAYS,
  FACET_TRACKER_LOOKBACK_MS,
} from "./versions";

interface CandidateExtraOccurrence {
  candidateId: Id<"candidates">;
  key: string;
  value: string;
  quote: string;
  offset: number;
  context: string;
}

/**
 * trackExtrasFrequency — scans candidates parsed in the last FACET_TRACKER_LOOKBACK_MS,
 * aggregates parsedFacets.extras keys, and upserts rows in facetPromotionCandidates.
 *
 * Idempotent: each (key, candidateId) pair is counted at most once per row.
 * Each existing row tracks which candidate IDs have already contributed (via the
 * sampleEvidence list — we use sampleEvidence.candidateId as the dedup signal).
 *
 * IMPORTANT: skips extras keys starting with `__promoted__` — those are already
 * graduated typed facets stored under the namespace prefix, NOT new novelty.
 * Counting them would re-promote already-promoted facets, breaking the lifecycle.
 *
 * Designed to be called by a nightly cron OR on-demand.
 */
export const trackExtrasFrequency = internalAction({
  args: { lookbackMs: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ keysSeen: number; newRows: number; updatedRows: number }> => {
    const lookback = args.lookbackMs ?? FACET_TRACKER_LOOKBACK_MS;
    const since = Date.now() - lookback;

    const recent = await ctx.runQuery(internal.facetPromotion.listRecentlyParsed, { since });

    // Collect all (key, candidateId, value, evidence) occurrences
    const occurrences: CandidateExtraOccurrence[] = [];
    for (const c of recent) {
      const extras = c.parsedFacets?.extras ?? {};
      for (const [key, arr] of Object.entries(extras)) {
        // Skip already-promoted keys to avoid double-counting
        if (key.startsWith("__promoted__")) continue;
        for (const fv of arr as any[]) {
          occurrences.push({
            candidateId: c._id,
            key,
            value: fv.value,
            quote: fv.evidence?.quote ?? "",
            offset: fv.evidence?.offset ?? 0,
            context: fv.evidence?.context ?? "",
          });
        }
      }
    }

    // Group by key
    const byKey = new Map<string, CandidateExtraOccurrence[]>();
    for (const o of occurrences) {
      if (!byKey.has(o.key)) byKey.set(o.key, []);
      byKey.get(o.key)!.push(o);
    }

    let newRows = 0;
    let updatedRows = 0;
    for (const [key, occs] of byKey) {
      const result = await ctx.runMutation(internal.facetPromotion.upsertCandidate, {
        key,
        occurrences: occs.slice(0, 50), // cap for the upsert call
      });
      if (result === "created") newRows++;
      else updatedRows++;
    }

    return { keysSeen: byKey.size, newRows, updatedRows };
  },
});

export const listRecentlyParsed = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, args) => {
    // No `by_parsedAt` index yet — scan all candidates and filter. For Phase 2's
    // expected pool size (≤10K), this is fine. Add the index in a follow-up if
    // we cross 100K candidates.
    const all = await ctx.db.query("candidates").take(2000);
    return all.filter((c) => (c.parsedAt ?? 0) >= args.since);
  },
});

export const upsertCandidate = internalMutation({
  args: {
    key: v.string(),
    occurrences: v.array(v.object({
      candidateId: v.id("candidates"),
      key: v.string(),
      value: v.string(),
      quote: v.string(),
      offset: v.number(),
      context: v.string(),
    })),
  },
  handler: async (ctx, args): Promise<"created" | "updated"> => {
    const existing = await ctx.db
      .query("facetPromotionCandidates")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    // Dedup contributing candidate IDs
    const existingCandidates = new Set(
      existing?.sampleEvidence.map((e) => String(e.candidateId)) ?? []
    );
    const newOccurrences = args.occurrences.filter(
      (o) => !existingCandidates.has(String(o.candidateId))
    );

    if (existing) {
      // Skip if no new contributors
      if (newOccurrences.length === 0) return "updated";
      const newSamples = [
        ...existing.sampleEvidence,
        ...newOccurrences.slice(0, 5 - existing.sampleEvidence.length).map((o) => ({
          candidateId: o.candidateId,
          quote: o.quote,
          offset: o.offset,
          context: o.context,
        })),
      ].slice(0, 5);
      await ctx.db.patch(existing._id, {
        occurrenceCount: existing.occurrenceCount + newOccurrences.length,
        lastSeenAt: Date.now(),
        sampleEvidence: newSamples,
      });
      return "updated";
    } else {
      await ctx.db.insert("facetPromotionCandidates", {
        key: args.key,
        occurrenceCount: args.occurrences.length,
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
        sampleEvidence: args.occurrences.slice(0, 5).map((o) => ({
          candidateId: o.candidateId,
          quote: o.quote,
          offset: o.offset,
          context: o.context,
        })),
        status: "pending",
      });
      return "created";
    }
  },
});

export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("facetPromotionCandidates")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

/**
 * listPending — for the admin UI. Returns rows where status is "pending" AND
 * either occurrenceCount >= PROMOTION_OCCURRENCE_THRESHOLD OR the row hits
 * the percent threshold over the recent window.
 */
export const listPending = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const pending = await ctx.db
      .query("facetPromotionCandidates")
      .withIndex("by_status_occurrenceCount", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(200);

    // Pool size for the % threshold
    const recentCutoff = Date.now() - PROMOTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recentCandidates = await ctx.db.query("candidates").take(2000);
    const recentPoolSize = recentCandidates.filter((c) => (c.parsedAt ?? 0) >= recentCutoff).length;
    const percentThresholdAbsolute = Math.max(5, Math.ceil(recentPoolSize * PROMOTION_PERCENT_THRESHOLD));

    return pending
      .filter((r) =>
        r.occurrenceCount >= PROMOTION_OCCURRENCE_THRESHOLD ||
        r.occurrenceCount >= percentThresholdAbsolute
      )
      .slice(0, limit);
  },
});

export const listAll = query({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const base = ctx.db.query("facetPromotionCandidates");
    if (args.status) {
      const status = args.status;
      return await base
        .withIndex("by_status", (idx) => idx.eq("status", status as any))
        .order("desc")
        .take(limit);
    }
    return await base.order("desc").take(limit);
  },
});
