import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as formTemplates from "../../convex/formTemplates";
import * as roles from "../../convex/roles";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "formTemplates.ts": async () => formTemplates,
  "roles.ts": async () => roles,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

describe("school creation side-effects", () => {
  it("seeds 4 form templates per school on create", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create" as any, {
      name: "Side Effect School", board: "CBSE", city: "X", state: "Y",
    } as any);
    const tpls = await t.query("formTemplates:listForSchool" as any, { schoolId } as any);
    expect(tpls).toHaveLength(4);
  });

  it("seeds a teacher system role on school create", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create" as any, {
      name: "Teacher Role School", board: "CBSE", city: "X", state: "Y",
    } as any);
    const allRoles = await t.query("roles:list" as any, { schoolId } as any);
    expect(allRoles.find((r: any) => r.name === "teacher" && r.isSystem === true))
      .toBeDefined();
  });
});
