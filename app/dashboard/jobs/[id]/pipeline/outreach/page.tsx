import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { requireProfile } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";
import { OutreachHistory } from "@/components/outreach/outreach-history";

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
