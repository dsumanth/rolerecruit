import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { renderBrief } from "./morningBrief_render";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istTodayLabel(now: number): string {
  const istNow = new Date(now + IST_OFFSET_MS);
  const month = istNow.toUTCString().slice(8, 11);
  const day = istNow.getUTCDate();
  return `${month} ${day}`;
}

export const getSchoolWithRecipients = internalQuery({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) return null;
    const recipientIds = school.morningBriefRecipientUserIds ?? [];
    const recipients: Array<{ userId: string; email: string; name: string }> = [];
    for (const userId of recipientIds) {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (!profile) continue;
      recipients.push({ userId, email: profile.email, name: profile.name });
    }
    return {
      schoolId: school._id,
      schoolName: school.name,
      enabled: school.morningBriefEnabled === true,
      recipients,
    };
  },
});

export const listAllSchoolIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const schools = await ctx.db.query("schools").collect();
    return schools.map((s) => s._id);
  },
});

export const sendBriefForSchool = internalAction({
  args: { schoolId: v.id("schools") },
  handler: async (
    ctx,
    args,
  ): Promise<{ skipped: boolean; reason?: string; recipientsSent: number }> => {
    const info = await ctx.runQuery(internal.morningBrief.getSchoolWithRecipients, {
      schoolId: args.schoolId,
    });
    if (!info) return { skipped: true, reason: "school_not_found", recipientsSent: 0 };
    if (info.recipients.length === 0) return { skipped: true, reason: "no_recipients", recipientsSent: 0 };
    if (!info.enabled) return { skipped: true, reason: "disabled", recipientsSent: 0 };

    const stats = await ctx.runQuery(api.morningBrief_stats.collectStats, { schoolId: args.schoolId });
    const { subject, htmlBody, textBody } = renderBrief({
      schoolName: info.schoolName,
      stats,
      todayLabel: istTodayLabel(Date.now()),
    });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[morningBrief] RESEND_API_KEY missing, skipping send");
      return { skipped: true, reason: "no_api_key", recipientsSent: 0 };
    }
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    let sent = 0;
    for (const r of info.recipients) {
      try {
        await resend.emails.send({
          from: "RoleRecruit <noreply@rolerecruit.com>",
          to: r.email,
          subject,
          text: textBody,
          html: htmlBody,
        });
        sent++;
      } catch (err) {
        console.error(`[morningBrief] failed to send to ${r.email}:`, err);
      }
    }
    return { skipped: false, recipientsSent: sent };
  },
});

export const sendAllSchools = internalAction({
  args: {},
  handler: async (ctx): Promise<{ schoolsProcessed: number }> => {
    const ids = await ctx.runQuery(internal.morningBrief.listAllSchoolIds, {});
    for (const id of ids) {
      try {
        await ctx.runAction(internal.morningBrief.sendBriefForSchool, { schoolId: id });
      } catch (err) {
        console.error(`[morningBrief] school ${id} failed:`, err);
      }
    }
    return { schoolsProcessed: ids.length };
  },
});
