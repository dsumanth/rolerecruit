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

describe("applications.bulkSetStage", () => {
  it("updates stage and returns previousStages snapshot", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "M", state: "MH",
    });
    const c1 = await t.mutation("candidates:create", {
      name: "A", email: "a@x.com", qualifications: [], subjects: [],
    });
    const c2 = await t.mutation("candidates:create", {
      name: "B", email: "b@x.com", qualifications: [], subjects: [],
    });
    // applications:create seeds stage from pipelineConfig (defaults to "sourced")
    const a1 = await t.mutation("applications:create", {
      candidateId: c1, schoolId, skipTriage: true,
    });
    const a2 = await t.mutation("applications:create", {
      candidateId: c2, schoolId, skipTriage: true,
    });

    // Force distinct stages so we can verify per-id snapshot
    await t.run(async (ctx: any) => {
      await ctx.db.patch(a1, { stage: "sourced" });
      await ctx.db.patch(a2, { stage: "screened" });
    });

    const r = await t.mutation("applications:bulkSetStage", { ids: [a1, a2], stage: "demo_scheduled" });

    expect(r.previousStages.find((p: any) => p.id === a1)?.previousStage).toBe("sourced");
    expect(r.previousStages.find((p: any) => p.id === a2)?.previousStage).toBe("screened");
    expect(typeof r.batchId).toBe("string");

    const a1After = await t.run(async (ctx: any) => ctx.db.get(a1));
    const a2After = await t.run(async (ctx: any) => ctx.db.get(a2));
    expect(a1After.stage).toBe("demo_scheduled");
    expect(a2After.stage).toBe("demo_scheduled");
  });

  it("matchAll by jobId updates all apps for that job", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S2", board: "CBSE", city: "M", state: "MH",
    });
    const jobId = await t.mutation("jobs:create", {
      schoolId, title: "Math PGT", subject: "Math", level: "PGT",
      board: "CBSE", qualifications: [], minExperience: 0, positions: 2,
      naturalLanguageDescription: "x",
    });
    const ids: any[] = [];
    for (let i = 0; i < 3; i++) {
      const cId = await t.mutation("candidates:create", {
        name: `C${i}`, email: `c${i}@x.com`, qualifications: [], subjects: [],
      });
      const aId = await t.mutation("applications:create", {
        candidateId: cId, schoolId, jobPostingId: jobId, skipTriage: true,
      });
      ids.push(aId);
    }

    const r = await t.mutation("applications:bulkSetStage", {
      matchAll: { jobId },
      stage: "screened",
    });

    expect(r.previousStages.length).toBe(3);
    for (const id of ids) {
      const doc = await t.run(async (ctx: any) => ctx.db.get(id));
      expect(doc.stage).toBe("screened");
    }
  });

  it("skips applications with pendingDeleteAt set when using matchAll", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S3", board: "CBSE", city: "M", state: "MH",
    });
    const jobId = await t.mutation("jobs:create", {
      schoolId, title: "Science PGT", subject: "Science", level: "PGT",
      board: "CBSE", qualifications: [], minExperience: 0, positions: 1,
      naturalLanguageDescription: "y",
    });
    const cId = await t.mutation("candidates:create", {
      name: "D", email: "d@x.com", qualifications: [], subjects: [],
    });
    const aId = await t.mutation("applications:create", {
      candidateId: cId, schoolId, jobPostingId: jobId, skipTriage: true,
    });
    await t.run(async (ctx: any) => {
      await ctx.db.patch(aId, { pendingDeleteAt: Date.now(), pendingDeleteBatchId: "b" });
    });

    const r = await t.mutation("applications:bulkSetStage", {
      matchAll: { jobId },
      stage: "screened",
    });
    expect(r.previousStages.length).toBe(0);
  });
});
