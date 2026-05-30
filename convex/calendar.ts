import { mutation, query, action, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { needsRefresh, refreshAccessToken } from "./lib/googleToken";

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

export const persistRefreshedToken = internalMutation({
  args: {
    calendarId: v.id("interviewerCalendars"),
    accessToken: v.string(),
    expiry: v.number(),
  },
  handler: async (ctx, args) => {
    const cal = await ctx.db.get(args.calendarId);
    if (!cal) return;
    await ctx.db.patch(args.calendarId, {
      googleTokens: {
        access_token: args.accessToken,
        refresh_token: cal.googleTokens.refresh_token,
        expiry: args.expiry,
      },
    });
  },
});

export interface EventInsertInput {
  summary: string;
  startMs: number;
  endMs: number;
  attendeeEmails: string[];
}

export function buildEventInsertBody(input: EventInsertInput) {
  return {
    summary: input.summary,
    start: { dateTime: new Date(input.startMs).toISOString() },
    end: { dateTime: new Date(input.endMs).toISOString() },
    attendees: input.attendeeEmails.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: `rr-${input.startMs}-${Math.floor(Math.random() * 1e9)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
}

// Creates a real Google Calendar event on the first interviewer's calendar
// (organizer), inviting the other interviewers and the candidate, with a Meet link.
export const createGoogleEvent = internalAction({
  args: {
    schoolId: v.id("schools"),
    summary: v.string(),
    startMs: v.number(),
    endMs: v.number(),
    candidateEmail: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ googleEventId: string | null; meetLink: string | null }> => {
    const calendars = await ctx.runQuery(
      internal.calendar.getInterviewerCalendarsForSchool,
      { schoolId: args.schoolId },
    );
    if (calendars.length === 0) return { googleEventId: null, meetLink: null };

    const organizer = calendars[0];
    const accessToken = await ctx.runAction(internal.calendar.ensureFreshToken, {
      calendarId: organizer._id,
      accessToken: organizer.googleTokens.access_token,
      refreshToken: organizer.googleTokens.refresh_token,
      expiry: organizer.googleTokens.expiry,
    });

    const attendeeEmails = [
      ...calendars.map((c) => c.googleEmail),
      ...(args.candidateEmail ? [args.candidateEmail] : []),
    ];

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(organizer.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildEventInsertBody({
            summary: args.summary,
            startMs: args.startMs,
            endMs: args.endMs,
            attendeeEmails,
          }),
        ),
      },
    );

    if (!res.ok) return { googleEventId: null, meetLink: null };
    const data = await res.json();
    return {
      googleEventId: data.id ?? null,
      meetLink: data.hangoutLink ?? null,
    };
  },
});

// Returns a non-expired access token for a stored calendar, refreshing if needed.
export const ensureFreshToken = internalAction({
  args: {
    calendarId: v.id("interviewerCalendars"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiry: v.number(),
  },
  handler: async (ctx, args): Promise<string> => {
    if (!needsRefresh(args.expiry, Date.now())) return args.accessToken;
    const refreshed = await refreshAccessToken(
      {
        refreshToken: args.refreshToken,
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        nowMs: Date.now(),
      },
      fetch,
    );
    await ctx.runMutation(internal.calendar.persistRefreshedToken, {
      calendarId: args.calendarId,
      accessToken: refreshed.access_token,
      expiry: refreshed.expiry,
    });
    return refreshed.access_token;
  },
});
