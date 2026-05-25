"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

interface Props {
  token: string;
}

const DIMENSIONS = [
  { key: "subjectKnowledge", label: "Subject Knowledge" },
  { key: "classroomManagement", label: "Classroom Management" },
  { key: "communication", label: "Communication" },
  { key: "overallFit", label: "Overall Fit" },
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
            "text-xl transition-colors",
            star <= value ? "text-warning" : "text-surface-tertiary"
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
      <div className="rounded-apple bg-surface border border-surface-tertiary p-8 text-center max-w-md mx-auto">
        <p className="text-sm text-ink-secondary">Loading...</p>
      </div>
    );
  }

  if (!submission._id) {
    return (
      <div className="rounded-apple bg-surface border border-surface-tertiary p-8 text-center max-w-md mx-auto">
        <h1 className="text-lg font-semibold text-ink mb-2">
          Invalid Link
        </h1>
        <p className="text-sm text-ink-secondary">
          This feedback link is invalid or has expired.
        </p>
      </div>
    );
  }

  if (submission.submitted || done) {
    return (
      <div className="rounded-apple bg-surface border border-surface-tertiary p-8 text-center max-w-md mx-auto">
        <div className="text-3xl mb-3">✓</div>
        <h1 className="text-lg font-semibold text-ink mb-2">
          Feedback Submitted
        </h1>
        <p className="text-sm text-ink-secondary">
          Thank you! Your evaluation has been recorded.
        </p>
      </div>
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

  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-apple bg-surface border border-surface-tertiary p-6">
        <h1 className="text-lg font-semibold text-ink mb-1">
          Demo Lesson Feedback
        </h1>
        {submission.candidate && (
          <p className="text-sm text-ink-secondary mb-6">
            Candidate: {submission.candidate.name}
            {submission.candidate.subjects.length > 0 &&
              ` · ${submission.candidate.subjects.join(", ")}`}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {DIMENSIONS.map((dim) => (
            <div key={dim.key}>
              <label className="block text-sm font-medium text-ink mb-1.5">
                {dim.label}
              </label>
              <StarRating
                value={ratings[dim.key] ?? 0}
                onChange={(v) => setRatings((prev) => ({ ...prev, [dim.key]: v }))}
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Comments
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
              placeholder="Any additional notes about the candidate..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Recommendation
            </label>
            <div className="flex gap-3">
              {RECOMMENDATIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRecommendation(r.value)}
                  className={cn(
                    "py-2 px-4 rounded-apple text-sm font-medium transition-colors border",
                    recommendation === r.value
                      ? r.value === "hire"
                        ? "bg-green-50 text-success border-[#34c759]"
                        : r.value === "reject"
                          ? "bg-red-50 text-danger border-[#ff3b30]"
                          : "bg-amber-50 text-warning border-[#ff9f0a]"
                      : "bg-surface-secondary text-ink-secondary border-surface-tertiary hover:bg-surface-tertiary"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-apple bg-red-50 text-sm text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-apple bg-accent text-white text-sm font-medium hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-50 transition-colors"
          >
            {submitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </form>
      </div>
    </div>
  );
}
