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

/**
 * Helper: build a school + job + application + a fake triageDecision so we
 * can isolate overrideOutcome / approveDraft from the full runTriage pipeline.
 */
async function seedAppWithDecision(
  t: ReturnType<typeof convexTest>,
  outcome: "auto_shortlisted" | "auto_rejected" | "human_review" | "cross_role_suggested",
  opts: { withDraft?: boolean; appStage?: string } = {},
) {
  const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "Mumbai", state: "MH" });
  const jobId = await t.mutation("jobs:create", {
    schoolId, title: "PGT Physics", subject: "Physics", level: "PGT", board: "CBSE",
    qualifications: ["B.Ed"], minExperience: 2,
    naturalLanguageDescription: "PGT Physics",
  });
  await t.mutation("jobs:publish", { jobId });
  const candId = await t.mutation("candidates:create", {
    name: "X", qualifications: ["B.Ed"], certifications: [], boardExperience: ["CBSE"],
    subjects: ["Physics"], yearsExperience: 5,
  });
  const appId = await t.mutation("applications:create", {
    candidateId: candId, jobPostingId: jobId, schoolId, skipTriage: true,
  });

  // Optionally bump the app past sourced (to test that we don't trample).
  if (opts.appStage && opts.appStage !== "sourced") {
    await t.run(async (ctx: any) => {
      await ctx.db.patch(appId, { stage: opts.appStage });
    });
  }

  // Hand-craft a triageDecision + (optional) draft outreach so we don't need
  // the LLM rerank / drafter to run.
  const { decisionId, draftId } = await t.run(async (ctx: any) => {
    let draftId: any = undefined;
    if (opts.withDraft) {
      draftId = await ctx.db.insert("outreachMessages", {
        applicationId: appId,
        candidateId: candId,
        type: outcome === "auto_rejected" ? "rejection" : "shortlist",
        channel: "whatsapp",
        body: "Hi {{name}}",
        status: "draft_pending_approval",
        draftedBy: "triage_agent",
      });
    }
    const decisionId = await ctx.db.insert("triageDecisions", {
      applicationId: appId,
      candidateId: candId,
      schoolId,
      primaryRoleId: jobId,
      primaryMatchScore: 80,
      primaryMatchReasons: ["test"],
      crossRoleMatches: [],
      outcome,
      outcomeReasoning: "test",
      outreachDraftId: draftId,
      hybridWeights: {
        w_struct: 0.5,
        w_sem: 0.3,
        w_rules: 0.2,
        facetWeights: {
          overall: 0.2,
          experience: 0.2,
          pedagogy: 0.2,
          achievements: 0.2,
          leadership: 0.2,
        },
      },
      createdAt: Date.now(),
      triagePromptVersion: "triage-v1",
    });
    await ctx.db.patch(appId, { triageOutcome: outcome, triageDecisionId: decisionId });
    return { decisionId, draftId };
  });

  return { schoolId, jobId, candId, appId, decisionId, draftId };
}

describe("triage.overrideOutcome", () => {
  it("advances pipeline stage to 'screened' when overriding from sourced to auto_shortlisted", async () => {
    const t = convexTest(schema, modules);
    const { appId, decisionId } = await seedAppWithDecision(t, "human_review");

    await t.mutation("triage:overrideOutcome", {
      decisionId,
      overriddenBy: "user_test",
      toOutcome: "auto_shortlisted",
    });

    const app = await t.query("applications:get", { applicationId: appId });
    expect(app!.stage).toBe("screened");
    expect(app!.triageOutcome).toBe("auto_shortlisted");
  });

  it("advances pipeline stage to 'rejected' when overriding from sourced to auto_rejected", async () => {
    const t = convexTest(schema, modules);
    const { appId, decisionId } = await seedAppWithDecision(t, "human_review");

    await t.mutation("triage:overrideOutcome", {
      decisionId,
      overriddenBy: "user_test",
      toOutcome: "auto_rejected",
    });

    const app = await t.query("applications:get", { applicationId: appId });
    expect(app!.stage).toBe("rejected");
  });

  it("records humanOverride metadata on the decision", async () => {
    const t = convexTest(schema, modules);
    const { decisionId } = await seedAppWithDecision(t, "human_review");

    await t.mutation("triage:overrideOutcome", {
      decisionId,
      overriddenBy: "user_test",
      toOutcome: "auto_shortlisted",
      note: "Strong recommendation",
    });

    const decision = await t.run(async (ctx: any) => ctx.db.get(decisionId));
    expect(decision.humanOverride).toBeDefined();
    expect(decision.humanOverride.fromOutcome).toBe("human_review");
    expect(decision.humanOverride.toOutcome).toBe("auto_shortlisted");
    expect(decision.humanOverride.note).toBe("Strong recommendation");
    expect(decision.humanOverride.overriddenBy).toBe("user_test");
  });

  it("does NOT advance stage when app is already past 'sourced' (preserves recruiter moves)", async () => {
    const t = convexTest(schema, modules);
    const { appId, decisionId } = await seedAppWithDecision(t, "auto_shortlisted", {
      appStage: "demo_scheduled",
    });

    // Recruiter overrides to auto_rejected. App is already at demo_scheduled —
    // we should NOT yank it back to "rejected" implicitly.
    await t.mutation("triage:overrideOutcome", {
      decisionId,
      overriddenBy: "user_test",
      toOutcome: "auto_rejected",
    });

    const app = await t.query("applications:get", { applicationId: appId });
    expect(app!.stage).toBe("demo_scheduled");
    expect(app!.triageOutcome).toBe("auto_rejected"); // triage state still updates
  });

  it("is a no-op when override target equals current outcome", async () => {
    const t = convexTest(schema, modules);
    const { appId, decisionId } = await seedAppWithDecision(t, "human_review");

    await t.mutation("triage:overrideOutcome", {
      decisionId,
      overriddenBy: "user_test",
      toOutcome: "human_review",
    });

    const app = await t.query("applications:get", { applicationId: appId });
    expect(app!.stage).toBe("sourced"); // unchanged
    const decision = await t.run(async (ctx: any) => ctx.db.get(decisionId));
    expect(decision.humanOverride).toBeUndefined(); // no override recorded
  });
});

describe("triage.approveDraft", () => {
  it("advances pipeline stage to match the outcome when approving from sourced", async () => {
    const t = convexTest(schema, modules);
    const { appId, decisionId, draftId } = await seedAppWithDecision(t, "auto_shortlisted", {
      withDraft: true,
    });

    await t.mutation("triage:approveDraft", { decisionId, overriddenBy: "user_test" });

    const app = await t.query("applications:get", { applicationId: appId });
    expect(app!.stage).toBe("screened");
    const draft = await t.run(async (ctx: any) => ctx.db.get(draftId));
    expect(draft.status).toBe("scheduled");
  });

  it("moves to 'rejected' stage when approving an auto_rejected draft", async () => {
    const t = convexTest(schema, modules);
    const { appId, decisionId } = await seedAppWithDecision(t, "auto_rejected", {
      withDraft: true,
    });

    await t.mutation("triage:approveDraft", { decisionId, overriddenBy: "user_test" });

    const app = await t.query("applications:get", { applicationId: appId });
    expect(app!.stage).toBe("rejected");
  });
});
