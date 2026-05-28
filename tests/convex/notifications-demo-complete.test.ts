import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as notifications from "../../convex/notifications";
import * as demoSessions from "../../convex/demoSessions";
import * as users from "../../convex/users";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "notifications.ts": async () => notifications,
  "demoSessions.ts": async () => demoSessions,
  "users.ts": async () => users,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

async function seedSchoolWithStaff(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", {
      name: "S", board: "CBSE", city: "X", state: "Y", planTier: "free",
    });
    const hrId = await ctx.db.insert("userProfiles", {
      userId: "u-hr", name: "HR", email: "hr@s.com",
      schoolId, role: "hr_admin", expoPushTokens: ["ExpoTok-HR"],
    });
    const principalId = await ctx.db.insert("userProfiles", {
      userId: "u-p", name: "P", email: "p@s.com",
      schoolId, role: "principal", expoPushTokens: ["ExpoTok-P"],
    });
    const teacherId = await ctx.db.insert("userProfiles", {
      userId: "u-t", name: "T", email: "t@s.com",
      schoolId, role: "teacher", expoPushTokens: ["ExpoTok-T"],
    });
    const principalNoTokenId = await ctx.db.insert("userProfiles", {
      userId: "u-p2", name: "P2", email: "p2@s.com",
      schoolId, role: "principal",
    });
    const candidateId = await ctx.db.insert("candidates", {
      name: "Priya",
      qualifications: [], certifications: [], boardExperience: [], subjects: [],
      talentBankFlag: false,
    });
    const applicationId = await ctx.db.insert("applications", {
      candidateId, schoolId, stage: "demo_scheduled", createdAt: Date.now(),
    });
    const demoId = await ctx.db.insert("demoSessions", {
      applicationId, schoolId,
      scheduledAt: Date.now() - 1,
      durationMinutes: 30,
      mode: "live", format: "classroom", status: "completed",
      createdBy: hrId, createdAt: Date.now(),
    });
    return { schoolId, hrId, principalId, teacherId, principalNoTokenId, demoId };
  });
}

describe("notifyDemoComplete", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends a demo_completed push to HR + Principal users with tokens, skipping teachers and tokenless principals", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "{}" });
    vi.stubGlobal("fetch", fetchMock);

    const t = convexTest(schema, modules);
    const { demoId, teacherId } = await seedSchoolWithStaff(t);

    await t.action(apiModule.internal.notifications.notifyDemoComplete, { demoId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    const body = JSON.parse(init.body as string);
    const tokens = body.map((m: any) => m.to).sort();
    expect(tokens).toEqual(["ExpoTok-HR", "ExpoTok-P"]);
    expect(tokens).not.toContain("ExpoTok-T");
    expect(body[0].title).toBe("Demo completed");
    expect(body[0].data.event).toBe("demo_completed");
    expect(typeof body[0].data.demoId).toBe("string");
    void teacherId;
  });

  it("does nothing when there are no HR or Principal users with tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "{}" });
    vi.stubGlobal("fetch", fetchMock);

    const t = convexTest(schema, modules);
    const demoId = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "Y", planTier: "free",
      });
      const teacherId = await ctx.db.insert("userProfiles", {
        userId: "u-t", name: "T", email: "t@s.com",
        schoolId, role: "teacher", expoPushTokens: ["ExpoTok-T"],
      });
      const candidateId = await ctx.db.insert("candidates", {
        name: "P",
        qualifications: [], certifications: [], boardExperience: [], subjects: [],
        talentBankFlag: false,
      });
      const applicationId = await ctx.db.insert("applications", {
        candidateId, schoolId, stage: "demo_scheduled", createdAt: Date.now(),
      });
      return await ctx.db.insert("demoSessions", {
        applicationId, schoolId,
        scheduledAt: Date.now() - 1,
        durationMinutes: 30,
        mode: "live", format: "classroom", status: "completed",
        createdBy: teacherId, createdAt: Date.now(),
      });
    });

    await t.action(apiModule.internal.notifications.notifyDemoComplete, { demoId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
