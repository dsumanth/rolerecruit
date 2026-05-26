"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { MarketingHero } from "@/components/careers/MarketingHero";
import { JobListings } from "@/components/careers/JobListings";

export default function JobsListingPage() {
  const { slug } = useParams<{ slug: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });
  const jobs = useQuery(api.careers.getOpenJobs, school ? { schoolId: school._id } : "skip");

  if (!school) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">Loading...</p></div>;
  }

  return (
    <div>
      <MarketingHero
        size="compact"
        eyebrow={school.name}
        title="Open positions"
        body="Browse all current openings. New roles are posted regularly."
      />
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <JobListings jobs={jobs ?? []} slug={slug} />
      </section>
    </div>
  );
}
