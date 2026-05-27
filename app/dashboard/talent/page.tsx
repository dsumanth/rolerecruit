"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Button, Card, PageHeader } from "@/components/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { TalentControls } from "@/components/talent/talent-controls";
import { PoolSelector } from "@/components/talent/pool-selector";
import { GlobalCriteriaPanel } from "@/components/talent/global-criteria-panel";
import { ApplicationTable } from "@/components/pipeline/application-table";
import { ApplicationDrawer } from "@/components/pipeline/application-drawer";
import type { Application } from "@/components/pipeline/application-table";
import { NlSearchBar } from "@/components/talent/nl-search-bar";

export default function TalentBankPage() {
  const { user } = useUser();
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");
  const schoolId = profile?.schoolId;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPoolId, setSelectedPoolId] = useState<string | "all">("all");
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"newest" | "score" | "name">("newest");
  const [showPoolManager, setShowPoolManager] = useState(false);
  const [showCriteriaPanel, setShowCriteriaPanel] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [nlResults, setNlResults] = useState<any[] | null>(null);
  const [nlIntent, setNlIntent] = useState("");
  const [selectedApp, setSelectedApp] = useState<any>(null);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    const timer = setTimeout(() => setDebouncedSearch(query), 300);
    return () => clearTimeout(timer);
  };

  const pools = useQuery(api.pools.listForSchool, schoolId ? { schoolId } : "skip") ?? [];

  const candidates = useQuery(
    api.candidates.listForSchool,
    schoolId
      ? {
          schoolId,
          poolId: selectedPoolId === "all" ? undefined : selectedPoolId,
        } as any
      : "skip"
  ) ?? [];

  const searchFiltered = useMemo(() => {
    if (!debouncedSearch.trim()) return candidates;
    const q = debouncedSearch.toLowerCase();
    return candidates.filter(
      (c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q) ||
        c.subjects?.some((s: string) => s.toLowerCase().includes(q))
    );
  }, [candidates, debouncedSearch]);

  const stageFiltered = useMemo(() => {
    if (selectedStages.length === 0) return searchFiltered;
    return searchFiltered.filter((c: any) => selectedStages.includes(c.stage));
  }, [searchFiltered, selectedStages]);

  const sorted = useMemo(() => {
    const apps = [...stageFiltered];
    switch (sortBy) {
      case "score":
        return apps.sort((a: any, b: any) => (b.globalScore ?? 0) - (a.globalScore ?? 0));
      case "name":
        return apps.sort((a: any, b: any) =>
          (a.name ?? "").localeCompare(b.name ?? "")
        );
      case "newest":
      default:
        return apps;
    }
  }, [stageFiltered, sortBy]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of searchFiltered) {
      counts[c.stage] = (counts[c.stage] ?? 0) + 1;
    }
    return counts;
  }, [searchFiltered]);

  const poolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of candidates) {
      if (c.poolIds) {
        for (const pid of c.poolIds) {
          counts[pid] = (counts[pid] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [candidates]);

  const poolsWithCounts = pools.map((p: any) => ({
    _id: p._id,
    name: p.name,
    createdBy: p.createdBy,
    tags: p.tags,
    candidateCount: poolCounts[p._id] ?? 0,
  }));

  const tableApplications: Application[] = sorted.map((c: any) => ({
    _id: c.applicationId ?? c._id,
    candidateId: c._id,
    stage: c.stage,
    aiMatchScore: c.aiMatchScore,
    globalScore: c.globalScore,
    poolNames: c.poolNames,
    candidate: {
      _id: c._id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      location: c.location,
      qualifications: c.qualifications,
      certifications: c.certifications,
      boardExperience: c.boardExperience,
      subjects: c.subjects,
      yearsExperience: c.yearsExperience,
      currentSchool: c.currentSchool,
      resumeUrl: c.resumeUrl,
    },
  }));

  const nlTableApplications: Application[] | null = nlResults
    ? nlResults.map((c: any) => ({
        _id: c.applicationId ?? c._id,
        candidateId: c._id,
        stage: c.stage,
        aiMatchScore: c.aiMatchScore,
        globalScore: c.globalScore,
        poolNames: c.poolNames,
        candidate: {
          _id: c._id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          location: c.location,
          qualifications: c.qualifications,
          certifications: c.certifications,
          boardExperience: c.boardExperience,
          subjects: c.subjects,
          yearsExperience: c.yearsExperience,
          currentSchool: c.currentSchool,
          resumeUrl: c.resumeUrl,
        },
      }))
    : null;

  const displayApplications = nlTableApplications ?? tableApplications;

  const isLoading = candidates === undefined;
  const total = candidates.length;

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
          </>
        }
      />

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
        searchQuery={searchQuery}
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
        totalCount={candidates.length}
        filteredCount={stageFiltered.length}
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
                : searchQuery || selectedPoolId !== "all" || selectedStages.length > 0
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
          />
        </Card>
      )}

      {selectedApp && (
        <ApplicationDrawer
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
        />
      )}
    </div>
  );
}
