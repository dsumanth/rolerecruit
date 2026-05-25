import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as pools from "../../convex/pools";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "pools.ts": async () => pools,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

async function setupSchool(t: any) {
  return await t.mutation("schools:create", {
    name: "Test School",
    board: "CBSE",
    city: "Test City",
    state: "Test State",
  });
}

describe("candidates", () => {
  it("creates a candidate with qualifications", async () => {
    const t = convexTest(schema, modules);

    const id = await t.mutation("candidates:create", {
      name: "Priya Sharma",
      phone: "+919876543210",
      email: "priya@email.com",
      location: "Hyderabad",
      qualifications: ["B.Ed", "M.Sc Physics"],
      certifications: ["CTET"],
      boardExperience: ["CBSE"],
      subjects: ["Physics"],
      yearsExperience: 5,
    });

    const candidate = await t.query("candidates:get", { candidateId: id });
    expect(candidate).not.toBeNull();
    expect(candidate!.name).toBe("Priya Sharma");
    expect(candidate!.qualifications).toContain("B.Ed");
    expect(candidate!.talentBankFlag).toBe(false);
  });

  it("listForSchool returns candidates with poolNames", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);

    const candidateId = await t.mutation("candidates:create", {
      name: "Test Candidate",
      qualifications: ["B.Ed"],
      subjects: ["English"],
    });

    await t.mutation("applications:create", { candidateId, schoolId });

    const poolId = await t.mutation("pools:create", {
      schoolId,
      name: "TGT English",
      tags: ["english"],
      createdBy: "admin",
    });

    await t.mutation("pools:assignToPool", {
      candidateId,
      poolId,
      confidence: 90,
    });

    const results = await t.query("candidates:listForSchool", { schoolId });
    expect(results).toHaveLength(1);
    expect(results[0].poolNames).toBeDefined();
    expect(results[0].poolNames).toContain("TGT English");
    expect(results[0].poolIds).toContain(poolId);
  });

  it("listForSchool filters by poolId", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);

    const candidate1 = await t.mutation("candidates:create", {
      name: "Candidate 1",
      qualifications: ["B.Ed"],
      subjects: ["English"],
    });
    const candidate2 = await t.mutation("candidates:create", {
      name: "Candidate 2",
      qualifications: ["B.Ed"],
      subjects: ["Math"],
    });

    await t.mutation("applications:create", { candidateId: candidate1, schoolId });
    await t.mutation("applications:create", { candidateId: candidate2, schoolId });

    const pool1 = await t.mutation("pools:create", {
      schoolId,
      name: "TGT English",
      tags: ["english"],
      createdBy: "admin",
    });

    const pool2 = await t.mutation("pools:create", {
      schoolId,
      name: "TGT Math",
      tags: ["math"],
      createdBy: "admin",
    });

    await t.mutation("pools:assignToPool", { candidateId: candidate1, poolId: pool1, confidence: 90 });
    await t.mutation("pools:assignToPool", { candidateId: candidate2, poolId: pool2, confidence: 85 });

    const allResults = await t.query("candidates:listForSchool", { schoolId });
    expect(allResults).toHaveLength(2);

    const filteredResults = await t.query("candidates:listForSchool", {
      schoolId,
      poolId: pool1,
    });
    expect(filteredResults).toHaveLength(1);
    expect(filteredResults[0].name).toBe("Candidate 1");
  });
});
