"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatusTabs } from "@/components/pipeline/status-tabs";
import { JobSidebar } from "@/components/pipeline/job-sidebar";
import { PipelineControls } from "@/components/pipeline/pipeline-controls";
import { ApplicationTable } from "@/components/pipeline/application-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { SortMode } from "@/components/pipeline/pipeline-controls";
import type { JobStatus } from "@/components/pipeline/status-tabs";

const FALLBACK_STAGES = [
  { id: "sourced", name: "Sourced" },
  { id: "screened", name: "Screened" },
  { id: "demo_scheduled", name: "Demo Scheduled" },
  { id: "demo_completed", name: "Demo Completed" },
  { id: "offer_sent", name: "Offer Sent" },
  { id: "hired", name: "Hired" },
  { id: "rejected", name: "Rejected" },
  { id: "on_hold", name: "On Hold" },
];

export function PipelineList({ schoolId }: { schoolId: any }) {
  const [activeStatus, setActiveStatus] = useState<JobStatus>("active");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>("newest");

  const pipelineConfig = useQuery(api.pipeline_config.getForSchool, { schoolId });

  const allJobs = useQuery(api.jobs.listBySchool, { schoolId }) || [];

  const pipeline = useQuery(
    api.applications.getPipelineForJob,
    selectedJobId ? { jobId: selectedJobId as any } : "skip",
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { active: 0, paused: 0, filled: 0, closed: 0, draft: 0 };
    allJobs.forEach((j: any) => {
      if (counts[j.status] !== undefined) counts[j.status]++;
    });
    return counts;
  }, [allJobs]);

  const filteredJobs = useMemo(
    () => allJobs.filter((j: any) => j.status === activeStatus),
    [allJobs, activeStatus],
  );

  const appCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredJobs.forEach((j: any) => {
      counts[j._id] = 0;
    });
    return counts;
  }, [filteredJobs]);

  const allApps = useMemo(() => {
    if (!pipeline) return [];
    return Object.values(pipeline).flat() as any[];
  }, [pipeline]);

  const filteredApps = useMemo(() => {
    let apps = allApps;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      apps = apps.filter(
        (app: any) =>
          (app.candidate?.name ?? "").toLowerCase().includes(q) ||
          (app.candidate?.location ?? "").toLowerCase().includes(q) ||
          (app.candidate?.subjects ?? []).some((s: string) =>
            s.toLowerCase().includes(q),
          ),
      );
    }

    if (selectedStage) {
      apps = apps.filter((app: any) => app.stage === selectedStage);
    }

    return apps;
  }, [allApps, searchQuery, selectedStage]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allApps.forEach((app: any) => {
      counts[app.stage] = (counts[app.stage] || 0) + 1;
    });
    return counts;
  }, [allApps]);

  const statusTabs = [
    { key: "active" as const, label: "Active", count: statusCounts.active },
    { key: "paused" as const, label: "Paused", count: statusCounts.paused },
    { key: "filled" as const, label: "Filled", count: statusCounts.filled },
    { key: "closed" as const, label: "Closed", count: statusCounts.closed },
    { key: "draft" as const, label: "Drafts", count: statusCounts.draft },
  ];

  const selectedJob = filteredJobs.find((j: any) => j._id === selectedJobId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="px-6 pt-4">
        <StatusTabs
          tabs={statusTabs}
          activeStatus={activeStatus}
          onStatusChange={(status) => {
            setActiveStatus(status);
            setSelectedJobId(null);
          }}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <JobSidebar
          jobs={filteredJobs}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
          applicationCounts={appCounts}
        />

        <main className="flex-1 overflow-y-auto p-6">
          {!selectedJobId ? (
            <EmptyState
              title="Select a job to view its pipeline"
              description="Choose a job from the sidebar to see all applications and manage your hiring pipeline."
            />
          ) : !pipeline ? (
            <div className="rounded-apple bg-surface shadow-elevation-low p-10 text-center">
              <p className="text-sm text-ink-secondary">Loading pipeline...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-ink">
                  {selectedJob?.title}
                </h1>
                <p className="text-sm text-ink-secondary mt-0.5">
                  {selectedJob?.subject} · {selectedJob?.level}
                </p>
              </div>

              <PipelineControls
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedStage={selectedStage}
                onStageChange={setSelectedStage}
                stages={
                  pipelineConfig?.stages?.length
                    ? pipelineConfig.stages.map((s: any) => ({ id: s.id, name: s.name }))
                    : FALLBACK_STAGES
                }
                stageCounts={stageCounts}
                totalCount={allApps.length}
                filteredCount={filteredApps.length}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />

              <ApplicationTable
                applications={filteredApps}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
