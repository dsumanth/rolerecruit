"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ApplicationTable } from "@/components/pipeline/application-table";
import { ApplicationDrawer } from "@/components/pipeline/application-drawer";

export default function PipelinePage({ params }: { params: { id: string } }) {
  const pipeline = useQuery(api.applications.getPipelineForJob, {
    jobId: params.id as any,
  });
  const moveStage = useMutation(api.applications.moveStage);
  const [selectedApp, setSelectedApp] = useState<any>(null);

  const allApps = pipeline ? Object.values(pipeline).flat() : [];

  if (!pipeline) {
    return (
      <div className="p-8 text-center text-sm text-ink-secondary">
        Loading pipeline...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Pipeline
        </h1>
        <Link
          href={`/dashboard/jobs/${params.id}/pipeline/outreach`}
          className="text-sm text-accent hover:text-[#0077ed]"
        >
          View Outreach History
        </Link>
      </div>

      <ApplicationTable
        applications={allApps}
        sortBy="newest"
        onSortChange={() => {}}
        onRowClick={setSelectedApp}
      />

      {selectedApp && (
        <ApplicationDrawer
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
        />
      )}
    </div>
  );
}
