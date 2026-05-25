"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { JobActions } from "@/components/jobs/job-actions";
import { JobParsedCriteria } from "@/components/jobs/job-parsed-criteria";
import { SuggestedMatches } from "@/components/dashboard/SuggestedMatches";
import { OutreachHistory } from "@/components/outreach/outreach-history";
import { useState } from "react";

const TABS = ["details", "pipeline", "sourcing", "outreach", "criteria", "matches"] as const;

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const job = useQuery(api.jobs.get, { jobId: id as any });
  const [tab, setTab] = useState<string>("details");

  if (!job) {
    return (
      <div>
        <Link href="/dashboard/jobs" className="text-sm text-accent hover:text-[#0077ed] mb-4 inline-block">
          ← Back to Jobs
        </Link>
        <div className="rounded-apple bg-surface border border-surface-tertiary p-8 text-center">
          <p className="text-sm text-ink-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/jobs" className="text-sm text-accent hover:text-[#0077ed] mb-4 inline-block">
        ← Back to Jobs
      </Link>

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{job.title}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full ${
            job.status === "active"
              ? "bg-[#e8f5e9] text-[#34c759]"
              : job.status === "draft"
              ? "bg-surface-secondary text-ink-secondary"
              : "bg-[#fff2f0] text-[#ff3b30]"
          }`}>
            {job.status}
          </span>
        </div>
        <p className="text-sm text-ink-secondary mt-1">{job.subject} · {job.level} · {job.board}</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-0.5 mb-6 border-b border-surface-tertiary">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-[#0071e3] text-accent"
                : "border-transparent text-ink-secondary hover:text-ink"
            }`}
          >
            {t === "details" ? "Details" :
             t === "pipeline" ? "Pipeline" :
             t === "sourcing" ? "Sourcing" :
             t === "outreach" ? "Outreach" :
             t === "criteria" ? "Scoring" :
             "Matches"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "details" && (
        <div className="space-y-6">
          <div className="rounded-apple bg-surface border border-surface-tertiary p-5">
            <h2 className="text-sm font-semibold text-ink mb-3">Job Description</h2>
            <p className="text-sm text-ink whitespace-pre-wrap">{job.naturalLanguageDescription}</p>
          </div>
          <div className="rounded-apple bg-surface border border-surface-tertiary p-5">
            <h2 className="text-sm font-semibold text-ink mb-3">Structured Criteria</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-ink-tertiary mb-0.5">Subject</p><p className="text-sm text-ink">{job.subject}</p></div>
              <div><p className="text-xs text-ink-tertiary mb-0.5">Level</p><p className="text-sm text-ink">{job.level}</p></div>
              <div><p className="text-xs text-ink-tertiary mb-0.5">Board</p><p className="text-sm text-ink">{job.board}</p></div>
              <div><p className="text-xs text-ink-tertiary mb-0.5">Qualifications</p><p className="text-sm text-ink">{job.qualifications.join(", ")}</p></div>
            </div>
          </div>
          {job.parsedCriteria && <JobParsedCriteria criteria={job.parsedCriteria} />}
          <JobActions jobId={id} status={job.status} />
        </div>
      )}

      {tab === "pipeline" && (
        <div className="rounded-apple bg-surface border border-surface-tertiary p-5">
          <p className="text-sm text-ink-secondary mb-4">Pipeline management for this position.</p>
          <Link
            href={`/dashboard/jobs/${id}/pipeline`}
            className="py-2.5 px-5 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] transition-colors inline-block"
          >
            Open Pipeline Board
          </Link>
        </div>
      )}

      {tab === "sourcing" && (
        <div className="rounded-apple bg-surface border border-surface-tertiary p-5">
          <p className="text-sm text-ink-secondary mb-4">Source candidates from job boards and talent banks.</p>
          <Link
            href={`/dashboard/jobs/${id}/sourcing`}
            className="py-2.5 px-5 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] transition-colors inline-block"
          >
            Open Sourcing
          </Link>
        </div>
      )}

      {tab === "outreach" && (
        <OutreachHistory jobId={id} />
      )}

      {tab === "criteria" && (
        <div className="rounded-apple bg-surface border border-surface-tertiary p-5">
          <p className="text-sm text-ink-secondary mb-4">Configure AI-powered scoring criteria for candidate matching.</p>
          <Link
            href={`/dashboard/jobs/${id}/criteria`}
            className="py-2.5 px-5 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] transition-colors inline-block"
          >
            Open Criteria Editor
          </Link>
        </div>
      )}

      {tab === "matches" && (
        <SuggestedMatches jobId={id} schoolId={job.schoolId} />
      )}
    </div>
  );
}
