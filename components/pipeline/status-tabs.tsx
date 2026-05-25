"use client";

import { Tabs } from "@/components/ui";

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
    <Tabs
      items={tabs.map((t) => ({ value: t.key, label: t.label, count: t.count }))}
      value={activeStatus}
      onChange={(v) => onStatusChange(v as JobStatus)}
    />
  );
}

export type { JobStatus, StatusTab };
