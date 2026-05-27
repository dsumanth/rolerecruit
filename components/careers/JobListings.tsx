"use client";

import { useState } from "react";
import { JobCard } from "./JobCard";
import { Input, EmptyState } from "@/components/ui";

interface Job {
  _id: string;
  title: string;
  subject: string;
  level: string;
  qualifications: string[];
  minExperience?: number;
  maxExperience?: number;
  salaryRange?: string;
}

interface Props {
  jobs: Job[];
  slug: string;
}

export function JobListings({ jobs, slug }: Props) {
  const [search, setSearch] = useState("");

  const filtered = jobs.filter((job) =>
    !search ||
    job.title.toLowerCase().includes(search.toLowerCase()) ||
    job.subject.toLowerCase().includes(search.toLowerCase())
  );

  const countText = jobs.length === 1 ? "1 role" : `${jobs.length} roles`;
  const titleText =
    jobs.length === 0
      ? "No roles open right now."
      : jobs.length === 1
        ? "One role open right now."
        : `${jobs.length} roles open right now.`;

  return (
    <section
      id="open-positions"
      className="max-w-[1100px] mx-auto px-6 md:px-12 py-14 border-t border-hairline scroll-mt-20"
    >
      <div className="flex items-baseline justify-between gap-6 flex-wrap mb-8">
        <div>
          <p className="text-micro text-ink-tertiary mb-2.5">Open positions</p>
          <h2 className="text-display-m text-ink tracking-tight">{titleText}</h2>
        </div>
        {jobs.length > 0 && (
          <span className="text-body-s text-ink-tertiary tabular-nums">{countText}</span>
        )}
      </div>

      {jobs.length > 0 && (
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or subject…"
          iconLeft="Search"
          className="max-w-md mb-5"
        />
      )}

      {filtered.length === 0 ? (
        jobs.length === 0 ? (
          <EmptyState
            title="No open positions yet"
            description="Check back soon — new roles are posted regularly."
          />
        ) : (
          <p className="text-body-s text-ink-secondary py-8 text-center">
            No positions matching your search.
          </p>
        )
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((job) => (
            <JobCard key={job._id} jobId={job._id} slug={slug} {...job} />
          ))}
        </div>
      )}
    </section>
  );
}
