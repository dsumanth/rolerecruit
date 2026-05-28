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

describe("formTemplates.saveOverride + duplicateFromDefault", () => {
  it("saveOverride deactivates the prior active row and inserts a new active row", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create" as any, {
      name: "S", board: "CBSE", city: "X", state: "Y",
    } as any);

    const before = await t.query("formTemplates:listForSchool" as any, { schoolId } as any);
    const principalActive = before.find(
      (r: any) => r.role === "principal" && r.isActive,
    );
    expect(principalActive).toBeDefined();

    const newId = await t.mutation("formTemplates:saveOverride" as any, {
      schoolId,
      role: "principal",
      name: "Custom principal v2",
      fields: [
        { key: "subjectKnowledge", label: "Subject knowledge", type: "score_1_10", required: true },
        { key: "comments", label: "Notes", type: "text", allowDictation: true },
      ],
    } as any);
    expect(newId).toBeDefined();

    const after = await t.query("formTemplates:listForSchool" as any, { schoolId } as any);
    const activeRows = after.filter((r: any) => r.role === "principal" && r.isActive);
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]._id).toBe(newId);
    expect(activeRows[0].name).toBe("Custom principal v2");

    const old = after.find((r: any) => r._id === principalActive!._id);
    expect(old.isActive).toBe(false);
  });

  it("getForRole returns the new active template after override save", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create" as any, {
      name: "S", board: "CBSE", city: "X", state: "Y",
    } as any);
    await t.mutation("formTemplates:saveOverride" as any, {
      schoolId, role: "hod", name: "HOD custom",
      fields: [{ key: "pedagogy", label: "Pedagogy", type: "score_1_5", required: true }],
    } as any);
    const tpl = await t.query("formTemplates:getForRole" as any, {
      schoolId, role: "hod",
    } as any);
    expect(tpl.name).toBe("HOD custom");
    expect(tpl.fields).toHaveLength(1);
  });

  it("duplicateFromDefault returns a draft preview of the built-in for the role", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create" as any, {
      name: "S", board: "CBSE", city: "X", state: "Y",
    } as any);
    const draft = await t.query("formTemplates:duplicateFromDefault" as any, {
      schoolId, role: "teacher",
    } as any);
    expect(draft.role).toBe("teacher");
    expect(draft.fields.some((f: any) => f.key === "peerCompatibility")).toBe(true);
    const list = await t.query("formTemplates:listForSchool" as any, { schoolId } as any);
    const teacherRows = list.filter((r: any) => r.role === "teacher");
    expect(teacherRows.length).toBe(1);
  });

  it("saveOverride rejects fields with empty key or label", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create" as any, {
      name: "S", board: "CBSE", city: "X", state: "Y",
    } as any);
    await expect(t.mutation("formTemplates:saveOverride" as any, {
      schoolId, role: "principal", name: "x",
      fields: [{ key: "", label: "X", type: "score_1_5" }],
    } as any)).rejects.toThrow(/empty/i);
    await expect(t.mutation("formTemplates:saveOverride" as any, {
      schoolId, role: "principal", name: "x",
      fields: [{ key: "k", label: "", type: "score_1_5" }],
    } as any)).rejects.toThrow(/empty/i);
  });

  it("saveOverride rejects duplicate field keys", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create" as any, {
      name: "S", board: "CBSE", city: "X", state: "Y",
    } as any);
    await expect(t.mutation("formTemplates:saveOverride" as any, {
      schoolId, role: "principal", name: "dup",
      fields: [
        { key: "a", label: "A", type: "score_1_5" },
        { key: "a", label: "A2", type: "text" },
      ],
    } as any)).rejects.toThrow(/duplicate/i);
  });
});
