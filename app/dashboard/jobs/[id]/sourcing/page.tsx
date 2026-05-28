"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useAction, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Badge, Button, Card } from "@/components/ui";

type RunStatus = "running" | "completed" | "failed" | string;

interface SourcingRun {
  _id: string;
  status: RunStatus;
  startedAt: number;
  candidatesFound?: number;
  candidatesScored?: number;
  error?: string;
}

function jobBadge(status: string) {
  if (status === "active") return <Badge dot variant="success">Active</Badge>;
  if (status === "draft") return <Badge dot variant="neutral">Draft</Badge>;
  return <Badge dot variant="neutral">Closed</Badge>;
}

function runBadge(status: RunStatus) {
  if (status === "running") return <Badge variant="info">Running</Badge>;
  if (status === "completed") return <Badge variant="success">Completed</Badge>;
  if (status === "failed") return <Badge variant="danger">Failed</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

export default function SourcingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const job = useQuery(api.jobs.get, { jobId: params.id as any });
  const sourcingRuns = useQuery(api.sourcing.getRunsForJob, { jobId: params.id as any });
  const { results: pipelineResults } = usePaginatedQuery(
    api.applications.getPipelineForJob,
    { jobId: params.id as any },
    { initialNumItems: 100 },
  );
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

  const totalPipeline = pipelineResults.length;

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/jobs", label: "Jobs" }}
        title={job?.title ?? "Sourcing"}
        subtitle={job ? [job.subject, job.level, job.board].filter(Boolean).join(" · ") : undefined}
        status={job ? jobBadge(job.status) : undefined}
        actions={
          <Button
            variant="primary"
            size="md"
            iconLeft="Sparkles"
            loading={running}
            onClick={handleRunSourcing}
          >
            Source Candidates
          </Button>
        }
      />

      <JobTabs jobId={params.id} active="sourcing" />

      <div className="mt-7 space-y-5">
        {error && (
          <Card padding="md" elevation={1}>
            <p className="text-body-s text-danger">{error}</p>
          </Card>
        )}

        {sourcingRuns && sourcingRuns.length > 0 && (
          <div>
            <div className="text-micro text-ink-secondary uppercase tracking-wider mb-3">
              Sourcing history
            </div>
            <div className="space-y-2">
              {(sourcingRuns as SourcingRun[]).map((run) => (
                <Card key={run._id} padding="md" elevation={1} interactive>
                  <div className="flex flex-wrap items-center gap-3">
                    {runBadge(run.status)}
                    <span className="text-caption text-ink-secondary">
                      {new Date(run.startedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {run.candidatesFound != null && (
                      <span className="text-caption text-ink-secondary">
                        {run.candidatesFound} found
                      </span>
                    )}
                    {run.candidatesScored != null && (
                      <span className="text-caption text-ink-secondary">
                        {run.candidatesScored} scored
                      </span>
                    )}
                    {run.error && (
                      <span className="text-caption text-danger truncate">{run.error}</span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Card padding="lg" elevation={1}>
          <div className="text-center">
            {sourcingRuns && sourcingRuns.length > 0 ? (
              <>
                <p className="text-body text-ink font-medium mb-2">
                  {totalPipeline} candidate{totalPipeline !== 1 ? "s" : ""} in pipeline
                </p>
                <p className="text-body-s text-ink-secondary mb-4">
                  Sourced candidates are added directly to your pipeline.
                </p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => router.push(`/dashboard/jobs/${params.id}/pipeline`)}
                >
                  View Pipeline
                </Button>
              </>
            ) : (
              <>
                <p className="text-body-s text-ink-secondary mb-2">
                  Click &quot;Source Candidates&quot; to find matching teachers from Naukri, Indeed, and LinkedIn.
                </p>
                <p className="text-caption text-ink-tertiary">
                  During beta, this uses mock data. Real Apify integration is configured in convex/sourcing_actions.ts.
                </p>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function JobTabs({ jobId, active }: { jobId: string; active: "overview" | "pipeline" | "sourcing" | "criteria" }) {
  const tabs: Array<{ value: typeof active; label: string; href: string }> = [
    { value: "overview", label: "Overview", href: `/dashboard/jobs/${jobId}` },
    { value: "pipeline", label: "Pipeline", href: `/dashboard/jobs/${jobId}/pipeline` },
    { value: "sourcing", label: "Sourcing", href: `/dashboard/jobs/${jobId}/sourcing` },
    { value: "criteria", label: "Criteria", href: `/dashboard/jobs/${jobId}/criteria` },
  ];
  return (
    <div role="tablist" className="flex gap-1 border-b border-hairline">
      {tabs.map((t) => {
        const a = t.value === active;
        return (
          <Link
            key={t.value}
            href={t.href}
            role="tab"
            aria-selected={a}
            className={`relative px-3.5 py-2 text-body-s ${a ? "text-ink font-semibold" : "text-ink-secondary hover:text-ink"} transition-colors duration-fast`}
          >
            {t.label}
            {a && (
              <span
                aria-hidden
                className="absolute left-3.5 right-3.5 -bottom-px h-[2px] rounded-full bg-accent-grad"
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
