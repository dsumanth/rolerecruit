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

describe("jobs.saveCriteriaText", () => {
  it("updates the criteria field", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
    const jobId = await t.mutation("jobs:create", {
      schoolId, title: "T", subject: "M", level: "PGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
    await t.mutation("jobs:saveCriteriaText", { jobId, text: "Must have 5+ years" });
    const after = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(after.criteria).toBe("Must have 5+ years");
  });
});
