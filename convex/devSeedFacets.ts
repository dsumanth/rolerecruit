/**
 * DEV-ONLY one-off actions for smoke-testing the Phase 2 facet promotion flow.
 *
 * Usage (against running Convex dev):
 *
 *   # Seed 30 fake candidates carrying the same extras key
 *   bunx convex run devSeedFacets:seedTestCandidates \
 *     '{"count":30,"key":"AI_curriculum_design"}'
 *
 *   # Then the normal Phase 2 flow:
 *   bunx convex run facetPromotion:trackExtrasFrequency '{}'
 *   bunx convex run facetPromotion:getByKey '{"key":"AI_curriculum_design"}'
 *   bunx convex run facetPromotion:promote \
 *     '{"key":"AI_curriculum_design","actorUserId":"smoke_test"}'
 *   # …wait ~1s for scheduler to run backfillPromotion
 *   bunx convex run facetPromotion:demote \
 *     '{"key":"AI_curriculum_design","actorUserId":"smoke_test"}'
 *
 *   # Clean up — deletes all candidates this script created
 *   bunx convex run devSeedFacets:cleanupTestCandidates \
 *     '{"key":"AI_curriculum_design"}'
 *
 * Test candidates are tagged with name prefix `__facettest__` so cleanup only
 * touches rows this script created. Will NOT delete real candidates.
 */

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const TEST_NAME_PREFIX = "__facettest__";

export const seedTestCandidates = internalAction({
  args: {
    count: v.number(),
    key: v.string(),
  },
  handler: async (ctx, args): Promise<{ created: number; key: string }> => {
    if (args.count <= 0 || args.count > 1000) {
      throw new Error(`count must be 1..1000, got ${args.count}`);
    }
    if (!args.key.match(/^[A-Za-z0-9_]+$/)) {
      throw new Error(`key must be snake_case alphanumeric; got "${args.key}"`);
    }
    if (args.key.startsWith("__promoted__")) {
      throw new Error("key must not start with __promoted__ — that's the post-promotion namespace");
    }

    let created = 0;
    for (let i = 0; i < args.count; i++) {
      await ctx.runMutation(internal.devSeedFacets.insertTestCandidate, {
        index: i,
        key: args.key,
      });
      created++;
    }
    return { created, key: args.key };
  },
});

export const insertTestCandidate = internalMutation({
  args: { index: v.number(), key: v.string() },
  handler: async (ctx, args): Promise<Id<"candidates">> => {
    const evidenceText = `Designed and implemented ${args.key} program for grade ${(args.index % 12) + 1} students`;
    return await ctx.db.insert("candidates", {
      name: `${TEST_NAME_PREFIX}${args.key}_${args.index}`,
      qualifications: ["B.Ed", "M.Sc"],
      certifications: ["CTET"],
      boardExperience: ["CBSE"],
      subjects: ["Physics"],
      yearsExperience: 5,
      sourceChannel: "manual_import",
      talentBankFlag: false,
      parsedFacets: {
        specializations: [],
        gradeLevels: [],
        pedagogicalApproach: [],
        leadershipRoles: [],
        extracurricular: [],
        languages: [],
        schoolTypes: [],
        keyAchievements: [],
        redFlags: [],
        extras: {
          [args.key]: [
            {
              value: args.key,
              evidence: { quote: evidenceText, offset: 0, context: evidenceText },
            },
          ],
        },
      },
      rawChunks: [{ text: evidenceText, section: "experience", offset: 0 }],
      parsedAt: Date.now(),
      parsedVersion: "facets-v1",
    });
  },
});

export const cleanupTestCandidates = internalAction({
  args: { key: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ deleted: number }> => {
    const ids: Id<"candidates">[] = await ctx.runQuery(internal.devSeedFacets.listTestCandidates, {
      key: args.key,
    });
    for (const id of ids) {
      await ctx.runMutation(internal.devSeedFacets.deleteCandidate, { candidateId: id });
    }
    return { deleted: ids.length };
  },
});

export const listTestCandidates = internalQuery({
  args: { key: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Id<"candidates">[]> => {
    const prefix = args.key
      ? `${TEST_NAME_PREFIX}${args.key}_`
      : TEST_NAME_PREFIX;
    const all = await ctx.db.query("candidates").take(2000);
    return all.filter((c) => c.name?.startsWith(prefix)).map((c) => c._id);
  },
});

export const deleteCandidate = internalMutation({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.delete(args.candidateId);
  },
});
