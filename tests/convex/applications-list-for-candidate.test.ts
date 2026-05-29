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

import { api } from "../../convex/_generated/api";

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

async function seedSchool(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("schools", {
      name: "S",
      board: "CBSE",
      city: "Mumbai",
      state: "MH",
      planTier: "free",
    } as any),
  );
}

async function seedCandidate(t: ReturnType<typeof convexTest>, name: string) {
  return await t.run(async (ctx) =>
    ctx.db.insert("candidates", {
      name,
      qualifications: ["B.Ed"],
      certifications: [],
      boardExperience: [],
      subjects: ["Math"],
      talentBankFlag: false,
    } as any),
  );
}

describe("applications.listForCandidate", () => {
  it("returns an empty array when the candidate has no applications", async () => {
    const t = convexTest(schema, modules);
    const candidateId = await seedCandidate(t, "Solo");
    const out = await t.query(api.applications.listForCandidate, { candidateId });
    expect(out).toEqual([]);
  });

  it("returns only the applications that belong to the given candidate", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await seedSchool(t);
    const targetCandidate = await seedCandidate(t, "Target");
    const otherCandidate = await seedCandidate(t, "Other");

    const targetApp1 = await t.run(async (ctx) =>
      ctx.db.insert("applications", {
        candidateId: targetCandidate,
        schoolId,
        stage: "sourced",
        createdAt: Date.now(),
      } as any),
    );
    const targetApp2 = await t.run(async (ctx) =>
      ctx.db.insert("applications", {
        candidateId: targetCandidate,
        schoolId,
        stage: "demo_scheduled",
        createdAt: Date.now(),
      } as any),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("applications", {
        candidateId: otherCandidate,
        schoolId,
        stage: "sourced",
        createdAt: Date.now(),
      } as any),
    );

    const out = await t.query(api.applications.listForCandidate, {
      candidateId: targetCandidate,
    });
    const ids = out.map((a: any) => a._id).sort();
    expect(ids).toEqual([targetApp1, targetApp2].sort());
  });
});
