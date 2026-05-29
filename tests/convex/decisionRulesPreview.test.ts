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

async function seedDecidedDemo(t: ReturnType<typeof convexTest>) {
  const schoolId = await t.mutation("schools:create" as any, {
    name: "Preview School", board: "CBSE", city: "Mumbai", state: "Maharashtra",
  } as any);
  const candidateId = await t.mutation("candidates:create" as any, {
    name: "Arjun Sharma", qualifications: ["B.Ed"], subjects: ["Science"],
  } as any);
  const jobId = await t.mutation("jobs:create" as any, {
    schoolId, title: "TGT Science", subject: "Science", level: "TGT",
    board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "Science teacher",
  } as any);
  const appId = await t.mutation("applications:create" as any, {
    candidateId, jobPostingId: jobId, schoolId,
  } as any);
  const principalId = await t.mutation("users:createProfile" as any, {
    userId: "u-pr1", name: "Principal", email: "p@school.com", schoolId, role: "principal",
  } as any);
  const hodId = await t.mutation("users:createProfile" as any, {
    userId: "u-hod1", name: "HOD", email: "h@school.com", schoolId, role: "hod",
  } as any);
  const ruleId = await t.mutation("decisionRules:create" as any, {
    schoolId,
    name: "seed rule",
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
  await t.mutation("evaluations:submit" as any, {
    inviteId: invitesList[0]._id,
    responses: {},
    recommendation: "hire",
    submittedFromPlatform: "web",
  } as any);
  await t.mutation("evaluations:submit" as any, {
    inviteId: invitesList[1]._id,
    responses: {},
    recommendation: "hire",
    submittedFromPlatform: "web",
  } as any);
  return { schoolId, demoId };
}

describe("decisionRules preview", () => {
  it("previewRuleOnDemo returns the action and per-step explanation for a draft rule", async () => {
    const t = convexTest(schema, modules);
    const { demoId } = await seedDecidedDemo(t);
    const result = await t.query("decisionRules:previewRuleOnDemo" as any, {
      demoId,
      rule: {
        steps: [{ match: "all", conditions: [{ type: "recCount", rec: "hire", op: "atLeast", value: 2 }], action: "advance" }],
        otherwise: "manual",
      },
    } as any);
    expect(result.action).toBe("advance");
    expect(result.matchedStepIndex).toBe(0);
    expect(result.steps[0].conditions[0].passed).toBe(true);
  });

  it("recentDecidedDemos lists completed demos for the school", async () => {
    const t = convexTest(schema, modules);
    const { schoolId } = await seedDecidedDemo(t);
    const demos = await t.query("decisionRules:recentDecidedDemos" as any, { schoolId } as any);
    expect(demos.length).toBeGreaterThan(0);
    expect(demos[0]).toHaveProperty("demoId");
    expect(demos[0]).toHaveProperty("label");
  });
});
