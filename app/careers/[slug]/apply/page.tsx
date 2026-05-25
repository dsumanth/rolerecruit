"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { SchoolHeader } from "@/components/careers/SchoolHeader";
import { ApplicationForm } from "@/components/careers/ApplicationForm";
import Link from "next/link";

export default function ApplyPage() {
  const { slug } = useParams<{ slug: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });

  if (!school) return <div className="max-w-4xl mx-auto px-6 py-20"><p className="text-ink-secondary">School not found</p></div>;

  return (
    <div>
      <SchoolHeader name={school.name} board={school.board} city={school.city} />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href={`/careers/${slug}`} className="text-sm text-accent hover:underline mb-4 inline-block">← Back to jobs</Link>
        <div className="rounded-apple bg-surface border border-hairline p-6">
          <h2 className="text-lg font-semibold text-ink mb-2">General Application</h2>
          <p className="text-sm text-ink-secondary mb-6">Submit your profile and we'll match you with future openings at {school.name}.</p>
          <ApplicationForm schoolId={school._id} slug={slug} />
        </div>
      </div>
    </div>
  );
}
