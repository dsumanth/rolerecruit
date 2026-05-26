"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { MarketingHero } from "@/components/careers/MarketingHero";
import { JobListings } from "@/components/careers/JobListings";
import { Card, Button } from "@/components/ui";
import Link from "next/link";

export default function CareersPage() {
  const { slug } = useParams<{ slug: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });
  const jobs = useQuery(api.careers.getOpenJobs, school ? { schoolId: school._id } : "skip");

  if (school === undefined) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">Loading...</p></div>;
  }

  if (!school) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">School not found</p></div>;
  }

  return (
    <div>
      <MarketingHero
        eyebrow={`${school.board} · ${school.city}`}
        title={`Teach at ${school.name}`}
        body="Join a school that invests in great teachers. Browse open roles below or submit a general application."
        cta={
          <Link href={`/careers/${slug}/apply`}>
            <Button variant="gradient" size="lg" iconRight="ArrowRight">Submit a general application</Button>
          </Link>
        }
      />

      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-title-l text-ink">Open positions</h2>
          {jobs && jobs.length > 0 && (
            <span className="text-body-s text-ink-secondary tabular-nums">{jobs.length} {jobs.length === 1 ? "role" : "roles"}</span>
          )}
        </div>
        <JobListings jobs={jobs ?? []} slug={slug} />

        <Card padding="lg" elevation={1} className="mt-10 text-center">
          <h3 className="text-title-m text-ink">Don't see the right role?</h3>
          <p className="text-body-s text-ink-secondary mt-1 mb-5 max-w-md mx-auto">
            Submit a general application and we'll contact you when a matching position opens.
          </p>
          <Link href={`/careers/${slug}/apply`} className="inline-block">
            <Button variant="ink" iconRight="ArrowRight">General application</Button>
          </Link>
        </Card>
      </section>
    </div>
  );
}
