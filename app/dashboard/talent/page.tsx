"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useTableSelection } from "@/hooks/use-table-selection";
import { useUndoToast } from "@/hooks/use-undo-toast";
import { Button, Card, PageHeader } from "@/components/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { SelectAllMatchingBanner } from "@/components/ui/select-all-matching-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UndoToast } from "@/components/ui/undo-toast";
import { TalentControls } from "@/components/talent/talent-controls";
import { PoolSelector } from "@/components/talent/pool-selector";
import { GlobalCriteriaPanel } from "@/components/talent/global-criteria-panel";
import { UploadResumeModal } from "@/components/talent/upload-resume-modal";
import { ApplicationTable } from "@/components/pipeline/application-table";
import { ApplicationDrawer } from "@/components/pipeline/application-drawer";
import type { Application } from "@/components/pipeline/application-table";
import { NlSearchBar } from "@/components/talent/nl-search-bar";
import { rowsToCsv, downloadCsv } from "@/lib/csv-export";

export default function TalentBankPage() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");
  const schoolId = profile?.schoolId;

  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPoolId, setSelectedPoolId] = useState<string | "all">("all");
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"newest" | "score" | "name">("newest");
  const [showPoolManager, setShowPoolManager] = useState(false);
  const [showCriteriaPanel, setShowCriteriaPanel] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [nlResults, setNlResults] = useState<any[] | null>(null);
  const [nlIntent, setNlIntent] = useState("");
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Bulk selection
  const sel = useTableSelection<string, { schoolId: any; filter: any }>();
  const undoToast = useUndoToast();
  const removeMany = useMutation(api.candidates.removeMany);
  const undoRemove = useMutation(api.candidates.undoBatchDelete);

  const handleSearchChange = (query: string) => {
    setSearchText(query);
    const timer = setTimeout(() => setDebouncedSearch(query), 300);
    return () => clearTimeout(timer);
  };

  const pools = useQuery(api.pools.listForSchool, schoolId ? { schoolId } : "skip") ?? [];

  const { results, status, loadMore } = usePaginatedQuery(
    api.candidates.listForSchool,
    schoolId ? {
      schoolId,
      filter: {
        poolId: selectedPoolId === "all" ? undefined : (selectedPoolId as any),
        stages: selectedStages.length > 0 ? selectedStages : undefined,
        search: debouncedSearch || undefined,
      },
      sort: sortBy,
    } : "skip",
    { initialNumItems: 100 },
  );

  const sentinelRef = useInfiniteScroll({ status, loadMore, loadCount: 100 });

  const totalCountQuery = useQuery(
    api.candidates.countForSchool,
    profile?.schoolId
      ? {
          schoolId: profile.schoolId,
          filter: {
            poolId: selectedPoolId === "all" ? undefined : (selectedPoolId as any),
            stages: selectedStages.length > 0 ? selectedStages : undefined,
            search: debouncedSearch || undefined,
          },
        }
      : "skip",
  );

  // Keep loadedIds in sync with rendered results
  useEffect(() => {
    sel.setLoadedIds(results.map((r: any) => r.applicationId));
  }, [results]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear selection on filter/sort change
  useEffect(() => {
    sel.clear();
  }, [selectedPoolId, selectedStages, searchText, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  const poolCounts: Record<string, number> = {};
  // Pool counts are not available in the enriched shape; show 0 for now
  const poolsWithCounts = pools.map((p: any) => ({
    _id: p._id,
    name: p.name,
    createdBy: p.createdBy,
    tags: p.tags,
    candidateCount: poolCounts[p._id] ?? 0,
  }));

  const stageCounts: Record<string, number> = {};
  for (const row of results) {
    const s = (row as any).stage;
    if (s) stageCounts[s] = (stageCounts[s] ?? 0) + 1;
  }

  // Map enriched rows to Application shape for ApplicationTable
  const tableApplications: Application[] = results.map((row: any) => ({
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
  }));

  const nlTableApplications: Application[] | null = nlResults
    ? nlResults.map((row: any) => ({
        _id: row.applicationId ?? row._id,
        candidateId: row.candidateId ?? row._id,
        stage: row.stage,
        aiMatchScore: row.aiMatchScore,
        globalScore: undefined,
        poolNames: undefined,
        candidate: {
          _id: row.candidateId ?? row._id,
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
      }))
    : null;

  const displayApplications = nlTableApplications ?? tableApplications;

  const isLoading = status === "LoadingFirstPage";
  const total = results.length;

  const totalCount = totalCountQuery?.total ?? 0;
  const countN = sel.count.kind === "all-matching" ? totalCount : sel.count.n;
  const hasSelection = sel.count.kind === "ids" ? sel.count.n > 0 : true;

  return (
    <div className="p-6">
      <PageHeader
        title="Talent Bank"
        subtitle={`${total} candidate${total !== 1 ? "s" : ""} across your school`}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPoolManager(!showPoolManager)}
            >
              Manage Pools
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCriteriaPanel(true)}
            >
              Global Criteria
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowUploadModal(true)}
              disabled={!schoolId}
            >
              Upload Resume
            </Button>
          </>
        }
      />

      {schoolId && (
        <UploadResumeModal
          open={showUploadModal}
          onOpenChange={setShowUploadModal}
          schoolId={schoolId}
        />
      )}

      {showPoolManager && schoolId && (
        <div className="mb-4">
          <PoolSelector schoolId={schoolId} pools={poolsWithCounts} />
        </div>
      )}

      {showCriteriaPanel && schoolId && (
        <GlobalCriteriaPanel
          schoolId={schoolId}
          onClose={() => setShowCriteriaPanel(false)}
        />
      )}

      <NlSearchBar onResults={(c, intent) => { setNlResults(c); setNlIntent(intent); }} />
      {nlResults && (
        <div className="mb-4 text-sm text-gray-600">
          {nlIntent ? `Showing results for: ${nlIntent}` : null} ({nlResults.length} candidates)
          <button className="ml-2 text-blue-600 underline" onClick={() => setNlResults(null)}>Clear</button>
        </div>
      )}

      <TalentControls
        searchQuery={searchText}
        onSearchChange={handleSearchChange}
        selectedPoolId={selectedPoolId}
        onPoolChange={setSelectedPoolId}
        pools={poolsWithCounts.map((p: any) => ({
          _id: p._id,
          name: p.name,
          count: p.candidateCount,
        }))}
        selectedStages={selectedStages}
        onStagesChange={setSelectedStages}
        stageCounts={stageCounts}
        sortBy={sortBy}
        onSortChange={setSortBy}
        totalCount={total}
        filteredCount={total}
      />

      {isLoading ? (
        <Card padding="lg" className="mt-4 text-center">
          <p className="text-sm text-ink-secondary">Loading candidates...</p>
        </Card>
      ) : displayApplications.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            }
            title="No candidates found"
            description={
              nlResults
                ? "No candidates matched your search. Try different keywords."
                : searchText || selectedPoolId !== "all" || selectedStages.length > 0
                  ? "Try adjusting your search or filters."
                  : "Candidates will appear here when you source them from jobs, email ingestion, or the careers portal."
            }
          />
        </div>
      ) : (
        <Card padding="none" elevation={1} className="mt-4 overflow-hidden">
          <ApplicationTable
            applications={displayApplications}
            sortBy={sortBy}
            onSortChange={setSortBy}
            showScoreAs="global"
            showPoolBadges={true}
            onRowClick={setSelectedApp}
            loadMoreRef={sentinelRef}
            selected={(id) => sel.isSelected(id as any)}
            onToggleRow={(id, shift) => sel.toggle(id as any, shift)}
            onToggleAll={(ids) => sel.toggleAllLoaded(ids as any)}
          />
        </Card>
      )}

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
          countLabel="candidates"
          onClear={() => sel.clear()}
          banner={
            sel.mode.kind === "ids" &&
            sel.count.n === results.length &&
            results.length > 0 &&
            totalCount > results.length ? (
              <SelectAllMatchingBanner
                loadedCount={results.length}
                totalCount={totalCount}
                entityLabel="candidates"
                onSelectAllMatching={() =>
                  sel.selectAllMatching({
                    schoolId: profile!.schoolId,
                    filter: {
                      poolId: selectedPoolId === "all" ? undefined : (selectedPoolId as any),
                      stages: selectedStages.length > 0 ? selectedStages : undefined,
                      search: debouncedSearch || undefined,
                    },
                  })
                }
              />
            ) : undefined
          }
        >
          <button
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-body-s"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </button>
          {sel.mode.kind === "ids" && (
            <button
              className="bg-surface text-ink px-3 py-1.5 rounded text-body-s border border-hairline"
              onClick={() => {
                const selectedRows = sel.mode.kind === "ids"
                  ? results.filter((r: any) => sel.isSelected(r.applicationId))
                  : [];
                if (selectedRows.length === 0) return;
                const csv = rowsToCsv(selectedRows, [
                  { key: "name", label: "Name" },
                  { key: "email", label: "Email" },
                  { key: "phone", label: "Phone" },
                  { key: "yearsExperience", label: "Years Experience" },
                  { key: "subjects", label: "Subjects" },
                  { key: "createdAt", label: "Created At" },
                ]);
                const today = new Date().toISOString().slice(0, 10);
                downloadCsv(`talent-${today}.csv`, csv);
              }}
            >
              Export CSV
            </button>
          )}
        </BulkActionBar>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${countN} ${countN === 1 ? "candidate" : "candidates"}?`}
        body="This removes their resumes, every application across roles, and all evaluations. You can undo within 10 seconds."
        confirmLabel="Delete"
        onConfirm={async () => {
          setConfirmDelete(false);
          const args: any =
            sel.mode.kind === "ids"
              ? {
                  ids: results
                    .filter((r: any) => sel.isSelected(r.applicationId))
                    .map((r: any) => r.candidateId),
                }
              : {
                  matchAll: {
                    schoolId: profile!.schoolId,
                    filter: {
                      poolId: selectedPoolId === "all" ? undefined : (selectedPoolId as any),
                      stages: selectedStages.length > 0 ? selectedStages : undefined,
                      search: debouncedSearch || undefined,
                    },
                  },
                };
          const r = await removeMany(args);
          sel.clear();
          if (r.batchId) {
            const batchId = r.batchId;
            undoToast.show({
              label: `Deleted ${r.count} ${r.count === 1 ? "candidate" : "candidates"}`,
              onUndo: async () => { await undoRemove({ batchId }); },
            });
          }
        }}
        onCancel={() => setConfirmDelete(false)}
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
