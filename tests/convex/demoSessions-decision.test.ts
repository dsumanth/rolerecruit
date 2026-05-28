import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as users from "../../convex/users";
import * as formTemplates from "../../convex/formTemplates";
import * as demoSessions from "../../convex/demoSessions";
import * as invites from "../../convex/evaluationInvites";
import * as evaluations from "../../convex/evaluations";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "users.ts": async () => users,
  "formTemplates.ts": async () => formTemplates,
  "demoSessions.ts": async () => demoSessions,
  "evaluationInvites.ts": async () => invites,
  "evaluations.ts": async () => evaluations,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

async function setup(t: ReturnType<typeof convexTest>) {
  const schoolId = await t.mutation("schools:create" as any, {
    name: "S", board: "CBSE", city: "X", state: "Y",
  } as any);
  const candidateId = await t.mutation("candidates:create" as any, {
    name: "Priya", qualifications: ["B.Ed"], subjects: ["Maths"],
  } as any);
  const jobId = await t.mutation("jobs:create" as any, {
    schoolId, title: "TGT Maths", subject: "Maths", level: "TGT",
    board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "x",
  } as any);
  const appId = await t.mutation("applications:create" as any, {
    candidateId, jobPostingId: jobId, schoolId,
  } as any);
  const principalId = await t.mutation("users:createProfile" as any, {
    userId: "u1", name: "Mrs Iyer", email: "p@s.com", schoolId, role: "principal",
  } as any);
  const demoId = await t.mutation("demoSessions:create" as any, {
    applicationId: appId,
    schoolId,
    scheduledAt: Date.now() + 86400000,
    durationMinutes: 30,
    mode: "live",
    format: "classroom",
    evaluators: [{ userId: principalId, role: "principal" }],
    createdBy: principalId,
  } as any);
  return { schoolId, appId, principalId, demoId };
}

describe("demoSessions.applyDecision", () => {
  it("advances the application stage and records the decision", async () => {
    const t = convexTest(schema, modules);
    const { appId, demoId, principalId } = await setup(t);

    const result = await t.mutation("demoSessions:applyDecision" as any, {
      demoId,
      action: "advance",
      appliedBy: principalId,
      note: "Strong demo, ready for next round",
    } as any);
    expect(result).toBe("advance");

    const demo = await t.query("demoSessions:get" as any, { demoId } as any);
    expect(demo.status).toBe("completed");
    expect(demo.appliedDecision).toBeDefined();
    expect(demo.appliedDecision.action).toBe("advance");
    expect(demo.appliedDecision.note).toBe("Strong demo, ready for next round");
    expect(demo.appliedDecision.appliedBy).toBe(principalId);
    expect(typeof demo.appliedDecision.appliedAt).toBe("number");

    const app = await t.run(async (ctx) => ctx.db.get(appId));
    expect(app?.stage).toBe("advanced");
  });

  it("rejects the application stage on action=reject", async () => {
    const t = convexTest(schema, modules);
    const { appId, demoId } = await setup(t);

    await t.mutation("demoSessions:applyDecision" as any, {
      demoId,
      action: "reject",
    } as any);

    const app = await t.run(async (ctx) => ctx.db.get(appId));
    expect(app?.stage).toBe("rejected");
  });

  it("does not change application stage for redemo or manual", async () => {
    const t = convexTest(schema, modules);
    const { appId, demoId } = await setup(t);
    const beforeApp = await t.run(async (ctx) => ctx.db.get(appId));
    const beforeStage = beforeApp?.stage;

    await t.mutation("demoSessions:applyDecision" as any, {
      demoId,
      action: "redemo",
    } as any);
    const afterRedemo = await t.run(async (ctx) => ctx.db.get(appId));
    expect(afterRedemo?.stage).toBe(beforeStage);

    await t.mutation("demoSessions:applyDecision" as any, {
      demoId,
      action: "manual",
    } as any);
    const afterManual = await t.run(async (ctx) => ctx.db.get(appId));
    expect(afterManual?.stage).toBe(beforeStage);
  });

  it("throws when demo not found", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, appId, principalId, demoId } = await setup(t);
    await t.mutation("demoSessions:cancel" as any, { demoId } as any);
    void schoolId; void appId; void principalId;

    // Use a fabricated-but-validly-shaped Id by generating a fresh demo then deleting it.
    const ghostDemo = await t.mutation("demoSessions:create" as any, {
      applicationId: appId,
      schoolId,
      scheduledAt: Date.now() + 86400000,
      durationMinutes: 30,
      mode: "live",
      format: "classroom",
      evaluators: [{ userId: principalId, role: "principal" }],
      createdBy: principalId,
    } as any);
    await t.run(async (ctx) => ctx.db.delete(ghostDemo));

    await expect(
      t.mutation("demoSessions:applyDecision" as any, { demoId: ghostDemo, action: "manual" } as any),
    ).rejects.toThrow(/not found/i);
  });
});
