import type { Id } from "@/convex/_generated/dataModel";

export type BulkInput<F> = { ids: string[] } | { matchAll: F };

export function isIdsMode<F>(x: BulkInput<F>): x is { ids: string[] } {
  return Object.prototype.hasOwnProperty.call(x, "ids");
}

export function isMatchAllMode<F>(x: BulkInput<F>): x is { matchAll: F } {
  return Object.prototype.hasOwnProperty.call(x, "matchAll");
}

// Per-table filter shapes used both by Convex queries (validated) and by client code.
export type TalentFilter = {
  poolId?: Id<"pools"> | "all";
  stages?: string[];
  search?: string;
};

export type PipelineFilter = {
  stage?: string;
  search?: string;
};

export type JobFilter = {
  status?: "draft" | "active" | "paused" | "filled" | "closed";
  search?: string;
};

export type CandidateSort = "newest" | "score" | "name";
export type ApplicationSort = "newest" | "score" | "name";
export type JobSort = "newest" | "title";
