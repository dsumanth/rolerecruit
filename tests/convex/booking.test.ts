import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as booking from "../../convex/booking";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "booking.ts": async () => booking,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", {
      name: "Acme", board: "CBSE", city: "X", state: "X", planTier: "free",
    });
    const candidateId = await ctx.db.insert("candidates", {
      name: "Asha", email: "asha@x.com", qualifications: [], certifications: [],
      boardExperience: [], subjects: [], talentBankFlag: false,
    });
    const jobId = await ctx.db.insert("jobPostings", {
      schoolId, title: "Math Teacher", subject: "Math", level: "TGT", board: "CBSE",
      qualifications: [], naturalLanguageDescription: "d", status: "active",
      createdAt: Date.now(),
    });
    const applicationId = await ctx.db.insert("applications", {
      schoolId, candidateId, jobPostingId: jobId, stage: "shortlisted",
      createdAt: Date.now(),
    });
    await ctx.db.insert("pipelineConfigs", {
      schoolId,
      stages: [
        { id: "shortlisted", name: "Shortlisted", order: 0 },
        { id: "demo_scheduled", name: "Demo Scheduled", order: 1 },
      ],
      transitions: [{ fromStageId: "shortlisted", toStageId: "demo_scheduled" }],
      version: 1,
    });
    const token = "tok123";
    await ctx.db.insert("bookingTokens", {
      token, applicationId, schoolId,
      expiresAt: Date.now() + 60_000, used: false,
    });
    return { schoolId, applicationId, token };
  });
}

describe("finalizeBooking", () => {
  it("marks the token used, stores the google event + meet link, and advances the stage", async () => {
    const t = convexTest(schema, modules);
    const { applicationId, token } = await seed(t);

    await t.mutation(apiModule.internal.booking.finalizeBooking, {
      token, startMs: 1000, endMs: 2000,
      googleEventId: "ev123", meetLink: "https://meet.google.com/x",
    });

    const { app, events, bookingToken } = await t.run(async (ctx) => {
      const app = await ctx.db.get(applicationId);
      const events = await ctx.db
        .query("calendarEvents")
        .withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
        .collect();
      const bookingToken = await ctx.db
        .query("bookingTokens")
        .withIndex("by_token", (q) => q.eq("token", token))
        .first();
      return { app, events, bookingToken };
    });

    expect(bookingToken?.used).toBe(true);
    expect(app?.stage).toBe("demo_scheduled");
    expect(events).toHaveLength(1);
    expect(events[0].googleEventId).toBe("ev123");
    expect(events[0].meetLink).toBe("https://meet.google.com/x");
  });

  it("rejects an already-used token", async () => {
    const t = convexTest(schema, modules);
    const { token } = await seed(t);

    await t.mutation(apiModule.internal.booking.finalizeBooking, {
      token, startMs: 1000, endMs: 2000,
    });

    await expect(
      t.mutation(apiModule.internal.booking.finalizeBooking, {
        token, startMs: 1000, endMs: 2000,
      }),
    ).rejects.toThrow("Invalid or expired booking token");
  });
});
