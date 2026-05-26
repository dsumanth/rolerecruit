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
    <div className="space-y-5">
      <Input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by title or subject..."
        iconLeft="Search"
        className="max-w-md"
      />
      {filtered.length === 0 ? (
        jobs.length === 0 ? (
          <EmptyState
            title="No open positions yet"
            description="Check back soon — new roles are posted regularly."
          />
        ) : (
          <p className="text-body-s text-ink-secondary py-8 text-center">No positions matching your search.</p>
        )
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((job) => (
            <JobCard key={job._id} jobId={job._id} slug={slug} {...job} />
          ))}
        </div>
      )}
    </div>
  );
}
