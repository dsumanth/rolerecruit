// tests/convex/facetPromotion.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as facetPromotion from "../../convex/facetPromotion";
import * as candidates from "../../convex/candidates";
import * as ai from "../../convex/ai";
import * as embeddings from "../../convex/embeddings";
import * as intake from "../../convex/intake";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "facetPromotion.ts": async () => facetPromotion,
  "candidates.ts": async () => candidates,
  "ai.ts": async () => ai,
  "embeddings.ts": async () => embeddings,
  "intake.ts": async () => intake,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
});

async function seedCandidateWithExtras(t: any, key: string, valueText: string) {
  const id = await t.mutation("candidates:create", {
    name: "X", qualifications: [], certifications: [],
    boardExperience: [], subjects: ["Physics"],
  });
  await t.run(async (ctx: any) => {
    await ctx.db.patch(id, {
      parsedFacets: {
        specializations: [], gradeLevels: [], pedagogicalApproach: [],
        leadershipRoles: [], extracurricular: [], languages: [],
        schoolTypes: [], keyAchievements: [], redFlags: [],
        extras: {
          [key]: [{ value: valueText, evidence: { quote: valueText, offset: 0, context: "" } }],
        },
      },
      rawChunks: [{ text: valueText, section: "experience", offset: 0 }],
      parsedAt: Date.now(),
      parsedVersion: "facets-v1",
    });
  });
  return id;
}

async function seedCandidateWithMultipleExtras(
  t: any,
  extrasMap: Record<string, string>,
) {
  const id = await t.mutation("candidates:create", {
    name: "X", qualifications: [], certifications: [],
    boardExperience: [], subjects: ["Physics"],
  });
  const extras: Record<string, any[]> = {};
  for (const [key, valueText] of Object.entries(extrasMap)) {
    extras[key] = [{ value: valueText, evidence: { quote: valueText, offset: 0, context: "" } }];
  }
  await t.run(async (ctx: any) => {
    await ctx.db.patch(id, {
      parsedFacets: {
        specializations: [], gradeLevels: [], pedagogicalApproach: [],
        leadershipRoles: [], extracurricular: [], languages: [],
        schoolTypes: [], keyAchievements: [], redFlags: [],
        extras,
      },
      rawChunks: [{ text: Object.values(extrasMap).join(" "), section: "experience", offset: 0 }],
      parsedAt: Date.now(),
      parsedVersion: "facets-v1",
    });
  });
  return id;
}

