import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as users from "../../convex/users";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "users.ts": async () => users,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("schools", () => {
  it("creates a school", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation("schools:create", {
      name: "Delhi Public School",
      board: "CBSE",
      city: "Hyderabad",
      state: "Telangana",
    });
    expect(id).toBeDefined();
  });

  it("rejects duplicate school name", async () => {
    const t = convexTest(schema, modules);
    await t.mutation("schools:create", {
      name: "Delhi Public School",
      board: "CBSE",
      city: "Hyderabad",
      state: "Telangana",
    });
    await expect(
      t.mutation("schools:create", {
        name: "Delhi Public School",
        board: "ICSE",
        city: "Bangalore",
        state: "Karnataka",
      })
    ).rejects.toThrow();
  });

  it("gets school by id", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation("schools:create", {
      name: "DPS Bangalore",
      board: "ICSE",
      city: "Bangalore",
      state: "Karnataka",
    });
    const school = await t.query("schools:get", { schoolId: id });
    expect(school).not.toBeNull();
    expect(school!.name).toBe("DPS Bangalore");
    expect(school!.planTier).toBe("free");
  });
});
