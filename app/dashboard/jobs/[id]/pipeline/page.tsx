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

function jobBadge(status: string) {
  if (status === "active") return <Badge dot variant="success">Active</Badge>;
  if (status === "draft") return <Badge dot variant="neutral">Draft</Badge>;
  return <Badge dot variant="neutral">Closed</Badge>;
}

const FALLBACK_STAGES = [
  "sourced",
  "screened",
  "demo_scheduled",
  "demo_completed",
  "offer_sent",
  "hired",
  "rejected",
  "on_hold",
];

function StagePicker({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <select
      className="w-full p-2 border border-hairline rounded"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select a stage…</option>
      {FALLBACK_STAGES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
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
  const [pickedStage, setPickedStage] = useState<string>("");

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
          <button
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-body-s"
            onClick={() => setConfirmRemove(true)}
          >
            Remove from pipeline
          </button>
          <button
            className="bg-accent text-white px-3 py-1.5 rounded text-body-s"
            onClick={() => setStageOpen(true)}
          >
            Move to stage
          </button>
          {sel.mode.kind === "ids" && (
            <button
              className="bg-surface text-ink px-3 py-1.5 rounded text-body-s border border-hairline"
              onClick={() => {
                /* CSV export in Phase 12 */
              }}
            >
              Export CSV
            </button>
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

      {/* Stage picker modal */}
      {stageOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
          onClick={() => setStageOpen(false)}
        >
          <div
            className="bg-surface rounded-lg p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-body font-semibold mb-3">Move {countN} to stage</h3>
            <StagePicker value={pickedStage} onChange={setPickedStage} />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setStageOpen(false)}
                className="text-body-s text-ink-secondary"
              >
                Cancel
              </button>
              <button
                disabled={!pickedStage}
                className="bg-accent text-white px-3 py-1.5 rounded text-body-s disabled:opacity-50"
                onClick={async () => {
                  const args: any =
                    sel.mode.kind === "ids"
                      ? { ids: Array.from(sel.mode.selected), stage: pickedStage }
                      : { matchAll: { jobId: params.id, filter }, stage: pickedStage };
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
              </button>
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

function JobTabs({ jobId, active }: { jobId: string; active: "overview" | "pipeline" | "sourcing" | "criteria" }) {
  const tabs: Array<{ value: typeof active; label: string; href: string }> = [
    { value: "overview", label: "Overview", href: `/dashboard/jobs/${jobId}` },
    { value: "pipeline", label: "Pipeline", href: `/dashboard/jobs/${jobId}/pipeline` },
    { value: "sourcing", label: "Sourcing", href: `/dashboard/jobs/${jobId}/sourcing` },
    { value: "criteria", label: "Criteria", href: `/dashboard/jobs/${jobId}/criteria` },
  ];
  return (
    <div role="tablist" className="flex gap-1 border-b border-hairline">
      {tabs.map((t) => {
        const a = t.value === active;
        return (
          <Link
            key={t.value}
            href={t.href}
            role="tab"
            aria-selected={a}
            className={`relative px-3.5 py-2 text-body-s ${a ? "text-ink font-semibold" : "text-ink-secondary hover:text-ink"} transition-colors duration-fast`}
          >
            {t.label}
            {a && (
              <span
                aria-hidden
                className="absolute left-3.5 right-3.5 -bottom-px h-[2px] rounded-full bg-accent-grad"
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
