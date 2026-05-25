import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as sourcing from "../../convex/sourcing";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "sourcing.ts": async () => sourcing,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("sourcing runs", () => {
  it("creates a sourcing run in pending state", async () => {
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

    const runId = await t.mutation("sourcing:startRun", { jobId, schoolId });
    expect(runId).toBeDefined();

    const runs = await t.query("sourcing:getRunsForJob", { jobId });
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("pending");
    expect(runs[0].candidatesFound).toBeUndefined();
  });

  it("transitions run to running state", async () => {
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

    const runId = await t.mutation("sourcing:startRun", { jobId, schoolId });
    await t.mutation("sourcing:markRunning", {
      runId,
      apifyRunId: "apify_run_123",
    });

    const runs = await t.query("sourcing:getRunsForJob", { jobId });
    expect(runs[0].status).toBe("running");
    expect(runs[0].apifyRunId).toBe("apify_run_123");
  });

  it("completes a sourcing run with candidate count", async () => {
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

    const runId = await t.mutation("sourcing:startRun", { jobId, schoolId });
    await t.mutation("sourcing:markRunning", {
      runId,
      apifyRunId: "apify_run_456",
    });
    await t.mutation("sourcing:markCompleted", {
      runId,
      candidatesFound: 42,
      candidatesScored: 35,
    });

    const runs = await t.query("sourcing:getRunsForJob", { jobId });
    expect(runs[0].status).toBe("completed");
    expect(runs[0].candidatesFound).toBe(42);
    expect(runs[0].candidatesScored).toBe(35);
  });

  it("marks sourcing run as failed", async () => {
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

    const runId = await t.mutation("sourcing:startRun", { jobId, schoolId });
    await t.mutation("sourcing:markFailed", {
      runId,
      error: "Apify actor timeout",
    });

    const runs = await t.query("sourcing:getRunsForJob", { jobId });
    expect(runs[0].status).toBe("failed");
    expect(runs[0].error).toBe("Apify actor timeout");
  });
});
