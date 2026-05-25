import { mutation, query, action, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Internal query: get interviewer calendar
export const getInterviewerCalendarByUserId = internalQuery({
  args: { userId: v.string(), schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("interviewerCalendars")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const getConnectionStatus = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { connected: false };

    const calendar = await ctx.db
      .query("interviewerCalendars")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    const school = await ctx.db.get(args.schoolId);
    return {
      connected: school?.googleCalendarConnected ?? false,
      email: calendar?.googleEmail ?? null,
    };
  },
});

export const disconnectCalendar = mutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const calendar = await ctx.db
      .query("interviewerCalendars")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    if (calendar) {
      await ctx.db.delete(calendar._id);
    }

    await ctx.db.patch(args.schoolId, { googleCalendarConnected: false });
  },
});

export const connectGoogleCalendar = action({
  args: {
    code: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: args.code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: args.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`OAuth token exchange failed: ${await tokenResponse.text()}`);
    }

    const tokens = await tokenResponse.json();

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    const profile = await ctx.runQuery(internal.users.getProfileInternal, {
      userId: identity.subject,
    });

    if (!profile) throw new Error("Profile not found");

    const existing = await ctx.runQuery(internal.calendar.getInterviewerCalendarByUserId, {
      userId: identity.subject,
      schoolId: profile.schoolId,
    });

    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    };

    if (existing) {
      await ctx.runMutation(internal.calendar.upsertTokens, {
        existingId: existing._id,
        userId: identity.subject,
        schoolId: profile.schoolId,
        tokens: tokenData,
        email: userInfo.email,
        calendarId: "primary",
      });
    } else {
      await ctx.runMutation(internal.calendar.upsertTokens, {
        userId: identity.subject,
        schoolId: profile.schoolId,
        tokens: tokenData,
        email: userInfo.email,
        calendarId: "primary",
      });
    }

    await ctx.runMutation(internal.schools.updateCalendarConnectedInternal, {
      schoolId: profile.schoolId,
      connected: true,
    });

    return { success: true, email: userInfo.email };
  },
});

export const upsertTokens = internalMutation({
  args: {
    existingId: v.optional(v.id("interviewerCalendars")),
    userId: v.string(),
    schoolId: v.id("schools"),
    tokens: v.object({
      access_token: v.string(),
      refresh_token: v.string(),
      expiry: v.number(),
    }),
    email: v.string(),
    calendarId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.existingId) {
      return await ctx.db.patch(args.existingId, {
        googleTokens: args.tokens,
        googleEmail: args.email,
      });
    }
    return await ctx.db.insert("interviewerCalendars", {
      userId: args.userId,
      schoolId: args.schoolId,
      googleTokens: args.tokens,
      googleEmail: args.email,
      calendarId: args.calendarId,
    });
  },
});

export const getInterviewerCalendarsForSchool = internalQuery({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("interviewerCalendars")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();
  },
});
