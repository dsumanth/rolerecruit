import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as evaluations from "../../convex/evaluations";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "evaluations.ts": async () => evaluations,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

async function setupApp(t: ReturnType<typeof convexTest>) {
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
    qualifications: ["B.Ed"],
    subjects: ["Math"],
  });
  const appId = await t.mutation("applications:create", {
    candidateId,
    jobPostingId: jobId,
    schoolId,
  });
  return { schoolId, jobId, candidateId, appId };
}

describe("evaluations", () => {
  it("creates an evaluation with a token", async () => {
    const t = convexTest(schema, modules);
    const { appId } = await setupApp(t);

    const result = await t.mutation("evaluations:create", {
      applicationId: appId,
      evaluatorRole: "principal",
    });

    expect(result._id).toBeDefined();
    expect(result.token).toBeTruthy();
    expect(result.token.length).toBe(32);

    const evals = await t.query("evaluations:getByApplication", {
      applicationId: appId,
    });
    expect(evals).toHaveLength(1);
    expect(evals[0].evaluatorRole).toBe("principal");
    expect(evals[0].submitted).toBe(false);
    expect(evals[0].token).toBeTruthy();
    expect(evals[0].token.length).toBe(32);
  });

  it("submits feedback via token", async () => {
    const t = convexTest(schema, modules);
    const { appId } = await setupApp(t);

    const evalId = await t.mutation("evaluations:create", {
      applicationId: appId,
      evaluatorRole: "hod",
    });

    const evals = await t.query("evaluations:getByApplication", {
      applicationId: appId,
    });
    const token = evals[0].token;

    await t.mutation("evaluations:submitFeedback", {
      token,
      subjectKnowledge: 4,
      classroomManagement: 3,
      communication: 5,
      overallFit: 4,
      comments: "Strong candidate with good subject knowledge.",
      recommendation: "hire",
    });

    const updated = await t.query("evaluations:getByApplication", {
      applicationId: appId,
    });
    expect(updated[0].submitted).toBe(true);
    expect(updated[0].subjectKnowledge).toBe(4);
    expect(updated[0].classroomManagement).toBe(3);
    expect(updated[0].communication).toBe(5);
    expect(updated[0].overallFit).toBe(4);
    expect(updated[0].comments).toBe(
      "Strong candidate with good subject knowledge."
    );
    expect(updated[0].recommendation).toBe("hire");
    expect(updated[0].submittedAt).toBeDefined();
  });

  it("enforces single-use tokens", async () => {
    const t = convexTest(schema, modules);
    const { appId } = await setupApp(t);

    await t.mutation("evaluations:create", {
      applicationId: appId,
      evaluatorRole: "principal",
    });

    const evals = await t.query("evaluations:getByApplication", {
      applicationId: appId,
    });
    const token = evals[0].token;

    await t.mutation("evaluations:submitFeedback", {
      token,
      subjectKnowledge: 4,
      classroomManagement: 4,
      communication: 4,
      overallFit: 4,
      recommendation: "hire",
    });

    await expect(
      t.mutation("evaluations:submitFeedback", {
        token,
        subjectKnowledge: 1,
        classroomManagement: 1,
        communication: 1,
        overallFit: 1,
        recommendation: "reject",
      })
    ).rejects.toThrow();
  });

  it("rejects submission with invalid token", async () => {
    const t = convexTest(schema, modules);
    const { appId } = await setupApp(t);

    await expect(
      t.mutation("evaluations:submitFeedback", {
        token: "nonexistent_token_1234567890",
        subjectKnowledge: 4,
        classroomManagement: 4,
        communication: 4,
        overallFit: 4,
        recommendation: "hire",
      })
    ).rejects.toThrow();
  });

  it("lists multiple evaluations for an application", async () => {
    const t = convexTest(schema, modules);
    const { appId } = await setupApp(t);

    await t.mutation("evaluations:create", {
      applicationId: appId,
      evaluatorRole: "principal",
    });
    await t.mutation("evaluations:create", {
      applicationId: appId,
      evaluatorRole: "hod",
    });

    const evals = await t.query("evaluations:getByApplication", {
      applicationId: appId,
    });
    expect(evals).toHaveLength(2);
  });
});
