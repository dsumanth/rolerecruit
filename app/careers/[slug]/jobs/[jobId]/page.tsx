"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { SchoolHeader } from "@/components/careers/SchoolHeader";
import { ApplicationForm } from "@/components/careers/ApplicationForm";
import Link from "next/link";

export default function JobDetailPage() {
  const { slug, jobId } = useParams<{ slug: string; jobId: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });
  const job = useQuery(api.careers.getJob, jobId ? { jobId: jobId as any } : "skip");

  if (!school) return <div className="max-w-4xl mx-auto px-6 py-20"><p className="text-ink-secondary">School not found</p></div>;
  if (!job) return <div className="max-w-4xl mx-auto px-6 py-20"><p className="text-ink-secondary">Loading...</p></div>;

  return (
    <div>
      <SchoolHeader name={school.name} board={school.board} city={school.city} />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href={`/careers/${slug}`} className="text-sm text-accent hover:underline mb-4 inline-block">← Back to all jobs</Link>
        <div className="rounded-apple bg-surface border border-surface-tertiary p-6 mb-8">
          <h1 className="text-xl font-bold text-ink">{job.title}</h1>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{job.subject}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-secondary text-ink-secondary">{job.level}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-secondary text-ink-secondary">{job.board}</span>
          </div>
          <div className="mt-4 text-sm text-ink space-y-2">
            <p><span className="font-medium">Qualifications:</span> {job.qualifications?.join(", ")}</p>
            {job.minExperience != null && <p><span className="font-medium">Min Experience:</span> {job.minExperience} years</p>}
            {job.salaryRange && <p><span className="font-medium">Salary:</span> {job.salaryRange}</p>}
          </div>
          {job.naturalLanguageDescription && (
            <div className="mt-4 text-sm text-ink-secondary leading-relaxed">
              <p>{job.naturalLanguageDescription}</p>
            </div>
          )}
        </div>

        <div className="rounded-apple bg-surface border border-surface-tertiary p-6">
          <h2 className="text-lg font-semibold text-ink mb-4">Apply for this position</h2>
          <ApplicationForm schoolId={school._id} jobId={jobId} slug={slug} />
        </div>
      </div>
    </div>
  );
}
