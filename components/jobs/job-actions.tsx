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
  const setStatus = useMutation(api.jobs.setStatus);
  const publishJob = useMutation(api.jobs.publish);
  const closeJob = useMutation(api.jobs.close);
  const deleteDraft = useMutation(api.jobs.deleteDraft);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<unknown>, failMessage: string) => {
    setError("");
    setLoading(true);
    try {
      await fn();
      router.refresh();
    } catch (err: any) {
      setError(err.message || failMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this draft? This can't be undone.")) return;
    setError("");
    setLoading(true);
    try {
      await deleteDraft({ jobId: jobId as any });
      router.push("/dashboard/jobs");
    } catch (err: any) {
      setError(err.message || "Failed to delete");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "draft" && (
        <>
          <Button variant="primary" size="md" loading={loading} onClick={() => run(() => publishJob({ jobId: jobId as any }), "Failed to publish")}>
            Publish role
          </Button>
          <Button variant="danger" size="md" loading={loading} onClick={handleDelete}>
            Delete draft
          </Button>
        </>
      )}

      {status === "paused" && (
        <Button variant="primary" size="md" loading={loading} onClick={() => run(() => setStatus({ jobId: jobId as any, status: "active" }), "Failed to resume")}>
          Resume role
        </Button>
      )}

      {status === "active" && (
        <>
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push(`/dashboard/jobs/${jobId}/pipeline`)}
          >
            View pipeline
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => router.push(`/dashboard/jobs/${jobId}/sourcing`)}
          >
            Source candidates
          </Button>
          <Button
            variant="secondary"
            size="md"
            loading={loading}
            onClick={() => run(() => setStatus({ jobId: jobId as any, status: "paused" }), "Failed to pause")}
          >
            Put on hold
          </Button>
          <Button
            variant="danger"
            size="md"
            loading={loading}
            onClick={() => run(() => closeJob({ jobId: jobId as any, reason: "closed" }), "Failed to close")}
          >
            Close role
          </Button>
        </>
      )}

      {(status === "filled" || status === "closed") && (
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={() => router.push(`/dashboard/jobs/${jobId}/pipeline`)}
          >
            View pipeline
          </Button>
          <Button
            variant="secondary"
            size="md"
            loading={loading}
            onClick={() => run(() => setStatus({ jobId: jobId as any, status: "active" }), "Failed to reopen")}
          >
            Reopen
          </Button>
        </>
      )}

      {error && (
        <span className="text-body-s text-danger">{error}</span>
      )}
    </div>
  );
}
