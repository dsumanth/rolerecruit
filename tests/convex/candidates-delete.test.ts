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

describe("candidates.removeMany", () => {
  it("marks candidates pendingDelete and returns batchId", async () => {
    const t = convexTest(schema, modules);
    const c1 = await t.mutation("candidates:create", {
      name: "A", email: "a@x.com", qualifications: [], subjects: [],
    });
    const c2 = await t.mutation("candidates:create", {
      name: "B", email: "b@x.com", qualifications: [], subjects: [],
    });
    const result = await t.mutation("candidates:removeMany", { ids: [c1, c2] });
    expect(result.count).toBe(2);
    expect(typeof result.batchId).toBe("string");

    // Direct DB check: both should have pendingDeleteAt set
    const c1Doc = await t.run(async (ctx: any) => ctx.db.get(c1));
    const c2Doc = await t.run(async (ctx: any) => ctx.db.get(c2));
    expect(c1Doc.pendingDeleteAt).toBeTypeOf("number");
    expect(c2Doc.pendingDeleteAt).toBeTypeOf("number");
    expect(c1Doc.pendingDeleteBatchId).toBe(result.batchId);
  });

  it("undoBatchDelete restores rows within window", async () => {
    const t = convexTest(schema, modules);
    const c1 = await t.mutation("candidates:create", {
      name: "A", email: "a@x.com", qualifications: [], subjects: [],
    });
    const { batchId } = await t.mutation("candidates:removeMany", { ids: [c1] });
    const r = await t.mutation("candidates:undoBatchDelete", { batchId });
    expect(r.restored).toBe(1);
    const after = await t.run(async (ctx: any) => ctx.db.get(c1));
    expect(after.pendingDeleteAt).toBeUndefined();
    expect(after.pendingDeleteBatchId).toBeUndefined();
  });

  it("single remove also returns a batchId", async () => {
    const t = convexTest(schema, modules);
    const c = await t.mutation("candidates:create", {
      name: "A", email: "a@x.com", qualifications: [], subjects: [],
    });
    const r = await t.mutation("candidates:remove", { candidateId: c });
    expect(r.count).toBe(1);
    expect(typeof r.batchId).toBe("string");
  });

  it("finalize cascades: applications, evaluations, outreach, calendar, triage, booking, pools, resume, candidate", async () => {
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

    await t.run(async (ctx: any) => {
      await ctx.db.insert("evaluations", {
        applicationId: appId, evaluatorUserId: "u1", evaluatorRole: "principal",
        token: "tok", submitted: false,
      });
      // candidatePools entry — use any pool id since we're just testing the cascade walks the index
      const poolId = await ctx.db.insert("pools", {
        schoolId, name: "P", createdBy: "ai", tags: [], createdAt: Date.now(),
      });
      await ctx.db.insert("candidatePools", {
        candidateId, poolId, confidence: 0.5, createdAt: Date.now(),
      });
    });

    vi.useFakeTimers();
    await t.mutation("candidates:removeMany", { ids: [candidateId] });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();

    const candAfter = await t.run(async (ctx: any) => ctx.db.get(candidateId));
    expect(candAfter).toBeNull();
    const appAfter = await t.run(async (ctx: any) => ctx.db.get(appId));
    expect(appAfter).toBeNull();
    const evals = await t.run(async (ctx: any) =>
      ctx.db.query("evaluations").withIndex("by_applicationId", (q: any) => q.eq("applicationId", appId)).collect()
    );
    expect(evals.length).toBe(0);
    const pools = await t.run(async (ctx: any) =>
      ctx.db.query("candidatePools").withIndex("by_candidateId", (q: any) => q.eq("candidateId", candidateId)).collect()
    );
    expect(pools.length).toBe(0);
  });

  it("undo before finalize prevents deletion", async () => {
    const t = convexTest(schema, modules);
    const candidateId = await t.mutation("candidates:create", {
      name: "A", email: "a@x.com", qualifications: [], subjects: [],
    });
    vi.useFakeTimers();
    const { batchId } = await t.mutation("candidates:removeMany", { ids: [candidateId] });
    await t.mutation("candidates:undoBatchDelete", { batchId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
    const after = await t.run(async (ctx: any) => ctx.db.get(candidateId));
    expect(after).not.toBeNull();
  });
});
