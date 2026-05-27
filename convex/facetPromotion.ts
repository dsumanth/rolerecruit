// convex/facetPromotion.ts
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
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
// Default candidates-per-page for the paginating scans below. Can be overridden
// per-call by passing `pageSize` to the action — primarily for tests that need
// to exercise the multi-page loop without seeding hundreds of rows.
const DEFAULT_PAGE_SIZE = 500;

export const trackExtrasFrequency = internalAction({
  args: { lookbackMs: v.optional(v.number()), pageSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ keysSeen: number; newRows: number; updatedRows: number }> => {
    const lookback = args.lookbackMs ?? FACET_TRACKER_LOOKBACK_MS;
    const since = Date.now() - lookback;
    const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE;

    // Collect all (key, candidateId, value, evidence) occurrences across all
    // recently-parsed candidates by walking the table page-by-page.
    const occurrences: CandidateExtraOccurrence[] = [];
    let cursor: string | null = null;
    while (true) {
      const result: { page: Array<any>; isDone: boolean; continueCursor: string } =
        await ctx.runQuery(internal.facetPromotion.recentlyParsedPage, {
          since,
          cursor,
          numItems: pageSize,
        });
      for (const c of result.page) {
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
      if (result.isDone) break;
      cursor = result.continueCursor;
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

/**
 * recentlyParsedPage — one page of candidates whose `parsedAt >= since`. The
 * filter is in-memory because no `by_parsedAt` index exists yet. With cursor
 * pagination the whole table is reachable regardless of size, at the cost of
 * one query per ~500 candidates.
 */
export const recentlyParsedPage = internalQuery({
  args: {
    since: v.number(),
    cursor: v.union(v.string(), v.null()),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("candidates").paginate({
      cursor: args.cursor,
      numItems: args.numItems ?? DEFAULT_PAGE_SIZE,
    });
    return {
      page: result.page.filter((c) => (c.parsedAt ?? 0) >= args.since),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
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

/**
 * listPromotedKeys — for the rest of the system to discover which extras keys
 * have been graduated to first-class facets (and therefore live under
 * `__promoted__<key>` inside the extras bag).
 */
export const listPromotedKeys = query({
  args: {},
  handler: async (ctx) => {
    const promoted = await ctx.db
      .query("facetPromotionCandidates")
      .withIndex("by_status", (q) => q.eq("status", "promoted"))
      .collect();
    return promoted.map((p) => p.key);
  },
});

// ============================================================================
// Promote / Dismiss / Demote lifecycle
// ============================================================================

/**
 * promote — marks a facetPromotionCandidates row as "promoted" and schedules
 * a backfill that moves extras[key] → extras[__promoted__key] for every
 * candidate carrying the key. Idempotent: re-calling on an already-promoted
 * row is a no-op.
 */
export const promote = mutation({
  args: { key: v.string(), actorUserId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("facetPromotionCandidates")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!row) throw new Error(`No facetPromotionCandidates row for key "${args.key}"`);
    if (row.status === "promoted") return row._id;

    await ctx.db.patch(row._id, { status: "promoted", promotedAt: Date.now() });

    // Schedule the backfill — moves values from extras[key] → extras[__promoted__key]
    // for every candidate carrying the key
    await ctx.scheduler.runAfter(0, internal.facetPromotion.backfillPromotion, {
      key: args.key,
    });
    return row._id;
  },
});

/**
 * dismiss — marks a candidate row as "dismissed" without touching any
 * candidate documents. Used when an admin decides a key is not worth promoting.
 */
export const dismiss = mutation({
  args: { key: v.string(), actorUserId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("facetPromotionCandidates")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!row) return;
    await ctx.db.patch(row._id, { status: "dismissed", dismissedAt: Date.now() });
  },
});

/**
 * demote — reverses a promotion: marks the row as "demoted" and schedules a
 * backfill that moves extras[__promoted__key] → extras[key] for every
 * candidate carrying the prefixed namespace.
 */
export const demote = mutation({
  args: { key: v.string(), actorUserId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("facetPromotionCandidates")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!row || row.status !== "promoted") return;

    await ctx.db.patch(row._id, { status: "demoted", demotedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.facetPromotion.backfillDemotion, {
      key: args.key,
    });
  },
});

export const backfillPromotion = internalAction({
  args: { key: v.string(), pageSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE;
    let cursor: string | null = null;
    let processed = 0;
    while (true) {
      const result: { page: Array<any>; isDone: boolean; continueCursor: string } =
        await ctx.runQuery(internal.facetPromotion.candidatesWithExtraKeyPage, {
          key: args.key,
          cursor,
          numItems: pageSize,
        });
      for (const c of result.page) {
        await ctx.runMutation(internal.candidates.promoteFacetForCandidate, {
          candidateId: c._id,
          key: args.key,
        });
        processed++;
      }
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    return { processed };
  },
});

export const backfillDemotion = internalAction({
  args: { key: v.string(), pageSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE;
    let cursor: string | null = null;
    let processed = 0;
    while (true) {
      const result: { page: Array<any>; isDone: boolean; continueCursor: string } =
        await ctx.runQuery(internal.facetPromotion.candidatesWithPromotedKeyPage, {
          key: args.key,
          cursor,
          numItems: pageSize,
        });
      for (const c of result.page) {
        await ctx.runMutation(internal.candidates.demoteFacetForCandidate, {
          candidateId: c._id,
          key: args.key,
        });
        processed++;
      }
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    return { processed };
  },
});

/**
 * candidatesWithExtraKeyPage — one page of candidates whose parsedFacets.extras
 * carries the (un-prefixed) key. The action above walks through pages until
 * isDone. No index on extras keys exists (Convex doesn't index dynamic JSON
 * object keys); the filter is in-memory per page.
 */
export const candidatesWithExtraKeyPage = internalQuery({
  args: {
    key: v.string(),
    cursor: v.union(v.string(), v.null()),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("candidates").paginate({
      cursor: args.cursor,
      numItems: args.numItems ?? DEFAULT_PAGE_SIZE,
    });
    return {
      page: result.page.filter(
        (c) => c.parsedFacets?.extras && (c.parsedFacets.extras as any)[args.key],
      ),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/**
 * candidatesWithPromotedKeyPage — one page of candidates whose
 * parsedFacets.extras carries the `__promoted__<key>` form. Used by the
 * demotion backfill action's cursor loop.
 */
export const candidatesWithPromotedKeyPage = internalQuery({
  args: {
    key: v.string(),
    cursor: v.union(v.string(), v.null()),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const promotedKey = `__promoted__${args.key}`;
    const result = await ctx.db.query("candidates").paginate({
      cursor: args.cursor,
      numItems: args.numItems ?? DEFAULT_PAGE_SIZE,
    });
    return {
      page: result.page.filter(
        (c) => c.parsedFacets?.extras && (c.parsedFacets.extras as any)[promotedKey],
      ),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
