"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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

  // Re-demo prefill source. Two ways it can be set:
  //   1. URL param (?fromDemo=<demoId>) — when the user navigates here from
  //      the demo detail page after picking "Re-demo" in DecisionModal.
  //   2. Future: an in-drawer DecisionModal could call setRedemoSourceId
  //      directly (lift-state pattern), since the drawer has no URL routing.
  const searchParams = useSearchParams();
  const fromDemoParam = searchParams?.get("fromDemo") ?? null;
  const [redemoSourceId, setRedemoSourceId] = useState<string | null>(fromDemoParam);

  useEffect(() => {
    if (fromDemoParam) setRedemoSourceId(fromDemoParam);
  }, [fromDemoParam]);

  if (!application) {
    return <p className="text-body-s text-ink-secondary">Loading…</p>;
  }

  return (
    <DemosPanel
      applicationId={applicationId}
      schoolId={application.schoolId}
      candidateName={candidate?.name ?? "Candidate"}
      prefillFromDemoId={redemoSourceId ?? undefined}
      onPrefillConsumed={() => setRedemoSourceId(null)}
    />
  );
}
