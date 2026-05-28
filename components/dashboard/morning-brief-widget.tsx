"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface Props {
  schoolId: Id<"schools">;
}

export function MorningBriefWidget({ schoolId }: Props) {
  const stats = useQuery(api.dashboard.getMorningBriefStats, { schoolId });
  const school = useQuery(api.schools.get, { schoolId });

  if (!stats || !school) {
    return <div className="rounded-2xl border border-neutral-200 p-6">Loading today&apos;s brief...</div>;
  }

  const recipientCount = school.morningBriefRecipientUserIds?.length ?? 0;
  const enabled = school.morningBriefEnabled === true;
  const showRecipientWarning = recipientCount === 0;
  const showDisabledWarning = !showRecipientWarning && !enabled;

  return (
    <div className="rounded-2xl border border-neutral-200 p-6 space-y-4 bg-white">
      <h2 className="text-xl font-medium">Today&apos;s hiring brief</h2>

      {showRecipientWarning && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          Morning brief recipients not configured.{" "}
          <a href="/dashboard/settings/notifications" className="underline">Set them in Settings</a>.
        </div>
      )}
      {showDisabledWarning && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          Daily email sending is off.{" "}
          <a href="/dashboard/settings/notifications" className="underline">Enable in Settings</a>.
        </div>
      )}

      <ul className="space-y-1 text-sm">
        <li><span className="font-medium">{stats.newApps24h.count}</span> new application{stats.newApps24h.count === 1 ? "" : "s"} in the last 24h</li>
        <li><span className="font-medium">{stats.strongAvailable.length}</span> strong candidate{stats.strongAvailable.length === 1 ? "" : "s"} not yet contacted</li>
        <li><span className="font-medium">{stats.stalled.length}</span> stalled candidate{stats.stalled.length === 1 ? "" : "s"} (no reply in 5+ days)</li>
        <li><span className="font-medium">{stats.demosToday}</span> demo{stats.demosToday === 1 ? "" : "s"} scheduled for today</li>
        <li><span className="font-medium">{stats.escalatedInboxCount}</span> conversation{stats.escalatedInboxCount === 1 ? "" : "s"} need your attention</li>
      </ul>

      {stats.strongAvailable.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-neutral-700 mb-1">Strong candidates</h3>
          <ul className="space-y-1 text-sm">
            {stats.strongAvailable.map((s) => (
              <li key={s.applicationId}>
                <a href={`/dashboard/pipeline?app=${s.applicationId}`} className="underline">{s.candidateName}</a>
                <span className="text-neutral-500"> (score {s.score})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.stalled.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-neutral-700 mb-1">Stalled</h3>
          <ul className="space-y-1 text-sm">
            {stats.stalled.map((s) => (
              <li key={s.applicationId}>
                <a href={`/dashboard/pipeline?app=${s.applicationId}`} className="underline">{s.candidateName}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
