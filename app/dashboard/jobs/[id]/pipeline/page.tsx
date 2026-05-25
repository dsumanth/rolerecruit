"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Badge, Button } from "@/components/ui";
import { ApplicationTable } from "@/components/pipeline/application-table";
import { ApplicationDrawer } from "@/components/pipeline/application-drawer";

function jobBadge(status: string) {
  if (status === "active") return <Badge dot variant="success">Active</Badge>;
  if (status === "draft") return <Badge dot variant="neutral">Draft</Badge>;
  return <Badge dot variant="neutral">Closed</Badge>;
}

export default function PipelinePage({ params }: { params: { id: string } }) {
  const job = useQuery(api.jobs.get, { jobId: params.id as any });
  const pipeline = useQuery(api.applications.getPipelineForJob, {
    jobId: params.id as any,
  });
  const moveStage = useMutation(api.applications.moveStage);
  const [selectedApp, setSelectedApp] = useState<any>(null);

  const allApps = pipeline ? Object.values(pipeline).flat() : [];

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/jobs", label: "Jobs" }}
        title={job?.title ?? "Pipeline"}
        subtitle={job ? [job.subject, job.level, job.board].filter(Boolean).join(" · ") : undefined}
        status={job ? jobBadge(job.status) : undefined}
        actions={
          <Link href={`/dashboard/jobs/${params.id}/pipeline/outreach`}>
            <Button variant="secondary" size="md" iconLeft="MessageSquare">
              Outreach history
            </Button>
          </Link>
        }
      />

      <JobTabs jobId={params.id} active="pipeline" />

      <div className="mt-7">
        {!pipeline ? (
          <div className="py-12 text-center text-body-s text-ink-secondary">
            Loading pipeline...
          </div>
        ) : (
          <ApplicationTable
            applications={allApps}
            sortBy="newest"
            onSortChange={() => {}}
            onRowClick={setSelectedApp}
          />
        )}
      </div>

      {selectedApp && (
        <ApplicationDrawer
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
        />
      )}
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
