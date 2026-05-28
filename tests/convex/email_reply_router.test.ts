import { describe, it, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as outreach from "../../convex/outreach";
import * as emailReplyRouter from "../../convex/email_reply_router";
import * as emailIngestion from "../../convex/email_ingestion";
import * as careers from "../../convex/careers";
import * as conversation from "../../convex/conversation";
import * as aiCandidateParsing from "../../convex/ai_candidate_parsing";
import * as intake from "../../convex/intake";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

vi.mock("../../convex/lib/llmClient", () => ({
  getLlmClient: () => null,
  LLM_MODEL: "test",
}));

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "outreach.ts": async () => outreach,
  "email_reply_router.ts": async () => emailReplyRouter,
  "email_ingestion.ts": async () => emailIngestion,
  "careers.ts": async () => careers,
  "conversation.ts": async () => conversation,
  "ai_candidate_parsing.ts": async () => aiCandidateParsing,
  "intake.ts": async () => intake,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("email_reply_router.dispatch", () => {
  it("routes a tokenized reply to an existing application as inbound", async () => {
    const t = convexTest(schema, modules);
    const setupIds = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      const candidateId = await ctx.db.insert("candidates", {
        name: "Asha", email: "asha@example.com",
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
      const outboundId = await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId, schoolId,
        type: "shortlist", channel: "email", body: "Hi Asha", status: "sent",
        direction: "outbound", replyToken: "abc123token4567890123456789012345".slice(0, 32),
        sentAt: Date.now(),
      });
      return { appId, candidateId, schoolId, outboundId };
    });

    const token = "abc123token4567890123456789012345".slice(0, 32);
    const result = await t.action(apiModule.api.email_reply_router.dispatch, {
      to: `reply+${token}@rolerecruit.com`,
      from: "Asha <asha@example.com>",
      subject: "Re: Hi",
      text: "Yes, I'm interested.",
      attachments: [],
    });

    expect(result.routed).toBe("reply");
    expect(result.applicationId).toBe(setupIds.appId);

    const inboundRow = await t.run(async (ctx) =>
      ctx.db.query("outreachMessages")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", setupIds.appId))
        .filter((q) => q.eq(q.field("direction"), "inbound"))
        .first(),
    );
    expect(inboundRow).not.toBeNull();
    expect(inboundRow?.body).toContain("Yes, I'm interested.");
    expect(inboundRow?.inReplyToMessageId).toBe(setupIds.outboundId);
  });

  it("returns routed='new_resume' when the token does not match", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("schools", {
        name: "Demo", board: "CBSE", city: "X", state: "X", planTier: "free", slug: "demo",
      });
    });
    const result = await t.action(apiModule.api.email_reply_router.dispatch, {
      to: "reply+nonexistenttokenxxxxxxxxxxxxxx@rolerecruit.com",
      from: "candidate@example.com",
      subject: "Re:",
      text: "test",
      attachments: [],
    });
    expect(result.routed).toBe("new_resume");
  });

  it("returns routed='new_resume' when there is no token", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("schools", {
        name: "Demo", board: "CBSE", city: "X", state: "X", planTier: "free", slug: "demo",
      });
    });
    const result = await t.action(apiModule.api.email_reply_router.dispatch, {
      to: "demo@rolerecruit.com",
      from: "candidate@example.com",
      subject: "Application",
      text: "Hi, I'm applying",
      attachments: [],
    });
    expect(result.routed).toBe("new_resume");
  });
});
