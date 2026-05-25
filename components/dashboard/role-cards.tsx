"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Props {
  schoolId: string;
}

const STAGE_LABELS: Record<string, string> = {
  sourced: "Sourced",
  screened: "Screened",
  demo_scheduled: "Demo",
  demo_completed: "Evaluated",
  offer_sent: "Offer",
  hired: "Hired",
};

const STAGE_COLORS: Record<string, string> = {
  sourced: "bg-ink-tertiary",
  screened: "bg-ink-secondary",
  demo_scheduled: "bg-accent",
  demo_completed: "bg-purple-600",
  offer_sent: "bg-warning",
  hired: "bg-success",
};

interface Application {
  _id: string;
  stage: string;
}

function statusBadgeVariant(status: string) {
  if (status === "active") return "success" as const;
  if (status === "draft") return "default" as const;
  return "danger" as const;
}

export function RoleCards({ schoolId }: Props) {
  const jobs = useQuery(api.jobs.listBySchool, { schoolId: schoolId as any });
  const pipeline = useQuery(api.dashboard.getPipelineBreakdown, {
    schoolId: schoolId as any,
  });

  if (!jobs || !pipeline) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-apple bg-surface border border-surface-tertiary p-5 animate-pulse"
          >
            <div className="h-5 w-48 bg-surface-secondary rounded mb-2" />
            <div className="h-3 w-32 bg-surface-secondary rounded mb-4" />
            <div className="h-2 w-full bg-surface-secondary rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-apple bg-surface border border-surface-tertiary p-8 text-center">
        <p className="text-ink-secondary text-sm">No open roles.</p>
        <Link
          href="/dashboard/jobs/new"
          className="inline-block mt-3 text-sm text-accent hover:text-accent-hover"
        >
          Post your first role
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const apps = pipeline[job._id] ?? [];
        const total = apps.length;

        return (
          <Link
            key={job._id}
            href={`/dashboard/jobs/${job._id}`}
            className="block rounded-apple bg-surface border border-surface-tertiary p-5 hover:border-accent transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  {job.title}
                </h3>
                <p className="text-[13px] text-ink-secondary mt-0.5">
                  {job.subject} · {job.level} · {job.board}
                </p>
              </div>
              <Badge variant={statusBadgeVariant(job.status)}>
                {job.status}
              </Badge>
            </div>

            {total > 0 ? (
              <div className="space-y-1.5">
                <div className="flex h-2 rounded-full overflow-hidden bg-surface-secondary">
                  {Object.entries(STAGE_LABELS).map(([stage]) => {
                    const count = apps.filter(
                      (a: Application) => a.stage === stage
                    ).length;
                    if (count === 0) return null;
                    return (
                      <div
                        key={stage}
                        className={cn("h-full transition-all", STAGE_COLORS[stage])}
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    );
                  })}
                </div>
                <div className="flex gap-3 text-xs text-ink-secondary">
                  {Object.entries(STAGE_LABELS).map(([stage, label]) => {
                    const count = apps.filter(
                      (a: Application) => a.stage === stage
                    ).length;
                    if (count === 0) return null;
                    return (
                      <span key={stage}>
                        {label}: {count}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-tertiary">No candidates in pipeline</p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
