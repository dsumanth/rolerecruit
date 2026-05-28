// @vitest-environment node
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as whatsappIntegration from "../../convex/whatsappIntegration";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "whatsappIntegration.ts": async () => whatsappIntegration,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

async function seedSchool(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("schools", { name: "S", board: "CBSE", city: "X", state: "X", planTier: "free" }),
  );
}

describe("whatsappIntegration storage", () => {
  it("upsert creates an active row with default 20% markup, hiding the token", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await seedSchool(t);

    await t.mutation(apiModule.internal.whatsappIntegration.upsertActiveIntegration, {
      schoolId, wabaId: "waba-1", phoneNumberId: "111",
      displayPhoneNumber: "+91 98765 43210", businessName: "Greenfield", verifiedName: "Greenfield Intl",
      accessTokenCipher: "cipher", accessTokenIv: "iv",
    });

    const view = await t.query(apiModule.api.whatsappIntegration.getIntegration, { schoolId });
    expect(view?.status).toBe("active");
    expect(view?.displayPhoneNumber).toBe("+91 98765 43210");
    expect(view?.markupPct).toBe(20);
    expect((view as any)?.accessTokenCipher).toBeUndefined();
  });

  it("upsert twice updates the same row and preserves markup", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await seedSchool(t);
    await t.mutation(apiModule.internal.whatsappIntegration.upsertActiveIntegration, {
      schoolId, wabaId: "w", phoneNumberId: "111", displayPhoneNumber: "+1", businessName: "B", verifiedName: "B", accessTokenCipher: "c", accessTokenIv: "i",
    });
    await t.mutation(apiModule.api.whatsappIntegration.updateMarkup, { schoolId, markupPct: 35 });
    await t.mutation(apiModule.internal.whatsappIntegration.upsertActiveIntegration, {
      schoolId, wabaId: "w", phoneNumberId: "222", displayPhoneNumber: "+2", businessName: "B", verifiedName: "B", accessTokenCipher: "c2", accessTokenIv: "i2",
    });
    const rows = await t.run(async (ctx) =>
      ctx.db.query("whatsappIntegrations").withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId)).collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].phoneNumberId).toBe("222");
    expect(rows[0].markupPct).toBe(35);
  });

  it("getByPhoneNumberId returns the integration", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await seedSchool(t);
    await t.mutation(apiModule.internal.whatsappIntegration.upsertActiveIntegration, {
      schoolId, wabaId: "w", phoneNumberId: "999", displayPhoneNumber: "+9", businessName: "B", verifiedName: "B", accessTokenCipher: "c", accessTokenIv: "i",
    });
    const found = await t.query(apiModule.internal.whatsappIntegration.getByPhoneNumberId, { phoneNumberId: "999" });
    expect(found?.schoolId).toBe(schoolId);
  });

  it("setIntegrationError flips status to error", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await seedSchool(t);
    await t.mutation(apiModule.internal.whatsappIntegration.upsertActiveIntegration, {
      schoolId, wabaId: "w", phoneNumberId: "111", displayPhoneNumber: "+1", businessName: "B", verifiedName: "B", accessTokenCipher: "c", accessTokenIv: "i",
    });
    await t.mutation(apiModule.internal.whatsappIntegration.setIntegrationError, { schoolId, message: "token expired" });
    const view = await t.query(apiModule.api.whatsappIntegration.getIntegration, { schoolId });
    expect(view?.status).toBe("error");
    expect(view?.lastErrorMessage).toBe("token expired");
  });

  it("disconnect clears credentials and sets status disconnected", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await seedSchool(t);
    await t.mutation(apiModule.internal.whatsappIntegration.upsertActiveIntegration, {
      schoolId, wabaId: "w", phoneNumberId: "111", displayPhoneNumber: "+1", businessName: "B", verifiedName: "B", accessTokenCipher: "c", accessTokenIv: "i",
    });
    await t.mutation(apiModule.api.whatsappIntegration.disconnect, { schoolId });
    const row = await t.run(async (ctx) =>
      (await ctx.db.query("whatsappIntegrations").withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId)).first()),
    );
    expect(row?.status).toBe("disconnected");
    expect(row?.accessTokenCipher).toBeUndefined();
    expect(row?.phoneNumberId).toBeUndefined();
  });
});
