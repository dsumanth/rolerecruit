import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("jobs", () => {
  it("creates a job posting as draft", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test School",
      board: "CBSE",
      city: "Hyderabad",
      state: "Telangana",
    });

    const jobId = await t.mutation("jobs:create", {
      schoolId,
      title: "Physics PGT Teacher",
      subject: "Physics",
      level: "PGT",
      board: "CBSE",
      qualifications: ["B.Ed", "M.Sc Physics"],
      minExperience: 3,
      maxExperience: 10,
      salaryRange: "₹6-8 LPA",
      naturalLanguageDescription:
        "We need a Physics teacher for Classes 11 and 12. Must have B.Ed and at least 3 years of teaching experience in a CBSE school. CTET qualified preferred.",
    });

    const job = await t.query("jobs:get", { jobId });
    expect(job).not.toBeNull();
    expect(job!.status).toBe("draft");
    expect(job!.title).toBe("Physics PGT Teacher");
  });

  it("lists jobs for a school", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test School",
      board: "CBSE",
      city: "Mumbai",
      state: "Maharashtra",
    });

    await t.mutation("jobs:create", {
      schoolId,
      title: "Math TGT",
      subject: "Mathematics",
      level: "TGT",
      board: "CBSE",
      qualifications: ["B.Ed", "B.Sc Mathematics"],
      naturalLanguageDescription: "Math teacher needed",
    });

    const jobs_ = await t.query("jobs:listBySchool", { schoolId });
    expect(jobs_).toHaveLength(1);
    expect(jobs_[0].title).toBe("Math TGT");
  });

  it("publishes a job", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test School",
      board: "ICSE",
      city: "Delhi",
      state: "Delhi",
    });

    const jobId = await t.mutation("jobs:create", {
      schoolId,
      title: "English PGT",
      subject: "English",
      level: "PGT",
      board: "ICSE",
      qualifications: ["B.Ed", "MA English"],
      naturalLanguageDescription: "English teacher needed",
    });

    await t.mutation("jobs:publish", { jobId });

    const job = await t.query("jobs:get", { jobId });
    expect(job!.status).toBe("active");
  });

  it("closes a filled job", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test School",
      board: "CBSE",
      city: "Test",
      state: "Test",
    });

    const jobId = await t.mutation("jobs:create", {
      schoolId,
      title: "History TGT",
      subject: "History",
      level: "TGT",
      board: "CBSE",
      qualifications: ["B.Ed"],
      naturalLanguageDescription: "History teacher",
    });

    await t.mutation("jobs:close", { jobId, reason: "filled" });
    const job = await t.query("jobs:get", { jobId });
    expect(job!.status).toBe("filled");
  });

  it("filters jobs by status", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test School",
      board: "CBSE",
      city: "Test",
      state: "Test",
    });

    const jobId1 = await t.mutation("jobs:create", {
      schoolId,
      title: "Active Job",
      subject: "Math",
      level: "TGT",
      board: "CBSE",
      qualifications: ["B.Ed"],
      naturalLanguageDescription: "desc",
    });

    await t.mutation("jobs:create", {
      schoolId,
      title: "Draft Job",
      subject: "Science",
      level: "PGT",
      board: "CBSE",
      qualifications: ["B.Ed"],
      naturalLanguageDescription: "desc",
    });

    await t.mutation("jobs:publish", { jobId: jobId1 });

    const activeJobs = await t.query("jobs:listBySchool", {
      schoolId,
      status: "active",
    });
    expect(activeJobs).toHaveLength(1);
    expect(activeJobs[0].title).toBe("Active Job");
  });

  it("deletes a draft", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test", board: "CBSE", city: "X", state: "Y",
    });

    const jobId = await t.mutation("jobs:create", {
      schoolId,
      title: "Draft to delete",
      subject: "Math",
      level: "TGT",
      board: "CBSE",
      qualifications: [],
      naturalLanguageDescription: "desc",
    });

    await t.mutation("jobs:deleteDraft", { jobId });
    const after = await t.query("jobs:get", { jobId });
    expect(after).toBeNull();
  });

  it("refuses to delete a non-draft job", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test", board: "CBSE", city: "X", state: "Y",
    });

    const jobId = await t.mutation("jobs:create", {
      schoolId,
      title: "Published",
      subject: "Math",
      level: "TGT",
      board: "CBSE",
      qualifications: [],
      naturalLanguageDescription: "desc",
    });
    await t.mutation("jobs:publish", { jobId });

    await expect(
      t.mutation("jobs:deleteDraft", { jobId })
    ).rejects.toThrow(/Only draft roles/);
  });

  it("updateJob patches multiple fields including description and qualifications", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test", board: "CBSE", city: "X", state: "Y",
    });

    const jobId = await t.mutation("jobs:create", {
      schoolId,
      title: "Original",
      subject: "Math",
      level: "TGT",
      board: "CBSE",
      qualifications: ["B.Ed"],
      naturalLanguageDescription: "Old description",
    });

    await t.mutation("jobs:updateJob", {
      jobId,
      title: "New title",
      subject: "Physics",
      level: "PGT",
      naturalLanguageDescription: "New description",
      qualifications: ["B.Ed", "M.Sc"],
    });

    const job = await t.query("jobs:get", { jobId });
    expect(job!.title).toBe("New title");
    expect(job!.subject).toBe("Physics");
    expect(job!.level).toBe("PGT");
    expect(job!.naturalLanguageDescription).toBe("New description");
    expect(job!.qualifications).toEqual(["B.Ed", "M.Sc"]);
  });
});
