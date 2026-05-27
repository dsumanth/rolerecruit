"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Card, Badge, EmptyState, Icon, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "active" | "draft" | "paused" | "filled" | "closed";

interface Props {
  schoolId: string;
  loadMoreRef?: (node: HTMLElement | null) => void;
  // Controlled filter/sort (optional — falls back to internal state if not provided)
  filter?: StatusFilter;
  onFilterChange?: (f: StatusFilter) => void;
  sort?: "newest" | "title";
  // Selection props
  selected?: (id: string) => boolean;
  onToggleRow?: (id: string, shiftKey: boolean) => void;
  onToggleAll?: (ids: string[]) => void;
  // Callback so parent can sync loaded IDs
  onResultsChange?: (results: Job[]) => void;
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

export function JobsList({
  schoolId,
  loadMoreRef,
  filter: externalFilter,
  onFilterChange,
  sort,
  selected,
  onToggleRow,
  onToggleAll,
  onResultsChange,
}: Props) {
  const [internalFilter, setInternalFilter] = useState<StatusFilter>("all");
  const filter = externalFilter ?? internalFilter;
  const setFilter = onFilterChange ?? setInternalFilter;

  const { results, status, loadMore } = usePaginatedQuery(
    api.jobs.listBySchool,
    {
      schoolId: schoolId as any,
      filter: filter !== "all" ? { status: filter as any } : undefined,
      sort: sort,
    },
    { initialNumItems: 100 },
  );

  const sentinelRef = useInfiniteScroll({ status, loadMore, loadCount: 100 });

  const pipelineStats = useQuery(
    api.jobs.hiredCountsForSchool,
    { schoolId: schoolId as any },
  ) as Record<string, number> | undefined;

  const jobs = results as Job[];

  // Notify parent of results changes
  useEffect(() => {
    onResultsChange?.(jobs);
  }, [jobs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count by status across currently loaded results (for chip badges)
  const counts = useMemo(() => {
    return {
      all: jobs.length,
      active: jobs.filter((j) => j.status === "active").length,
      draft: jobs.filter((j) => j.status === "draft").length,
      paused: jobs.filter((j) => j.status === "paused").length,
      filled: jobs.filter((j) => j.status === "filled").length,
      closed: jobs.filter((j) => j.status === "closed").length,
    };
  }, [jobs]);

  const selectionEnabled = !!(selected || onToggleRow || onToggleAll);
  const allIds = jobs.map((j) => j._id);
  const allSelected = selectionEnabled && allIds.length > 0 && allIds.every((id) => selected?.(id) ?? false);
  const someSelected = selectionEnabled && allIds.some((id) => selected?.(id) ?? false);

  if (status === "LoadingFirstPage") {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (jobs.length === 0 && filter === "all") {
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

      {jobs.length === 0 ? (
        <Card padding="lg" elevation={1}>
          <EmptyState
            title="No jobs found"
            description="No jobs match the selected filter."
          />
        </Card>
      ) : (
        <Card padding="none" elevation={1}>
          <div className={cn(
            "gap-4 px-5 py-3 border-b border-hairline",
            selectionEnabled
              ? "grid grid-cols-[32px_1.4fr_0.8fr_140px_100px_24px]"
              : "grid grid-cols-[1.4fr_0.8fr_140px_100px_24px]",
          )}>
            {selectionEnabled && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && someSelected;
                  }}
                  onChange={() => onToggleAll?.(allIds)}
                  className="w-4 h-4 rounded border-hairline text-accent cursor-pointer"
                  aria-label="Select all jobs"
                />
              </div>
            )}
            <div className="text-micro text-ink-secondary">Role</div>
            <div className="text-micro text-ink-secondary">Posted</div>
            <div className="text-micro text-ink-secondary">Hires / Positions</div>
            <div className="text-micro text-ink-secondary">Status</div>
            <div />
          </div>
          {jobs.map((job) => {
            const positions = job.positions ?? 1;
            const hired = pipelineStats?.[job._id] ?? 0;
            const isSelected = selected?.(job._id) ?? false;
            return (
              <div
                key={job._id}
                className={cn(
                  "border-b border-hairline last:border-b-0 transition-colors duration-fast",
                  isSelected ? "bg-accent-soft ring-2 ring-inset ring-accent/30" : "hover:bg-accent-soft",
                )}
              >
                <div className={cn(
                  "gap-4 items-center px-5 py-4",
                  selectionEnabled
                    ? "grid grid-cols-[32px_1.4fr_0.8fr_140px_100px_24px]"
                    : "grid grid-cols-[1.4fr_0.8fr_140px_100px_24px]",
                )}>
                  {selectionEnabled && (
                    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onToggleRow?.(job._id, (e.nativeEvent as MouseEvent).shiftKey)}
                        className="w-4 h-4 rounded border-hairline text-accent cursor-pointer"
                        aria-label={`Select job ${job.title}`}
                      />
                    </div>
                  )}
                  <Link href={`/dashboard/jobs/${job._id}`} className="contents">
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
                  </Link>
                </div>
              </div>
            );
          })}
          <div ref={loadMoreRef ?? sentinelRef} style={{ height: 1 }} />
        </Card>
      )}
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
