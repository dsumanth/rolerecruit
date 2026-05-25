import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as dashboard from "../../convex/dashboard";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "dashboard.ts": async () => dashboard,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("dashboard", () => {
  it("returns zero stats for empty school", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test School",
      board: "CBSE",
      city: "Test",
      state: "Test",
    });

    const stats = await t.query("dashboard:getStats", { schoolId });
    expect(stats.openPositions).toBe(0);
    expect(stats.totalCandidates).toBe(0);
    expect(stats.hiredThisMonth).toBe(0);
  });

  it("counts open positions correctly", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test School",
      board: "CBSE",
      city: "Test",
      state: "Test",
    });

    const job1 = await t.mutation("jobs:create", {
      schoolId,
      title: "Active Job",
      subject: "Math",
      level: "TGT",
      board: "CBSE",
      qualifications: ["B.Ed"],
      naturalLanguageDescription: "desc",
    });
    await t.mutation("jobs:publish", { jobId: job1 });

    await t.mutation("jobs:create", {
      schoolId,
      title: "Draft Job",
      subject: "Science",
      level: "PGT",
      board: "CBSE",
      qualifications: ["B.Ed"],
      naturalLanguageDescription: "desc",
    });

    const stats = await t.query("dashboard:getStats", { schoolId });
    expect(stats.openPositions).toBe(1);
  });

  it("tracks hired candidates", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test School",
      board: "CBSE",
      city: "Test",
      state: "Test",
    });
    const jobId = await t.mutation("jobs:create", {
      schoolId,
      title: "Math TGT",
      subject: "Math",
      level: "TGT",
      board: "CBSE",
      qualifications: ["B.Ed"],
      naturalLanguageDescription: "desc",
    });
    await t.mutation("jobs:publish", { jobId });

    const candidateId = await t.mutation("candidates:create", {
      name: "Hired Candidate",
      qualifications: ["B.Ed"],
      subjects: ["Math"],
    });

    const appId = await t.mutation("applications:create", {
      candidateId,
      jobPostingId: jobId,
      schoolId,
    });

    await t.mutation("applications:moveStage", {
      applicationId: appId,
      newStage: "screened",
    });
    await t.mutation("applications:moveStage", {
      applicationId: appId,
      newStage: "demo_scheduled",
    });
    await t.mutation("applications:moveStage", {
      applicationId: appId,
      newStage: "demo_completed",
    });
    await t.mutation("applications:moveStage", {
      applicationId: appId,
      newStage: "offer_sent",
    });
    await t.mutation("applications:moveStage", {
      applicationId: appId,
      newStage: "hired",
    });

    const stats = await t.query("dashboard:getStats", { schoolId });
    expect(stats.hiredThisMonth).toBe(1);
  });
});
