import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as outreach from "../../convex/outreach";
import * as whatsapp from "../../convex/whatsapp";
import * as conversation from "../../convex/conversation";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "outreach.ts": async () => outreach,
  "whatsapp.ts": async () => whatsapp,
  "conversation.ts": async () => conversation,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("whatsapp.handleInboundMessage", () => {
  it("matches phone to candidate's most recent active outbound", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      const candidateId = await ctx.db.insert("candidates", {
        name: "Asha", phone: "+919876543210",
        qualifications: [], certifications: [], boardExperience: [], subjects: [],
        talentBankFlag: false,
      });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: ["B.Ed"],
        naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
      });
      const appId = await ctx.db.insert("applications", {
        candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now(),
      });
      await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId, schoolId, type: "shortlist",
        channel: "whatsapp", body: "Hi", status: "sent",
        direction: "outbound", sentAt: Date.now() - 1000,
      });
      return { schoolId, candidateId, appId };
    });

    const result = await t.action(apiModule.api.whatsapp.handleInboundMessage, {
      fromPhone: "+919876543210",
      body: "Yes, interested",
    });

    expect(result.matched).toBe(true);
    expect(result.applicationId).toBe(ids.appId);

    const inbound = await t.run(async (ctx) =>
      ctx.db.query("outreachMessages")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", ids.appId))
        .filter((q) => q.eq(q.field("direction"), "inbound"))
        .first(),
    );
    expect(inbound?.body).toContain("Yes, interested");
  });

  it("returns matched=false when phone is unknown", async () => {
    const t = convexTest(schema, modules);
    const result = await t.action(apiModule.api.whatsapp.handleInboundMessage, {
      fromPhone: "+910000000000",
      body: "test",
    });
    expect(result.matched).toBe(false);
  });
});
