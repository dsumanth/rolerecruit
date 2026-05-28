"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EvidencePopover } from "@/components/shared/evidence-popover";

export function TriageTab({
  applicationId,
  candidateId,
}: {
  applicationId: string;
  candidateId: string;
}) {
  const triageDecision = useQuery(
    api.triage.getByApplicationId,
    applicationId ? { applicationId: applicationId as any } : "skip",
  );
  const candidateForTriage = useQuery(
    api.candidates.get,
    candidateId ? { candidateId: candidateId as any } : "skip",
  );

  if (triageDecision === undefined) {
    return <div className="p-4 text-sm text-ink-secondary">Loading…</div>;
  }
  if (!triageDecision) {
    return (
      <div className="p-4 text-sm text-ink-secondary">
        No triage decision for this application.
      </div>
    );
  }
  return (
    <div className="space-y-3 p-4">
      <div>
        <div className="text-sm text-ink-secondary">Outcome</div>
        <div className="font-medium">{triageDecision.outcome}</div>
      </div>
      <div>
        <div className="text-sm text-ink-secondary">Score</div>
        <div className="font-medium">{triageDecision.primaryMatchScore}/100</div>
      </div>
      {triageDecision.hybridWeights && (
        <div>
          <div className="text-sm text-ink-secondary">Hybrid weights</div>
          <div className="text-xs">
            struct={triageDecision.hybridWeights.w_struct}, sem={triageDecision.hybridWeights.w_sem}, rules={triageDecision.hybridWeights.w_rules}
          </div>
        </div>
      )}
      <div>
        <div className="text-sm text-ink-secondary">Reasoning</div>
        <div className="text-sm">{triageDecision.outcomeReasoning}</div>
      </div>
      {triageDecision.primaryMatchReasons && triageDecision.primaryMatchReasons.length > 0 && (
        <div>
          <div className="text-sm text-ink-secondary">Match reasons</div>
          <ul className="list-disc list-inside text-sm">
            {triageDecision.primaryMatchReasons.map((r: string, i: number) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {candidateForTriage?.parsedFacets?.specializations &&
        candidateForTriage.parsedFacets.specializations.length > 0 && (
          <div>
            <div className="text-sm text-ink-secondary">Specializations (click to verify)</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {candidateForTriage.parsedFacets.specializations.map((s: any, i: number) => (
                <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                  <EvidencePopover value={s.value} evidence={s.evidence} />
                </span>
              ))}
            </div>
          </div>
        )}
      {triageDecision.humanOverride && (
        <div className="text-sm bg-amber-50 p-2 rounded ring-1 ring-amber-200">
          Overridden by {triageDecision.humanOverride.overriddenBy} (
          {triageDecision.humanOverride.fromOutcome} →{" "}
          {triageDecision.humanOverride.toOutcome})
        </div>
      )}
    </div>
  );
}
