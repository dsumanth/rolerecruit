"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui";

interface StageConfig {
  id: string;
  name: string;
}

interface PipelineControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedStage: string | null;
  onStageChange: (stage: string | null) => void;
  stages: StageConfig[];
  stageCounts: Record<string, number>;
  totalCount: number;
  filteredCount: number;
  sortBy: "newest" | "score" | "name";
  onSortChange: (sort: "newest" | "score" | "name") => void;
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "score", label: "Highest Score" },
  { value: "name", label: "Name A-Z" },
];

export function PipelineControls({
  searchQuery,
  onSearchChange,
  selectedStage,
  onStageChange,
  stages,
  stageCounts,
  totalCount,
  filteredCount,
  sortBy,
  onSortChange,
}: PipelineControlsProps) {
  const allSelected = selectedStage === null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-tertiary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            placeholder="Search candidates..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={sortBy}
          onChange={(v) => onSortChange(v as "newest" | "score" | "name")}
          options={SORT_OPTIONS}
        />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => onStageChange(null)}
          className={cn(
            "text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-normal",
            allSelected
              ? "bg-accent-soft text-accent"
              : "bg-surface-canvas text-ink-secondary hover:bg-hairline",
          )}
        >
          All
          <span className="ml-1 tabular-nums opacity-70">{totalCount}</span>
        </button>
        {stages.map((stage) => (
          <button
            key={stage.id}
            onClick={() => onStageChange(selectedStage === stage.id ? null : stage.id)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-normal",
              selectedStage === stage.id
                ? "bg-accent-soft text-accent"
                : "bg-surface-canvas text-ink-secondary hover:bg-hairline",
            )}
          >
            {stage.name}
            <span className="ml-1 tabular-nums opacity-70">
              {stageCounts[stage.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <p className="text-xs text-ink-tertiary tabular-nums">
        {filteredCount === totalCount
          ? `${totalCount} application${totalCount !== 1 ? "s" : ""}`
          : `Showing ${filteredCount} of ${totalCount} applications`}
      </p>
    </div>
  );
}

export type { StageConfig };
export type SortMode = "newest" | "score" | "name";
