// tests/convex/facetExtraction.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as ai from "../../convex/ai";
import * as aiCandidateParsing from "../../convex/ai_candidate_parsing";
import * as embeddings from "../../convex/embeddings";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "ai.ts": async () => ai,
  "ai_candidate_parsing.ts": async () => aiCandidateParsing,
  "embeddings.ts": async () => embeddings,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  delete process.env.GOOGLE_API_KEY;
});

describe("facet extraction", () => {
  it("parseProfileFromText returns the new ParsedProfile shape even when no API key", async () => {
    const t = convexTest(schema, modules);
    const result = await t.action("ai_candidate_parsing:parseProfileFromText", { text: "any" });
    expect(result).toMatchObject({
      name: null,
      qualifications: expect.any(Array),
      parsedFacets: expect.objectContaining({
        specializations: expect.any(Array),
        extras: expect.any(Object),
      }),
      rawChunks: expect.any(Array),
      candidateSummary: expect.any(String),
    });
  });
});