describe("facetPromotion", () => {
  it("trackExtrasFrequency aggregates extras keys into facetPromotionCandidates", async () => {
    const t = convexTest(schema, modules);

    await seedCandidateWithExtras(t, "AI_curriculum_design", "designed AI-integrated curriculum");
    await seedCandidateWithExtras(t, "AI_curriculum_design", "AI curriculum for grade 9");
    await seedCandidateWithExtras(t, "STEM_lab_setup", "built STEM lab from scratch");

    await t.action("facetPromotion:trackExtrasFrequency", {});

    const ai = await t.query("facetPromotion:getByKey", { key: "AI_curriculum_design" });
    expect(ai).not.toBeNull();
    expect(ai!.occurrenceCount).toBe(2);
    expect(ai!.sampleEvidence.length).toBeGreaterThanOrEqual(1);

    const stem = await t.query("facetPromotion:getByKey", { key: "STEM_lab_setup" });
    expect(stem!.occurrenceCount).toBe(1);
  });

  it("trackExtrasFrequency is idempotent — running twice doesn't double-count", async () => {
    const t = convexTest(schema, modules);
    await seedCandidateWithExtras(t, "AI_curriculum_design", "v1");
    await t.action("facetPromotion:trackExtrasFrequency", {});
    await t.action("facetPromotion:trackExtrasFrequency", {});
    const row = await t.query("facetPromotion:getByKey", { key: "AI_curriculum_design" });
    expect(row!.occurrenceCount).toBe(1);
  });

  it("trackExtrasFrequency skips keys prefixed with __promoted__", async () => {
    const t = convexTest(schema, modules);
    await seedCandidateWithMultipleExtras(t, {
      "novel_key": "fresh novelty",
      "__promoted__AI_curriculum_design": "already promoted, should be ignored",
    });

    await t.action("facetPromotion:trackExtrasFrequency", {});

    const novel = await t.query("facetPromotion:getByKey", { key: "novel_key" });
    expect(novel).not.toBeNull();
    expect(novel!.occurrenceCount).toBe(1);

    const promoted = await t.query("facetPromotion:getByKey", {
      key: "__promoted__AI_curriculum_design",
    });
    expect(promoted).toBeNull();
  });

  it("promote moves extras values to __promoted__<key> for every carrying candidate", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const c1 = await seedCandidateWithExtras(t, "AI_curriculum_design", "designed AI curriculum");
      const c2 = await seedCandidateWithExtras(t, "AI_curriculum_design", "AI lessons for grade 9");
      const c3 = await seedCandidateWithExtras(t, "STEM_lab_setup", "built STEM lab");

      await t.action("facetPromotion:trackExtrasFrequency", {});
      await t.mutation("facetPromotion:promote", { key: "AI_curriculum_design", actorUserId: "test_admin" });
      await t.finishAllScheduledFunctions(vi.runAllTimers);

      // Promoted candidates: values moved to __promoted__<key>
      const updated1 = await t.query("candidates:get", { candidateId: c1 });
      const updated2 = await t.query("candidates:get", { candidateId: c2 });
      expect(updated1!.parsedFacets!.extras).not.toHaveProperty("AI_curriculum_design");
      expect(updated1!.parsedFacets!.extras).toHaveProperty("__promoted__AI_curriculum_design");
      expect(updated2!.parsedFacets!.extras).toHaveProperty("__promoted__AI_curriculum_design");

      // Unrelated candidate untouched
      const updated3 = await t.query("candidates:get", { candidateId: c3 });
      expect(updated3!.parsedFacets!.extras).toHaveProperty("STEM_lab_setup");

      // Promotion row has status="promoted"
      const row = await t.query("facetPromotion:getByKey", { key: "AI_curriculum_design" });
      expect(row!.status).toBe("promoted");
      expect(row!.promotedAt).toBeDefined();

      // listPromotedKeys exposes it
      const keys = await t.query("facetPromotion:listPromotedKeys", {});
      expect(keys).toContain("AI_curriculum_design");
    } finally {
      vi.useRealTimers();
    }
  });

  it("trackExtrasFrequency + backfillPromotion paginate through candidates beyond one page", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);

      // Seed 5 candidates carrying the same extras key. With pageSize=2 the
      // table is split across 3 pages (2 + 2 + 1), forcing both the tracker
      // and the backfill action to traverse multiple cursors.
      const ids: any[] = [];
      for (let i = 0; i < 5; i++) {
        ids.push(await seedCandidateWithExtras(t, "pagination_key", `evidence ${i}`));
      }

      // trackExtrasFrequency must aggregate across all 5 candidates even when
      // they don't all fit in one page.
      await t.action("facetPromotion:trackExtrasFrequency", { pageSize: 2 });
      const row = await t.query("facetPromotion:getByKey", { key: "pagination_key" });
      expect(row!.occurrenceCount).toBe(5);

      // Mark the row as promoted directly so we can invoke backfillPromotion
      // ourselves with a small page size — bypassing the public promote()
      // mutation that schedules with default pageSize.
      await t.run(async (ctx: any) => {
        await ctx.db.patch(row!._id, { status: "promoted", promotedAt: Date.now() });
      });

      const result = await t.action("facetPromotion:backfillPromotion", {
        key: "pagination_key",
        pageSize: 2,
      });
      expect(result.processed).toBe(5);

      // All 5 candidates should have their key moved under the __promoted__ prefix.
      for (const id of ids) {
        const c = await t.query("candidates:get", { candidateId: id });
        expect(c!.parsedFacets!.extras).toHaveProperty("__promoted__pagination_key");
        expect(c!.parsedFacets!.extras).not.toHaveProperty("pagination_key");
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("demote moves __promoted__<key> values back to extras[key]", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const c1 = await seedCandidateWithExtras(t, "AI_curriculum_design", "designed curriculum");
      await t.action("facetPromotion:trackExtrasFrequency", {});
      await t.mutation("facetPromotion:promote", { key: "AI_curriculum_design", actorUserId: "admin" });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      await t.mutation("facetPromotion:demote", { key: "AI_curriculum_design", actorUserId: "admin" });
      await t.finishAllScheduledFunctions(vi.runAllTimers);

      const c = await t.query("candidates:get", { candidateId: c1 });
      expect(c!.parsedFacets!.extras).toHaveProperty("AI_curriculum_design");
      expect(c!.parsedFacets!.extras).not.toHaveProperty("__promoted__AI_curriculum_design");

      const row = await t.query("facetPromotion:getByKey", { key: "AI_curriculum_design" });
      expect(row!.status).toBe("demoted");
    } finally {
      vi.useRealTimers();
    }
  });
});
