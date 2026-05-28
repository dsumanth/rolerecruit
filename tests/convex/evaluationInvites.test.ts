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
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

async function makeDemo(t: ReturnType<typeof convexTest>) {
  const schoolId = await t.mutation("schools:create" as any, { name: "S", board: "CBSE", city: "X", state: "Y" } as any);
  const candidateId = await t.mutation("candidates:create" as any, { name: "P", qualifications: ["B.Ed"], subjects: ["Maths"] } as any);
  const jobId = await t.mutation("jobs:create" as any, { schoolId, title: "T", subject: "Maths", level: "TGT", board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "x" } as any);
  const appId = await t.mutation("applications:create" as any, { candidateId, jobPostingId: jobId, schoolId } as any);
  const principalId = await t.mutation("users:createProfile" as any, { userId: "u1", name: "P", email: "p@s.com", schoolId, role: "principal" } as any);
  const teacherId = await t.mutation("users:createProfile" as any, { userId: "u2", name: "T", email: "t@s.com", schoolId, role: "teacher" } as any);
  const demoId = await t.mutation("demoSessions:create" as any, {
    applicationId: appId, schoolId,
    scheduledAt: Date.now() + 86400000, durationMinutes: 30,
    mode: "live", format: "classroom",
    evaluators: [
      { userId: principalId, role: "principal" },
      { userId: teacherId, role: "teacher" },
    ],
    createdBy: principalId,
  } as any);
  return { schoolId, demoId, principalId, teacherId };
}

describe("evaluationInvites lifecycle", () => {
  it("markViewed sets status=viewed and viewedAt", async () => {
    const t = convexTest(schema, modules);
    const { demoId } = await makeDemo(t);
    const all = await t.query("evaluationInvites:listForDemo" as any, { demoId } as any);
    const target = all[0]._id;
    await t.mutation("evaluationInvites:markViewed" as any, { inviteId: target } as any);
    const updated = await t.query("evaluationInvites:listForDemo" as any, { demoId } as any);
    const me = updated.find((i: any) => i._id === target)!;
    expect(me.status).toBe("viewed");
    expect(me.viewedAt).toBeGreaterThan(0);
  });

  it("decline sets status=declined with reason and timestamp", async () => {
    const t = convexTest(schema, modules);
    const { demoId } = await makeDemo(t);
    const all = await t.query("evaluationInvites:listForDemo" as any, { demoId } as any);
    const target = all[0]._id;
    await t.mutation("evaluationInvites:decline" as any, { inviteId: target, reason: "On leave" } as any);
    const updated = await t.query("evaluationInvites:listForDemo" as any, { demoId } as any);
    const me = updated.find((i: any) => i._id === target)!;
    expect(me.status).toBe("declined");
    expect(me.declineReason).toBe("On leave");
    expect(me.declinedAt).toBeGreaterThan(0);
  });

  it("getByToken returns the invite + demo for valid token, null for invalid", async () => {
    const t = convexTest(schema, modules);
    const { demoId } = await makeDemo(t);
    const all = await t.query("evaluationInvites:listForDemo" as any, { demoId } as any);
    const tok = all[0].token;
    const found = await t.query("evaluationInvites:getByToken" as any, { token: tok } as any);
    expect(found.invite._id).toBe(all[0]._id);
    expect(found.demo._id).toBe(demoId);
    const missing = await t.query("evaluationInvites:getByToken" as any, { token: "bogus" } as any);
    expect(missing).toBeNull();
  });

  it("listForUser returns pending invites with demo metadata", async () => {
    const t = convexTest(schema, modules);
    const { teacherId, demoId } = await makeDemo(t);
    const list = await t.query("evaluationInvites:listForUser" as any, {
      userId: teacherId, statusFilter: ["invited", "viewed", "in_progress"],
    } as any);
    expect(list).toHaveLength(1);
    expect(list[0].invite.demoSessionId).toBe(demoId);
    expect(list[0].demo).toBeDefined();
  });

  it("swap cancels old invite, creates new one, links via replacedBy", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, demoId, teacherId } = await makeDemo(t);
    const replacementId = await t.mutation("users:createProfile" as any, {
      userId: "u3", name: "Sub", email: "sub@s.com", schoolId, role: "teacher",
    } as any);
    const all = await t.query("evaluationInvites:listForDemo" as any, { demoId } as any);
    const teacherInvite = all.find((i: any) => i.evaluatorUserId === teacherId)!;
    const newInviteId = await t.mutation("evaluationInvites:swap" as any, {
      inviteId: teacherInvite._id,
      newEvaluatorUserId: replacementId,
    } as any);
    const after = await t.query("evaluationInvites:listForDemo" as any, { demoId } as any);
    const oldInv = after.find((i: any) => i._id === teacherInvite._id)!;
    const newInv = after.find((i: any) => i._id === newInviteId)!;
    expect(oldInv.status).toBe("cancelled");
    expect(oldInv.replacedBy).toBe(newInviteId);
    expect(newInv.status).toBe("invited");
    expect(newInv.evaluatorUserId).toBe(replacementId);
    expect(newInv.evaluatorRole).toBe("teacher");
  });
});
