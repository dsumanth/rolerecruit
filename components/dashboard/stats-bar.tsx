"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, Icon, type IconName } from "@/components/ui";

interface Props {
  schoolId: string;
}

interface StatDef {
  key: "openPositions" | "totalCandidates" | "hiredThisMonth";
  label: string;
  icon: IconName;
  tone: "accent" | "purple" | "success";
}

const STATS: StatDef[] = [
  { key: "openPositions",   label: "Open positions",  icon: "Briefcase",    tone: "accent" },
  { key: "totalCandidates", label: "Candidates",      icon: "Users",        tone: "purple" },
  { key: "hiredThisMonth",  label: "Hired this month", icon: "CheckCircle2", tone: "success" },
];

const TONE: Record<StatDef["tone"], { bg: string; fg: string }> = {
  accent:  { bg: "bg-accent-soft",                                   fg: "text-accent" },
  purple:  { bg: "bg-[color-mix(in_srgb,var(--purple)_10%,transparent)]", fg: "text-purple" },
  success: { bg: "bg-[color-mix(in_srgb,var(--success)_10%,transparent)]", fg: "text-[color-mix(in_srgb,var(--success)_75%,var(--ink-1))]" },
};

export function StatsBar({ schoolId }: Props) {
  const data = useQuery(api.dashboard.getStats, { schoolId: schoolId as any });

  if (!data) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {STATS.map((s) => (
          <Card key={s.key} padding="md" elevation={1}>
            <div className="h-8 w-16 bg-hairline rounded animate-pulse mb-2" />
            <div className="h-4 w-24 bg-hairline rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {STATS.map((s) => {
        const tone = TONE[s.tone];
        return (
          <Card key={s.key} padding="md" elevation={1} interactive>
            <div className="flex items-center justify-between mb-3">
              <span className="text-micro text-ink-secondary">{s.label}</span>
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-sm ${tone.bg} ${tone.fg}`}>
                <Icon name={s.icon} size={14} />
              </span>
            </div>
            <p className="text-display-m text-gradient-ink tabular-nums leading-none">
              {data[s.key]}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
