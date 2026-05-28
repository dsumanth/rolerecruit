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
  const hodId = await t.mutation("users:createProfile" as any, {
    userId: "u2", name: "Mr Khan", email: "h@s.com", schoolId, role: "hod",
  } as any);
  return { schoolId, appId, principalId, hodId };
}

describe("demoSessions.create", () => {
  it("creates one demo and one invite per evaluator", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, appId, principalId, hodId } = await setup(t);

    const demoId = await t.mutation("demoSessions:create" as any, {
      applicationId: appId,
      schoolId,
      scheduledAt: Date.now() + 86400000,
      durationMinutes: 30,
      mode: "live",
      format: "classroom",
      location: "Room 12B",
      evaluators: [
        { userId: principalId, role: "principal" },
        { userId: hodId, role: "hod" },
      ],
      createdBy: principalId,
    } as any);

    const demo = await t.query("demoSessions:get" as any, { demoId } as any);
    expect(demo.status).toBe("scheduled");
    expect(demo.mode).toBe("live");

    const inviteList = await t.query("evaluationInvites:listForDemo" as any, { demoId } as any);
    expect(inviteList).toHaveLength(2);
    expect(new Set(inviteList.map((i: any) => i.evaluatorRole))).toEqual(new Set(["principal", "hod"]));
    for (const inv of inviteList) {
      expect(inv.status).toBe("invited");
      expect(inv.token).toMatch(/^[a-z0-9]{32}$/);
      expect(inv.formTemplateId).toBeDefined();
    }
  });

  it("rejects an empty evaluator list", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, appId, principalId } = await setup(t);
    await expect(
      t.mutation("demoSessions:create" as any, {
        applicationId: appId, schoolId,
        scheduledAt: Date.now() + 1000, durationMinutes: 30,
        mode: "live", format: "classroom",
        evaluators: [],
        createdBy: principalId,
      } as any),
    ).rejects.toThrow(/at least one evaluator/i);
  });

  it("rejects scheduledAt in the past", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, appId, principalId } = await setup(t);
    await expect(
      t.mutation("demoSessions:create" as any, {
        applicationId: appId, schoolId,
        scheduledAt: Date.now() - 1000, durationMinutes: 30,
        mode: "live", format: "classroom",
        evaluators: [{ userId: principalId, role: "principal" }],
        createdBy: principalId,
      } as any),
    ).rejects.toThrow(/past/i);
  });
});

describe("demoSessions.cancel", () => {
  it("cancels the demo and all non-terminal invites", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, appId, principalId, hodId } = await setup(t);
    const demoId = await t.mutation("demoSessions:create" as any, {
      applicationId: appId, schoolId,
      scheduledAt: Date.now() + 86400000, durationMinutes: 30,
      mode: "live", format: "classroom",
      evaluators: [
        { userId: principalId, role: "principal" },
        { userId: hodId, role: "hod" },
      ],
      createdBy: principalId,
    } as any);
    await t.mutation("demoSessions:cancel" as any, { demoId, reason: "rescheduled" } as any);

    const demo = await t.query("demoSessions:get" as any, { demoId } as any);
    expect(demo.status).toBe("cancelled");
    expect(demo.cancellationReason).toBe("rescheduled");

    const inviteList = await t.query("evaluationInvites:listForDemo" as any, { demoId } as any);
    for (const inv of inviteList) {
      expect(inv.status).toBe("cancelled");
    }
  });
});

describe("demoSessions.aggregate", () => {
  it("rolls up per-dimension averages weighted by template weights", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, appId, principalId, hodId } = await setup(t);
    const demoId = await t.mutation("demoSessions:create" as any, {
      applicationId: appId, schoolId,
      scheduledAt: Date.now() + 86400000, durationMinutes: 30,
      mode: "live", format: "classroom",
      evaluators: [
        { userId: principalId, role: "principal" },
        { userId: hodId, role: "hod" },
      ],
      createdBy: principalId,
    } as any);
    const invs = await t.query("evaluationInvites:listForDemo" as any, { demoId } as any);
    const pInv = invs.find((i: any) => i.evaluatorRole === "principal");
    const hInv = invs.find((i: any) => i.evaluatorRole === "hod");

    await t.mutation("evaluations:submit" as any, {
      inviteId: pInv._id,
      responses: { subjectKnowledge: 4, classroomManagement: 5, communication: 4, overallFit: 4, comments: "good" },
      recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);
    await t.mutation("evaluations:submit" as any, {
      inviteId: hInv._id,
      responses: { subjectKnowledge: 5, pedagogy: 5, curriculumAlignment: 4, communication: 4, comments: "great" },
      recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);

    const agg = await t.query("demoSessions:aggregate" as any, { demoId } as any);
    expect(agg.demo._id).toBe(demoId);
    expect(agg.invitesByStatus.submitted).toBe(2);
    expect(agg.recommendationTally).toEqual({ hire: 2, maybe: 0, reject: 0 });
    expect(agg.dimensionAverages.subjectKnowledge).toBeCloseTo(14 / 3, 3);
    expect(agg.dimensionAverages.communication).toBeCloseTo(4.0, 3);
  });
});

describe("demoSessions.listForSchool / listForCandidate", () => {
  it("returns demos ordered by scheduledAt asc", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, appId, principalId } = await setup(t);
    const t1 = Date.now() + 86400000;
    const t2 = Date.now() + 172800000;
    const d2 = await t.mutation("demoSessions:create" as any, {
      applicationId: appId, schoolId,
      scheduledAt: t2, durationMinutes: 30,
      mode: "live", format: "classroom",
      evaluators: [{ userId: principalId, role: "principal" }],
      createdBy: principalId,
    } as any);
    const d1 = await t.mutation("demoSessions:create" as any, {
      applicationId: appId, schoolId,
      scheduledAt: t1, durationMinutes: 30,
      mode: "post", format: "mock",
      evaluators: [{ userId: principalId, role: "principal" }],
      createdBy: principalId,
    } as any);
    const list = await t.query("demoSessions:listForSchool" as any, { schoolId } as any);
    expect(list.map((d: any) => d._id)).toEqual([d1, d2]);
  });
});
