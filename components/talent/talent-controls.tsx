"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const PIPELINE_STAGES = [
  "sourced",
  "screened",
  "demo_scheduled",
  "demo_completed",
  "offer_sent",
  "hired",
] as const;

const STAGE_LABELS: Record<string, string> = {
  sourced: "Sourced",
  screened: "Screened",
  demo_scheduled: "Demo Scheduled",
  demo_completed: "Demo Completed",
  offer_sent: "Offer Sent",
  hired: "Hired",
};

interface Pool {
  _id: string;
  name: string;
  count: number;
}

interface TalentControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedPoolId: string | "all";
  onPoolChange: (poolId: string | "all") => void;
  pools: Pool[];
  selectedStages: string[];
  onStagesChange: (stages: string[]) => void;
  stageCounts: Record<string, number>;
  sortBy: "newest" | "score" | "name";
  onSortChange: (sort: "newest" | "score" | "name") => void;
  totalCount: number;
  filteredCount: number;
}

export function TalentControls({
  searchQuery,
  onSearchChange,
  selectedPoolId,
  onPoolChange,
  pools,
  selectedStages,
  onStagesChange,
  stageCounts,
  sortBy,
  onSortChange,
  totalCount,
  filteredCount,
}: TalentControlsProps) {
  const toggleStage = (stage: string) => {
    if (selectedStages.includes(stage)) {
      onStagesChange(selectedStages.filter((s) => s !== stage));
    } else {
      onStagesChange([...selectedStages, stage]);
    }
  };

  const allStagesSelected = selectedStages.length === 0;

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
            placeholder="Search candidates by name, email, location, or subjects..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as "newest" | "score" | "name")}
          className="text-xs px-3 py-1.5 rounded-apple bg-surface border border-surface-tertiary text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent appearance-none"
        >
          <option value="newest">Newest</option>
          <option value="score">Highest Score</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>

      {pools.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => onPoolChange("all")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-normal",
              selectedPoolId === "all"
                ? "bg-accent text-white"
                : "bg-surface-secondary text-ink-secondary hover:bg-surface-tertiary",
            )}
          >
            All
            <span className="ml-1 tabular-nums opacity-70">{totalCount}</span>
          </button>
          {pools.map((pool) => (
            <button
              key={pool._id}
              onClick={() => onPoolChange(pool._id)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-normal",
                selectedPoolId === pool._id
                  ? "bg-accent text-white"
                  : "bg-surface-secondary text-ink-secondary hover:bg-surface-tertiary",
              )}
            >
              {pool.name}
              <span className="ml-1 tabular-nums opacity-70">{pool.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => onStagesChange([])}
          className={cn(
            "text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-normal",
            allStagesSelected
              ? "bg-accent text-white"
              : "bg-surface-secondary text-ink-secondary hover:bg-surface-tertiary",
          )}
        >
          All
          <span className="ml-1 tabular-nums opacity-70">{totalCount}</span>
        </button>
        {PIPELINE_STAGES.map((stage) => (
          <button
            key={stage}
            onClick={() => toggleStage(stage)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-normal",
              selectedStages.includes(stage)
                ? "bg-accent text-white"
                : "bg-surface-secondary text-ink-secondary hover:bg-surface-tertiary",
            )}
          >
            {STAGE_LABELS[stage]}
            <span className="ml-1 tabular-nums opacity-70">
              {stageCounts[stage] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <p className="text-xs text-ink-tertiary tabular-nums">
        {filteredCount === totalCount
          ? `${totalCount} candidate${totalCount !== 1 ? "s" : ""}`
          : `Showing ${filteredCount} of ${totalCount} candidates`}
      </p>
    </div>
  );
}
