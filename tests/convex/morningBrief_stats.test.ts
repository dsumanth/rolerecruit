import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as outreach from "../../convex/outreach";
import * as morningBriefStats from "../../convex/morningBrief_stats";
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
  "morningBrief_stats.ts": async () => morningBriefStats,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("collectStats", () => {
  it("returns zeros for an empty school", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      return await ctx.db.insert("schools", {
        name: "Empty", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
    });
    const stats = await t.query(apiModule.api.morningBrief_stats.collectStats, { schoolId });
    expect(stats.newApps24h.count).toBe(0);
    expect(stats.strongAvailable).toEqual([]);
    expect(stats.stalled).toEqual([]);
    expect(stats.demosToday).toBe(0);
    expect(stats.escalatedInboxCount).toBe(0);
  });

  it("counts applications created in the last 24h as newApps24h", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      const candidateId = await ctx.db.insert("candidates", {
        name: "Asha",
        qualifications: ["B.Ed"],
        certifications: [],
        boardExperience: [],
        subjects: ["Math"],
        talentBankFlag: false,
      });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "Math", subject: "Math", level: "TGT", board: "CBSE",
        qualifications: ["B.Ed"], naturalLanguageDescription: "d",
        status: "active", createdAt: Date.now(),
      });
      await ctx.db.insert("applications", {
        candidateId, jobPostingId: jobId, schoolId, stage: "new",
        createdAt: Date.now(), aiMatchScore: 82,
      });
      return { schoolId };
    });
    const stats = await t.query(apiModule.api.morningBrief_stats.collectStats, { schoolId: ids.schoolId });
    expect(stats.newApps24h.count).toBe(1);
    expect(stats.newApps24h.top[0]?.candidateName).toBe("Asha");
    expect(stats.newApps24h.top[0]?.score).toBe(82);
  });

  it("flags strong, uncontacted candidates above autoShortlistThreshold", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
        autoShortlistThreshold: 75,
      });
      const cId = await ctx.db.insert("candidates", {
        name: "Bina", qualifications: [], certifications: [], boardExperience: [], subjects: [],
        talentBankFlag: false,
      });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE",
        qualifications: [], naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
      });
      await ctx.db.insert("applications", {
        candidateId: cId, jobPostingId: jobId, schoolId, stage: "shortlisted",
        createdAt: Date.now() - 48 * 60 * 60 * 1000, aiMatchScore: 88,
      });
      return { schoolId };
    });
    const stats = await t.query(apiModule.api.morningBrief_stats.collectStats, { schoolId: ids.schoolId });
    expect(stats.strongAvailable.length).toBe(1);
    expect(stats.strongAvailable[0].candidateName).toBe("Bina");
    expect(stats.strongAvailable[0].score).toBe(88);
  });

  it("excludes strong candidates already contacted with demo_schedule", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
        autoShortlistThreshold: 75,
      });
      const cId = await ctx.db.insert("candidates", {
        name: "X", qualifications: [], certifications: [], boardExperience: [], subjects: [],
        talentBankFlag: false,
      });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE",
        qualifications: [], naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
      });
      const appId = await ctx.db.insert("applications", {
        candidateId: cId, jobPostingId: jobId, schoolId, stage: "shortlisted",
        createdAt: Date.now(), aiMatchScore: 90,
      });
      await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId: cId, schoolId, type: "demo_schedule",
        channel: "email", body: "demo", status: "sent", sentAt: Date.now(),
      });
      return { schoolId };
    });
    const stats = await t.query(apiModule.api.morningBrief_stats.collectStats, { schoolId: ids.schoolId });
    expect(stats.strongAvailable.length).toBe(0);
  });

  it("flags stalled candidates (no reply 5+ days after outbound)", async () => {
    const t = convexTest(schema, modules);
    const DAY = 24 * 60 * 60 * 1000;
    const ids = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      const cId = await ctx.db.insert("candidates", {
        name: "Carl", qualifications: [], certifications: [], boardExperience: [], subjects: [],
        talentBankFlag: false,
      });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE",
        qualifications: [], naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
      });
      const appId = await ctx.db.insert("applications", {
        candidateId: cId, jobPostingId: jobId, schoolId, stage: "shortlisted",
        createdAt: Date.now() - 10 * DAY,
      });
      await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId: cId, schoolId, type: "shortlist",
        channel: "email", body: "hi", status: "sent",
        direction: "outbound", sentAt: Date.now() - 6 * DAY,
      });
      return { schoolId };
    });
    const stats = await t.query(apiModule.api.morningBrief_stats.collectStats, { schoolId: ids.schoolId });
    expect(stats.stalled.length).toBe(1);
    expect(stats.stalled[0].candidateName).toBe("Carl");
  });

  it("counts unresolved escalated inbound messages, deduped by application", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "S", board: "CBSE", city: "X", state: "X", planTier: "free",
      });
      const cId = await ctx.db.insert("candidates", {
        name: "Z", qualifications: [], certifications: [], boardExperience: [], subjects: [],
        talentBankFlag: false,
      });
      const jobId = await ctx.db.insert("jobPostings", {
        schoolId, title: "T", subject: "Math", level: "TGT", board: "CBSE",
        qualifications: [], naturalLanguageDescription: "d", status: "active", createdAt: Date.now(),
      });
      const appId = await ctx.db.insert("applications", {
        candidateId: cId, jobPostingId: jobId, schoolId, stage: "shortlisted", createdAt: Date.now(),
      });
      await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId: cId, schoolId, type: "candidate_reply",
        channel: "email", body: "x", status: "sent", direction: "inbound",
        escalated: true, escalationReason: "negotiation", sentAt: Date.now(),
      });
      await ctx.db.insert("outreachMessages", {
        applicationId: appId, candidateId: cId, schoolId, type: "candidate_reply",
        channel: "email", body: "y", status: "sent", direction: "inbound",
        escalated: true, escalationReason: "negotiation", sentAt: Date.now() + 1,
      });
      return { schoolId };
    });
    const stats = await t.query(apiModule.api.morningBrief_stats.collectStats, { schoolId: ids.schoolId });
    expect(stats.escalatedInboxCount).toBe(1);
  });
});
