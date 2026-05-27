"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, Badge, EmptyState, Icon, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "active" | "draft" | "paused" | "filled" | "closed";

interface Props {
  schoolId: string;
}

interface Job {
  _id: string;
  title: string;
  subject?: string;
  level?: string;
  board?: string;
  status: string;
  positions?: number;
  _creationTime: number;
}

function jobBadge(status: string) {
  if (status === "active") return <Badge dot variant="success">Active</Badge>;
  if (status === "draft") return <Badge dot variant="neutral">Draft</Badge>;
  if (status === "paused") return <Badge dot variant="warning">On hold</Badge>;
  if (status === "filled") return <Badge dot variant="success">Filled</Badge>;
  return <Badge dot variant="neutral">Closed</Badge>;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

export function JobsList({ schoolId }: Props) {
  const jobs = useQuery(api.jobs.listBySchool, { schoolId: schoolId as any }) as Job[] | undefined;
  const pipelineStats = useQuery(
    api.jobs.hiredCountsForSchool,
    { schoolId: schoolId as any },
  ) as Record<string, number> | undefined;
  const [filter, setFilter] = useState<StatusFilter>("all");

  const counts = useMemo(() => {
    if (!jobs) return { all: 0, active: 0, draft: 0, paused: 0, filled: 0, closed: 0 };
    return {
      all: jobs.length,
      active: jobs.filter((j) => j.status === "active").length,
      draft: jobs.filter((j) => j.status === "draft").length,
      paused: jobs.filter((j) => j.status === "paused").length,
      filled: jobs.filter((j) => j.status === "filled").length,
      closed: jobs.filter((j) => j.status === "closed").length,
    };
  }, [jobs]);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    if (filter === "all") return jobs;
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  if (!jobs) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card padding="lg" elevation={1}>
        <EmptyState
          title="No jobs yet"
          description="Post a role to start collecting candidates."
          action={
            <Link href="/dashboard/jobs/new" className="text-accent font-medium">Post a role →</Link>
          }
        />
      </Card>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap" role="tablist" aria-label="Status filter">
        <FilterChip label="All"     count={counts.all}     active={filter === "all"}     onClick={() => setFilter("all")} />
        <FilterChip label="Active"  count={counts.active}  active={filter === "active"}  onClick={() => setFilter("active")} />
        <FilterChip label="Draft"   count={counts.draft}   active={filter === "draft"}   onClick={() => setFilter("draft")} />
        <FilterChip label="On hold" count={counts.paused}  active={filter === "paused"}  onClick={() => setFilter("paused")} />
        <FilterChip label="Filled"  count={counts.filled}  active={filter === "filled"}  onClick={() => setFilter("filled")} />
        <FilterChip label="Closed"  count={counts.closed}  active={filter === "closed"}  onClick={() => setFilter("closed")} />
      </div>

      <Card padding="none" elevation={1}>
        <div className="grid grid-cols-[1.4fr_0.8fr_140px_100px_24px] gap-4 px-5 py-3 border-b border-hairline">
          <div className="text-micro text-ink-secondary">Role</div>
          <div className="text-micro text-ink-secondary">Posted</div>
          <div className="text-micro text-ink-secondary">Hires / Positions</div>
          <div className="text-micro text-ink-secondary">Status</div>
          <div />
        </div>
        {filtered.map((job) => {
          const positions = job.positions ?? 1;
          const hired = pipelineStats?.[job._id] ?? 0;
          return (
            <Link key={job._id} href={`/dashboard/jobs/${job._id}`}>
              <div className="grid grid-cols-[1.4fr_0.8fr_140px_100px_24px] gap-4 items-center px-5 py-4 border-b border-hairline last:border-b-0 hover:bg-accent-soft transition-colors duration-fast">
                <div className="min-w-0">
                  <div className="text-body-s font-semibold text-ink truncate">{job.title}</div>
                  <div className="text-caption text-ink-secondary truncate">
                    {[job.subject, job.level, job.board].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="text-caption text-ink-secondary">{formatDate(job._creationTime)}</div>
                <div className="text-body-s text-ink tabular-nums">
                  {hired} / {positions}
                </div>
                <div>{jobBadge(job.status)}</div>
                <Icon name="ChevronRight" size={14} color="var(--ink-3)" />
              </div>
            </Link>
          );
        })}
      </Card>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-body-s font-medium transition-colors duration-fast",
        active
          ? "bg-accent-soft border-accent/30 text-accent"
          : "bg-surface text-ink-secondary hover:text-ink",
      )}
    >
      {label}
      <span className="text-caption tabular-nums opacity-70">{count}</span>
    </button>
  );
}
