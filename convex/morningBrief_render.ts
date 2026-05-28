import type { BriefStats } from "./morningBrief_stats";

export interface RenderInput {
  schoolName: string;
  stats: BriefStats;
  todayLabel: string;
}

export interface RenderOutput {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export function renderBrief(input: RenderInput): RenderOutput {
  const { schoolName, stats, todayLabel } = input;

  const subject = `${schoolName} hiring brief, ${todayLabel}`;

  const lines: string[] = [];
  lines.push(`${schoolName} hiring brief, ${todayLabel}`);
  lines.push("");

  lines.push(`${stats.newApps24h.count} new application${stats.newApps24h.count === 1 ? "" : "s"} in the last 24h.`);
  if (stats.newApps24h.top.length > 0) {
    for (const t of stats.newApps24h.top) {
      lines.push(`  - ${t.candidateName}${t.score != null ? ` (score ${t.score})` : ""}`);
    }
  }
  lines.push("");

  lines.push(`${stats.strongAvailable.length} strong candidate${stats.strongAvailable.length === 1 ? "" : "s"} not yet contacted:`);
  for (const s of stats.strongAvailable) {
    lines.push(`  - ${s.candidateName} (score ${s.score})`);
  }
  lines.push("");

  lines.push(`${stats.stalled.length} stalled candidate${stats.stalled.length === 1 ? "" : "s"} (no reply in 5+ days):`);
  for (const s of stats.stalled) {
    lines.push(`  - ${s.candidateName}`);
  }
  lines.push("");

  lines.push(`${stats.demosToday} demo${stats.demosToday === 1 ? "" : "s"} scheduled for today.`);
  lines.push(`${stats.escalatedInboxCount} conversation${stats.escalatedInboxCount === 1 ? "" : "s"} need your attention.`);

  const textBody = lines.join("\n");

  const htmlBody = lines
    .map((l) => (l === "" ? "" : `<div>${escapeHtml(l)}</div>`))
    .join("\n");

  return { subject, htmlBody, textBody };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
