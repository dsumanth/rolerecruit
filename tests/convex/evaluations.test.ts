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
  const schoolId = await t.mutation("schools:create" as any, { name: "S", board: "CBSE", city: "X", state: "Y" } as any);
  const candidateId = await t.mutation("candidates:create" as any, { name: "P", qualifications: ["B.Ed"], subjects: ["Maths"] } as any);
  const jobId = await t.mutation("jobs:create" as any, { schoolId, title: "T", subject: "Maths", level: "TGT", board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "x" } as any);
  const appId = await t.mutation("applications:create" as any, { candidateId, jobPostingId: jobId, schoolId } as any);
  const principalId = await t.mutation("users:createProfile" as any, { userId: "u1", name: "P", email: "p@s.com", schoolId, role: "principal" } as any);
  const demoId = await t.mutation("demoSessions:create" as any, {
    applicationId: appId, schoolId,
    scheduledAt: Date.now() + 86400000, durationMinutes: 30,
    mode: "live", format: "classroom",
    evaluators: [{ userId: principalId, role: "principal" }],
    createdBy: principalId,
  } as any);
  const invs = await t.query("evaluationInvites:listForDemo" as any, { demoId } as any);
  return { schoolId, appId, principalId, demoId, invite: invs[0] };
}

describe("evaluations.submit", () => {
  it("persists responses and advances invite to submitted", async () => {
    const t = convexTest(schema, modules);
    const { invite } = await setup(t);
    await t.mutation("evaluations:submit" as any, {
      inviteId: invite._id,
      responses: { subjectKnowledge: 4, classroomManagement: 5, communication: 4, overallFit: 4, comments: "Strong" },
      recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);
    const evals = await t.query("evaluations:listForInvite" as any, { inviteId: invite._id } as any);
    expect(evals).toHaveLength(1);
    expect(evals[0].responses.subjectKnowledge).toBe(4);
    expect(evals[0].recommendation).toBe("hire");

    const inv = await t.query("evaluationInvites:listForDemo" as any, { demoId: invite.demoSessionId } as any);
    expect(inv[0].status).toBe("submitted");
    expect(inv[0].submittedAt).toBeGreaterThan(0);
  });

  it("rejects double submission on the same invite", async () => {
    const t = convexTest(schema, modules);
    const { invite } = await setup(t);
    await t.mutation("evaluations:submit" as any, {
      inviteId: invite._id, responses: { comments: "x" }, recommendation: "maybe", submittedFromPlatform: "web",
    } as any);
    await expect(
      t.mutation("evaluations:submit" as any, {
        inviteId: invite._id, responses: { comments: "y" }, recommendation: "hire", submittedFromPlatform: "web",
      } as any),
    ).rejects.toThrow(/already submitted/i);
  });

  it("rejects submission on a cancelled invite", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, invite } = await setup(t);
    const subId = await t.mutation("users:createProfile" as any, { userId: "u2", name: "S", email: "s@s.com", schoolId, role: "principal" } as any);
    await t.mutation("evaluationInvites:swap" as any, { inviteId: invite._id, newEvaluatorUserId: subId } as any);
    await expect(
      t.mutation("evaluations:submit" as any, {
        inviteId: invite._id, responses: {}, recommendation: "hire", submittedFromPlatform: "web",
      } as any),
    ).rejects.toThrow(/cancelled/i);
  });

  it("submitByToken accepts a valid token and rejects an invalid one", async () => {
    const t = convexTest(schema, modules);
    const { invite } = await setup(t);
    await t.mutation("evaluations:submitByToken" as any, {
      token: invite.token,
      responses: { comments: "good" },
      recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);
    const evals = await t.query("evaluations:listForInvite" as any, { inviteId: invite._id } as any);
    expect(evals).toHaveLength(1);

    await expect(
      t.mutation("evaluations:submitByToken" as any, {
        token: "bogus", responses: {}, recommendation: "hire", submittedFromPlatform: "web",
      } as any),
    ).rejects.toThrow(/not found/i);
  });

  it("persists voiceInputs when provided", async () => {
    const t = convexTest(schema, modules);
    const { invite } = await setup(t);
    await t.mutation("evaluations:submit" as any, {
      inviteId: invite._id,
      responses: { comments: "see bullets" },
      recommendation: "hire",
      submittedFromPlatform: "web",
      voiceInputs: [{
        fieldKey: "comments",
        transcript: "She was strong on fractions",
        summaryPoints: ["Strong on fractions", "Engaged students"],
        language: "en-IN",
        durationSec: 30,
        processedAt: Date.now(),
      }],
    } as any);
    const evals = await t.query("evaluations:listForInvite" as any, { inviteId: invite._id } as any);
    expect(evals[0].voiceInputs).toHaveLength(1);
    expect(evals[0].voiceInputs![0].summaryPoints).toHaveLength(2);
  });
});
