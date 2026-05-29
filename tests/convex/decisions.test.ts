import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as users from "../../convex/users";
import * as formTemplates from "../../convex/formTemplates";
import * as decisionRules from "../../convex/decisionRules";
import * as demoSessions from "../../convex/demoSessions";
import * as invites from "../../convex/evaluationInvites";
import * as evaluations from "../../convex/evaluations";
import * as decisions from "../../convex/decisions";
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
  "decisionRules.ts": async () => decisionRules,
  "demoSessions.ts": async () => demoSessions,
  "evaluationInvites.ts": async () => invites,
  "evaluations.ts": async () => evaluations,
  "decisions.ts": async () => decisions,
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
    userId: "u-p", name: "P", email: "p@s.com", schoolId, role: "principal",
  } as any);
  const hodId = await t.mutation("users:createProfile" as any, {
    userId: "u-h", name: "H", email: "h@s.com", schoolId, role: "hod",
  } as any);
  const ruleId = await t.mutation("decisionRules:create" as any, {
    schoolId,
    name: "auto-advance on 2 hires",
    steps: [{ match: "all", conditions: [{ type: "recCount", rec: "hire", op: "atLeast", value: 2 }], action: "advance" }],
    otherwise: "manual",
  } as any);
  const demoId = await t.mutation("demoSessions:create" as any, {
    applicationId: appId,
    schoolId,
    scheduledAt: Date.now() + 86400000,
    durationMinutes: 30,
    mode: "live",
    format: "classroom",
    evaluators: [
      { userId: principalId, role: "principal" },
      { userId: hodId, role: "hod" },
    ],
    decisionRuleId: ruleId,
    createdBy: principalId,
  } as any);
  const invitesList = await t.query("evaluationInvites:listForDemo" as any, {
    demoId,
  } as any);
  return { schoolId, appId, demoId, ruleId, principalId, hodId, invitesList };
}

describe("maybeApplyDecision via terminal-transition mutations", () => {
  it("auto-advances when all submit hire and rule matches", async () => {
    const t = convexTest(schema, modules);
    const s = await setup(t);

    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[0]._id,
      responses: {},
      recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);
    let demo = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    expect(demo.appliedDecision).toBeUndefined();

    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[1]._id,
      responses: {},
      recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);
    demo = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    expect(demo.appliedDecision).toBeDefined();
    expect(demo.appliedDecision.action).toBe("advance");
    expect(demo.status).toBe("completed");

    const app = await t.query("applications:get" as any, { applicationId: s.appId } as any);
    expect(app.stage).toBe("advanced");
  });

  it("falls through to manual fallback when no branch matches", async () => {
    const t = convexTest(schema, modules);
    const s = await setup(t);

    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[0]._id, responses: {}, recommendation: "maybe",
      submittedFromPlatform: "web",
    } as any);
    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[1]._id, responses: {}, recommendation: "reject",
      submittedFromPlatform: "web",
    } as any);

    const demo = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    expect(demo.appliedDecision?.action).toBe("manual");
    const app = await t.query("applications:get" as any, { applicationId: s.appId } as any);
    expect(app.stage).not.toBe("advanced");
    expect(app.stage).not.toBe("rejected");
  });

  it("decline triggers the engine when it's the last remaining transition", async () => {
    const t = convexTest(schema, modules);
    const s = await setup(t);

    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[0]._id, responses: {}, recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);
    await t.mutation("evaluationInvites:decline" as any, {
      inviteId: s.invitesList[1]._id, reason: "conflict",
    } as any);

    const demo = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    expect(demo.appliedDecision?.action).toBe("manual");
  });

  it("is idempotent — does not re-fire once decision is set", async () => {
    const t = convexTest(schema, modules);
    const s = await setup(t);

    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[0]._id, responses: {}, recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);
    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[1]._id, responses: {}, recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);

    const demo1 = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    expect(demo1.appliedDecision?.action).toBe("advance");

    // Manual override is the only way to change appliedDecision after auto-apply.
    await t.mutation("demoSessions:applyDecision" as any, {
      demoId: s.demoId, action: "reject", note: "override",
    } as any);

    const demo2 = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    expect(demo2.appliedDecision.action).toBe("reject");
  });

  it("does not fire when demo has no decisionRuleId", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create" as any, {
      name: "S2", board: "ICSE", city: "X", state: "Y",
    } as any);
    const candidateId = await t.mutation("candidates:create" as any, {
      name: "X", qualifications: [], subjects: [],
    } as any);
    const jobId = await t.mutation("jobs:create" as any, {
      schoolId, title: "x", subject: "x", level: "TGT", board: "CBSE",
      qualifications: [], naturalLanguageDescription: "x",
    } as any);
    const appId = await t.mutation("applications:create" as any, {
      candidateId, jobPostingId: jobId, schoolId,
    } as any);
    const userId = await t.mutation("users:createProfile" as any, {
      userId: "u1", name: "U", email: "u@s.com", schoolId, role: "principal",
    } as any);
    const demoId = await t.mutation("demoSessions:create" as any, {
      applicationId: appId,
      schoolId,
      scheduledAt: Date.now() + 86400000,
      durationMinutes: 30,
      mode: "live", format: "classroom",
      evaluators: [{ userId, role: "principal" }],
      createdBy: userId,
    } as any);
    const inv = (await t.query("evaluationInvites:listForDemo" as any, {
      demoId,
    } as any))[0];

    await t.mutation("evaluations:submit" as any, {
      inviteId: inv._id, responses: {}, recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);

    const demo = await t.query("demoSessions:get" as any, { demoId } as any);
    expect(demo.appliedDecision).toBeUndefined();
  });

  it("ignores cancelled (swapped) invites when checking all-terminal", async () => {
    const t = convexTest(schema, modules);
    const s = await setup(t);
    const replacementId = await t.mutation("users:createProfile" as any, {
      userId: "u-r", name: "R", email: "r@s.com", schoolId: s.schoolId, role: "principal",
    } as any);

    await t.mutation("evaluationInvites:swap" as any, {
      inviteId: s.invitesList[0]._id,
      newEvaluatorUserId: replacementId,
    } as any);

    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[1]._id, responses: {}, recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);

    let demo = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    expect(demo.appliedDecision).toBeUndefined();

    const all = await t.query("evaluationInvites:listForDemo" as any, {
      demoId: s.demoId,
    } as any);
    const replacement = all.find((i: any) => i.status === "invited");
    expect(replacement).toBeDefined();
    await t.mutation("evaluations:submit" as any, {
      inviteId: replacement._id, responses: {}, recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);

    demo = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    expect(demo.appliedDecision?.action).toBe("advance");
  });
});
