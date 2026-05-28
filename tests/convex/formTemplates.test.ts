import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as formTemplates from "../../convex/formTemplates";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "formTemplates.ts": async () => formTemplates,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

async function makeSchool(t: ReturnType<typeof convexTest>) {
  return await t.mutation("schools:create" as any, {
    name: "Test School", board: "CBSE", city: "Test", state: "Test",
  } as any);
}

describe("formTemplates", () => {
  it("seedForSchool creates one row per role with schoolId", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await makeSchool(t);
    await t.mutation("formTemplates:seedForSchool" as any, { schoolId } as any);
    const all = await t.query("formTemplates:listForSchool" as any, { schoolId } as any);
    expect(all.map((r: any) => r.role).sort())
      .toEqual(["hod", "hr_admin", "principal", "teacher"]);
    for (const r of all) {
      expect(r.isActive).toBe(true);
      expect(r.schoolId).toBe(schoolId);
    }
  });

  it("seedForSchool is idempotent", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await makeSchool(t);
    await t.mutation("formTemplates:seedForSchool" as any, { schoolId } as any);
    await t.mutation("formTemplates:seedForSchool" as any, { schoolId } as any);
    const all = await t.query("formTemplates:listForSchool" as any, { schoolId } as any);
    expect(all).toHaveLength(4);
  });

  it("getForRole returns the school's active template for that role", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await makeSchool(t);
    await t.mutation("formTemplates:seedForSchool" as any, { schoolId } as any);
    const tpl = await t.query("formTemplates:getForRole" as any, { schoolId, role: "principal" } as any);
    expect(tpl).toBeDefined();
    expect(tpl.role).toBe("principal");
    expect(tpl.fields.map((f: any) => f.key)).toContain("subjectKnowledge");
  });
});
