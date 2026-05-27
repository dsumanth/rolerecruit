"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CohortCard } from "@/components/sourcing/cohort-card";
import { CandidatesInCohort } from "@/components/sourcing/candidates-in-cohort";

export default function CohortsPage() {
  const cohorts = useQuery(api.graph.listCohorts, { limit: 100 });
  const [selected, setSelected] = useState<{ id: Id<"nodes">; name: string } | null>(null);

  if (selected) {
    return (
      <div className="p-6 flex flex-col gap-6">
        <CandidatesInCohort
          cohortNodeId={selected.id}
          cohortName={selected.name}
          onBack={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <PageHeader
        title="Cohort Sourcing"
        subtitle="Find untapped candidates by university and graduation year."
      />
      {cohorts === undefined ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : cohorts.length === 0 ? (
        <EmptyState
          title="No cohorts yet"
          description="Cohorts form automatically as candidates flow through intake. Run the graph backfill from the Convex CLI to populate from existing candidates."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {cohorts.map((c) => (
            <CohortCard
              key={String(c.nodeId)}
              displayName={c.displayName}
              memberCount={c.memberCount}
              onView={() => setSelected({ id: c.nodeId, name: c.displayName })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
