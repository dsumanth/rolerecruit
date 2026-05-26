"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, Button } from "@/components/ui";
import { nameInitial } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Props {
  token: string;
}

const DIMENSIONS = [
  { key: "subjectKnowledge", label: "Subject knowledge" },
  { key: "classroomManagement", label: "Classroom management" },
  { key: "communication", label: "Communication" },
  { key: "overallFit", label: "Overall fit" },
] as const;

const RECOMMENDATIONS = [
  { value: "hire" as const, label: "Hire" },
  { value: "maybe" as const, label: "Maybe" },
  { value: "reject" as const, label: "Reject" },
];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={cn(
            "text-2xl transition-colors duration-fast",
            star <= value ? "text-warning" : "text-hairline hover:text-ink-tertiary",
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function FeedbackForm({ token }: Props) {
  const submission = useQuery(api.evaluations.getByToken, { token });
  const submit = useMutation(api.evaluations.submitFeedback);

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState("");
  const [recommendation, setRecommendation] = useState<"hire" | "maybe" | "reject" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!submission) {
    return (
      <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto text-center">
        <p className="text-body-s text-ink-secondary">Loading...</p>
      </Card>
    );
  }

  if (!submission._id) {
    return (
      <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto text-center">
        <h1 className="text-title-l text-ink mb-2">Invalid link</h1>
        <p className="text-body-s text-ink-secondary">This feedback link is invalid or has expired.</p>
      </Card>
    );
  }

  if (submission.submitted || done) {
    return (
      <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success mb-4 text-2xl">✓</div>
        <h1 className="text-title-l text-ink mb-2">Feedback submitted</h1>
        <p className="text-body-s text-ink-secondary">Thank you. Your evaluation has been recorded.</p>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const missing = DIMENSIONS.filter((d) => !ratings[d.key]);
    if (missing.length > 0 || !recommendation) {
      setError("Please complete all ratings and select a recommendation.");
      return;
    }

    setSubmitting(true);
    try {
      await submit({
        token,
        subjectKnowledge: ratings.subjectKnowledge!,
        classroomManagement: ratings.classroomManagement!,
        communication: ratings.communication!,
        overallFit: ratings.overallFit!,
        comments: comments || undefined,
        recommendation,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const candidateName = submission.candidate?.name ?? "Candidate";

  return (
    <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto">
      <div className="flex items-center gap-2.5 pb-5 mb-5 border-b border-hairline">
        <div className="h-8 w-8 rounded-sm bg-gradient-to-br from-[#1d1d1f] to-[#4a4a52] text-white text-body-s font-bold flex items-center justify-center">
          {nameInitial(candidateName, "·")}
        </div>
        <div className="min-w-0">
          <p className="text-body-s font-medium text-ink truncate">{candidateName}</p>
          {submission.candidate?.subjects?.length ? (
            <p className="text-caption text-ink-secondary truncate">{submission.candidate.subjects.join(", ")}</p>
          ) : null}
        </div>
      </div>

      <h1 className="text-display-s text-ink mb-1">Demo lesson feedback</h1>
      <p className="text-body-s text-ink-secondary mb-6">Rate each dimension and share your overall recommendation.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {DIMENSIONS.map((dim) => (
          <div key={dim.key} className="flex items-center justify-between">
            <label className="text-body-s font-medium text-ink">{dim.label}</label>
            <StarRating
              value={ratings[dim.key] ?? 0}
              onChange={(v) => setRatings((prev) => ({ ...prev, [dim.key]: v }))}
            />
          </div>
        ))}

        <div>
          <label className="block text-body-s font-medium text-ink mb-1.5">Comments</label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            className="w-full rounded-sm bg-surface border border-hairline-strong px-3 py-2 text-body-s text-ink placeholder:text-ink-tertiary outline-none transition-all duration-fast focus:border-accent focus:ring-2 focus:ring-accent-soft resize-none"
            placeholder="Any additional notes about the candidate..."
          />
        </div>

        <div>
          <label className="block text-body-s font-medium text-ink mb-2">Recommendation</label>
          <div className="grid grid-cols-3 gap-2">
            {RECOMMENDATIONS.map((r) => {
              const active = recommendation === r.value;
              const activeClasses = r.value === "hire"
                ? "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] border-[color-mix(in_srgb,var(--success)_45%,transparent)] text-success"
                : r.value === "reject"
                  ? "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] border-[color-mix(in_srgb,var(--danger)_45%,transparent)] text-danger"
                  : "bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] border-[color-mix(in_srgb,var(--warning)_45%,transparent)] text-warning";
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRecommendation(r.value)}
                  className={cn(
                    "py-2 rounded-md text-body-s font-medium transition-colors duration-fast border",
                    active ? activeClasses : "bg-surface text-ink-secondary border-hairline hover:text-ink",
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger">
            {error}
          </div>
        )}

        <Button type="submit" variant="ink" size="lg" loading={submitting} className="w-full">
          Submit feedback
        </Button>
      </form>
    </Card>
  );
}
