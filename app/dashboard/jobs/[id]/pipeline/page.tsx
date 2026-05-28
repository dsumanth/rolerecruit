"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useTableSelection } from "@/hooks/use-table-selection";
import { useUndoToast } from "@/hooks/use-undo-toast";
import { PageHeader, Badge, Button } from "@/components/ui";
import { ApplicationTable } from "@/components/pipeline/application-table";
import { ApplicationDrawer } from "@/components/pipeline/application-drawer";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { SelectAllMatchingBanner } from "@/components/ui/select-all-matching-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UndoToast } from "@/components/ui/undo-toast";
import type { Application } from "@/components/pipeline/application-table";
import { rowsToCsv, downloadCsv } from "@/lib/csv-export";
import { JobTabs } from "@/components/jobs/job-tabs";
import { StagePickerModal } from "@/components/pipeline/stage-picker-modal";

function jobBadge(status: string) {
  if (status === "active") return <Badge dot variant="success">Active</Badge>;
  if (status === "draft") return <Badge dot variant="neutral">Draft</Badge>;
  return <Badge dot variant="neutral">Closed</Badge>;
}

export default function PipelinePage({ params }: { params: { id: string } }) {
  const job = useQuery(api.jobs.get, { jobId: params.id as any });
  const moveStage = useMutation(api.applications.moveStage);
  const removeApps = useMutation(api.applications.removeManyApplications);
  const undoRemove = useMutation(api.applications.undoBatchDelete);
  const bulkSetStage = useMutation(api.applications.bulkSetStage);

  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [filter, setFilter] = useState<{ stage?: string; search?: string }>({});
  const [sort, setSort] = useState<"newest" | "score" | "name">("newest");

  // Bulk selection state
  const sel = useTableSelection<string, { jobId: any; filter: any }>();
  const undoToast = useUndoToast();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);

  const { results, status, loadMore } = usePaginatedQuery(
    api.applications.getPipelineForJob,
    { jobId: params.id as any, filter, sort },
    { initialNumItems: 100 },
  );

  const sentinelRef = useInfiniteScroll({ status, loadMore, loadCount: 100 });

  const totalCountQuery = useQuery(api.applications.countForJob, {
    jobId: params.id as any,
    filter,
  });

  // Keep loadedIds in sync with the rendered results
  useEffect(() => {
    sel.setLoadedIds(results.map((r: any) => r.applicationId));
  }, [results]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear selection on filter/sort change
  useEffect(() => {
    sel.clear();
  }, [filter, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const allApps: Application[] = results.map((row: any) => ({
    _id: row.applicationId,
    candidateId: row.candidateId,
    stage: row.stage,
    aiMatchScore: row.aiMatchScore,
    globalScore: undefined,
    poolNames: undefined,
    priorRejectCount: row.priorRejectCount ?? 0,
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
  }));

  const totalCount = totalCountQuery?.total ?? 0;
  const countN = sel.count.kind === "all-matching" ? totalCount : sel.count.n;
  const hasSelection = sel.count.kind === "ids" ? sel.count.n > 0 : true;

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/jobs", label: "Jobs" }}
        title={job?.title ?? "Pipeline"}
        subtitle={job ? [job.subject, job.level, job.board].filter(Boolean).join(" · ") : undefined}
        status={job ? jobBadge(job.status) : undefined}
        actions={
          <Link href={`/dashboard/jobs/${params.id}/pipeline/outreach`}>
            <Button variant="secondary" size="md" iconLeft="MessageSquare">
              Outreach history
            </Button>
          </Link>
        }
      />

      <JobTabs jobId={params.id} active="pipeline" />

      <div className="mt-7">
        {status === "LoadingFirstPage" ? (
          <div className="py-12 text-center text-body-s text-ink-secondary">
            Loading pipeline...
          </div>
        ) : (
          <ApplicationTable
            applications={allApps}
            sortBy={sort}
            onSortChange={setSort}
            onRowClick={setSelectedApp}
            loadMoreRef={sentinelRef}
            selected={(id) => sel.isSelected(id as any)}
            onToggleRow={(id, shift) => sel.toggle(id as any, shift)}
            onToggleAll={(ids) => sel.toggleAllLoaded(ids as any)}
          />
        )}
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
            sel.count.n === results.length &&
            results.length > 0 &&
            totalCount > results.length ? (
              <SelectAllMatchingBanner
                loadedCount={results.length}
                totalCount={totalCount}
                entityLabel="applications"
                onSelectAllMatching={() =>
                  sel.selectAllMatching({ jobId: params.id, filter })
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
                  ? results.filter((r: any) => sel.isSelected(r.applicationId))
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
                downloadCsv(`pipeline-${(job?.title ?? "pipeline").replace(/\s+/g, "-")}-${today}.csv`, csv);
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
              : { matchAll: { jobId: params.id, filter } };
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

      <StagePickerModal
        open={stageOpen}
        onClose={() => setStageOpen(false)}
        count={countN}
        onMove={async (picked) => {
          const args: any =
            sel.mode.kind === "ids"
              ? { ids: Array.from(sel.mode.selected), stage: picked }
              : { matchAll: { jobId: params.id, filter }, stage: picked };
          const r = await bulkSetStage(args);
          sel.clear();
          setStageOpen(false);
          undoToast.show({
            label: `Moved ${r.previousStages.length} to ${picked}`,
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
      />

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

