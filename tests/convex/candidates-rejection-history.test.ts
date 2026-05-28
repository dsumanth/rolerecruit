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

describe("candidates.getRejectionHistory", () => {
  it("returns prior rejections excluding the current application", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "M", state: "MH",
    });
    const candidateId = await t.mutation("candidates:create", {
      name: "A", email: "a@x.com", qualifications: [], subjects: [],
    });
    const job1 = await t.mutation("jobs:create", {
      schoolId, title: "Math PGT", subject: "Math", level: "PGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
    const job2 = await t.mutation("jobs:create", {
      schoolId, title: "Math TGT", subject: "Math", level: "TGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
    const app1 = await t.mutation("applications:create", {
      candidateId, schoolId, jobPostingId: job1, stage: "rejected",
    });
    const app2 = await t.mutation("applications:create", {
      candidateId, schoolId, jobPostingId: job2, stage: "applied",
    });

    const history = await t.query("candidates:getRejectionHistory", {
      candidateId, excludeApplicationId: app2,
    });
    expect(history.length).toBe(1);
    expect(history[0].applicationId).toBe(app1);
    expect(history[0].jobTitle).toBe("Math PGT");
  });
});
