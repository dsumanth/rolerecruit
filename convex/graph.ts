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
import { ACTIVE_PIPELINE_STAGES } from "./pipeline_defaults";

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

// ============================================================================
// materializeGraphFromIntake — called from intake.ts after writeCompiledData.
// Takes the LLM-extracted relationship hints plus the structured fields the
// candidate already carries (subjects, boards) and writes nodes + edges.
// Idempotent: re-calling on the same candidate produces no duplicate edges
// (because both upsertNode and addEdge dedupe).
// ============================================================================

const previousSchoolValidator = v.object({
  name: v.string(),
  role: v.optional(v.string()),
  subjects: v.optional(v.array(v.string())),
  yearStart: v.optional(v.number()),
  yearEnd: v.optional(v.number()),
  endReason: v.optional(v.string()),
});

const qualificationHintValidator = v.object({
  degree: v.string(),
  university: v.optional(v.string()),
  yearStart: v.optional(v.number()),
  yearEnd: v.optional(v.number()),
});

const relationshipsValidator = v.object({
  previousSchools: v.array(previousSchoolValidator),
  qualifications: v.array(qualificationHintValidator),
  certifications: v.array(v.string()),
  referredBy: v.optional(v.string()),
  region: v.optional(v.string()),
});

export const materializeGraphFromIntake = mutation({
  args: {
    candidateId: v.id("candidates"),
    relationships: relationshipsValidator,
    subjects: v.array(v.string()),
    boardExperience: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<{ nodesUpserted: number; edgesUpserted: number }> => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) throw new Error(`Candidate ${args.candidateId} not found`);

    let nodesUpserted = 0;
    let edgesUpserted = 0;

    const upsertNodeInline = async (
      type: GraphNodeType,
      externalId: string,
      displayName: string,
      attributes?: any,
    ): Promise<Id<"nodes">> => {
      const existing = await ctx.db
        .query("nodes")
        .withIndex("by_type_externalId", (q) => q.eq("type", type).eq("externalId", externalId))
        .first();
      if (existing) return existing._id;
      nodesUpserted++;
      return await ctx.db.insert("nodes", {
        type, externalId, displayName, attributes, createdAt: Date.now(),
      });
    };

    const addEdgeInline = async (
      fromId: Id<"nodes">,
      toId: Id<"nodes">,
      type: GraphEdgeType,
      attributes?: any,
    ): Promise<void> => {
      const existing = await ctx.db
        .query("edges")
        .withIndex("by_from_type", (q) => q.eq("fromId", fromId).eq("type", type))
        .collect();
      const dup = existing.find((e) => String(e.toId) === String(toId));
      if (dup) {
        if (attributes) {
          await ctx.db.patch(dup._id, { attributes: { ...(dup.attributes ?? {}), ...attributes } });
        }
        return;
      }
      await ctx.db.insert("edges", {
        fromId, toId, type, attributes, createdAt: Date.now(),
      });
      edgesUpserted++;
    };

    // 1. Candidate node
    const candNodeId = await upsertNodeInline(
      "Candidate",
      String(args.candidateId),
      candidate.name,
      { candidateId: String(args.candidateId) },
    );

    // 2. TAUGHT_AT — for each previous school
    for (const ps of args.relationships.previousSchools) {
      if (!ps.name?.trim()) continue;
      const schoolId = await upsertNodeInline("School", canonicalize(ps.name), ps.name);
      await addEdgeInline(candNodeId, schoolId, "TAUGHT_AT", {
        role: ps.role, subjects: ps.subjects, yearStart: ps.yearStart, yearEnd: ps.yearEnd, endReason: ps.endReason,
      });
    }

    // 3. HOLDS + FROM — for each qualification; cohort membership when university+endYear known
    for (const q of args.relationships.qualifications) {
      if (!q.degree?.trim()) continue;
      const qualId = await upsertNodeInline("Qualification", canonicalize(q.degree), q.degree);
      await addEdgeInline(candNodeId, qualId, "HOLDS", { yearStart: q.yearStart, yearEnd: q.yearEnd });
      if (q.university?.trim()) {
        const uniId = await upsertNodeInline("University", canonicalize(q.university), q.university);
        await addEdgeInline(qualId, uniId, "FROM");

        if (q.yearEnd) {
          const cohortExternalId = cohortKey(q.university, q.degree, q.yearEnd);
          const cohortDisplay = `${q.university} ${q.degree} ${q.yearEnd}`;
          const cohortId = await upsertNodeInline("Cohort", cohortExternalId, cohortDisplay, {
            university: q.university, program: q.degree, endYear: q.yearEnd,
          });
          await addEdgeInline(candNodeId, cohortId, "BELONGS_TO");
        }
      }
    }

    // 4. CERTIFIED_IN
    for (const cert of args.relationships.certifications) {
      if (!cert?.trim()) continue;
      const certId = await upsertNodeInline("Certification", canonicalize(cert), cert);
      await addEdgeInline(candNodeId, certId, "CERTIFIED_IN");
    }

    // 5. SPECIALIZES_IN — from the structured subjects array on the candidate
    for (const subj of args.subjects) {
      if (!subj?.trim()) continue;
      const subjId = await upsertNodeInline("Subject", canonicalize(subj), subj);
      await addEdgeInline(candNodeId, subjId, "SPECIALIZES_IN");
    }

    // 6. BELONGS_TO (Board) — from candidate.boardExperience
    for (const board of args.boardExperience) {
      if (!board?.trim()) continue;
      const boardId = await upsertNodeInline("Board", canonicalize(board), board);
      await addEdgeInline(candNodeId, boardId, "BELONGS_TO");
    }

    // 7. LOCATED_IN — region
    if (args.relationships.region?.trim()) {
      const regionId = await upsertNodeInline("Region", canonicalize(args.relationships.region), args.relationships.region);
      await addEdgeInline(candNodeId, regionId, "LOCATED_IN");
    }

    // 8. REFERRED_BY — only if referrer name is provided (Phase 3a stops at name-only; matching to existing candidates/users is Phase 3c)
    if (args.relationships.referredBy?.trim()) {
      // Park referrer as a free-text attribute on the candidate node for now.
      const existing = await ctx.db.get(candNodeId);
      await ctx.db.patch(candNodeId, {
        attributes: { ...(existing?.attributes ?? {}), referredByName: args.relationships.referredBy },
      });
    }

    // Stamp the candidate row so backfill knows the graph was built
    const { GRAPH_VERSION } = await import("./versions");
    await ctx.db.patch(args.candidateId, { graphVersion: GRAPH_VERSION });

    return { nodesUpserted, edgesUpserted };
  },
});

