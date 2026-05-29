import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("backfillNormalizePhones", () => {
  it("normalizes IN bare 10-digit phones to E.164 and reports counts", async () => {
    const t = convexTest(schema, modules);
    const { rawId, e164Id, invalidId, noPhoneId } = await t.run(async (ctx) => {
      const rawId = await ctx.db.insert("candidates", {
        name: "Raw", qualifications: [], certifications: [], boardExperience: [],
        subjects: [], talentBankFlag: false, phone: "9876543210",
      });
      const e164Id = await ctx.db.insert("candidates", {
        name: "E164", qualifications: [], certifications: [], boardExperience: [],
        subjects: [], talentBankFlag: false, phone: "+919876500001",
      });
      const invalidId = await ctx.db.insert("candidates", {
        name: "Bad", qualifications: [], certifications: [], boardExperience: [],
        subjects: [], talentBankFlag: false, phone: "abcxyz",
      });
      const noPhoneId = await ctx.db.insert("candidates", {
        name: "NoPhone", qualifications: [], certifications: [], boardExperience: [],
        subjects: [], talentBankFlag: false,
      });
      return { rawId, e164Id, invalidId, noPhoneId };
    });

    const result = await t.mutation(apiModule.internal.candidates.backfillNormalizePhones, {});
    expect(result.normalized).toBe(1);
    expect(result.unchanged).toBe(1);
    expect(result.invalid).toBe(1);
    expect(result.skipped).toBe(1);

    const updatedRaw = await t.run(async (ctx) => ctx.db.get(rawId));
    expect(updatedRaw?.phone).toBe("+919876543210");

    const sameE164 = await t.run(async (ctx) => ctx.db.get(e164Id));
    expect(sameE164?.phone).toBe("+919876500001");

    const stillInvalid = await t.run(async (ctx) => ctx.db.get(invalidId));
    expect(stillInvalid?.phone).toBe("abcxyz");

    const stillNone = await t.run(async (ctx) => ctx.db.get(noPhoneId));
    expect(stillNone?.phone).toBeUndefined();
  });
});
