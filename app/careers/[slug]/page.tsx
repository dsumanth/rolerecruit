"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { SchoolHeader } from "@/components/careers/SchoolHeader";
import { JobListings } from "@/components/careers/JobListings";
import Link from "next/link";

export default function CareersPage() {
  const { slug } = useParams<{ slug: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });
  const jobs = useQuery(api.careers.getOpenJobs, school ? { schoolId: school._id } : "skip");

  if (!school) return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-ink-secondary">School not found</p></div>;

  return (
    <div>
      <SchoolHeader name={school.name} board={school.board} city={school.city} />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-ink">Open Positions</h2>
        </div>
        <JobListings jobs={jobs ?? []} slug={slug} />
        <div className="mt-8 p-6 rounded-apple bg-surface border border-surface-tertiary text-center">
          <p className="text-ink font-medium mb-1">Don't see the right role?</p>
          <p className="text-sm text-ink-secondary mb-4">Submit a general application and we'll contact you when a matching position opens.</p>
          <Link
            href={`/careers/${slug}/apply`}
            className="inline-block py-2.5 px-5 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] transition-colors"
          >
            General Application
          </Link>
        </div>
      </div>
    </div>
  );
}
