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

describe("jobs.bulkSetStatus", () => {
  it("updates status and returns previousStatuses", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
    const j1 = await t.mutation("jobs:create", {
      schoolId, title: "T1", subject: "M", level: "PGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
    await t.mutation("jobs:publish", { jobId: j1 });
    const r = await t.mutation("jobs:bulkSetStatus", { ids: [j1], status: "paused" });
    expect(r.previousStatuses.find((p: any) => p.id === j1)?.previousStatus).toBe("active");
    const after = await t.run(async (ctx: any) => ctx.db.get(j1));
    expect(after.status).toBe("paused");
  });

  it("bulk updates multiple jobs", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S2", board: "CBSE", city: "M", state: "MH" });
    const j1 = await t.mutation("jobs:create", {
      schoolId, title: "T1", subject: "Math", level: "PGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
    const j2 = await t.mutation("jobs:create", {
      schoolId, title: "T2", subject: "Sci", level: "TGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "y",
    });
    await t.mutation("jobs:publish", { jobId: j1 });
    await t.mutation("jobs:publish", { jobId: j2 });
    const r = await t.mutation("jobs:bulkSetStatus", { ids: [j1, j2], status: "closed" });
    expect(r.previousStatuses.length).toBe(2);
    const j1After = await t.run(async (ctx: any) => ctx.db.get(j1));
    const j2After = await t.run(async (ctx: any) => ctx.db.get(j2));
    expect(j1After.status).toBe("closed");
    expect(j2After.status).toBe("closed");
  });
});
