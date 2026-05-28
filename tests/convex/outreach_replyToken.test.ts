import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as outreach from "../../convex/outreach";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "outreach.ts": async () => outreach,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

async function setup(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", {
      name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
    });
    const jobId = await ctx.db.insert("jobPostings", {
      schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE",
      qualifications: ["B.Ed"], naturalLanguageDescription: "d",
      status: "active", createdAt: Date.now(),
    });
    const candidateId = await ctx.db.insert("candidates", {
      name: "A", qualifications: [], certifications: [], boardExperience: [], subjects: [],
      talentBankFlag: false,
    });
    const appId = await ctx.db.insert("applications", {
      candidateId, jobPostingId: jobId, schoolId, stage: "new", createdAt: Date.now(),
    });
    return { schoolId, candidateId, appId };
  });
}

describe("outreach createDraft", () => {
  it("sets direction='outbound' and schoolId on a new email draft", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, candidateId, appId } = await setup(t);
    const msgId = await t.run(async (ctx) =>
      ctx.runMutation(apiModule.internal.outreach.createDraft, {
        applicationId: appId,
        candidateId,
        type: "shortlist",
        channel: "email",
        body: "Subject: Hi\n\nHello",
      }),
    );
    const row = await t.run(async (ctx) => ctx.db.get(msgId));
    expect(row?.direction).toBe("outbound");
    expect(row?.schoolId).toBe(schoolId);
    expect(typeof row?.replyToken).toBe("string");
    expect(row?.replyToken?.length).toBe(32);
  });

  it("does NOT generate a replyToken for whatsapp channel", async () => {
    const t = convexTest(schema, modules);
    const { candidateId, appId } = await setup(t);
    const msgId = await t.run(async (ctx) =>
      ctx.runMutation(apiModule.internal.outreach.createDraft, {
        applicationId: appId,
        candidateId,
        type: "shortlist",
        channel: "whatsapp",
        body: "Hi",
      }),
    );
    const row = await t.run(async (ctx) => ctx.db.get(msgId));
    expect(row?.direction).toBe("outbound");
    expect(row?.replyToken).toBeUndefined();
  });
});
