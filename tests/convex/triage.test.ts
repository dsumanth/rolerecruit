import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as triage from "../../convex/triage";
import * as reverseMatching from "../../convex/reverseMatching";
import * as schools from "../../convex/schools";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as jobs from "../../convex/jobs";
import * as jobsAi from "../../convex/jobs_ai";
import * as intake from "../../convex/intake";
import * as ai from "../../convex/ai";
import * as embeddings from "../../convex/embeddings";
import * as scoring from "../../convex/scoring";
import * as outreach from "../../convex/outreach";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "triage.ts": async () => triage,
  "reverseMatching.ts": async () => reverseMatching,
  "schools.ts": async () => schools,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "jobs.ts": async () => jobs,
  "jobs_ai.ts": async () => jobsAi,
  "intake.ts": async () => intake,
  "ai.ts": async () => ai,
  "embeddings.ts": async () => embeddings,
  "scoring.ts": async () => scoring,
  "outreach.ts": async () => outreach,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
  delete process.env.DEEPSEEK_API_KEY;
});

describe("triage.runTriage", () => {
  it("writes a triageDecisions row with hybridWeights snapshot and stamps the application", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "Mumbai", state: "MH" });
    await t.mutation("schools:updateTriageConfig", { schoolId, triageEnabled: true });

    const jobId = await t.mutation("jobs:create", {
      schoolId, title: "PGT Physics", subject: "Physics", level: "PGT", board: "CBSE",
      qualifications: ["B.Ed"], minExperience: 2,
      naturalLanguageDescription: "PGT Physics",
    });
    await t.mutation("jobs:publish", { jobId });
    await t.action("jobs_ai:computeRoleEmbeddings", { jobId });

    const candId = await t.mutation("candidates:create", {
      name: "X", qualifications: ["B.Ed", "M.Sc Physics"], certifications: ["CTET"],
      boardExperience: ["CBSE"], subjects: ["Physics"], yearsExperience: 5,
    });
    await t.action("intake:parseAndStoreCandidate", { candidateId: candId, rawText: "" });

    const appId = await t.mutation("applications:create", {
      candidateId: candId, jobPostingId: jobId, schoolId,
    });

    await t.action("triage:runTriage", { applicationId: appId });

    const app = await t.query("applications:get", { applicationId: appId });
    expect(app!.triageOutcome).toBeDefined();
    expect(app!.triageDecisionId).toBeDefined();

    const decision = await t.query("triage:getByApplicationId", { applicationId: appId });
    expect(decision!.hybridWeights).toBeDefined();
    expect(decision!.hybridWeights.w_struct).toBe(0.5);
    expect(decision!.hybridWeights.w_sem).toBe(0.3);
    expect(decision!.hybridWeights.w_rules).toBe(0.2);
  });
});
