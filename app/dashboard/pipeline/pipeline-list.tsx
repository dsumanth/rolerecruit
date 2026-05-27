"use client";

import { useState, useMemo } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { StatusTabs } from "@/components/pipeline/status-tabs";
import { JobSidebar } from "@/components/pipeline/job-sidebar";
import { PipelineControls } from "@/components/pipeline/pipeline-controls";
import { ApplicationTable } from "@/components/pipeline/application-table";
import { ApplicationDrawer } from "@/components/pipeline/application-drawer";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { SortMode } from "@/components/pipeline/pipeline-controls";
import type { JobStatus } from "@/components/pipeline/status-tabs";
import type { Application } from "@/components/pipeline/application-table";

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
  const [selectedApp, setSelectedApp] = useState<any>(null);

  // Load jobs for the sidebar (large page, no infinite scroll needed)
  const { results: allJobResults } = usePaginatedQuery(
    api.jobs.listBySchool,
    { schoolId },
    { initialNumItems: 500 },
  );
  const allJobs = allJobResults as any[];

  // Pipeline query with filter + sort
  const pipelineFilter = useMemo(
    () => ({
      stage: selectedStage ?? undefined,
      search: searchQuery || undefined,
    }),
    [selectedStage, searchQuery],
  );

  const {
    results: pipelineResults,
    status: pipelineStatus,
    loadMore: pipelineLoadMore,
  } = usePaginatedQuery(
    api.applications.getPipelineForJob,
    selectedJobId ? { jobId: selectedJobId as any, filter: pipelineFilter, sort: sortBy as any } : "skip",
    { initialNumItems: 100 },
  );

  const sentinelRef = useInfiniteScroll({
    status: pipelineStatus,
    loadMore: pipelineLoadMore,
    loadCount: 100,
  });

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

  // Map enriched rows to Application shape
  const allApps: Application[] = useMemo(
    () =>
      pipelineResults.map((row: any) => ({
        _id: row.applicationId,
        candidateId: row.candidateId,
        stage: row.stage,
        aiMatchScore: row.aiMatchScore,
        globalScore: undefined,
        poolNames: undefined,
        candidate: {
          _id: row.candidateId,
          name: row.name,
          phone: row.phone,
          email: row.email,
          location: row.location,
          qualifications: [],
          certifications: [],
          boardExperience: [],
          subjects: row.subjects ?? [],
          yearsExperience: row.yearsExperience,
          currentSchool: undefined,
          resumeUrl: undefined,
        },
      })),
    [pipelineResults],
  );

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allApps.forEach((app) => {
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
          ) : pipelineStatus === "LoadingFirstPage" ? (
            <Card padding="lg" elevation={1} className="text-center">
              <p className="text-body-s text-ink-secondary">Loading pipeline...</p>
            </Card>
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
                stages={FALLBACK_STAGES}
                stageCounts={stageCounts}
                totalCount={allApps.length}
                filteredCount={allApps.length}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />

              <ApplicationTable
                applications={allApps}
                sortBy={sortBy}
                onSortChange={setSortBy}
                onRowClick={setSelectedApp}
                loadMoreRef={sentinelRef}
              />
            </div>
          )}
        </main>
      </div>

      {selectedApp && (
        <ApplicationDrawer
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
        />
      )}
    </div>
  );
}
