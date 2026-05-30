import { mutation, query, action, internalQuery, internalMutation } from "./_generated/server";
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

export const getConfirmContext = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const bookingToken = await ctx.db
      .query("bookingTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!bookingToken || bookingToken.used || Date.now() > bookingToken.expiresAt) {
      return null;
    }

    const app = await ctx.db.get(bookingToken.applicationId);
    if (!app) return null;

    const candidate = await ctx.db.get(app.candidateId);
    const school = await ctx.db.get(bookingToken.schoolId);

    return {
      applicationId: bookingToken.applicationId,
      schoolId: bookingToken.schoolId,
      candidateEmail: candidate?.email,
      schoolName: school?.name ?? "School",
    };
  },
});

export const finalizeBooking = internalMutation({
  args: {
    token: v.string(),
    startMs: v.number(),
    endMs: v.number(),
    googleEventId: v.optional(v.string()),
    meetLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const bookingToken = await ctx.db
      .query("bookingTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!bookingToken || bookingToken.used || Date.now() > bookingToken.expiresAt) {
      throw new Error("Invalid or expired booking token");
    }

    const app = await ctx.db.get(bookingToken.applicationId);
    if (!app) throw new Error("Application not found");

    await ctx.db.patch(bookingToken._id, { used: true });

    await ctx.db.insert("calendarEvents", {
      applicationId: bookingToken.applicationId,
      schoolId: bookingToken.schoolId,
      googleEventId: args.googleEventId ?? `rr_${bookingToken._id}`,
      summary: "Demo Lesson",
      start: args.startMs,
      end: args.endMs,
      attendees: [],
      meetLink: args.meetLink,
    });

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
  },
});

export const confirmBooking = action({
  args: {
    token: v.string(),
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args): Promise<{ success: true }> => {
    const context = await ctx.runQuery(internal.booking.getConfirmContext, {
      token: args.token,
    });
    if (!context) throw new Error("Invalid or expired booking token");

    const event = await ctx.runAction(internal.calendar.createGoogleEvent, {
      schoolId: context.schoolId,
      summary: `Demo Lesson - ${context.schoolName}`,
      startMs: args.startMs,
      endMs: args.endMs,
      candidateEmail: context.candidateEmail,
    });

    await ctx.runMutation(internal.booking.finalizeBooking, {
      token: args.token,
      startMs: args.startMs,
      endMs: args.endMs,
      googleEventId: event.googleEventId ?? undefined,
      meetLink: event.meetLink ?? undefined,
    });

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
