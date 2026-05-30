import { mutation, query, action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function calculateSlots(
  workingHoursStart: string,
  workingHoursEnd: string,
  slotDuration: number,
  busyBlocks: { start: number; end: number }[],
  dateStart: number
): { start: string; end: string; startMs: number; endMs: number }[] {
  const dayStartMin = timeToMinutes(workingHoursStart);
  const dayEndMin = timeToMinutes(workingHoursEnd);
  const slots: { start: string; end: string; startMs: number; endMs: number }[] = [];

  for (let m = dayStartMin; m + slotDuration <= dayEndMin; m += slotDuration) {
    const slotStartMs = dateStart + m * 60 * 1000;
    const slotEndMs = slotStartMs + slotDuration * 60 * 1000;

    const isBusy = busyBlocks.some(
      (block) => slotStartMs < block.end && slotEndMs > block.start
    );

    if (!isBusy && slotStartMs > Date.now()) {
      slots.push({
        start: minutesToTime(m),
        end: minutesToTime(m + slotDuration),
        startMs: slotStartMs,
        endMs: slotEndMs,
      });
    }
  }

  return slots;
}

export const getSlotConfig = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("slotConfigs")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
  },
});

export const getSlotConfigInternal = internalQuery({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("slotConfigs")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();
  },
});

export const updateSlotConfig = mutation({
  args: {
    schoolId: v.id("schools"),
    advanceDays: v.number(),
    workingHoursStart: v.string(),
    workingHoursEnd: v.string(),
    slotDuration: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("slotConfigs")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .first();

    if (existing) {
      return await ctx.db.patch(existing._id, {
        advanceDays: args.advanceDays,
        workingHoursStart: args.workingHoursStart,
        workingHoursEnd: args.workingHoursEnd,
        slotDuration: args.slotDuration,
      });
    }

    return await ctx.db.insert("slotConfigs", {
      schoolId: args.schoolId,
      advanceDays: args.advanceDays,
      workingHoursStart: args.workingHoursStart,
      workingHoursEnd: args.workingHoursEnd,
      slotDuration: args.slotDuration,
    });
  },
});

export const getAvailableSlotsForDate = action({
  args: {
    schoolId: v.id("schools"),
    date: v.string(),
  },
  handler: async (ctx, args): Promise<{ start: string; end: string; startMs: number; endMs: number }[]> => {
    const slotConfig = await ctx.runQuery(internal.slot_calculator.getSlotConfigInternal, {
      schoolId: args.schoolId,
    });
    if (!slotConfig) return [];

    const interviewerCalendars = await ctx.runQuery(
      internal.calendar.getInterviewerCalendarsForSchool,
      { schoolId: args.schoolId }
    );

    const dateObj = new Date(args.date);
    const dateStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
    const dateEnd = dateStart + 24 * 60 * 60 * 1000;

    const busyBlocks: { start: number; end: number }[] = [];

    for (const cal of interviewerCalendars) {
      try {
        const accessToken: string = await ctx.runAction(
          internal.calendar.ensureFreshToken,
          {
            calendarId: cal._id,
            accessToken: cal.googleTokens.access_token,
            refreshToken: cal.googleTokens.refresh_token,
            expiry: cal.googleTokens.expiry,
          }
        );
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendarId)}/events?timeMin=${new Date(dateStart).toISOString()}&timeMax=${new Date(dateEnd).toISOString()}&singleEvents=true&orderBy=startTime`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (response.ok) {
          const data = await response.json();
          for (const event of data.items ?? []) {
            if (event.start?.dateTime && event.end?.dateTime) {
              busyBlocks.push({
                start: new Date(event.start.dateTime).getTime(),
                end: new Date(event.end.dateTime).getTime(),
              });
            }
          }
        }
      } catch {
        // Skip unavailable calendars
      }
    }

    return calculateSlots(
      slotConfig.workingHoursStart,
      slotConfig.workingHoursEnd,
      slotConfig.slotDuration,
      busyBlocks,
      dateStart
    );
  },
});
