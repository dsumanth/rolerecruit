import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { requireProfile } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";
import { JobActions } from "@/components/jobs/job-actions";
import { JobParsedCriteria } from "@/components/jobs/job-parsed-criteria";
import { JobOverviewEditor } from "@/components/jobs/job-overview-editor";

interface Props {
  params: { id: string };
}

function jobBadge(status: string) {
  if (status === "active") return <Badge dot variant="success">Active</Badge>;
  if (status === "draft") return <Badge dot variant="neutral">Draft</Badge>;
  if (status === "paused") return <Badge dot variant="warning">On hold</Badge>;
  if (status === "filled") return <Badge dot variant="success">Filled</Badge>;
  return <Badge dot variant="neutral">Closed</Badge>;
}

export default async function JobDetailPage({ params }: Props) {
  await requireProfile();
  const job = await fetchQuery(api.jobs.get, { jobId: params.id as Id<"jobPostings"> });
  if (!job) notFound();
  const hiredCounts = await fetchQuery(api.jobs.hiredCountsForSchool, { schoolId: job.schoolId });
  const hired = hiredCounts[params.id] ?? 0;
  const positions = job.positions ?? 1;

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/jobs", label: "Jobs" }}
        title={job.title}
        subtitle={[job.subject, job.level, job.board].filter(Boolean).join(" · ")}
        status={jobBadge(job.status)}
        actions={<JobActions jobId={params.id} status={job.status} />}
      />

      <JobTabs jobId={params.id} active="overview" />

      <div className="grid grid-cols-[1fr_320px] gap-7 items-start mt-7">
        <main className="min-w-0 space-y-5">
          <JobOverviewEditor
            jobId={params.id}
            initialTitle={job.title ?? ""}
            initialSubject={job.subject ?? ""}
            initialLevel={job.level ?? "TGT"}
            initialBoard={job.board ?? "CBSE"}
            initialDescription={job.naturalLanguageDescription ?? ""}
            initialCriteria={job.criteria ?? job.naturalLanguageDescription ?? ""}
            initialPositions={positions}
          />
          <JobParsedCriteria criteria={job.parsedCriteria} />
        </main>
        <aside className="rounded-lg bg-surface-floating backdrop-blur-20 border border-chrome p-5 shadow-elev-1">
          <div className="text-micro text-ink-secondary mb-3">Quick facts</div>
          <dl className="space-y-3 text-body-s">
            <Fact label="Positions" value={`${hired} hired / ${positions} open`} />
            <Fact label="Subject" value={job.subject} />
            <Fact label="Level" value={job.level} />
            <Fact label="Board" value={job.board} />
            <Fact label="Experience" value={job.minExperience != null ? `${job.minExperience}+ years` : null} />
            <Fact label="Qualifications" value={job.qualifications?.join(" · ")} />
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-micro text-ink-secondary mb-0.5">{label}</dt>
      <dd className="text-ink">{value}</dd>
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
