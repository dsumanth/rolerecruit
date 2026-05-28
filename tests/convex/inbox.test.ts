import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as outreach from "../../convex/outreach";
import * as inbox from "../../convex/inbox";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "outreach.ts": async () => outreach,
  "inbox.ts": async () => inbox,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("inbox", () => {
  it("listEscalated returns one entry per applicationId, newest first", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      const candidateId = await ctx.db.insert("candidates", {
        name: "A", qualifications: [], certifications: [], boardExperience: [], subjects: [],
        talentBankFlag: false,
      });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: [],
        naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
      });
      const appId = await ctx.db.insert("applications", {
        candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now(),
      });
      await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId, schoolId, type: "candidate_reply", channel: "email",
        body: "msg1", status: "sent", direction: "inbound", escalated: true,
        escalationReason: "negotiation", sentAt: Date.now() - 1000,
      });
      await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId, schoolId, type: "candidate_reply", channel: "email",
        body: "msg2", status: "sent", direction: "inbound", escalated: true,
        escalationReason: "negotiation", sentAt: Date.now(),
      });
      return { schoolId, appId };
    });

    const result = await t.query(apiModule.api.inbox.listEscalated, { schoolId: ids.schoolId });
    expect(result.length).toBe(1);
    expect(result[0].applicationId).toBe(ids.appId);
    expect(result[0].latestEscalationReason).toBe("negotiation");
  });

  it("countEscalated dedupes by application", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      const candidateId = await ctx.db.insert("candidates", {
        name: "A", qualifications: [], certifications: [], boardExperience: [], subjects: [],
        talentBankFlag: false,
      });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: [],
        naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
      });
      const appId = await ctx.db.insert("applications", {
        candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now(),
      });
      await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId, schoolId, type: "candidate_reply", channel: "email",
        body: "a", status: "sent", direction: "inbound", escalated: true, sentAt: Date.now(),
      });
      await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId, schoolId, type: "candidate_reply", channel: "email",
        body: "b", status: "sent", direction: "inbound", escalated: true, sentAt: Date.now() + 1,
      });
      return { schoolId };
    });
    const count = await t.query(apiModule.api.inbox.countEscalated, { schoolId: ids.schoolId });
    expect(count).toBe(1);
  });

  it("humanReply clears resolvedAt on all prior escalated messages in the thread", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      const candidateId = await ctx.db.insert("candidates", {
        name: "A", qualifications: [], certifications: [], boardExperience: [], subjects: [],
        talentBankFlag: false,
      });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE", qualifications: [],
        naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
      });
      const appId = await ctx.db.insert("applications", {
        candidateId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now(),
      });
      const escId = await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId, schoolId, type: "candidate_reply", channel: "email",
        body: "x", status: "sent", direction: "inbound", escalated: true,
        escalationReason: "negotiation", sentAt: Date.now(),
      });
      return { appId, candidateId, escId };
    });

    await t.mutation(apiModule.api.inbox.humanReply, {
      applicationId: ids.appId,
      candidateId: ids.candidateId,
      channel: "email",
      body: "Replying directly",
    });
    const esc = await t.run(async (ctx) => ctx.db.get(ids.escId));
    expect(typeof esc?.resolvedAt).toBe("number");
  });
});
