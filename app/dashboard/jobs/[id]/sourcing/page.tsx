"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function SourcingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const job = useQuery(api.jobs.get, { jobId: params.id as any });
  const sourcingRuns = useQuery(api.sourcing.getRunsForJob, { jobId: params.id as any });
  const pipeline = useQuery(api.applications.getPipelineForJob, { jobId: params.id as any });
  const runSourcing = useAction(api.sourcing_actions.runSourcing);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const handleRunSourcing = async () => {
    if (!job?.schoolId) return;
    setError("");
    setRunning(true);
    try {
      await runSourcing({ jobId: params.id as any, schoolId: job.schoolId as any });
    } catch (err: any) {
      setError(err.message || "Sourcing failed");
    } finally {
      setRunning(false);
    }
  };

  const totalPipeline = pipeline
    ? Object.values(pipeline).flat().length
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Source Candidates
          </h1>
          <p className="text-sm text-ink-secondary mt-1">
            {job?.title ?? "Loading..."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRunSourcing}
          disabled={running}
          className="py-2.5 px-5 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] active:bg-[#004999] disabled:opacity-50 transition-colors"
        >
          {running ? "Sourcing..." : "Source Candidates"}
        </button>
      </div>

      {sourcingRuns && sourcingRuns.length > 0 && (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold text-ink mb-3">Sourcing History</h2>
          {sourcingRuns.map((run) => (
            <div key={run._id} className="flex items-center gap-3 text-sm">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                run.status === "completed"
                  ? "bg-[#e8f5e9] text-[#34c759]"
                  : run.status === "running"
                  ? "bg-accent/10 text-accent"
                  : run.status === "failed"
                  ? "bg-[#fff2f0] text-[#ff3b30]"
                  : "bg-surface-secondary text-ink-secondary"
              }`}>
                {run.status}
              </span>
              <span className="text-xs text-ink-tertiary">
                {new Date(run.startedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {run.candidatesFound != null && (
                <span className="text-xs text-ink-secondary">{run.candidatesFound} found</span>
              )}
              {run.candidatesScored != null && (
                <span className="text-xs text-ink-secondary">{run.candidatesScored} scored</span>
              )}
              {run.error && (
                <span className="text-xs text-[#ff3b30] truncate">{run.error}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-apple bg-[#fff2f0] text-sm text-[#ff3b30] mb-6">{error}</div>
      )}

      <div className="rounded-apple bg-surface border border-surface-tertiary p-8 text-center">
        {sourcingRuns && sourcingRuns.length > 0 ? (
          <>
            <p className="text-ink text-sm font-medium mb-2">
              {totalPipeline} candidate{totalPipeline !== 1 ? "s" : ""} in pipeline
            </p>
            <p className="text-ink-secondary text-sm mb-4">
              Sourced candidates are added directly to your pipeline.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/jobs/${params.id}/pipeline`)}
              className="py-2.5 px-5 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] transition-colors"
            >
              View Pipeline
            </button>
          </>
        ) : (
          <>
            <p className="text-ink-secondary text-sm mb-4">
              Click &quot;Source Candidates&quot; to find matching teachers from Naukri, Indeed, and LinkedIn.
            </p>
            <p className="text-ink-tertiary text-xs">
              During beta, this uses mock data. Real Apify integration is configured in convex/sourcing_actions.ts.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
