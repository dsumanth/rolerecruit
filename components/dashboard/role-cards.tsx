"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Badge, Card, EmptyState, Button } from "@/components/ui";

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
  demo_completed: "bg-purple",
  offer_sent: "bg-warning",
  hired: "bg-success",
};

interface Application { _id: string; stage: string }

function jobStatusBadge(status: string) {
  if (status === "active") return <Badge dot variant="success">Active</Badge>;
  if (status === "draft") return <Badge dot variant="neutral">Draft</Badge>;
  return <Badge dot variant="neutral">Closed</Badge>;
}

export function RoleCards({ schoolId }: Props) {
  const jobs = useQuery(api.jobs.listBySchool, { schoolId: schoolId as any });
  const pipeline = useQuery(api.dashboard.getPipelineBreakdown, { schoolId: schoolId as any });

  if (!jobs || !pipeline) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} padding="md" elevation={1}>
            <div className="h-5 w-48 bg-hairline rounded animate-pulse mb-2" />
            <div className="h-3 w-32 bg-hairline rounded animate-pulse mb-4" />
            <div className="h-2 w-full bg-hairline rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card padding="lg" elevation={1}>
        <EmptyState
          title="No open roles"
          description="Post your first role to start tracking candidates."
          action={
            <Link href="/dashboard/jobs/new">
              <Button variant="ink" iconLeft="Plus">Post your first role</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job: (typeof jobs)[number]) => {
        const apps = pipeline[job._id] ?? [];
        const total = apps.length;

        return (
          <Link key={job._id} href={`/dashboard/jobs/${job._id}`} className="block">
            <Card padding="md" elevation={1} interactive>
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="text-title-m text-ink truncate">{job.title}</h3>
                  <p className="text-caption text-ink-secondary mt-0.5">
                    {job.subject} <span className="text-ink-tertiary">·</span>{" "}
                    {job.level} <span className="text-ink-tertiary">·</span>{" "}
                    {job.board}
                  </p>
                </div>
                {jobStatusBadge(job.status)}
              </div>

              {total > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-hairline gap-[2px]">
                    {Object.entries(STAGE_LABELS).map(([stage]) => {
                      const count = apps.filter((a: Application) => a.stage === stage).length;
                      if (count === 0) return null;
                      return (
                        <div
                          key={stage}
                          className={cn("h-full rounded-sm", STAGE_COLORS[stage])}
                          style={{ width: `${(count / total) * 100}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-3 text-caption text-ink-secondary mt-2">
                    {Object.entries(STAGE_LABELS).map(([stage, label]) => {
                      const count = apps.filter((a: Application) => a.stage === stage).length;
                      if (count === 0) return null;
                      return (
                        <span key={stage} className="inline-flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 rounded-sm", STAGE_COLORS[stage])} />
                          {label} <span className="text-ink font-medium tabular-nums">{count}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-caption text-ink-tertiary">No candidates in pipeline</p>
              )}
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
