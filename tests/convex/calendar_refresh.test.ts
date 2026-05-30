import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as calendar from "../../convex/calendar";
import * as users from "../../convex/users";
import * as schools from "../../convex/schools";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "calendar.ts": async () => calendar,
  "users.ts": async () => users,
  "schools.ts": async () => schools,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("persistRefreshedToken", () => {
  it("updates the stored access token and expiry, keeping the refresh token", async () => {
    const t = convexTest(schema, modules);
    const calId = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      return ctx.db.insert("interviewerCalendars", {
        userId: "u1", schoolId,
        googleTokens: { access_token: "old", refresh_token: "rt", expiry: 1 },
        googleEmail: "i@s.com", calendarId: "primary",
      });
    });

    await t.mutation(apiModule.internal.calendar.persistRefreshedToken, {
      calendarId: calId, accessToken: "fresh", expiry: 999_999,
    });

    const updated = await t.run((ctx) => ctx.db.get(calId));
    expect(updated?.googleTokens.access_token).toBe("fresh");
    expect(updated?.googleTokens.expiry).toBe(999_999);
    expect(updated?.googleTokens.refresh_token).toBe("rt");
  });
});
