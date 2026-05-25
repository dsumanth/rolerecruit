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

describe("users", () => {
  it("creates a user profile", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test School",
      board: "CBSE",
      city: "Mumbai",
      state: "Maharashtra",
    });

    const profileId = await t.mutation("users:createProfile", {
      userId: "user_123",
      name: "Priya Sharma",
      email: "priya@school.in",
      schoolId,
      role: "hr_admin",
    });

    expect(profileId).toBeDefined();
  });

  it("rejects duplicate profile for same user", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test School 2",
      board: "ICSE",
      city: "Delhi",
      state: "Delhi",
    });

    await t.mutation("users:createProfile", {
      userId: "user_456",
      name: "Dr. Sharma",
      email: "sharma@school.in",
      schoolId,
      role: "principal",
    });

    await expect(
      t.mutation("users:createProfile", {
        userId: "user_456",
        name: "Dr. Sharma Duplicate",
        email: "sharma2@school.in",
        schoolId,
        role: "principal",
      })
    ).rejects.toThrow();
  });

  it("gets user profile by userId", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test School 3",
      board: "IB",
      city: "Bangalore",
      state: "Karnataka",
    });

    await t.mutation("users:createProfile", {
      userId: "user_789",
      name: "Rajesh Kumar",
      email: "rajesh@school.in",
      schoolId,
      role: "viewer",
    });

    const profile = await t.query("users:getProfile", {
      userId: "user_789",
    });

    expect(profile).not.toBeNull();
    expect(profile!.name).toBe("Rajesh Kumar");
    expect(profile!.role).toBe("viewer");
  });

  it("returns null for nonexistent user", async () => {
    const t = convexTest(schema, modules);
    const profile = await t.query("users:getProfile", {
      userId: "nonexistent_user",
    });
    expect(profile).toBeNull();
  });

  it("lists users by school", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test School 4",
      board: "State",
      city: "Chennai",
      state: "Tamil Nadu",
    });

    await t.mutation("users:createProfile", {
      userId: "user_a",
      name: "User A",
      email: "a@school.in",
      schoolId,
      role: "hr_admin",
    });

    await t.mutation("users:createProfile", {
      userId: "user_b",
      name: "User B",
      email: "b@school.in",
      schoolId,
      role: "principal",
    });

    const profiles = await t.query("users:getBySchool", { schoolId });
    expect(profiles).toHaveLength(2);
  });
});
