"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface Job {
  _id: string;
  title: string;
  subject: string;
  level: string;
  status: string;
}

interface JobSidebarProps {
  jobs: Job[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  applicationCounts: Record<string, number>;
}

export function JobSidebar({
  jobs,
  selectedJobId,
  onSelectJob,
  applicationCounts,
}: JobSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = jobs.filter((j) =>
    j.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <aside
      className={cn(
        "shrink-0 border-r border-hairline bg-surface transition-all duration-slow ease-apple-ease flex flex-col",
        collapsed ? "w-12" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex items-center border-b border-hairline",
          collapsed ? "justify-center py-4" : "px-4 py-3 justify-between",
        )}
      >
        {!collapsed && (
          <span className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">
            Jobs
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-ink-tertiary hover:text-ink transition-colors duration-normal p-1 rounded-md hover:bg-surface-canvas"
        >
          {collapsed ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 py-2">
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs py-1.5"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && !collapsed && (
          <div className="px-4 py-8 text-center text-xs text-ink-tertiary">
            {search ? "No jobs match your search" : "No jobs"}
          </div>
        )}
        {filtered.map((job) =>
          collapsed ? (
            <button
              key={job._id}
              onClick={() => onSelectJob(job._id)}
              className={cn(
                "w-full p-3 flex justify-center transition-colors duration-normal",
                selectedJobId === job._id
                  ? "text-accent bg-accent-soft border-r-2 border-accent"
                  : "text-ink-tertiary hover:text-ink hover:bg-surface-canvas",
              )}
              title={`${job.title} (${applicationCounts[job._id] ?? 0})`}
            >
              <span className="text-xs font-semibold tabular-nums">
                {applicationCounts[job._id] ?? 0}
              </span>
            </button>
          ) : (
            <button
              key={job._id}
              onClick={() => onSelectJob(job._id)}
              className={cn(
                "w-full text-left px-4 py-2.5 transition-colors duration-normal flex items-center justify-between",
                selectedJobId === job._id
                  ? "bg-accent-soft border-r-2 border-accent"
                  : "hover:bg-surface-canvas",
              )}
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm truncate",
                    selectedJobId === job._id
                      ? "font-medium text-accent"
                      : "text-ink",
                  )}
                >
                  {job.title}
                </p>
                <p className="text-xs text-ink-tertiary mt-0.5 truncate">
                  {job.subject} · {job.level}
                </p>
              </div>
              {(applicationCounts[job._id] ?? 0) > 0 && (
                <span className="text-xs tabular-nums text-ink-tertiary ml-2 shrink-0">
                  {applicationCounts[job._id]}
                </span>
              )}
            </button>
          ),
        )}
      </div>
    </aside>
  );
}

export type { Job };
