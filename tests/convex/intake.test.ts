// tests/convex/intake.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import { PARSED_FACETS_VERSION } from "../../convex/versions";
import schema from "../../convex/schema";
import * as intake from "../../convex/intake";
import * as ai from "../../convex/ai";
import * as embeddings from "../../convex/embeddings";
import * as candidates from "../../convex/candidates";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "intake.ts": async () => intake,
  "ai.ts": async () => ai,
  "embeddings.ts": async () => embeddings,
  "candidates.ts": async () => candidates,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
  delete process.env.DEEPSEEK_API_KEY; // empty profile fallback; embeddings still computed
});

describe("intake", () => {
  it("compiles a candidate with all 5 facet embeddings + version stamps", async () => {
    const t = convexTest(schema, modules);
    const candId = await t.mutation("candidates:create", {
      name: "Priya", qualifications: ["B.Ed"], certifications: [], boardExperience: ["CBSE"],
      subjects: ["Physics"], yearsExperience: 5,
    });
    await t.action("intake:parseAndStoreCandidate", {
      candidateId: candId,
      rawText: "B.Ed and 5 years PGT Physics. Led JEE prep coaching.",
    });
    const c = await t.query("candidates:get", { candidateId: candId });
    expect(c!.parsedVersion).toBe(PARSED_FACETS_VERSION);
    expect(c!.embeddingVersion).toBe("emb-text3sm-v1");
    expect(c!.facetEmbeddings).toBeDefined();
    expect(c!.facetEmbeddings!.overall.length).toBe(1536);
    expect(c!.facetEmbeddings!.experience.length).toBe(1536);
    expect(c!.facetEmbeddings!.pedagogy.length).toBe(1536);
    expect(c!.facetEmbeddings!.achievements.length).toBe(1536);
    expect(c!.facetEmbeddings!.leadership.length).toBe(1536);
    expect(c!.rawChunks).toBeDefined();
  });
});
