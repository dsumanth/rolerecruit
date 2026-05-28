"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useTableSelection } from "@/hooks/use-table-selection";
import { useUndoToast } from "@/hooks/use-undo-toast";
import { Button, PageHeader } from "@/components/ui";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { SelectAllMatchingBanner } from "@/components/ui/select-all-matching-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UndoToast } from "@/components/ui/undo-toast";
import { JobsList } from "@/components/jobs/jobs-list";
import { rowsToCsv, downloadCsv } from "@/lib/csv-export";

type StatusFilter = "all" | "active" | "draft" | "paused" | "filled" | "closed";

export default function JobsPage() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");

  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sort] = useState<"newest" | "title">("newest");
  const [results, setResults] = useState<any[]>([]);

  const sel = useTableSelection<string, { schoolId: any; filter: any }>();
  const undoToast = useUndoToast();
  const removeMany = useMutation(api.jobs.removeMany);
  const undoRemove = useMutation(api.jobs.undoBatchDelete);
  const bulkSetStatus = useMutation(api.jobs.bulkSetStatus);

  const convexFilter = filter !== "all"
    ? { status: filter as "draft" | "active" | "paused" | "filled" | "closed" }
    : undefined;

  const totalCountQuery = useQuery(
    api.jobs.countBySchool,
    profile?.schoolId ? { schoolId: profile.schoolId, filter: convexFilter } : "skip",
  );

  // Keep loadedIds in sync with rendered results
  useEffect(() => {
    sel.setLoadedIds(results.map((j: any) => j._id));
  }, [results]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear selection on filter/sort change
  useEffect(() => {
    sel.clear();
  }, [filter, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const allDrafts =
    sel.mode.kind === "ids"
      ? Array.from(sel.mode.selected).every((id) => {
          const job = results.find((j: any) => j._id === id);
          return job?.status === "draft";
        })
      : filter === "draft";

  const totalCount = totalCountQuery?.total ?? 0;
  const countN = sel.count.kind === "all-matching" ? totalCount : sel.count.n;
  const hasSelection = sel.count.kind === "ids" ? sel.count.n > 0 : true;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [pickedStatus, setPickedStatus] = useState<string>("");

  return (
    <div>
      <PageHeader
        title="Jobs"
        actions={
          <Link href="/dashboard/jobs/new">
            <Button variant="ink" iconLeft="Plus">Post role</Button>
          </Link>
        }
      />

      {profile?.schoolId && (
        <JobsList
          schoolId={profile.schoolId}
          filter={filter}
          onFilterChange={setFilter}
          sort={sort}
          selected={(id) => sel.isSelected(id as any)}
          onToggleRow={(id, shift) => sel.toggle(id as any, shift)}
          onToggleAll={(ids) => sel.toggleAllLoaded(ids as any)}
          onResultsChange={setResults}
        />
      )}

      {/* Bulk action bar */}
      {hasSelection && (
        <BulkActionBar
          count={countN}
          countLabel="jobs"
          onClear={() => sel.clear()}
          banner={
            sel.mode.kind === "ids" &&
            sel.count.n === results.length &&
            results.length > 0 &&
            totalCount > results.length ? (
              <SelectAllMatchingBanner
                loadedCount={results.length}
                totalCount={totalCount}
                entityLabel="jobs"
                onSelectAllMatching={() =>
                  sel.selectAllMatching({ schoolId: profile!.schoolId, filter: convexFilter })
                }
              />
            ) : undefined
          }
        >
          <Button
            variant="danger"
            size="sm"
            iconLeft="Trash2"
            disabled={!allDrafts}
            title={!allDrafts ? "Only draft jobs can be deleted in bulk" : undefined}
            onClick={() => setConfirmDelete(true)}
          >
            Delete drafts
          </Button>

          <Button variant="primary" size="sm" iconLeft="RefreshCw" onClick={() => setStatusOpen(true)}>
            Change status
          </Button>

          {sel.mode.kind === "ids" && (
            <Button
              variant="secondary"
              size="sm"
              iconLeft="Download"
              onClick={() => {
                const selectedRows = sel.mode.kind === "ids"
                  ? results.filter((j: any) => sel.isSelected(j._id))
                  : [];
                if (selectedRows.length === 0) return;
                const csv = rowsToCsv(selectedRows, [
                  { key: "title", label: "Title" },
                  { key: "subject", label: "Subject" },
                  { key: "level", label: "Level" },
                  { key: "board", label: "Board" },
                  { key: "status", label: "Status" },
                  { key: "positions", label: "Positions" },
                  { key: "_creationTime", label: "Created At" },
                ]);
                const today = new Date().toISOString().slice(0, 10);
                downloadCsv(`jobs-${today}.csv`, csv);
              }}
            >
              Export CSV
            </Button>
          )}
        </BulkActionBar>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${countN} draft ${countN === 1 ? "job" : "jobs"}?`}
        body="You can undo within 10 seconds."
        confirmLabel="Delete"
        onConfirm={async () => {
          setConfirmDelete(false);
          const args: any =
            sel.mode.kind === "ids"
              ? { ids: Array.from(sel.mode.selected) }
              : { matchAll: { schoolId: profile!.schoolId, filter: convexFilter } };
          const r = await removeMany(args);
          sel.clear();
          if (r.batchId) {
            const batchId = r.batchId;
            undoToast.show({
              label: `Deleted ${r.count} ${r.count === 1 ? "job" : "jobs"}`,
              onUndo: async () => {
                await undoRemove({ batchId });
              },
            });
          }
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Change status modal */}
      {statusOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setStatusOpen(false)}
        >
          <div
            className="bg-surface border border-hairline rounded-lg shadow-elev-3 p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-body font-semibold text-ink mb-3">
              Change status for {countN} {countN === 1 ? "job" : "jobs"}
            </h3>
            <select
              className="w-full px-3 py-2 rounded-sm bg-surface border border-hairline-strong text-ink text-body-s outline-none transition-all duration-fast ease-apple-out focus:border-accent focus:ring-2 focus:ring-accent-soft"
              value={pickedStatus}
              onChange={(e) => setPickedStatus(e.target.value)}
            >
              <option value="">Select status…</option>
              <option value="active">Active</option>
              <option value="paused">On hold</option>
              <option value="filled">Filled</option>
              <option value="closed">Closed</option>
            </select>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" size="md" onClick={() => setStatusOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={!pickedStatus}
                onClick={async () => {
                  const args: any =
                    sel.mode.kind === "ids"
                      ? { ids: Array.from(sel.mode.selected), status: pickedStatus }
                      : { matchAll: { schoolId: profile!.schoolId, filter: convexFilter }, status: pickedStatus };
                  const r = await bulkSetStatus(args);
                  sel.clear();
                  setStatusOpen(false);
                  const newStatus = pickedStatus;
                  setPickedStatus("");
                  undoToast.show({
                    label: `Status updated for ${r.previousStatuses.length} jobs`,
                    onUndo: async () => {
                      const byStatus = new Map<string, any[]>();
                      for (const { id, previousStatus } of r.previousStatuses) {
                        if (!byStatus.has(previousStatus)) byStatus.set(previousStatus, []);
                        byStatus.get(previousStatus)!.push(id);
                      }
                      for (const [status, idsArr] of byStatus) {
                        await bulkSetStatus({ ids: idsArr, status });
                      }
                    },
                  });
                }}
              >
                Apply
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
