"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Candidate {
  _id: string;
  name: string;
  qualifications: string[];
  subjects: string[];
}

interface Application {
  _id: string;
  candidateId: string;
  stage: string;
  aiMatchScore?: number;
  candidate?: Candidate | null;
}

interface Props {
  app: Application;
  isDragging: boolean;
  onClick: () => void;
}

function matchScoreVariant(score: number) {
  if (score >= 80) return "success" as const;
  if (score >= 50) return "warning" as const;
  return "default" as const;
}

export function CandidateCard({ app, isDragging, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-apple bg-surface-secondary transition-shadow",
        isDragging && "shadow-menu rotate-1 bg-surface"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">
          {app.candidate?.name ?? "Unknown"}
        </p>
        {app.aiMatchScore != null && (
          <Badge variant={matchScoreVariant(app.aiMatchScore)}>
            {app.aiMatchScore}%
          </Badge>
        )}
      </div>
      {app.candidate?.subjects && app.candidate.subjects.length > 0 && (
        <p className="text-xs text-ink-tertiary mt-1">
          {app.candidate.subjects.join(", ")}
        </p>
      )}
    </button>
  );
}
