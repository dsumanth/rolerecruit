import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { monthStartUtc } from "../../convex/whatsappUsage";
import * as whatsappUsage from "../../convex/whatsappUsage";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "whatsappUsage.ts": async () => whatsappUsage,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("monthStartUtc", () => {
  it("returns the first ms of the UTC month", () => {
    const ts = Date.UTC(2026, 4, 28, 13, 45, 0); // 2026-05-28
    expect(monthStartUtc(ts)).toBe(Date.UTC(2026, 4, 1));
  });
});

describe("usage queries", () => {
  it("getCurrentUsage returns this month's row; getUsageHistory sorts desc", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) =>
      ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" }),
    );
    const thisMonth = monthStartUtc(Date.now());
    const lastMonth = monthStartUtc(thisMonth - 1);
    await t.run(async (ctx) => {
      for (const [periodStart, count] of [[lastMonth, 3], [thisMonth, 7]] as const) {
        await ctx.db.insert("whatsappUsage", {
          schoolId, periodStart, messageCount: count,
          utilityCount: count, marketingCount: 0, authenticationCount: 0, serviceCount: 0,
          metaCostUsdTotal: 0.01 * count, billableUsdTotal: 0.012 * count, updatedAt: Date.now(),
        });
      }
    });

    const current = await t.query(apiModule.api.whatsappUsage.getCurrentUsage, { schoolId });
    expect(current?.messageCount).toBe(7);

    const history = await t.query(apiModule.api.whatsappUsage.getUsageHistory, { schoolId, months: 6 });
    expect(history.map((h: any) => h.periodStart)).toEqual([thisMonth, lastMonth]);
  });
});
