"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

interface Candidate {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  location?: string;
  qualifications: string[];
  certifications: string[];
  boardExperience: string[];
  subjects: string[];
  yearsExperience?: number;
  currentSchool?: string;
}

interface Props {
  candidate: Candidate;
  jobId: string;
  onAddToPipeline: (candidateId: string) => void;
  onDismiss: (candidateId: string) => void;
  score?: number;
  reasoning?: string;
}

export function CandidateReviewCard({
  candidate,
  jobId,
  onAddToPipeline,
  onDismiss,
  score,
  reasoning,
}: Props) {
  return (
    <div className="rounded-apple bg-surface border border-surface-tertiary p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            {candidate.name}
          </h3>
          {candidate.location && (
            <p className="text-xs text-ink-tertiary mt-0.5">{candidate.location}</p>
          )}
        </div>
        {score != null && (
          <span
            className={cn(
              "text-xs px-2 py-1 rounded-full font-medium tabular-nums",
              score >= 80
                ? "bg-green-50 text-success"
                : score >= 50
                  ? "bg-amber-50 text-warning"
                  : "bg-surface-secondary text-ink-secondary"
            )}
          >
            {score}%
          </span>
        )}
      </div>

      {reasoning && (
        <p className="text-xs text-ink-secondary mb-3 italic">{reasoning}</p>
      )}

      <div className="space-y-2 mb-4">
        {candidate.yearsExperience != null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-tertiary w-20 shrink-0">Experience</span>
            <span className="text-xs text-ink">{candidate.yearsExperience} years</span>
          </div>
        )}
        {candidate.currentSchool && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-tertiary w-20 shrink-0">Current</span>
            <span className="text-xs text-ink">{candidate.currentSchool}</span>
          </div>
        )}
        {candidate.qualifications.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-xs text-ink-tertiary w-20 shrink-0">Quals</span>
            <div className="flex flex-wrap gap-1">
              {candidate.qualifications.map((q) => (
                <span
                  key={q}
                  className="text-xs px-1.5 py-0.5 rounded bg-surface-secondary text-ink"
                >
                  {q}
                </span>
              ))}
            </div>
          </div>
        )}
        {candidate.certifications.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-xs text-ink-tertiary w-20 shrink-0">Certs</span>
            <div className="flex flex-wrap gap-1">
              {candidate.certifications.map((c) => (
                <span key={c} className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-success">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {candidate.subjects.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-xs text-ink-tertiary w-20 shrink-0">Subjects</span>
            <div className="flex flex-wrap gap-1">
              {candidate.subjects.map((s) => (
                <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-surface-secondary text-ink">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {candidate.boardExperience.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-xs text-ink-tertiary w-20 shrink-0">Boards</span>
            <div className="flex flex-wrap gap-1">
              {candidate.boardExperience.map((b) => (
                <span key={b} className="text-xs px-1.5 py-0.5 rounded bg-surface-secondary text-ink">
                  {b}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAddToPipeline(candidate._id)}
          className="flex-1 py-2 rounded-apple bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
        >
          Add to Pipeline
        </button>
        <button
          type="button"
          onClick={() => onDismiss(candidate._id)}
          className="py-2 px-4 rounded-apple bg-surface-secondary text-ink-secondary text-xs font-medium hover:bg-surface-tertiary transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
