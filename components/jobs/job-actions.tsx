"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface Props {
  jobId: string;
  status: string;
}

export function JobActions({ jobId, status }: Props) {
  const router = useRouter();
  const publishJob = useMutation(api.jobs.publish);
  const closeJob = useMutation(api.jobs.close);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePublish = async () => {
    setError("");
    setLoading(true);
    try {
      await publishJob({ jobId: jobId as any });
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to publish");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    setError("");
    setLoading(true);
    try {
      await closeJob({ jobId: jobId as any, reason: "filled" });
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to close job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {(status === "draft" || status === "paused") && (
          <button
            onClick={handlePublish}
            disabled={loading}
            className="py-2.5 px-5 rounded-apple bg-accent text-white text-sm font-medium hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-50 transition-colors"
          >
            {loading ? "Publishing..." : "Publish Job"}
          </button>
        )}

        {status === "active" && (
          <>
            <button
              onClick={() => router.push(`/dashboard/jobs/${jobId}/pipeline`)}
              className="py-2.5 px-5 rounded-apple bg-accent text-white text-sm font-medium hover:bg-accent-hover active:bg-accent-pressed transition-colors"
            >
              View Pipeline
            </button>
            <button
              onClick={() => router.push(`/dashboard/jobs/${jobId}/sourcing`)}
              className="py-2.5 px-5 rounded-apple bg-surface-secondary text-ink text-sm font-medium hover:bg-surface-tertiary transition-colors"
            >
              Source Candidates
            </button>
            <button
              onClick={handleClose}
              disabled={loading}
              className="py-2.5 px-5 rounded-apple bg-red-50 text-danger text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              Close Job
            </button>
          </>
        )}

        {status === "filled" || status === "closed" ? (
          <button
            onClick={() => router.push(`/dashboard/jobs/${jobId}/pipeline`)}
            className="py-2.5 px-5 rounded-apple bg-surface-secondary text-ink text-sm font-medium hover:bg-surface-tertiary transition-colors"
          >
            View Pipeline
          </button>
        ) : null}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-apple bg-red-50 text-sm text-danger">{error}</div>
      )}
    </div>
  );
}
