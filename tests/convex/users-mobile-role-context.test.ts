import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as users from "../../convex/users";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

import { api } from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "users.ts": async () => users,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("users.getMobileRoleContext", () => {
  it("returns null when no profile exists", async () => {
    const t = convexTest(schema, modules);
    const out = await t.query(api.users.getMobileRoleContext, { userId: "nope" });
    expect(out).toBeNull();
  });

  it("returns isHR=true for hr_admin", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) =>
      ctx.db.insert("schools", {
        name: "S",
        board: "CBSE",
        city: "Mumbai",
        state: "MH",
        planTier: "free",
      } as any),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("userProfiles", {
        userId: "u-hr",
        name: "HR",
        email: "h@s",
        schoolId,
        role: "hr_admin",
      } as any),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("roles", {
        schoolId,
        name: "hr_admin",
        permissions: ["*"],
        isSystem: true,
      } as any),
    );
    const out = await t.query(api.users.getMobileRoleContext, { userId: "u-hr" });
    expect(out?.isHR).toBe(true);
    expect(out?.role).toBe("hr_admin");
    expect(out?.permissions).toContain("*");
  });

  it("returns isHR=true for principal, false for hod and teacher", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) =>
      ctx.db.insert("schools", {
        name: "S",
        board: "CBSE",
        city: "Mumbai",
        state: "MH",
        planTier: "free",
      } as any),
    );
    for (const r of ["principal", "hod", "teacher"]) {
      await t.run(async (ctx) =>
        ctx.db.insert("userProfiles", {
          userId: `u-${r}`,
          name: r,
          email: `${r}@s`,
          schoolId,
          role: r,
        } as any),
      );
    }
    const p = await t.query(api.users.getMobileRoleContext, { userId: "u-principal" });
    const h = await t.query(api.users.getMobileRoleContext, { userId: "u-hod" });
    const te = await t.query(api.users.getMobileRoleContext, { userId: "u-teacher" });
    expect(p?.isHR).toBe(true);
    expect(h?.isHR).toBe(false);
    expect(te?.isHR).toBe(false);
  });
});
