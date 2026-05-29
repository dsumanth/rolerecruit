import { useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export interface PipelineApplication {
  _id: string;
  candidateId?: string;
  stage: string;
  aiMatchScore?: number;
}

export interface PipelineJob {
  _id: string;
  title: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  color?: string;
  order?: number;
}

export function groupByStage(
  apps: PipelineApplication[],
): Record<string, PipelineApplication[]> {
  const out: Record<string, PipelineApplication[]> = {};
  for (const a of apps) {
    if (!out[a.stage]) out[a.stage] = [];
    out[a.stage].push(a);
  }
  return out;
}

interface Options {
  schoolId: string | null;
}

export function usePipeline({ schoolId }: Options) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const jobsPage = usePaginatedQuery(
    api.jobs.listBySchool,
    schoolId ? { schoolId: schoolId as any } : "skip",
    { initialNumItems: 200 },
  );
  const stages = useQuery(
    api.pipeline_config.getActiveStages,
    schoolId ? { schoolId: schoolId as any } : "skip",
  );
  const apps = usePaginatedQuery(
    api.applications.getPipelineForJob,
    selectedJobId ? { jobId: selectedJobId as any } : "skip",
    { initialNumItems: 100 },
  );

  return {
    jobs: (jobsPage.results ?? []) as PipelineJob[],
    selectedJobId,
    setSelectedJobId,
    stages: (stages ?? []) as PipelineStage[],
    applicationsByStage: groupByStage(
      (apps.results ?? []) as PipelineApplication[],
    ),
    loading:
      jobsPage.status === "LoadingFirstPage" ||
      apps.status === "LoadingFirstPage",
  };
}
