import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as users from "../../convex/users";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as jobs from "../../convex/jobs";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "users.ts": async () => users,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "jobs.ts": async () => jobs,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("candidates.removeMany", () => {
  it("marks candidates pendingDelete and returns batchId", async () => {
    const t = convexTest(schema, modules);
    const c1 = await t.mutation("candidates:create", {
      name: "A", email: "a@x.com", qualifications: [], subjects: [],
    });
    const c2 = await t.mutation("candidates:create", {
      name: "B", email: "b@x.com", qualifications: [], subjects: [],
    });
    const result = await t.mutation("candidates:removeMany", { ids: [c1, c2] });
    expect(result.count).toBe(2);
    expect(typeof result.batchId).toBe("string");

    // Direct DB check: both should have pendingDeleteAt set
    const c1Doc = await t.run(async (ctx: any) => ctx.db.get(c1));
    const c2Doc = await t.run(async (ctx: any) => ctx.db.get(c2));
    expect(c1Doc.pendingDeleteAt).toBeTypeOf("number");
    expect(c2Doc.pendingDeleteAt).toBeTypeOf("number");
    expect(c1Doc.pendingDeleteBatchId).toBe(result.batchId);
  });

  it("undoBatchDelete restores rows within window", async () => {
    const t = convexTest(schema, modules);
    const c1 = await t.mutation("candidates:create", {
      name: "A", email: "a@x.com", qualifications: [], subjects: [],
    });
    const { batchId } = await t.mutation("candidates:removeMany", { ids: [c1] });
    const r = await t.mutation("candidates:undoBatchDelete", { batchId });
    expect(r.restored).toBe(1);
    const after = await t.run(async (ctx: any) => ctx.db.get(c1));
    expect(after.pendingDeleteAt).toBeUndefined();
    expect(after.pendingDeleteBatchId).toBeUndefined();
  });

  it("single remove also returns a batchId", async () => {
    const t = convexTest(schema, modules);
    const c = await t.mutation("candidates:create", {
      name: "A", email: "a@x.com", qualifications: [], subjects: [],
    });
    const r = await t.mutation("candidates:remove", { candidateId: c });
    expect(r.count).toBe(1);
    expect(typeof r.batchId).toBe("string");
  });
});
