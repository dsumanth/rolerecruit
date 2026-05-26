"use client";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Check, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { EvidencePopover } from "@/components/shared/evidence-popover";

interface Props {
  item: { application: any; candidate: any; job: any; decision: any; draft: any };
  userId: string;
}

const outcomeStyles: Record<string, { bg: string; label: string }> = {
  auto_shortlisted: { bg: "bg-green-50 ring-green-200", label: "Auto-Shortlisted" },
  auto_rejected: { bg: "bg-red-50 ring-red-200", label: "Auto-Rejected" },
  human_review: { bg: "bg-amber-50 ring-amber-200", label: "Needs Your Review" },
  cross_role_suggested: { bg: "bg-blue-50 ring-blue-200", label: "Cross-Role Match" },
};

export function TriageCard({ item, userId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const approve = useMutation(api.triage.approveDraft);
  const override = useMutation(api.triage.overrideOutcome);
  const outcome = item.decision?.outcome ?? "human_review";
  const styles = outcomeStyles[outcome] ?? outcomeStyles.human_review;
  const specs: any[] = item.candidate?.parsedFacets?.specializations ?? [];

  return (
    <div className={`rounded-lg ring-1 p-4 ${styles.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-gray-900 truncate">{item.candidate?.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white">{styles.label}</span>
            <span className="text-sm text-gray-600">{item.decision?.primaryMatchScore}/100</span>
          </div>
          <p className="text-sm text-gray-700 mt-1">For: <span className="font-medium">{item.job?.title}</span></p>
          <p className="text-sm text-gray-600 mt-1 italic">{item.decision?.outcomeReasoning}</p>
          {specs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {specs.slice(0, 6).map((s: any, i: number) => (
                <span key={i} className="text-xs bg-white px-2 py-0.5 rounded ring-1 ring-gray-200">
                  <EvidencePopover value={s.value} evidence={s.evidence} />
                </span>
              ))}
            </div>
          )}
          {item.decision?.primaryMatchReasons && item.decision.primaryMatchReasons.length > 0 && (
            <ul className="mt-2 text-xs text-gray-700 list-disc list-inside">
              {item.decision.primaryMatchReasons.slice(0, 3).map((r: string, i: number) => <li key={i}>{r}</li>)}
            </ul>
          )}
          {item.draft && (
            <button className="mt-2 text-xs text-blue-600 inline-flex items-center gap-1" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Hide" : "Show"} draft outreach
            </button>
          )}
          {expanded && item.draft && (
            <pre className="mt-2 p-3 bg-white border rounded text-xs whitespace-pre-wrap">{item.draft.body}</pre>
          )}
        </div>
        <div className="flex gap-2">
          {item.draft && item.draft.status === "draft_pending_approval" && (
            <button onClick={() => approve({ decisionId: item.decision._id, overriddenBy: userId })}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-xs inline-flex items-center gap-1">
              <Check className="h-3 w-3" /> Approve
            </button>
          )}
          <button onClick={() => override({ decisionId: item.decision._id, overriddenBy: userId, toOutcome: "human_review" })}
            className="px-3 py-1.5 bg-white text-gray-700 ring-1 ring-gray-300 rounded text-xs inline-flex items-center gap-1">
            <Edit className="h-3 w-3" /> Override
          </button>
        </div>
      </div>
    </div>
  );
}
