// tests/convex/reparse.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as intake from "../../convex/intake";
import * as intake_pdf from "../../convex/intake_pdf";
import * as ai from "../../convex/ai";
import * as aiCandidateParsing from "../../convex/ai_candidate_parsing";
import * as embeddings from "../../convex/embeddings";
import * as candidates from "../../convex/candidates";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "intake.ts": async () => intake,
  "intake_pdf.ts": async () => intake_pdf,
  "ai.ts": async () => ai,
  "ai_candidate_parsing.ts": async () => aiCandidateParsing,
  "embeddings.ts": async () => embeddings,
  "candidates.ts": async () => candidates,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
  delete process.env.GOOGLE_API_KEY;
});

describe("candidates:reparse", () => {
  it("returns ok=false with a clear reason when the candidate has no resume file", async () => {
    const t = convexTest(schema, modules);
    const candId = await t.mutation("candidates:create", {
      name: "Text-only candidate",
      qualifications: [],
      certifications: [],
      boardExperience: [],
      subjects: [],
    });
    const result = await t.action("candidates:reparse", { candidateId: candId });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no resume/i);
  });
});
