"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface Props {
  schoolId: string;
}

const stats = [
  { key: "openPositions", label: "Open Positions" },
  { key: "totalCandidates", label: "Total Candidates" },
  { key: "hiredThisMonth", label: "Hired This Month" },
] as const;

export function StatsBar({ schoolId }: Props) {
  const data = useQuery(api.dashboard.getStats, { schoolId: schoolId as any });

  if (!data) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div
            key={s.key}
            className="rounded-apple bg-surface border border-surface-tertiary p-6 animate-pulse"
          >
            <div className="h-8 w-16 bg-surface-secondary rounded mb-2" />
            <div className="h-4 w-24 bg-surface-secondary rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((s) => (
        <div
          key={s.key}
          className="rounded-apple bg-surface border border-surface-tertiary p-6"
        >
          <p className="text-3xl font-bold tracking-tight text-ink tabular-nums">
            {data[s.key]}
          </p>
          <p className="text-sm text-ink-secondary mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
