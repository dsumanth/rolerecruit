"use client";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Check, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { EvidencePopover } from "@/components/shared/evidence-popover";
import { Dropdown, DropdownItem, DropdownLabel, DropdownDivider } from "@/components/ui/dropdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Outcome = "auto_shortlisted" | "auto_rejected" | "human_review" | "cross_role_suggested";

const OVERRIDE_TARGETS: Array<{ key: Outcome; label: string; hint: string }> = [
  { key: "auto_shortlisted", label: "Auto-Shortlist", hint: "Advances pipeline to Screened" },
  { key: "auto_rejected", label: "Auto-Reject", hint: "Moves pipeline to Rejected" },
  { key: "human_review", label: "Needs Review", hint: "Park in inbox" },
  { key: "cross_role_suggested", label: "Cross-Role Match", hint: "Suggest for a different role" },
];

const OUTCOME_META: Record<Outcome, { label: string; variant: "success" | "danger" | "warning" | "info" }> = {
  auto_shortlisted: { label: "Auto-Shortlisted", variant: "success" },
  auto_rejected: { label: "Auto-Rejected", variant: "danger" },
  human_review: { label: "Needs Your Review", variant: "warning" },
  cross_role_suggested: { label: "Cross-Role Match", variant: "info" },
};

interface Props {
  item: { application: any; candidate: any; job: any; decision: any; draft: any };
  userId: string;
}

export function TriageCard({ item, userId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const approve = useMutation(api.triage.approveDraft);
  const override = useMutation(api.triage.overrideOutcome);
  const outcome: Outcome = (item.decision?.outcome ?? "human_review") as Outcome;
  const meta = OUTCOME_META[outcome] ?? OUTCOME_META.human_review;
  const specs: any[] = item.candidate?.parsedFacets?.specializations ?? [];

  return (
    <div className="rounded-lg bg-surface border border-hairline shadow-elev-1 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-body font-medium text-ink truncate">{item.candidate?.name}</h3>
            <Badge variant={meta.variant} dot>{meta.label}</Badge>
            <span className="text-caption text-ink-secondary">{item.decision?.primaryMatchScore}/100</span>
          </div>
          <p className="text-body-s text-ink-secondary mt-1.5">
            For: <span className="text-ink font-medium">{item.job?.title}</span>
          </p>
          {item.decision?.outcomeReasoning && (
            <p className="text-body-s text-ink-secondary mt-1.5">{item.decision.outcomeReasoning}</p>
          )}
          {specs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {specs.slice(0, 6).map((s: any, i: number) => (
                <span
                  key={i}
                  className="inline-flex items-center text-caption text-ink-secondary bg-surface-canvas border border-hairline rounded-full px-2.5 py-0.5"
                >
                  <EvidencePopover value={s.value} evidence={s.evidence} />
                </span>
              ))}
            </div>
          )}
          {item.decision?.primaryMatchReasons && item.decision.primaryMatchReasons.length > 0 && (
            <ul className="mt-3 text-caption text-ink-secondary list-disc list-inside space-y-0.5">
              {item.decision.primaryMatchReasons.slice(0, 3).map((r: string, i: number) => <li key={i}>{r}</li>)}
            </ul>
          )}
          {item.draft && (
            <button
              type="button"
              className="mt-3 text-caption text-accent inline-flex items-center gap-1 hover:opacity-80 transition-opacity duration-fast"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Hide" : "Show"} draft outreach
            </button>
          )}
          {expanded && item.draft && (
            <pre className="mt-2 p-3 bg-surface-canvas border border-hairline rounded-md text-caption text-ink whitespace-pre-wrap font-sans">
              {item.draft.body}
            </pre>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {item.draft && item.draft.status === "draft_pending_approval" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => approve({ decisionId: item.decision._id, overriddenBy: userId })}
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
          )}
          <Dropdown
            align="end"
            trigger={
              <Button variant="outline" size="sm">
                <Edit className="h-3.5 w-3.5" /> Override
              </Button>
            }
          >
            <DropdownLabel>Move to</DropdownLabel>
            <DropdownDivider />
            {OVERRIDE_TARGETS.filter((t) => t.key !== outcome).map((t) => (
              <DropdownItem
                key={t.key}
                onSelect={() =>
                  override({
                    decisionId: item.decision._id,
                    overriddenBy: userId,
                    toOutcome: t.key,
                  })
                }
              >
                <div className="flex flex-col">
                  <span>{t.label}</span>
                  <span className="text-micro text-ink-secondary">{t.hint}</span>
                </div>
              </DropdownItem>
            ))}
          </Dropdown>
        </div>
      </div>
    </div>
  );
}
