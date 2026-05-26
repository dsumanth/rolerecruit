// convex/graph.ts
// Phase 3a — Knowledge Graph foundation.
// Owns canonicalization, idempotent node/edge upserts, cohort composition,
// bounded traversals, and the intake-time materializeGraphFromIntake orchestrator.

import { internalMutation, mutation, query, internalQuery, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type {
  GraphNodeType,
  GraphEdgeType,
  RelationshipsHint,
} from "./types";

// ============================================================================
// Canonicalization
// ============================================================================

/**
 * canonicalize — lowercase + strip punctuation + collapse whitespace + trim.
 * Used to derive node externalId from human-entered names so that "DPS R.K.
 * Puram" and "DPS RK Puram" land on the same node.
 *
 * Known limitation: abbreviations ("DU" vs "Delhi University") canonicalize
 * differently and create separate nodes. Phase 3b will add an LLM-assisted
 * dedup pass; for now we accept the duplication.
 */
export function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * cohortKey — composite externalId for Cohort nodes. Stable across re-runs.
 * Format: "${normalizedUniversity}|${normalizedProgram}|${endYear}"
 */
export function cohortKey(university: string, program: string, endYear: number): string {
  return `${canonicalize(university)}|${canonicalize(program)}|${endYear}`;
}

// ============================================================================
// Public upsert mutations (also used by tests directly)
// ============================================================================

export const upsertNode = mutation({
  args: {
    type: v.union(
      v.literal("Candidate"), v.literal("School"), v.literal("University"),
      v.literal("Subject"), v.literal("Board"), v.literal("Certification"),
      v.literal("Qualification"), v.literal("Region"), v.literal("Cohort"),
    ),
    externalId: v.string(),
    displayName: v.string(),
    attributes: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<Id<"nodes">> => {
    const existing = await ctx.db
      .query("nodes")
      .withIndex("by_type_externalId", (q) => q.eq("type", args.type).eq("externalId", args.externalId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("nodes", {
      type: args.type,
      externalId: args.externalId,
      displayName: args.displayName,
      attributes: args.attributes,
      createdAt: Date.now(),
    });
  },
});

export const addEdge = mutation({
  args: {
    fromId: v.id("nodes"),
    toId: v.id("nodes"),
    type: v.union(
      v.literal("TAUGHT_AT"), v.literal("HOLDS"), v.literal("FROM"),
      v.literal("CERTIFIED_IN"), v.literal("SPECIALIZES_IN"), v.literal("REFERRED_BY"),
      v.literal("TEACHES"), v.literal("BELONGS_TO"), v.literal("LOCATED_IN"),
      v.literal("APPLIED_TO"),
    ),
    attributes: v.optional(v.any()),
    weight: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"edges">> => {
    const existing = await ctx.db
      .query("edges")
      .withIndex("by_from_type", (q) => q.eq("fromId", args.fromId).eq("type", args.type))
      .collect();
    const dup = existing.find((e) => String(e.toId) === String(args.toId));
    if (dup) {
      // Merge attributes if both sides have them (keep newest by overlay), do NOT duplicate the row.
      if (args.attributes || args.weight !== undefined) {
        await ctx.db.patch(dup._id, {
          attributes: { ...(dup.attributes ?? {}), ...(args.attributes ?? {}) },
          weight: args.weight ?? dup.weight,
        });
      }
      return dup._id;
    }
    return await ctx.db.insert("edges", {
      fromId: args.fromId,
      toId: args.toId,
      type: args.type,
      attributes: args.attributes,
      weight: args.weight,
      createdAt: Date.now(),
    });
  },
});
