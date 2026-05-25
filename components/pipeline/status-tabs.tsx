"use client";

import { cn } from "@/lib/utils";

type JobStatus = "active" | "paused" | "filled" | "closed" | "draft";

interface StatusTab {
  key: JobStatus;
  label: string;
  count: number;
}

interface StatusTabsProps {
  tabs: StatusTab[];
  activeStatus: JobStatus;
  onStatusChange: (status: JobStatus) => void;
}

export function StatusTabs({ tabs, activeStatus, onStatusChange }: StatusTabsProps) {
  return (
    <div className="flex gap-1 border-b border-surface-tertiary">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onStatusChange(tab.key)}
          className={cn(
            "relative px-4 py-2.5 text-sm font-medium transition-all duration-normal ease-apple-ease",
            activeStatus === tab.key
              ? "text-accent"
              : "text-ink-secondary hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count > 0 && (
            <span
              className={cn(
                "ml-1.5 text-xs tabular-nums px-1.5 py-0.5 rounded-full",
                activeStatus === tab.key
                  ? "bg-accent/10 text-accent"
                  : "bg-surface-secondary text-ink-tertiary",
              )}
            >
              {tab.count}
            </span>
          )}
          {activeStatus === tab.key && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}

export type { JobStatus, StatusTab };
