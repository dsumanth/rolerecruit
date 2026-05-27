"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MarketingHero } from "@/components/careers/MarketingHero";
import { JobListings } from "@/components/careers/JobListings";
import { SchoolAbout } from "@/components/careers/SchoolAbout";
import { SchoolPerks } from "@/components/careers/SchoolPerks";
import { MarketingFooterCTA } from "@/components/careers/MarketingFooterCTA";
import { Button } from "@/components/ui";

function computeHeroSubtitle(
  board: string,
  city: string,
  foundedYear?: number,
  studentCount?: number,
): string {
  const age = foundedYear ? new Date().getFullYear() - foundedYear : null;
  const lead = age ? `A ${age}-year-old ${board} institution` : `A ${board} institution`;
  const tail = studentCount
    ? ` with ${studentCount.toLocaleString("en-IN")} students.`
    : ` in ${city}.`;
  return lead + tail;
}

function buildHeroStats(
  studentCount?: number,
  facultyCount?: number,
  foundedYear?: number,
) {
  const stats: { value: string; label?: string }[] = [];
  if (studentCount) {
    stats.push({ value: studentCount.toLocaleString("en-IN"), label: "students" });
  }
  if (facultyCount) {
    stats.push({ value: String(facultyCount), label: "faculty" });
  }
  if (foundedYear) {
    stats.push({ value: `est. ${foundedYear}` });
  }
  return stats;
}

export default function CareersPage() {
  const { slug } = useParams<{ slug: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });
  const jobs = useQuery(
    api.careers.getOpenJobs,
    school ? { schoolId: school._id } : "skip",
  );

  if (school === undefined) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-body-s text-ink-secondary">Loading…</p>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-body-s text-ink-secondary">School not found</p>
      </div>
    );
  }

  const hasOpenJobs = (jobs?.length ?? 0) > 0;
  const eyebrow = `${hasOpenJobs ? "Now hiring · " : ""}${school.board} · ${school.city}`;
  const heroTitle = school.tagline || `Teach at ${school.name}.`;
  const heroSubtitle = computeHeroSubtitle(
    school.board,
    school.city,
    school.foundedYear,
    school.studentCount,
  );
  const heroStats = buildHeroStats(
    school.studentCount,
    school.facultyCount,
    school.foundedYear,
  );
  const applyHref = `/careers/${slug}/apply`;

  return (
    <div>
      <MarketingHero
        eyebrow={eyebrow}
        title={heroTitle}
        tagline={heroSubtitle}
        heroImageUrl={school.heroImageUrl}
        schoolName={school.name}
        stats={heroStats}
        cta={
          <Link href={applyHref}>
            <Button variant="gradient" size="lg" iconRight="ArrowRight">
              Submit a general application
            </Button>
          </Link>
        }
      />

      <JobListings jobs={jobs ?? []} slug={slug} />

      {school.about && <SchoolAbout about={school.about} />}

      {school.perks && school.perks.length > 0 && (
        <SchoolPerks perks={school.perks} />
      )}

      <MarketingFooterCTA href={applyHref} />
    </div>
  );
}
