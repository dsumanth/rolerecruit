import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as decisionRules from "../../convex/decisionRules";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "decisionRules.ts": async () => decisionRules,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

async function setupSchool(t: ReturnType<typeof convexTest>) {
  return await t.mutation("schools:create" as any, {
    name: "S", board: "CBSE", city: "X", state: "Y",
  } as any);
}

describe("decisionRules", () => {
  it("creates a rule and lists it for the school", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId,
      name: "Standard hire path",
      branches: [
        { condition: { minHire: 2, maxReject: 0 }, action: "advance" },
      ],
      fallback: "manual",
    } as any);
    expect(ruleId).toBeDefined();

    const list = await t.query("decisionRules:list" as any, { schoolId } as any);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Standard hire path");
    expect(list[0].isActive).toBe(true);
  });

  it("update replaces branches and fallback", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "r1",
      branches: [{ condition: { minHire: 1 }, action: "advance" }],
      fallback: "manual",
    } as any);

    await t.mutation("decisionRules:update" as any, {
      ruleId,
      name: "r1 renamed",
      branches: [{ condition: { minHire: 3 }, action: "reject" }],
      fallback: "redemo",
    } as any);

    const got = await t.query("decisionRules:get" as any, { ruleId } as any);
    expect(got.name).toBe("r1 renamed");
    expect(got.branches[0].condition.minHire).toBe(3);
    expect(got.fallback).toBe("redemo");
  });

  it("setActive toggles isActive", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "r", branches: [], fallback: "manual",
    } as any);

    await t.mutation("decisionRules:setActive" as any, { ruleId, active: false } as any);
    const got = await t.query("decisionRules:get" as any, { ruleId } as any);
    expect(got.isActive).toBe(false);
  });

  it("remove deletes the row", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "r", branches: [], fallback: "manual",
    } as any);

    await t.mutation("decisionRules:remove" as any, { ruleId } as any);
    const list = await t.query("decisionRules:list" as any, { schoolId } as any);
    expect(list).toHaveLength(0);
  });

  it("listActive returns only active rules", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const a = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "a", branches: [], fallback: "manual",
    } as any);
    const b = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "b", branches: [], fallback: "manual",
    } as any);
    await t.mutation("decisionRules:setActive" as any, { ruleId: b, active: false } as any);

    const active = await t.query("decisionRules:listActive" as any, { schoolId } as any);
    expect(active.map((r: any) => r._id)).toEqual([a]);
  });

  it("rejects empty name", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    await expect(t.mutation("decisionRules:create" as any, {
      schoolId, name: "  ", branches: [], fallback: "manual",
    } as any)).rejects.toThrow(/name/i);
  });
});
