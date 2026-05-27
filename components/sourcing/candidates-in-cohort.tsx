"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

interface CandidatesInCohortProps {
  cohortNodeId: Id<"nodes">;
  cohortName: string;
  onBack: () => void;
}

export function CandidatesInCohort({ cohortNodeId, cohortName, onBack }: CandidatesInCohortProps) {
  const [untappedOnly, setUntappedOnly] = useState(true);
  const data = useQuery(api.graph.listCandidatesInCohort, {
    cohortNodeId,
    untappedOnly,
    limit: 100,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="text-ink-muted text-sm hover:text-ink"
          >
            ← All cohorts
          </button>
          <h2 className="text-ink text-lg font-medium mt-1">{cohortName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-body-s text-ink-secondary">Untapped only</span>
          <Toggle
            checked={untappedOnly}
            onCheckedChange={setUntappedOnly}
            label="Untapped only"
          />
        </div>
      </div>

      {data === undefined ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          title={untappedOnly ? "No untapped candidates" : "No candidates"}
          description={
            untappedOnly
              ? "Every candidate from this cohort is already in motion. Try the full list."
              : "This cohort has no candidates yet."
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((c) => (
            <Card key={String(c.candidateId)} padding="none" className="p-4 flex items-center justify-between">
              <div>
                <div className="text-ink font-medium">{c.name}</div>
                <div className="text-ink-muted text-sm flex items-center gap-2 mt-1">
                  {c.subjects?.length ? (
                    <Badge variant="neutral">{c.subjects.join(", ")}</Badge>
                  ) : null}
                  {typeof c.yearsExperience === "number" ? (
                    <span>{c.yearsExperience}y experience</span>
                  ) : null}
                  {c.currentSchool ? <span>• {c.currentSchool}</span> : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
