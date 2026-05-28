import { describe, it, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as users from "../../convex/users";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as jobs from "../../convex/jobs";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "users.ts": async () => users,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "jobs.ts": async () => jobs,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("applications.removeManyApplications", () => {
  it("marks pending, finalize deletes app + children, candidate untouched", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "M", state: "MH",
    });
    const candidateId = await t.mutation("candidates:create", {
      name: "A", email: "a@x.com", qualifications: [], subjects: [],
    });
    const appId = await t.mutation("applications:create", {
      candidateId, schoolId, skipTriage: true,
    });
    // Seed a demo + invite + evaluation through the new chain so the cascade
    // has something to walk.
    const { demoId, inviteId, evalId } = await t.run(async (ctx: any) => {
      const tplId = await ctx.db.insert("formTemplates", {
        schoolId, role: "principal", name: "P", fields: [],
        isActive: true, createdAt: Date.now(), updatedAt: Date.now(),
      });
      const userId = await ctx.db.insert("userProfiles", {
        userId: "u-cascade", name: "P", email: "p@x.com", schoolId, role: "principal",
      });
      const demoId = await ctx.db.insert("demoSessions", {
        applicationId: appId, schoolId,
        scheduledAt: Date.now() + 86400000, durationMinutes: 30,
        mode: "live", format: "classroom", status: "scheduled",
        createdBy: userId, createdAt: Date.now(),
      });
      const inviteId = await ctx.db.insert("evaluationInvites", {
        demoSessionId: demoId, evaluatorUserId: userId, evaluatorRole: "principal",
        formTemplateId: tplId, status: "invited", token: "t-cascade", invitedAt: Date.now(),
      });
      const evalId = await ctx.db.insert("evaluations", {
        inviteId, formTemplateId: tplId, responses: {},
        submittedAt: Date.now(), submittedFromPlatform: "web",
      });
      return { demoId, inviteId, evalId };
    });

    const { batchId, count } = await t.mutation("applications:removeManyApplications", { ids: [appId] });
    expect(count).toBe(1);
    expect(typeof batchId).toBe("string");

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const appAfter = await t.run(async (ctx: any) => ctx.db.get(appId));
    expect(appAfter).toBeNull();
    // Cascade walks demos -> invites -> evaluations.
    const demoAfter = await t.run(async (ctx: any) => ctx.db.get(demoId));
    const inviteAfter = await t.run(async (ctx: any) => ctx.db.get(inviteId));
    const evalAfter = await t.run(async (ctx: any) => ctx.db.get(evalId));
    expect(demoAfter).toBeNull();
    expect(inviteAfter).toBeNull();
    expect(evalAfter).toBeNull();
    const candAfter = await t.run(async (ctx: any) => ctx.db.get(candidateId));
    expect(candAfter).not.toBeNull();
    vi.useRealTimers();
  });

  it("undo restores applications before finalize", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "M", state: "MH",
    });
    const cId = await t.mutation("candidates:create", {
      name: "A", email: "a@x.com", qualifications: [], subjects: [],
    });
    const appId = await t.mutation("applications:create", { candidateId: cId, schoolId, skipTriage: true });
    const { batchId } = await t.mutation("applications:removeManyApplications", { ids: [appId] });
    const r = await t.mutation("applications:undoBatchDelete", { batchId });
    expect(r.restored).toBe(1);
    const after = await t.run(async (ctx: any) => ctx.db.get(appId));
    expect(after.pendingDeleteAt).toBeUndefined();
    expect(after.pendingDeleteBatchId).toBeUndefined();
  });

  it("undo before finalize prevents deletion", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S2", board: "CBSE", city: "M", state: "MH",
    });
    const cId = await t.mutation("candidates:create", {
      name: "B", email: "b@x.com", qualifications: [], subjects: [],
    });
    const appId = await t.mutation("applications:create", { candidateId: cId, schoolId, skipTriage: true });
    vi.useFakeTimers();
    const { batchId } = await t.mutation("applications:removeManyApplications", { ids: [appId] });
    await t.mutation("applications:undoBatchDelete", { batchId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
    const after = await t.run(async (ctx: any) => ctx.db.get(appId));
    expect(after).not.toBeNull();
  });
});
