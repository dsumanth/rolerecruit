/**
 * DEV-ONLY one-off actions for smoke-testing the Phase 3a graph build.
 *
 * Usage (against running Convex dev):
 *
 *   # Seed 6 candidates: 3 from DU B.Ed 2019, 2 from TISS Social Work 2020, 1 standalone
 *   bunx convex run devSeedGraph:seedTestGraph '{}'
 *
 *   # Trigger backfill (synthetic relationships — uses structured fields)
 *   bunx convex run backfill:backfillGraph '{"pageSize":50}'
 *
 *   # Inspect
 *   bunx convex run graph:listCohorts '{}'
 *
 *   # Clean up — deletes all seeded candidates + their graph nodes/edges
 *   bunx convex run devSeedGraph:cleanupTestGraph '{}'
 *
 * Seeded candidates are tagged with name prefix `__graphtest__`.
 */

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const TEST_NAME_PREFIX = "__graphtest__";

const FIXTURE = [
  { name: "DU_BEd_2019_alice", uni: "Delhi University", deg: "B.Ed", yearEnd: 2019, subjects: ["Physics"] },
  { name: "DU_BEd_2019_bob",   uni: "Delhi University", deg: "B.Ed", yearEnd: 2019, subjects: ["Chemistry"] },
  { name: "DU_BEd_2019_carol", uni: "Delhi University", deg: "B.Ed", yearEnd: 2019, subjects: ["Math"] },
  { name: "TISS_SW_2020_dave", uni: "TISS Mumbai", deg: "M.A. Social Work", yearEnd: 2020, subjects: ["Counselling"] },
  { name: "TISS_SW_2020_eve",  uni: "TISS Mumbai", deg: "M.A. Social Work", yearEnd: 2020, subjects: ["Counselling"] },
  { name: "Standalone_frank",  uni: "Bangalore University", deg: "B.Ed", yearEnd: 2021, subjects: ["English"] },
];

export const seedTestGraph = internalAction({
  args: {},
  handler: async (ctx): Promise<{ created: number }> => {
    let created = 0;
    for (const f of FIXTURE) {
      await ctx.runMutation(internal.devSeedGraph.insertTestCandidate, { fixture: f });
      created++;
    }
    return { created };
  },
});

export const insertTestCandidate = internalMutation({
  args: {
    fixture: v.object({
      name: v.string(),
      uni: v.string(),
      deg: v.string(),
      yearEnd: v.number(),
      subjects: v.array(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<Id<"candidates">> => {
    const fullName = `${TEST_NAME_PREFIX}${args.fixture.name}`;
    const candId = await ctx.db.insert("candidates", {
      name: fullName,
      qualifications: [args.fixture.deg],
      certifications: ["CTET"],
      boardExperience: ["CBSE"],
      subjects: args.fixture.subjects,
      yearsExperience: 5,
      sourceChannel: "manual_import",
      talentBankFlag: false,
      parsedFacets: {
        specializations: [], gradeLevels: [], pedagogicalApproach: [],
        leadershipRoles: [], extracurricular: [], languages: [],
        schoolTypes: [], keyAchievements: [], redFlags: [], extras: {},
      },
      rawChunks: [],
      parsedAt: Date.now(),
      parsedVersion: "facets-v2",
    });

    // Synthesize materialization directly (skipping the LLM)
    await ctx.scheduler.runAfter(0, internal.devSeedGraph.materializeForFixture, {
      candidateId: candId,
      fixture: args.fixture,
    });
    return candId;
  },
});

export const materializeForFixture = internalAction({
  args: {
    candidateId: v.id("candidates"),
    fixture: v.object({
      name: v.string(),
      uni: v.string(),
      deg: v.string(),
      yearEnd: v.number(),
      subjects: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(api.graph.materializeGraphFromIntake, {
      candidateId: args.candidateId,
      relationships: {
        previousSchools: [],
        qualifications: [{ degree: args.fixture.deg, university: args.fixture.uni, yearEnd: args.fixture.yearEnd }],
        certifications: ["CTET"],
      },
      subjects: args.fixture.subjects,
      boardExperience: ["CBSE"],
    });
  },
});

export const cleanupTestGraph = internalAction({
  args: {},
  handler: async (ctx): Promise<{ deletedCandidates: number; deletedNodes: number; deletedEdges: number }> => {
    const candIds: Id<"candidates">[] = await ctx.runQuery(internal.devSeedGraph.listTestCandidates, {});
    let deletedCandidates = 0;
    let deletedNodes = 0;
    let deletedEdges = 0;
    for (const id of candIds) {
      const counts = await ctx.runMutation(internal.devSeedGraph.deleteCandidateAndGraph, { candidateId: id });
      deletedCandidates++;
      deletedNodes += counts.deletedNodes;
      deletedEdges += counts.deletedEdges;
    }
    return { deletedCandidates, deletedNodes, deletedEdges };
  },
});

export const listTestCandidates = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"candidates">[]> => {
    const all = await ctx.db.query("candidates").take(2000);
    return all.filter((c) => c.name?.startsWith(TEST_NAME_PREFIX)).map((c) => c._id);
  },
});

export const deleteCandidateAndGraph = internalMutation({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args): Promise<{ deletedNodes: number; deletedEdges: number }> => {
    let deletedNodes = 0;
    let deletedEdges = 0;

    // Find the Candidate node
    const candNode = await ctx.db
      .query("nodes")
      .withIndex("by_type_externalId", (q) => q.eq("type", "Candidate").eq("externalId", String(args.candidateId)))
      .first();

    if (candNode) {
      // Delete all edges FROM and TO the candidate node
      const outEdges = await ctx.db.query("edges").withIndex("by_from_type", (q) => q.eq("fromId", candNode._id)).collect();
      const inEdges = await ctx.db.query("edges").withIndex("by_to_type", (q) => q.eq("toId", candNode._id)).collect();
      for (const e of [...outEdges, ...inEdges]) {
        await ctx.db.delete(e._id);
        deletedEdges++;
      }
      await ctx.db.delete(candNode._id);
      deletedNodes++;
    }

    await ctx.db.delete(args.candidateId);
    return { deletedNodes, deletedEdges };
  },
});
