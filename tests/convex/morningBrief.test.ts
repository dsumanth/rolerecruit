import { describe, it, expect, vi, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schoolsMod from "../../convex/schools";
import * as users from "../../convex/users";
import * as morningBrief from "../../convex/morningBrief";
import * as morningBriefStats from "../../convex/morningBrief_stats";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schoolsMod,
  "users.ts": async () => users,
  "morningBrief.ts": async () => morningBrief,
  "morningBrief_stats.ts": async () => morningBriefStats,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

const sendMock = vi.fn().mockResolvedValue({ data: { id: "test-id" }, error: null });

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

beforeEach(() => {
  sendMock.mockClear();
  process.env.RESEND_API_KEY = "test-key";
});

describe("sendBriefForSchool", () => {
  it("skips send when recipient list is empty", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      return await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
    });
    const result = await t.action("morningBrief:sendBriefForSchool" as any, { schoolId });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no_recipients");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("skips send when morningBriefEnabled is false", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      await ctx.db.patch(id, { morningBriefRecipientUserIds: ["user1"] });
      await ctx.db.insert("userProfiles", {
        userId: "user1", name: "Recruiter", email: "r@example.com", schoolId: id, role: "recruiter",
      });
      return id;
    });
    const result = await t.action("morningBrief:sendBriefForSchool" as any, { schoolId });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("disabled");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends one email per recipient when enabled with recipients", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("schools", {
        name: "Acme", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      await ctx.db.patch(id, {
        morningBriefRecipientUserIds: ["user1", "user2"],
        morningBriefEnabled: true,
      });
      await ctx.db.insert("userProfiles", {
        userId: "user1", name: "A", email: "a@example.com", schoolId: id, role: "recruiter",
      });
      await ctx.db.insert("userProfiles", {
        userId: "user2", name: "B", email: "b@example.com", schoolId: id, role: "owner",
      });
      return id;
    });
    const result = await t.action("morningBrief:sendBriefForSchool" as any, { schoolId });
    expect(result.skipped).toBe(false);
    expect(result.recipientsSent).toBe(2);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("silently skips stale recipient userIds whose profile no longer exists", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("schools", {
        name: "Acme", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      await ctx.db.patch(id, {
        morningBriefRecipientUserIds: ["ghost", "real"],
        morningBriefEnabled: true,
      });
      await ctx.db.insert("userProfiles", {
        userId: "real", name: "Real", email: "real@example.com", schoolId: id, role: "recruiter",
      });
      return id;
    });
    const result = await t.action("morningBrief:sendBriefForSchool" as any, { schoolId });
    expect(result.recipientsSent).toBe(1);
  });
});
