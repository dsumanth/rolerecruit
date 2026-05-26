// tests/convex/facetPromotion.test.ts
import { describe, it, expect, beforeEach } from "vitest";
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
});
