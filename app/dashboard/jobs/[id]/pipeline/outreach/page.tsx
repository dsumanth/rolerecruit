import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { requireProfile } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";
import { OutreachHistory } from "@/components/outreach/outreach-history";
import { JobTabs } from "@/components/jobs/job-tabs";

interface Props {
  params: { id: string };
}

function jobBadge(status: string) {
  if (status === "active") return <Badge dot variant="success">Active</Badge>;
  if (status === "draft") return <Badge dot variant="neutral">Draft</Badge>;
  return <Badge dot variant="neutral">Closed</Badge>;
}

export default async function OutreachPage({ params }: Props) {
  await requireProfile();
  const job = await fetchQuery(api.jobs.get, { jobId: params.id as Id<"jobPostings"> });
  if (!job) notFound();

  return (
    <div>
      <PageHeader
        back={{ href: `/dashboard/jobs/${params.id}/pipeline`, label: "Pipeline" }}
        title="Outreach"
        subtitle={[job.title, job.subject, job.level].filter(Boolean).join(" · ")}
        status={jobBadge(job.status)}
      />

      <JobTabs jobId={params.id} active="pipeline" />

      <div className="mt-7">
        <OutreachHistory jobId={params.id} />
      </div>
    </div>
  );
}

