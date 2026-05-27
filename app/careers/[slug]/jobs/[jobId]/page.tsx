"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { ApplicationForm } from "@/components/careers/ApplicationForm";
import { Card, Badge, Icon } from "@/components/ui";
import Link from "next/link";

export default function JobDetailPage() {
  const { slug, jobId } = useParams<{ slug: string; jobId: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });
  const job = useQuery(api.careers.getJob, jobId ? { jobId: jobId as any } : "skip");

  if (school === undefined || job === undefined) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">Loading…</p></div>;
  }
  if (!school || !job) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">Not found</p></div>;
  }

  return (
    <div>
      <section className="max-w-5xl mx-auto px-6 pt-14 pb-6">
        <Link
          href={`/careers/${slug}`}
          className="inline-flex items-center gap-1 text-body-s text-accent hover:underline mb-6"
        >
          <Icon name="ChevronLeft" size={14} /> All positions
        </Link>
        <p className="text-micro text-ink-tertiary mb-2.5">
          {[job.subject, job.level, job.board].filter(Boolean).join(" · ")}
        </p>
        <h1 className="text-display-m text-ink tracking-tight">{job.title}</h1>
      </section>

      <div className="max-w-5xl mx-auto px-6 pb-20">

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 items-start">
          <main className="min-w-0">
            <Card padding="lg" elevation={1}>
              <div className="flex flex-wrap gap-2 mb-5">
                <Badge variant="info">{job.subject}</Badge>
                <Badge variant="neutral">{job.level}</Badge>
                <Badge variant="neutral">{job.board}</Badge>
              </div>
              {job.naturalLanguageDescription && (
                <p className="text-body-l text-ink leading-relaxed whitespace-pre-line">
                  {job.naturalLanguageDescription}
                </p>
              )}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 mt-8 pt-6 border-t border-hairline">
                {job.qualifications && job.qualifications.length > 0 && (
                  <Fact label="Qualifications" value={job.qualifications.join(", ")} wide />
                )}
                {job.minExperience != null && (
                  <Fact label="Experience" value={`${job.minExperience}+ years`} />
                )}
                {job.salaryRange && <Fact label="Salary" value={job.salaryRange} />}
              </dl>
            </Card>

            <section className="mt-10">
              <h2 className="text-title-l text-ink mb-4">Apply for this position</h2>
              <Card padding="lg" elevation={1}>
                <ApplicationForm schoolId={school._id} jobId={jobId} slug={slug} />
              </Card>
            </section>
          </main>

          <aside className="hidden lg:block lg:sticky lg:top-24">
            <div className="rounded-lg bg-surface-floating backdrop-blur-20 border border-chrome p-6 shadow-elev-2">
              <p className="text-micro text-ink-secondary uppercase tracking-[0.06em] mb-3">Apply now</p>
              <h3 className="text-title-m text-ink mb-3">{job.title}</h3>
              <p className="text-body-s text-ink-secondary mb-5">
                Submit your application in under 2 minutes.
              </p>
              <a
                href="#apply"
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector("form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="inline-flex items-center justify-center gap-1.5 w-full rounded-full bg-accent-grad text-white px-4 py-2.5 text-body-s font-medium hover:opacity-95 transition-opacity"
              >
                Start application
              </a>

              <dl className="mt-6 pt-5 border-t border-hairline space-y-3">
                <Fact label="Subject" value={job.subject} />
                <Fact label="Level" value={job.level} />
                <Fact label="Board" value={job.board} />
                {job.minExperience != null && (
                  <Fact label="Experience" value={`${job.minExperience}+ years`} />
                )}
                {job.salaryRange && <Fact label="Salary" value={job.salaryRange} />}
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-micro text-ink-secondary mb-0.5">{label}</dt>
      <dd className="text-body-s text-ink">{value}</dd>
    </div>
  );
}
