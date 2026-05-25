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

async function setupApp(t: ReturnType<typeof convexTest>) {
  const schoolId = await t.mutation("schools:create", {
    name: "Test School",
    board: "CBSE",
    city: "Test",
    state: "Test",
  });
  const jobId = await t.mutation("jobs:create", {
    schoolId,
    title: "Math TGT",
    subject: "Math",
    level: "TGT",
    board: "CBSE",
    qualifications: ["B.Ed"],
    naturalLanguageDescription: "desc",
  });
  const candidateId = await t.mutation("candidates:create", {
    name: "Rajesh Kumar",
    phone: "+919876543210",
    qualifications: ["B.Ed"],
    subjects: ["Math"],
  });
  const appId = await t.mutation("applications:create", {
    candidateId,
    jobPostingId: jobId,
    schoolId,
  });
  return { schoolId, jobId, candidateId, appId };
}

describe("outreach", () => {
  it("sends a WhatsApp shortlist message", async () => {
    const t = convexTest(schema, modules);
    const { appId, candidateId } = await setupApp(t);

    const msgId = await t.mutation("outreach:sendMessage", {
      applicationId: appId,
      candidateId,
      type: "shortlist",
      channel: "whatsapp",
      body: "Your application for Math TGT has been shortlisted.",
    });
    expect(msgId).toBeDefined();

    const history = await t.query("outreach:getMessageHistory", { applicationId: appId });
    expect(history).toHaveLength(1);
    expect(history[0].type).toBe("shortlist");
    expect(history[0].channel).toBe("whatsapp");
    expect(history[0].status).toBe("sent");
  });

  it("schedules a demo lesson with details", async () => {
    const t = convexTest(schema, modules);
    const { appId, candidateId } = await setupApp(t);

    const msgId = await t.mutation("outreach:sendMessage", {
      applicationId: appId,
      candidateId,
      type: "demo_schedule",
      channel: "whatsapp",
      body: "Demo lesson scheduled for May 25, 2026 at 10:00 AM. Topic: Quadratic Equations. Class: 10.",
    });
    expect(msgId).toBeDefined();

    const history = await t.query("outreach:getMessageHistory", { applicationId: appId });
    expect(history[0].type).toBe("demo_schedule");
  });

  it("records multiple messages in history", async () => {
    const t = convexTest(schema, modules);
    const { appId, candidateId } = await setupApp(t);

    await t.mutation("outreach:sendMessage", {
      applicationId: appId,
      candidateId,
      type: "shortlist",
      channel: "whatsapp",
      body: "Message 1",
    });
    await t.mutation("outreach:sendMessage", {
      applicationId: appId,
      candidateId,
      type: "demo_schedule",
      channel: "whatsapp",
      body: "Message 2",
    });
    await t.mutation("outreach:sendMessage", {
      applicationId: appId,
      candidateId,
      type: "feedback_request",
      channel: "whatsapp",
      body: "Message 3",
    });

    const history = await t.query("outreach:getMessageHistory", { applicationId: appId });
    expect(history).toHaveLength(3);
  });

  it("returns empty history for app with no messages", async () => {
    const t = convexTest(schema, modules);
    const { appId } = await setupApp(t);

    const history = await t.query("outreach:getMessageHistory", { applicationId: appId });
    expect(history).toEqual([]);
  });
});
