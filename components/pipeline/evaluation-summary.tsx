"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface Props {
  applicationId: string;
}

export function EvaluationSummary({ applicationId }: Props) {
  const evaluations = useQuery(api.evaluations.getByApplication, {
    applicationId: applicationId as any,
  });

  if (!evaluations) return null;

  const submitted = evaluations.filter((e) => e.submitted);
  if (submitted.length === 0) {
    return (
      <p className="text-xs text-ink-tertiary mt-1">
        {evaluations.length} evaluator{evaluations.length !== 1 ? "s" : ""} invited
      </p>
    );
  }

  const avg =
    submitted.reduce((sum, e) => {
      const scores = [
        e.subjectKnowledge ?? 0,
        e.classroomManagement ?? 0,
        e.communication ?? 0,
        e.overallFit ?? 0,
      ];
      return sum + scores.reduce((a, b) => a + b, 0) / scores.length;
    }, 0) / submitted.length;

  const recommendations = submitted.filter((e) => e.recommendation === "hire").length;

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <span className="text-xs text-ink-secondary tabular-nums">
        Avg: {avg.toFixed(1)}
      </span>
      <span className="text-xs text-ink-secondary">·</span>
      <span className="text-xs text-ink-secondary tabular-nums">
        {recommendations}/{submitted.length} hire
      </span>
    </div>
  );
}
