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

const advanceOn2Hires = {
  match: "all" as const,
  conditions: [{ type: "recCount" as const, rec: "hire" as const, op: "atLeast" as const, value: 2 }],
  action: "advance" as const,
};

describe("decisionRules", () => {
  it("creates a rule with steps/otherwise and lists it", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "Standard hire path", steps: [advanceOn2Hires], otherwise: "manual",
    } as any);
    expect(ruleId).toBeDefined();
    const list = await t.query("decisionRules:list" as any, { schoolId } as any);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Standard hire path");
    expect(list[0].isActive).toBe(true);
  });

  it("update replaces steps and otherwise", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "r1", steps: [advanceOn2Hires], otherwise: "manual",
    } as any);
    await t.mutation("decisionRules:update" as any, {
      ruleId, name: "r1 renamed",
      steps: [{ match: "all", conditions: [{ type: "recCount", rec: "hire", op: "atLeast", value: 3 }], action: "reject" }],
      otherwise: "redemo",
    } as any);
    const got = await t.query("decisionRules:get" as any, { ruleId } as any);
    expect(got.name).toBe("r1 renamed");
    expect(got.steps[0].conditions[0].value).toBe(3);
    expect(got.otherwise).toBe("redemo");
  });

  it("accepts every condition type", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const id = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "all types",
      steps: [{
        match: "any",
        conditions: [
          { type: "recCount", rec: "hire", op: "exactly", value: 1 },
          { type: "recPercent", rec: "reject", op: "atMost", value: 25 },
          { type: "scoreAvg", fieldKey: "subjectKnowledge", op: "atLeast", value: 4 },
          { type: "overallScore", op: "atLeast", value: 7 },
          { type: "roleSubmitted", mode: "allOf", roles: ["principal", "hod"] },
          { type: "roleVerdict", role: "principal", rec: "hire" },
        ],
        action: "advance",
      }],
      otherwise: "manual",
    } as any);
    expect(id).toBeDefined();
  });

  it("setActive toggles isActive", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "r", steps: [], otherwise: "manual",
    } as any);
    await t.mutation("decisionRules:setActive" as any, { ruleId, active: false } as any);
    const got = await t.query("decisionRules:get" as any, { ruleId } as any);
    expect(got.isActive).toBe(false);
  });

  it("remove deletes the row", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "r", steps: [], otherwise: "manual",
    } as any);
    await t.mutation("decisionRules:remove" as any, { ruleId } as any);
    expect(await t.query("decisionRules:list" as any, { schoolId } as any)).toHaveLength(0);
  });

  it("listActive returns only active rules", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const a = await t.mutation("decisionRules:create" as any, { schoolId, name: "a", steps: [], otherwise: "manual" } as any);
    const b = await t.mutation("decisionRules:create" as any, { schoolId, name: "b", steps: [], otherwise: "manual" } as any);
    await t.mutation("decisionRules:setActive" as any, { ruleId: b, active: false } as any);
    const active = await t.query("decisionRules:listActive" as any, { schoolId } as any);
    expect(active.map((r: any) => r._id)).toEqual([a]);
  });

  it("rejects empty name", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    await expect(t.mutation("decisionRules:create" as any, {
      schoolId, name: "  ", steps: [], otherwise: "manual",
    } as any)).rejects.toThrow(/name/i);
  });
});
