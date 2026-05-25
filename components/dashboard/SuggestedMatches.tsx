"use client";

import { useState, useEffect } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface Props {
  jobId: string;
  schoolId: any;
}

export function SuggestedMatches({ jobId, schoolId }: Props) {
  const [matches, setMatches] = useState<any[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const runReverseMatch = useAction(api.reverseMatching.reverseMatchJob);
  const addApplication = useMutation(api.applications.create);

  useEffect(() => {
    runReverseMatch({ jobId: jobId as any }).then(setMatches).catch(() => setMatches([]));
  }, [jobId]);

  const handleAddToPipeline = async (candidateId: any, score: number) => {
    try {
      await addApplication({
        candidateId,
        jobPostingId: jobId as any,
        schoolId,
      });
      setAdded(new Set([...added, candidateId]));
    } catch {
      // Already added or error
    }
  };

  if (!matches || matches.length === 0) return null;

  return (
    <div className="rounded-apple bg-surface border border-hairline p-5">
      <h3 className="text-sm font-semibold text-ink mb-4">Suggested Matches</h3>
      <div className="space-y-2">
        {matches.slice(0, 10).map((m: any) => (
          <div key={m.candidateId ?? m.applicationId} className="flex items-center justify-between p-3 rounded-apple bg-surface-canvas">
            <div className="flex items-center gap-3">
              <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                m.score >= 85 ? "bg-green-50 text-success" :
                m.score >= 60 ? "bg-amber-50 text-warning" :
                "bg-surface-canvas text-ink-secondary"
              }`}>
                {m.score}/100
              </div>
              <span className="text-sm text-ink">{m.recommendation}</span>
            </div>
            <button
              type="button"
              disabled={added.has(m.candidateId)}
              onClick={() => handleAddToPipeline(m.candidateId, m.score)}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                added.has(m.candidateId)
                  ? "bg-green-50 text-success"
                  : "text-accent hover:bg-accent/10"
              }`}
            >
              {added.has(m.candidateId) ? "Added" : "Add to Pipeline"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
