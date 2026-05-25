import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 48; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export const generateBookingToken = mutation({
  args: {
    applicationId: v.id("applications"),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const token = generateToken();
    await ctx.db.insert("bookingTokens", {
      token,
      applicationId: args.applicationId,
      schoolId: args.schoolId,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      used: false,
    });
    return token;
  },
});

export const getBookingByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const bookingToken = await ctx.db
      .query("bookingTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!bookingToken) return { valid: false as const, reason: "not_found" as const };
    if (bookingToken.used) return { valid: false as const, reason: "used" as const };
    if (Date.now() > bookingToken.expiresAt) return { valid: false as const, reason: "expired" as const };

    const app = await ctx.db.get(bookingToken.applicationId);
    if (!app) return { valid: false as const, reason: "application_not_found" as const };

    const job = app.jobPostingId ? await ctx.db.get(app.jobPostingId) : null;
    const school = await ctx.db.get(app.schoolId);

    return {
      valid: true as const,
      applicationId: app._id,
      schoolId: app.schoolId,
      jobTitle: job?.title ?? "Position",
      schoolName: school?.name ?? "School",
    };
  },
});

export const confirmBooking = mutation({
  args: {
    token: v.string(),
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) => {
    const bookingToken = await ctx.db
      .query("bookingTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!bookingToken || bookingToken.used || Date.now() > bookingToken.expiresAt) {
      throw new Error("Invalid or expired booking token");
    }

    await ctx.db.patch(bookingToken._id, { used: true });

    const app = await ctx.db.get(bookingToken.applicationId);
    if (!app) throw new Error("Application not found");

    // Create calendar event record
    const eventId = `rr_${bookingToken._id}`;
    await ctx.db.insert("calendarEvents", {
      applicationId: bookingToken.applicationId,
      schoolId: bookingToken.schoolId,
      googleEventId: eventId,
      summary: `Demo Lesson`,
      start: args.startMs,
      end: args.endMs,
      attendees: [],
    });

    // Move application to next stage if config exists
    const config = await ctx.db
      .query("pipelineConfigs")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", bookingToken.schoolId))
      .first();

    if (config) {
      const nextTransition = config.transitions.find(t => t.fromStageId === app.stage);
      if (nextTransition) {
        await ctx.db.patch(app._id, { stage: nextTransition.toStageId });
      }
    }

    return { success: true };
  },
});

export const createCalendarEventForBooking = internalMutation({
  args: {
    applicationId: v.id("applications"),
    schoolId: v.id("schools"),
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) => {
    const eventId = `rr_event_${args.applicationId}_${args.startMs}`;
    await ctx.db.insert("calendarEvents", {
      applicationId: args.applicationId,
      schoolId: args.schoolId,
      googleEventId: eventId,
      summary: "Demo Lesson",
      start: args.startMs,
      end: args.endMs,
      attendees: [],
    });
  },
});
