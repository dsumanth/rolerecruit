"use client";

import { useEffect, useState, useMemo } from "react";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useTableSelection } from "@/hooks/use-table-selection";
import { useUndoToast } from "@/hooks/use-undo-toast";
import { StatusTabs } from "@/components/pipeline/status-tabs";
import { JobSidebar } from "@/components/pipeline/job-sidebar";
import { PipelineControls } from "@/components/pipeline/pipeline-controls";
import { ApplicationTable } from "@/components/pipeline/application-table";
import { ApplicationDrawer } from "@/components/pipeline/application-drawer";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { SelectAllMatchingBanner } from "@/components/ui/select-all-matching-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UndoToast } from "@/components/ui/undo-toast";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { SortMode } from "@/components/pipeline/pipeline-controls";
import type { JobStatus } from "@/components/pipeline/status-tabs";
import type { Application } from "@/components/pipeline/application-table";
import { rowsToCsv, downloadCsv } from "@/lib/csv-export";

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

function StagePicker({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <select
      className="w-full px-3 py-2 rounded-sm bg-surface border border-hairline-strong text-ink text-body-s outline-none transition-all duration-fast ease-apple-out focus:border-accent focus:ring-2 focus:ring-accent-soft"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select a stage…</option>
      {FALLBACK_STAGES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

export function PipelineList({ schoolId }: { schoolId: any }) {
  const [activeStatus, setActiveStatus] = useState<JobStatus>("active");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>("newest");
  const [selectedApp, setSelectedApp] = useState<any>(null);

  // Bulk selection state
  const sel = useTableSelection<string, { jobId: string | null; filter: any }>();
  const undoToast = useUndoToast();
  const removeApps = useMutation(api.applications.removeManyApplications);
  const undoRemove = useMutation(api.applications.undoBatchDelete);
  const bulkSetStage = useMutation(api.applications.bulkSetStage);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [pickedStage, setPickedStage] = useState<string>("");

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

  const totalCountQuery = useQuery(
    api.applications.countForJob,
    selectedJobId
      ? { jobId: selectedJobId as any, filter: pipelineFilter }
      : "skip",
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

  // Keep loadedIds in sync with rendered results
  useEffect(() => {
    sel.setLoadedIds(pipelineResults.map((r: any) => r.applicationId));
  }, [pipelineResults]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear selection on filter/sort/job change
  useEffect(() => {
    sel.clear();
  }, [pipelineFilter, sortBy, selectedJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusTabs = [
    { key: "active" as const, label: "Active", count: statusCounts.active },
    { key: "paused" as const, label: "Paused", count: statusCounts.paused },
    { key: "filled" as const, label: "Filled", count: statusCounts.filled },
    { key: "closed" as const, label: "Closed", count: statusCounts.closed },
    { key: "draft" as const, label: "Drafts", count: statusCounts.draft },
  ];

  const selectedJob = filteredJobs.find((j: any) => j._id === selectedJobId);

  const totalCount = totalCountQuery?.total ?? 0;
  const countN = sel.count.kind === "all-matching" ? totalCount : sel.count.n;
  const hasSelection = sel.count.kind === "ids" ? sel.count.n > 0 : true;

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
                selected={(id) => sel.isSelected(id as any)}
                onToggleRow={(id, shift) => sel.toggle(id as any, shift)}
                onToggleAll={(ids) => sel.toggleAllLoaded(ids as any)}
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

      {/* Bulk action bar */}
      {hasSelection && (
        <BulkActionBar
          count={countN}
          countLabel="applications"
          onClear={() => sel.clear()}
          banner={
            sel.mode.kind === "ids" &&
            sel.count.n === pipelineResults.length &&
            pipelineResults.length > 0 &&
            totalCount > pipelineResults.length ? (
              <SelectAllMatchingBanner
                loadedCount={pipelineResults.length}
                totalCount={totalCount}
                entityLabel="applications"
                onSelectAllMatching={() =>
                  sel.selectAllMatching({ jobId: selectedJobId, filter: pipelineFilter })
                }
              />
            ) : undefined
          }
        >
          <Button variant="danger" size="sm" iconLeft="Trash2" onClick={() => setConfirmRemove(true)}>
            Remove from pipeline
          </Button>
          <Button variant="primary" size="sm" iconLeft="MoveRight" onClick={() => setStageOpen(true)}>
            Move to stage
          </Button>
          {sel.mode.kind === "ids" && (
            <Button
              variant="secondary"
              size="sm"
              iconLeft="Download"
              onClick={() => {
                const selectedRows = sel.mode.kind === "ids"
                  ? pipelineResults.filter((r: any) => sel.isSelected(r.applicationId))
                  : [];
                if (selectedRows.length === 0) return;
                const csv = rowsToCsv(selectedRows, [
                  { key: "name", label: "Name" },
                  { key: "email", label: "Email" },
                  { key: "phone", label: "Phone" },
                  { key: "aiMatchScore", label: "Score" },
                  { key: "stage", label: "Stage" },
                  { key: "subjects", label: "Subjects" },
                  { key: "createdAt", label: "Applied At" },
                ]);
                const today = new Date().toISOString().slice(0, 10);
                downloadCsv(`pipeline-${today}.csv`, csv);
              }}
            >
              Export CSV
            </Button>
          )}
        </BulkActionBar>
      )}

      {/* Confirm remove dialog */}
      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${countN} ${countN === 1 ? "application" : "applications"}?`}
        body="The candidates remain in the system and their other applications are unaffected. You can undo within 10 seconds."
        confirmLabel="Remove"
        onConfirm={async () => {
          setConfirmRemove(false);
          const args: any =
            sel.mode.kind === "ids"
              ? { ids: Array.from(sel.mode.selected) }
              : { matchAll: { jobId: selectedJobId, filter: pipelineFilter } };
          const r = await removeApps(args);
          sel.clear();
          if (r.batchId) {
            const batchId = r.batchId;
            undoToast.show({
              label: `Removed ${r.count} ${r.count === 1 ? "application" : "applications"}`,
              onUndo: async () => { await undoRemove({ batchId }); },
            });
          }
        }}
        onCancel={() => setConfirmRemove(false)}
      />

      {/* Stage picker modal */}
      {stageOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setStageOpen(false)}
        >
          <div
            className="bg-surface border border-hairline rounded-lg shadow-elev-3 p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-body font-semibold text-ink mb-3">Move {countN} to stage</h3>
            <StagePicker value={pickedStage} onChange={setPickedStage} />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" size="md" onClick={() => setStageOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={!pickedStage}
                onClick={async () => {
                  const args: any =
                    sel.mode.kind === "ids"
                      ? { ids: Array.from(sel.mode.selected), stage: pickedStage }
                      : { matchAll: { jobId: selectedJobId, filter: pipelineFilter }, stage: pickedStage };
                  const r = await bulkSetStage(args);
                  sel.clear();
                  setStageOpen(false);
                  const movedTo = pickedStage;
                  setPickedStage("");
                  undoToast.show({
                    label: `Moved ${r.previousStages.length} to ${movedTo}`,
                    onUndo: async () => {
                      const byStage = new Map<string, any[]>();
                      for (const { id, previousStage } of r.previousStages) {
                        if (!byStage.has(previousStage)) byStage.set(previousStage, []);
                        byStage.get(previousStage)!.push(id);
                      }
                      for (const [stage, idsArr] of byStage) {
                        await bulkSetStage({ ids: idsArr, stage });
                      }
                    },
                  });
                }}
              >
                Move
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Undo toasts */}
      <div className="fixed top-6 right-6 z-50 space-y-2">
        {undoToast.toasts.map((t) => (
          <UndoToast
            key={t.id}
            label={t.label}
            onUndo={() => undoToast.undo(t.id)}
            onDismiss={() => undoToast.dismiss(t.id)}
          />
        ))}
      </div>
    </div>
  );
}
