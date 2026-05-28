import { query } from "./_generated/server";
import { v } from "convex/values";
import { isStalled } from "./lib/stalled";

const DAY_MS = 24 * 60 * 60 * 1000;
const TERMINAL_STAGES = new Set(["rejected", "hired", "withdrawn"]);

export interface BriefStats {
  newApps24h: { count: number; top: Array<{ candidateName: string; score: number | null }> };
  strongAvailable: Array<{ applicationId: string; candidateName: string; score: number }>;
  stalled: Array<{ applicationId: string; candidateName: string; lastOutboundAt: number }>;
  demosToday: number;
  escalatedInboxCount: number;
}

export async function collectStatsHandler(ctx: any, schoolId: any): Promise<BriefStats> {
  const now = Date.now();
  const cutoff24h = now - DAY_MS;

  const school = await ctx.db.get(schoolId);
  const threshold = school?.autoShortlistThreshold ?? 75;

  const apps = await ctx.db
    .query("applications")
    .withIndex("by_schoolId", (q: any) => q.eq("schoolId", schoolId))
    .collect();

  const recent = apps.filter((a: any) => a.createdAt >= cutoff24h);
  const recentWithCandidates = await Promise.all(
    recent.map(async (a: any) => {
      const c = await ctx.db.get(a.candidateId);
      return { app: a, name: c?.name ?? "Unknown", score: a.aiMatchScore ?? null };
    }),
  );
  recentWithCandidates.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));
  const newApps24h = {
    count: recent.length,
    top: recentWithCandidates.slice(0, 3).map((r: any) => ({ candidateName: r.name, score: r.score })),
  };

  const strongCandidates: BriefStats["strongAvailable"] = [];
  for (const app of apps) {
    if (TERMINAL_STAGES.has(app.stage)) continue;
    const score = app.aiMatchScore ?? 0;
    if (score < threshold) continue;
    const msgs = await ctx.db
      .query("outreachMessages")
      .withIndex("by_applicationId", (q: any) => q.eq("applicationId", app._id))
      .collect();
    const contacted = msgs.some((m: any) => m.type === "demo_schedule" || m.type === "offer");
    if (contacted) continue;
    const c = await ctx.db.get(app.candidateId);
    strongCandidates.push({
      applicationId: app._id,
      candidateName: c?.name ?? "Unknown",
      score,
    });
  }
  strongCandidates.sort((a, b) => b.score - a.score);
  const strongAvailable = strongCandidates.slice(0, 5);

  const stalledRows: BriefStats["stalled"] = [];
  for (const app of apps) {
    const msgs = await ctx.db
      .query("outreachMessages")
      .withIndex("by_applicationId", (q: any) => q.eq("applicationId", app._id))
      .collect();
    const outbounds = msgs
      .filter((m: any) => m.direction !== "inbound" && typeof m.sentAt === "number")
      .map((m: any) => m.sentAt as number);
    const inbounds = msgs
      .filter((m: any) => m.direction === "inbound" && typeof m.sentAt === "number")
      .map((m: any) => m.sentAt as number);
    const lastOutboundAt = outbounds.length ? Math.max(...outbounds) : null;
    const lastInboundAt = inbounds.length ? Math.max(...inbounds) : null;
    if (!isStalled({ now, lastOutboundAt, lastInboundAt, stage: app.stage })) continue;
    const c = await ctx.db.get(app.candidateId);
    stalledRows.push({
      applicationId: app._id,
      candidateName: c?.name ?? "Unknown",
      lastOutboundAt: lastOutboundAt as number,
    });
  }
  stalledRows.sort((a, b) => a.lastOutboundAt - b.lastOutboundAt);
  const stalled = stalledRows.slice(0, 5);

  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = now + IST_OFFSET_MS;
  const istMidnight = istNow - (istNow % DAY_MS);
  const istStart = istMidnight - IST_OFFSET_MS;
  const istEnd = istStart + DAY_MS;
  const events = await ctx.db
    .query("calendarEvents")
    .withIndex("by_schoolId_start", (q: any) =>
      q.eq("schoolId", schoolId).gte("start", istStart).lt("start", istEnd),
    )
    .collect();
  const demosToday = events.length;

  const escalated = await ctx.db
    .query("outreachMessages")
    .withIndex("by_schoolId_escalated", (q: any) =>
      q.eq("schoolId", schoolId).eq("escalated", true),
    )
    .collect();
  const unresolved = escalated.filter((m: any) => m.resolvedAt == null);
  const distinctApps = new Set(unresolved.map((m: any) => m.applicationId));
  const escalatedInboxCount = distinctApps.size;

  return { newApps24h, strongAvailable, stalled, demosToday, escalatedInboxCount };
}

export const collectStats = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args): Promise<BriefStats> => collectStatsHandler(ctx, args.schoolId),
});
