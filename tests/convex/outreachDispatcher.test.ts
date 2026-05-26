import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as outreach from "../../convex/outreach";
import * as whatsapp from "../../convex/whatsapp";
import * as resend from "../../convex/resend";
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
  "resend.ts": async () => resend,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("dispatchScheduledOutreach", () => {
  it("processes due scheduled whatsapp messages and flips status away from scheduled", async () => {
    const t = convexTest(schema, modules);

    const schoolId = await t.mutation("schools:create", {
      name: "Test School",
      board: "CBSE",
      city: "Delhi",
      state: "Delhi",
    });
    const candidateId = await t.mutation("candidates:create", {
      name: "Priya Sharma",
      phone: "+919876543210",
      email: "priya@example.com",
      qualifications: ["B.Ed"],
      subjects: ["Physics"],
    });
    const appId = await t.mutation("applications:create", {
      candidateId,
      schoolId,
      skipTriage: true,
    });

    // Insert a scheduled whatsapp message with scheduledSendAt in the past
    await t.run(async (ctx: any) => {
      await ctx.db.insert("outreachMessages", {
        applicationId: appId,
        candidateId,
        type: "shortlist",
        channel: "whatsapp",
        body: "Hi Priya, we'd love to talk about the Physics position.",
        scheduledSendAt: Date.now() - 5000,
        status: "scheduled",
        draftedBy: "triage_agent",
      });
    });

    const result = await t.action("outreach:dispatchScheduledOutreach", {});

    expect(result.processed).toBe(1);
    expect(result.sent + result.failed).toBe(1);

    // Verify the message is no longer "scheduled"
    const history = await t.query("outreach:getMessageHistory", { applicationId: appId });
    expect(history).toHaveLength(1);
    expect(history[0].status).not.toBe("scheduled");
    expect(["sent", "failed"]).toContain(history[0].status);
  });

  it("processes due scheduled email messages and flips status away from scheduled", async () => {
    const t = convexTest(schema, modules);

    const schoolId = await t.mutation("schools:create", {
      name: "Email School",
      board: "ICSE",
      city: "Mumbai",
      state: "Maharashtra",
    });
    const candidateId = await t.mutation("candidates:create", {
      name: "Rahul Verma",
      email: "rahul@example.com",
      qualifications: ["M.Sc"],
      subjects: ["Chemistry"],
    });
    const appId = await t.mutation("applications:create", {
      candidateId,
      schoolId,
      skipTriage: true,
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("outreachMessages", {
        applicationId: appId,
        candidateId,
        type: "rejection",
        channel: "email",
        body: "Subject: Application Update\n\nDear Rahul, thank you for applying.",
        scheduledSendAt: Date.now() - 2000,
        status: "scheduled",
        draftedBy: "triage_agent",
      });
    });

    const result = await t.action("outreach:dispatchScheduledOutreach", {});

    expect(result.processed).toBe(1);
    expect(result.sent + result.failed).toBe(1);

    const history = await t.query("outreach:getMessageHistory", { applicationId: appId });
    expect(history).toHaveLength(1);
    expect(history[0].status).not.toBe("scheduled");
    expect(["sent", "failed"]).toContain(history[0].status);
  });

  it("does not process messages with scheduledSendAt in the future", async () => {
    const t = convexTest(schema, modules);

    const schoolId = await t.mutation("schools:create", {
      name: "Future School",
      board: "IB",
      city: "Pune",
      state: "Maharashtra",
    });
    const candidateId = await t.mutation("candidates:create", {
      name: "Anita Singh",
      phone: "+919000000001",
      qualifications: ["B.Ed"],
      subjects: ["Math"],
    });
    const appId = await t.mutation("applications:create", {
      candidateId,
      schoolId,
      skipTriage: true,
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("outreachMessages", {
        applicationId: appId,
        candidateId,
        type: "shortlist",
        channel: "whatsapp",
        body: "Future message",
        scheduledSendAt: Date.now() + 3_600_000, // 1 hour from now
        status: "scheduled",
        draftedBy: "triage_agent",
      });
    });

    const result = await t.action("outreach:dispatchScheduledOutreach", {});

    expect(result.processed).toBe(0);

    // Message should still be "scheduled"
    const history = await t.query("outreach:getMessageHistory", { applicationId: appId });
    expect(history[0].status).toBe("scheduled");
  });

  it("marks failed when candidate has no phone for whatsapp channel", async () => {
    const t = convexTest(schema, modules);

    const schoolId = await t.mutation("schools:create", {
      name: "No Phone School",
      board: "CBSE",
      city: "Jaipur",
      state: "Rajasthan",
    });
    const candidateId = await t.mutation("candidates:create", {
      name: "No Phone Candidate",
      qualifications: ["B.Ed"],
      subjects: ["Math"],
      // no phone
    });
    const appId = await t.mutation("applications:create", {
      candidateId,
      schoolId,
      skipTriage: true,
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("outreachMessages", {
        applicationId: appId,
        candidateId,
        type: "shortlist",
        channel: "whatsapp",
        body: "Hi, you have been shortlisted.",
        scheduledSendAt: Date.now() - 1000,
        status: "scheduled",
        draftedBy: "triage_agent",
      });
    });

    const result = await t.action("outreach:dispatchScheduledOutreach", {});

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);

    const history = await t.query("outreach:getMessageHistory", { applicationId: appId });
    expect(history[0].status).toBe("failed");
  });

  it("marks failed when candidate has no email for email channel", async () => {
    const t = convexTest(schema, modules);

    const schoolId = await t.mutation("schools:create", {
      name: "No Email School",
      board: "State",
      city: "Chennai",
      state: "Tamil Nadu",
    });
    const candidateId = await t.mutation("candidates:create", {
      name: "No Email Candidate",
      qualifications: ["B.Ed"],
      subjects: ["Tamil"],
      // no email
    });
    const appId = await t.mutation("applications:create", {
      candidateId,
      schoolId,
      skipTriage: true,
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("outreachMessages", {
        applicationId: appId,
        candidateId,
        type: "rejection",
        channel: "email",
        body: "Subject: Update\n\nDear candidate, thank you.",
        scheduledSendAt: Date.now() - 1000,
        status: "scheduled",
        draftedBy: "triage_agent",
      });
    });

    const result = await t.action("outreach:dispatchScheduledOutreach", {});

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);

    const history = await t.query("outreach:getMessageHistory", { applicationId: appId });
    expect(history[0].status).toBe("failed");
  });
});
