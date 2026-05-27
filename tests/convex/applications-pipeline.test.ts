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

describe("applications.getPipelineForJob — paginated", () => {
  it("returns paginated rows and excludes pending-delete", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "M", state: "MH",
    });
    const jobId = await t.mutation("jobs:create", {
      schoolId, title: "Math PGT", subject: "Math", level: "PGT",
      board: "CBSE", qualifications: [], minExperience: 0, positions: 1,
      naturalLanguageDescription: "x",
    });
    for (let i = 0; i < 3; i++) {
      const candId = await t.mutation("candidates:create", {
        name: `C${i}`, email: `c${i}@x.com`,
        qualifications: [], subjects: [],
      });
      await t.mutation("applications:create", {
        candidateId: candId, schoolId, jobPostingId: jobId, skipTriage: true,
      });
    }
    const result = await t.query("applications:getPipelineForJob", {
      jobId,
      paginationOpts: { cursor: null, numItems: 2 },
    });
    expect(result.page.length).toBe(2);
    expect(result.isDone).toBe(false);
  });

  it("excludes applications with pendingDeleteAt set", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S2", board: "CBSE", city: "M", state: "MH",
    });
    const jobId = await t.mutation("jobs:create", {
      schoolId, title: "Science PGT", subject: "Science", level: "PGT",
      board: "CBSE", qualifications: [], minExperience: 0, positions: 1,
      naturalLanguageDescription: "y",
    });
    const candId = await t.mutation("candidates:create", {
      name: "Del", email: "del@x.com",
      qualifications: [], subjects: [],
    });
    const appId = await t.mutation("applications:create", {
      candidateId: candId, schoolId, jobPostingId: jobId, skipTriage: true,
    });
    await t.run(async (ctx: any) => {
      await ctx.db.patch(appId, { pendingDeleteAt: Date.now(), pendingDeleteBatchId: "b" });
    });
    const result = await t.query("applications:getPipelineForJob", {
      jobId,
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(result.page.length).toBe(0);
  });

  it("returns one row per application (no dedup by candidateId)", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S3", board: "CBSE", city: "C", state: "MH",
    });
    const jobId = await t.mutation("jobs:create", {
      schoolId, title: "English PGT", subject: "English", level: "PGT",
      board: "CBSE", qualifications: [], minExperience: 0, positions: 2,
      naturalLanguageDescription: "z",
    });
    const candId = await t.mutation("candidates:create", {
      name: "Dup", email: "dup@x.com",
      qualifications: [], subjects: [],
    });
    // Same candidate, two applications to same job
    await t.mutation("applications:create", {
      candidateId: candId, schoolId, jobPostingId: jobId, skipTriage: true,
    });
    await t.mutation("applications:create", {
      candidateId: candId, schoolId, jobPostingId: jobId, skipTriage: true,
    });
    const result = await t.query("applications:getPipelineForJob", {
      jobId,
      paginationOpts: { cursor: null, numItems: 10 },
    });
    // Should see both applications, not deduped
    expect(result.page.length).toBe(2);
  });
});
