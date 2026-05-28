"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DemosPanel } from "@/components/demos/demos-panel";

// TODO(Plan 2): full eval surface moved to /dashboard/demos/[id]
export function EvaluateTab({ applicationId }: { applicationId: string }) {
  const application = useQuery(api.applications.get, {
    applicationId: applicationId as Id<"applications">,
  });
  const candidate = useQuery(
    api.candidates.get,
    application?.candidateId
      ? { candidateId: application.candidateId }
      : "skip",
  );

  if (!application) {
    return <p className="text-body-s text-ink-secondary">Loading…</p>;
  }

  return (
    <DemosPanel
      applicationId={applicationId}
      schoolId={application.schoolId}
      candidateName={candidate?.name ?? "Candidate"}
    />
  );
}