// ============================================================================
// Sourcing queries
// ============================================================================

export const listCohorts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const cohortNodes = await ctx.db
      .query("nodes")
      .withIndex("by_type", (q) => q.eq("type", "Cohort"))
      .collect();

    const enriched = await Promise.all(cohortNodes.map(async (n) => {
      const memberEdges = await ctx.db
        .query("edges")
        .withIndex("by_to_type", (q) => q.eq("toId", n._id).eq("type", "BELONGS_TO"))
        .collect();
      return {
        nodeId: n._id,
        displayName: n.displayName,
        externalId: n.externalId,
        attributes: n.attributes,
        memberCount: memberEdges.length,
      };
    }));

    return enriched
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, limit);
  },
});

// Sourced from convex/pipeline_defaults.ts — single source of truth for the
// "in motion" subset of pipeline stages. Used here by the untappedOnly filter.
const ACTIVE_STAGES = new Set<string>(ACTIVE_PIPELINE_STAGES);

export const listCandidatesInCohort = query({
  args: {
    cohortNodeId: v.id("nodes"),
    untappedOnly: v.boolean(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    // BELONGS_TO edges pointing AT this cohort node — from = Candidate node
    const memberEdges = await ctx.db
      .query("edges")
      .withIndex("by_to_type", (q) => q.eq("toId", args.cohortNodeId).eq("type", "BELONGS_TO"))
      .collect();

    const candidates: any[] = [];
    for (const edge of memberEdges) {
      const candNode = await ctx.db.get(edge.fromId);
      if (!candNode || candNode.type !== "Candidate") continue;
      const candidateId = candNode.externalId as Id<"candidates">;
      const candidate = await ctx.db.get(candidateId);
      if (!candidate) continue;

      if (args.untappedOnly) {
        const apps = await ctx.db
          .query("applications")
          .withIndex("by_candidateId", (q) => q.eq("candidateId", candidateId))
          .collect();
        const inMotion = apps.some((a: any) => ACTIVE_STAGES.has(a.stage));
        if (inMotion) continue;
      }

      candidates.push({
        candidateId,
        name: candidate.name,
        subjects: (candidate as any).subjects,
        yearsExperience: (candidate as any).yearsExperience,
        boardExperience: (candidate as any).boardExperience,
        currentSchool: (candidate as any).currentSchool,
      });
      if (candidates.length >= limit) break;
    }
    return candidates;
  },
});

/**
 * neighbors — 1-hop traversal from a node. Used by future Phase 3b/3c work and
 * by the cohort drilldown for "candidates similar to this one." Bounded by limit.
 */
export const neighbors = query({
  args: {
    nodeId: v.id("nodes"),
    edgeType: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("out"), v.literal("in"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dir = args.direction ?? "out";
    const limit = args.limit ?? 100;

    let edges;
    if (dir === "out") {
      edges = args.edgeType
        ? await ctx.db.query("edges").withIndex("by_from_type", (q) => q.eq("fromId", args.nodeId).eq("type", args.edgeType as any)).take(limit)
        : await ctx.db.query("edges").withIndex("by_from_type", (q) => q.eq("fromId", args.nodeId)).take(limit);
    } else {
      edges = args.edgeType
        ? await ctx.db.query("edges").withIndex("by_to_type", (q) => q.eq("toId", args.nodeId).eq("type", args.edgeType as any)).take(limit)
        : await ctx.db.query("edges").withIndex("by_to_type", (q) => q.eq("toId", args.nodeId)).take(limit);
    }

    const results = await Promise.all(edges.map(async (e) => {
      const other = await ctx.db.get(dir === "out" ? e.toId : e.fromId);
      return { edge: e, node: other };
    }));
    return results.filter((r) => r.node);
  },
});
