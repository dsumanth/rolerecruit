"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, Badge, Button } from "@/components/ui";

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

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

function scoreVariant(score: number): BadgeVariant {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "neutral";
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
    <Card padding="md" elevation={1} interactive>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-body-s font-semibold text-ink">
            {candidate.name}
          </h3>
          {candidate.location && (
            <p className="text-caption text-ink-secondary mt-0.5">{candidate.location}</p>
          )}
        </div>
        {score != null && (
          <Badge variant={scoreVariant(score)}>{score}%</Badge>
        )}
      </div>

      {reasoning && (
        <p className="text-caption text-ink-secondary mb-3 italic">{reasoning}</p>
      )}

      <div className="space-y-2 mb-4">
        {candidate.yearsExperience != null && (
          <div className="flex items-center gap-2">
            <span className="text-caption text-ink-secondary w-20 shrink-0">Experience</span>
            <span className="text-caption text-ink">{candidate.yearsExperience} years</span>
          </div>
        )}
        {candidate.currentSchool && (
          <div className="flex items-center gap-2">
            <span className="text-caption text-ink-secondary w-20 shrink-0">Current</span>
            <span className="text-caption text-ink">{candidate.currentSchool}</span>
          </div>
        )}
        {candidate.qualifications.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-caption text-ink-secondary w-20 shrink-0">Quals</span>
            <div className="flex flex-wrap gap-1">
              {candidate.qualifications.map((q) => (
                <Badge key={q} variant="neutral">{q}</Badge>
              ))}
            </div>
          </div>
        )}
        {candidate.certifications.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-caption text-ink-secondary w-20 shrink-0">Certs</span>
            <div className="flex flex-wrap gap-1">
              {candidate.certifications.map((c) => (
                <Badge key={c} variant="success">{c}</Badge>
              ))}
            </div>
          </div>
        )}
        {candidate.subjects.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-caption text-ink-secondary w-20 shrink-0">Subjects</span>
            <div className="flex flex-wrap gap-1">
              {candidate.subjects.map((s) => (
                <Badge key={s} variant="neutral">{s}</Badge>
              ))}
            </div>
          </div>
        )}
        {candidate.boardExperience.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-caption text-ink-secondary w-20 shrink-0">Boards</span>
            <div className="flex flex-wrap gap-1">
              {candidate.boardExperience.map((b) => (
                <Badge key={b} variant="neutral">{b}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          onClick={() => onAddToPipeline(candidate._id)}
        >
          Add to Pipeline
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onDismiss(candidate._id)}
        >
          Dismiss
        </Button>
      </div>
    </Card>
  );
}
