"use client";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui";

interface Props {
  schoolId: Id<"schools">;
}

export function MorningBriefWidget({ schoolId }: Props) {
  const stats = useQuery(api.dashboard.getMorningBriefStats, { schoolId });
  const school = useQuery(api.schools.get, { schoolId });

  if (!stats || !school) {
    return (
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-micro text-ink-secondary">Today&apos;s hiring brief</h2>
          <span className="text-caption text-ink-tertiary">Sent daily at 8am IST</span>
        </div>
        <Card padding="md" elevation={1}>
          <div className="text-body-s text-ink-secondary">Loading...</div>
        </Card>
      </section>
    );
  }

  const recipientCount = school.morningBriefRecipientUserIds?.length ?? 0;
  const enabled = school.morningBriefEnabled === true;
  const showRecipientWarning = recipientCount === 0;
  const showDisabledWarning = !showRecipientWarning && !enabled;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-micro text-ink-secondary">Today&apos;s hiring brief</h2>
        <span className="text-caption text-ink-tertiary">Sent daily at 8am IST</span>
      </div>
      <Card padding="md" elevation={1}>
        <div className="space-y-4">
        {showRecipientWarning && (
          <div className="rounded-sm bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] border border-[color-mix(in_srgb,var(--warning)_45%,transparent)] px-3 py-2 text-body-s text-ink">
            Morning brief recipients not configured.{" "}
            <Link href="/dashboard/settings/notifications" className="text-accent underline">
              Set them in Settings
            </Link>
            .
          </div>
        )}
        {showDisabledWarning && (
          <div className="rounded-sm bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] border border-[color-mix(in_srgb,var(--warning)_45%,transparent)] px-3 py-2 text-body-s text-ink">
            Daily email sending is off.{" "}
            <Link href="/dashboard/settings/notifications" className="text-accent underline">
              Enable in Settings
            </Link>
            .
          </div>
        )}

        <ul className="space-y-1.5 text-body-s text-ink">
          <li>
            <span className="font-medium">{stats.newApps24h.count}</span>{" "}
            <span className="text-ink-secondary">
              new application{stats.newApps24h.count === 1 ? "" : "s"} in the last 24h
            </span>
          </li>
          <li>
            <span className="font-medium">{stats.strongAvailable.length}</span>{" "}
            <span className="text-ink-secondary">
              strong candidate{stats.strongAvailable.length === 1 ? "" : "s"} not yet contacted
            </span>
          </li>
          <li>
            <span className="font-medium">{stats.stalled.length}</span>{" "}
            <span className="text-ink-secondary">
              stalled candidate{stats.stalled.length === 1 ? "" : "s"} (no reply in 5+ days)
            </span>
          </li>
          <li>
            <span className="font-medium">{stats.demosToday}</span>{" "}
            <span className="text-ink-secondary">
              demo{stats.demosToday === 1 ? "" : "s"} scheduled for today
            </span>
          </li>
          <li>
            <span className="font-medium">{stats.escalatedInboxCount}</span>{" "}
            <span className="text-ink-secondary">
              conversation{stats.escalatedInboxCount === 1 ? "" : "s"} need your attention
            </span>
          </li>
        </ul>

        {stats.strongAvailable.length > 0 && (
          <div className="pt-2 border-t border-hairline">
            <h3 className="text-micro text-ink-secondary uppercase tracking-wider mb-2">Strong candidates</h3>
            <ul className="space-y-1 text-body-s">
              {stats.strongAvailable.map((s) => (
                <li key={s.applicationId} className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/pipeline?app=${s.applicationId}`}
                    className="text-ink hover:text-accent"
                  >
                    {s.candidateName}
                  </Link>
                  <span className="text-caption text-ink-tertiary">score {s.score}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {stats.stalled.length > 0 && (
          <div className="pt-2 border-t border-hairline">
            <h3 className="text-micro text-ink-secondary uppercase tracking-wider mb-2">Stalled</h3>
            <ul className="space-y-1 text-body-s">
              {stats.stalled.map((s) => (
                <li key={s.applicationId}>
                  <Link
                    href={`/dashboard/pipeline?app=${s.applicationId}`}
                    className="text-ink hover:text-accent"
                  >
                    {s.candidateName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        </div>
      </Card>
    </section>
  );
}
