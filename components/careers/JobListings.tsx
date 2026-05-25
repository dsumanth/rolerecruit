"use client";

import { useState } from "react";
import { JobCard } from "./JobCard";

interface Job {
  _id: string;
  title: string;
  subject: string;
  level: string;
  qualifications: string[];
  minExperience?: number;
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

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by title or subject..."
        className="w-full max-w-md px-4 py-2.5 rounded-apple bg-surface border border-hairline text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      {filtered.length === 0 ? (
        <p className="text-ink-secondary text-sm py-8 text-center">No open positions {search ? "matching your search" : "at this time"}.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((job) => (
            <JobCard key={job._id} jobId={job._id} slug={slug} {...job} />
          ))}
        </div>
      )}
    </div>
  );
}
