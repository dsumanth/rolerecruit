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

async function setupCandidate(t: any, schoolId: string) {
  const candidateId = await t.mutation("candidates:create", {
    name: "Test Candidate",
    qualifications: ["B.Ed", "M.Sc"],
    subjects: ["English", "Social Studies"],
    yearsExperience: 5,
  });
  await t.mutation("applications:create", { candidateId, schoolId });
  return candidateId;
}

describe("pools", () => {
  it("creates a pool", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);

    const poolId = await t.mutation("pools:create", {
      schoolId,
      name: "TGT English",
      tags: ["english", "tgt", "grades 5-8"],
      createdBy: "admin",
    });

    const allPools = await t.query("pools:listForSchool", { schoolId });
    expect(allPools).toHaveLength(1);
    expect(allPools[0].name).toBe("TGT English");
    expect(allPools[0].createdBy).toBe("admin");
    expect(allPools[0].tags).toContain("english");
  });

  it("rejects duplicate pool name for same school", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);

    await t.mutation("pools:create", {
      schoolId,
      name: "TGT English",
      tags: ["english"],
      createdBy: "admin",
    });

    await expect(
      t.mutation("pools:create", {
        schoolId,
        name: "TGT English",
        tags: ["english", "tgt"],
        createdBy: "admin",
      })
    ).rejects.toThrow();
  });

  it("lists only pools for the given school", async () => {
    const t = convexTest(schema, modules);
    const school1 = await setupSchool(t);
    const school2 = await t.mutation("schools:create", {
      name: "School 2",
      board: "ICSE",
      city: "Other",
      state: "Other",
    });

    await t.mutation("pools:create", {
      schoolId: school1,
      name: "Pool A",
      tags: [],
      createdBy: "admin",
    });
    await t.mutation("pools:create", {
      schoolId: school2,
      name: "Pool B",
      tags: [],
      createdBy: "admin",
    });

    const pools1 = await t.query("pools:listForSchool", { schoolId: school1 });
    const pools2 = await t.query("pools:listForSchool", { schoolId: school2 });

    expect(pools1).toHaveLength(1);
    expect(pools1[0].name).toBe("Pool A");
    expect(pools2).toHaveLength(1);
    expect(pools2[0].name).toBe("Pool B");
  });

  it("updates pool name and tags", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);

    const poolId = await t.mutation("pools:create", {
      schoolId,
      name: "Old Name",
      tags: ["old"],
      createdBy: "admin",
    });

    await t.mutation("pools:update", {
      poolId,
      name: "New Name",
      tags: ["new", "updated"],
    });

    const pools = await t.query("pools:listForSchool", { schoolId });
    expect(pools[0].name).toBe("New Name");
    expect(pools[0].tags).toEqual(["new", "updated"]);
  });

  it("removes pool and cascades to candidatePools and candidates.poolIds", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const candidateId = await setupCandidate(t, schoolId);

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

    let candidate = await t.query("candidates:get", { candidateId });
    expect(candidate!.poolIds).toContain(poolId);

    await t.mutation("pools:remove", { poolId });

    candidate = await t.query("candidates:get", { candidateId });
    expect(candidate!.poolIds ?? []).not.toContain(poolId);

    const pools = await t.query("pools:listForSchool", { schoolId });
    expect(pools).toHaveLength(0);
  });

  it("assigns candidate to pool", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const candidateId = await setupCandidate(t, schoolId);

    const poolId = await t.mutation("pools:create", {
      schoolId,
      name: "TGT English",
      tags: ["english"],
      createdBy: "admin",
    });

    await t.mutation("pools:assignToPool", {
      candidateId,
      poolId,
      confidence: 85,
    });

    const candidate = await t.query("candidates:get", { candidateId });
    expect(candidate!.poolIds).toBeDefined();
    expect(candidate!.poolIds!).toContain(poolId);
  });

  it("unassigns candidate from pool", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const candidateId = await setupCandidate(t, schoolId);

    const poolId = await t.mutation("pools:create", {
      schoolId,
      name: "TGT English",
      tags: ["english"],
      createdBy: "admin",
    });

    await t.mutation("pools:assignToPool", {
      candidateId,
      poolId,
      confidence: 85,
    });

    await t.mutation("pools:unassignFromPool", { candidateId, poolId });

    const candidate = await t.query("candidates:get", { candidateId });
    expect(candidate!.poolIds ?? []).not.toContain(poolId);
  });
});
