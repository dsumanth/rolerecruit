import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as reverseMatching from "../../convex/reverseMatching";
import * as ai from "../../convex/ai";
import * as aiCandidateParsing from "../../convex/ai_candidate_parsing";
import * as embeddings from "../../convex/embeddings";
import * as scoring from "../../convex/scoring";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as jobs from "../../convex/jobs";
import * as jobsAi from "../../convex/jobs_ai";
import * as schools from "../../convex/schools";
import * as intake from "../../convex/intake";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "reverseMatching.ts": async () => reverseMatching,
  "ai.ts": async () => ai,
  "ai_candidate_parsing.ts": async () => aiCandidateParsing,
  "embeddings.ts": async () => embeddings,
  "scoring.ts": async () => scoring,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "jobs.ts": async () => jobs,
  "jobs_ai.ts": async () => jobsAi,
  "schools.ts": async () => schools,
  "intake.ts": async () => intake,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
});

describe("reverseMatching.findCandidatesForJob (hybrid)", () => {
  it("returns top candidates with hybrid score breakdown", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "X", state: "Y" });

    const strong = await t.mutation("candidates:create", {
      name: "Strong", qualifications: ["B.Ed", "M.Sc Physics"], certifications: ["CTET"],
      boardExperience: ["CBSE"], subjects: ["Physics"], yearsExperience: 7,
    });
    const weak = await t.mutation("candidates:create", {
      name: "Weak", qualifications: [], certifications: [],
      boardExperience: ["State"], subjects: ["Physics"], yearsExperience: 1,
    });
    const unrelated = await t.mutation("candidates:create", {
      name: "Unrelated", qualifications: ["B.Ed"], certifications: [],
      boardExperience: ["CBSE"], subjects: ["English"], yearsExperience: 3,
    });

    for (const id of [strong, weak, unrelated]) {
      await t.action("intake:parseAndStoreCandidate", { candidateId: id, rawText: "" });
    }

    const jobId = await t.mutation("jobs:create", {
      schoolId, title: "PGT Physics", subject: "Physics", level: "PGT", board: "CBSE",
      qualifications: ["B.Ed", "M.Sc Physics"], minExperience: 3,
      naturalLanguageDescription: "PGT Physics for CBSE Class 11-12",
    });
    await t.action("jobs_ai:computeRoleEmbeddings", { jobId });

    const results = await t.action("reverseMatching:findCandidatesForJob", { jobId });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].candidateId).toBe(strong);
    expect(results.some((r: any) => r.candidateId === unrelated)).toBe(false);
    expect(results[0]).toHaveProperty("structuredScore");
    expect(results[0]).toHaveProperty("semanticSimilarity");
    expect(results[0]).toHaveProperty("ruleScore");
  });
});
