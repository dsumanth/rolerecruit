import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("applications", () => {
  it("creates an application with sourced stage", async () => {
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
    const candidateId = await t.mutation("candidates:create", {
      name: "Rajesh Kumar",
      qualifications: ["B.Ed", "M.Sc"],
      subjects: ["Mathematics"],
    });

    const appId = await t.mutation("applications:create", {
      candidateId,
      jobPostingId: jobId,
      schoolId,
      aiMatchScore: 85,
    });

    const app = await t.query("applications:get", { applicationId: appId });
    expect(app).not.toBeNull();
    expect(app!.stage).toBe("sourced");
    expect(app!.aiMatchScore).toBe(85);
  });

  it("moves application through valid stage transitions", async () => {
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
    const candidateId = await t.mutation("candidates:create", {
      name: "Priya",
      qualifications: ["B.Ed"],
      subjects: ["English"],
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

    let app = await t.query("applications:get", { applicationId: appId });
    expect(app!.stage).toBe("screened");

    await t.mutation("applications:moveStage", {
      applicationId: appId,
      newStage: "demo_scheduled",
    });

    app = await t.query("applications:get", { applicationId: appId });
    expect(app!.stage).toBe("demo_scheduled");
  });

  it("rejects invalid stage transitions", async () => {
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
    const candidateId = await t.mutation("candidates:create", {
      name: "Test Candidate",
      qualifications: ["B.Ed"],
      subjects: ["Math"],
    });

    const appId = await t.mutation("applications:create", {
      candidateId,
      jobPostingId: jobId,
      schoolId,
    });

    await expect(
      t.mutation("applications:moveStage", {
        applicationId: appId,
        newStage: "demo_scheduled",
      })
    ).rejects.toThrow();
  });

  it("rejects transition from hired", async () => {
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
    const candidateId = await t.mutation("candidates:create", {
      name: "Test Candidate",
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

    await expect(
      t.mutation("applications:moveStage", {
        applicationId: appId,
        newStage: "rejected",
      })
    ).rejects.toThrow();
  });

  it("gets pipeline for a job grouped by stage", async () => {
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

    const candidate1 = await t.mutation("candidates:create", {
      name: "Candidate 1",
      qualifications: ["B.Ed"],
      subjects: ["Math"],
    });
    const candidate2 = await t.mutation("candidates:create", {
      name: "Candidate 2",
      qualifications: ["B.Ed"],
      subjects: ["Math"],
    });

    const app1 = await t.mutation("applications:create", {
      candidateId: candidate1,
      jobPostingId: jobId,
      schoolId,
    });
    const app2 = await t.mutation("applications:create", {
      candidateId: candidate2,
      jobPostingId: jobId,
      schoolId,
    });

    await t.mutation("applications:moveStage", {
      applicationId: app1,
      newStage: "screened",
    });

    const pipeline = await t.query("applications:getPipelineForJob", { jobId });
    expect(pipeline.sourced).toHaveLength(1);
    expect(pipeline.screened).toHaveLength(1);
  });
});
