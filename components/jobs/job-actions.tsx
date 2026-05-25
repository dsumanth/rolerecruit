"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui";

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
    <div className="flex flex-wrap items-center gap-2">
      {(status === "draft" || status === "paused") && (
        <Button variant="primary" size="md" loading={loading} onClick={handlePublish}>
          Publish Job
        </Button>
      )}

      {status === "active" && (
        <>
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push(`/dashboard/jobs/${jobId}/pipeline`)}
          >
            View Pipeline
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => router.push(`/dashboard/jobs/${jobId}/sourcing`)}
          >
            Source Candidates
          </Button>
          <Button
            variant="danger"
            size="md"
            loading={loading}
            onClick={handleClose}
          >
            Close Job
          </Button>
        </>
      )}

      {(status === "filled" || status === "closed") && (
        <Button
          variant="secondary"
          size="md"
          onClick={() => router.push(`/dashboard/jobs/${jobId}/pipeline`)}
        >
          View Pipeline
        </Button>
      )}

      {error && (
        <span className="text-body-s text-danger">{error}</span>
      )}
    </div>
  );
}
