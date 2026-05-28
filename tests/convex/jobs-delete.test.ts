import { describe, it, expect, vi } from "vitest";
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

describe("jobs.removeMany", () => {
  it("marks draft jobs pending; finalize deletes", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
    const j1 = await t.mutation("jobs:create", {
      schoolId, title: "Draft 1", subject: "M", level: "PGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
    const r = await t.mutation("jobs:removeMany", { ids: [j1] });
    expect(r.count).toBe(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = await t.run(async (ctx: any) => ctx.db.get(j1));
    expect(after).toBeNull();
    vi.useRealTimers();
  });

  it("throws if any selected job is non-draft", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
    const j1 = await t.mutation("jobs:create", {
      schoolId, title: "T", subject: "M", level: "PGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
    await t.mutation("jobs:publish", { jobId: j1 });
    await expect(
      t.mutation("jobs:removeMany", { ids: [j1] })
    ).rejects.toThrow();
  });

  it("undo restores jobs before finalize", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "M", state: "MH" });
    const j1 = await t.mutation("jobs:create", {
      schoolId, title: "Draft Undo", subject: "M", level: "PGT", board: "CBSE",
      qualifications: [], minExperience: 0, positions: 1, naturalLanguageDescription: "x",
    });
    const { batchId } = await t.mutation("jobs:removeMany", { ids: [j1] });
    const r = await t.mutation("jobs:undoBatchDelete", { batchId });
    expect(r.restored).toBe(1);
    const after = await t.run(async (ctx: any) => ctx.db.get(j1));
    expect(after).not.toBeNull();
    expect(after.pendingDeleteAt).toBeUndefined();
    expect(after.pendingDeleteBatchId).toBeUndefined();
  });
});
