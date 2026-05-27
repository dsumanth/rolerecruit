import { describe, it, expect } from "vitest";
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

describe("candidates.listForSchool — paginated", () => {
  it("returns a page + isDone + continueCursor", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "M", state: "MH",
    });
    for (let i = 0; i < 3; i++) {
      const candidateId = await t.mutation("candidates:create", {
        name: `Cand ${i}`, email: `c${i}@x.com`,
        qualifications: [], subjects: [],
      });
      await t.mutation("applications:create", {
        candidateId, schoolId, skipTriage: true,
      });
    }
    const result = await t.query("candidates:listForSchool", {
      schoolId,
      paginationOpts: { cursor: null, numItems: 2 },
    });
    expect(result.page.length).toBe(2);
    expect(result.isDone).toBe(false);
    expect(typeof result.continueCursor).toBe("string");
  });

  it("excludes rows with pendingDeleteAt set", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S2", board: "CBSE", city: "M", state: "MH",
    });
    const candidateId = await t.mutation("candidates:create", {
      name: "Cand", email: "c@x.com",
      qualifications: [], subjects: [],
    });
    const appId = await t.mutation("applications:create", {
      candidateId, schoolId, skipTriage: true,
    });
    await t.run(async (ctx: any) => {
      await ctx.db.patch(appId, { pendingDeleteAt: Date.now(), pendingDeleteBatchId: "b" });
    });
    const result = await t.query("candidates:listForSchool", {
      schoolId,
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(result.page.length).toBe(0);
  });

  it("deduplicates candidates with multiple applications", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "M", state: "MH",
    });
    const candidateId = await t.mutation("candidates:create", {
      name: "Dup", email: "dup@x.com",
      qualifications: [], subjects: [],
    });
    // Same candidate, two applications to the same school
    await t.mutation("applications:create", { candidateId, schoolId, skipTriage: true });
    await t.mutation("applications:create", { candidateId, schoolId, skipTriage: true });

    const result = await t.query("candidates:listForSchool", {
      schoolId,
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(result.page.length).toBe(1);
    expect(result.page[0].candidateId).toBe(candidateId);
  });

  it("countForSchool returns total matching", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "M", state: "MH",
    });
    for (let i = 0; i < 5; i++) {
      const candidateId = await t.mutation("candidates:create", {
        name: `Cand ${i}`, email: `c${i}@x.com`,
        qualifications: [], subjects: [],
      });
      await t.mutation("applications:create", { candidateId, schoolId, skipTriage: true });
    }
    const total = await t.query("candidates:countForSchool", { schoolId });
    expect(total.total).toBe(5);
  });
});
