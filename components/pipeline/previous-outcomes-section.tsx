"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface Props {
  candidateId: any;
  currentApplicationId: any;
}

export function PreviousOutcomesSection({ candidateId, currentApplicationId }: Props) {
  const history = useQuery(api.candidates.getRejectionHistory, {
    candidateId, excludeApplicationId: currentApplicationId,
  });
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  if (!history || history.length === 0) return null;

  return (
    <div className="mt-6 border-t border-hairline pt-5">
      <h3 className="text-body-s font-semibold text-ink mb-3">Previous outcomes ({history.length})</h3>
      <div className="space-y-3">
        {history.map((h: any) => {
          const expanded = expandedById[h.applicationId] ?? false;
          return (
            <div key={h.applicationId} className="rounded border border-hairline p-3">
              <button
                onClick={() => setExpandedById((s) => ({ ...s, [h.applicationId]: !expanded }))}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="text-body-s">
                  <span className="font-medium">{h.jobTitle}</span>
                  <span className="text-ink-secondary"> · rejected {new Date(h.rejectedAt).toLocaleDateString()}</span>
                </span>
                <span aria-hidden>{expanded ? "▾" : "▸"}</span>
              </button>
              {expanded && (
                <div className="mt-2 space-y-2 text-body-s">
                  {h.evaluations.length === 0 ? (
                    <p className="text-ink-secondary italic">No evaluation notes recorded.</p>
                  ) : (
                    h.evaluations.map((e: any, i: number) => (
                      <div key={i} className="pl-2 border-l-2 border-hairline">
                        <div className="text-ink font-medium capitalize">{e.evaluatorRole.replace("_", " ")}</div>
                        {e.recommendation && (
                          <div className="text-ink-secondary text-body-xs">
                            Recommendation: <span className="font-medium">{e.recommendation}</span>
                          </div>
                        )}
                        {e.comments && <div className="text-ink-secondary italic">"{e.comments}"</div>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
