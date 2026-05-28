import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as users from "../../convex/users";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "users.ts": async () => users,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

async function setup(t: ReturnType<typeof convexTest>) {
  const schoolId = await t.mutation("schools:create" as any, {
    name: "S", board: "CBSE", city: "X", state: "Y",
  } as any);
  const userId = await t.mutation("users:createProfile" as any, {
    userId: "u1", name: "Mrs Iyer", email: "p@s.com", schoolId, role: "principal",
  } as any);
  return { schoolId, userId };
}

describe("registerExpoToken", () => {
  it("adds a token to a profile with no existing tokens", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setup(t);
    await t.mutation("users:registerExpoToken" as any, {
      userId, token: "ExpoToken[a]",
    } as any);
    const got = await t.query("users:getById" as any, { userId } as any);
    expect(got.expoPushTokens).toEqual(["ExpoToken[a]"]);
  });

  it("is idempotent, registering the same token twice keeps one copy", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setup(t);
    await t.mutation("users:registerExpoToken" as any, { userId, token: "ExpoToken[a]" } as any);
    await t.mutation("users:registerExpoToken" as any, { userId, token: "ExpoToken[a]" } as any);
    const got = await t.query("users:getById" as any, { userId } as any);
    expect(got.expoPushTokens).toEqual(["ExpoToken[a]"]);
  });

  it("appends a second distinct token alongside the first", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setup(t);
    await t.mutation("users:registerExpoToken" as any, { userId, token: "ExpoToken[a]" } as any);
    await t.mutation("users:registerExpoToken" as any, { userId, token: "ExpoToken[b]" } as any);
    const got = await t.query("users:getById" as any, { userId } as any);
    expect(got.expoPushTokens?.sort()).toEqual(["ExpoToken[a]", "ExpoToken[b]"]);
  });

  it("unregisterExpoToken removes the matching token only", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setup(t);
    await t.mutation("users:registerExpoToken" as any, { userId, token: "ExpoToken[a]" } as any);
    await t.mutation("users:registerExpoToken" as any, { userId, token: "ExpoToken[b]" } as any);
    await t.mutation("users:unregisterExpoToken" as any, { userId, token: "ExpoToken[a]" } as any);
    const got = await t.query("users:getById" as any, { userId } as any);
    expect(got.expoPushTokens).toEqual(["ExpoToken[b]"]);
  });

  it("unregisterExpoToken is a no-op for an unknown token", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setup(t);
    await t.mutation("users:registerExpoToken" as any, { userId, token: "ExpoToken[a]" } as any);
    await t.mutation("users:unregisterExpoToken" as any, { userId, token: "ExpoToken[ghost]" } as any);
    const got = await t.query("users:getById" as any, { userId } as any);
    expect(got.expoPushTokens).toEqual(["ExpoToken[a]"]);
  });
});
