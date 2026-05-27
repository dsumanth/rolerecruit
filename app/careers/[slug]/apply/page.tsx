"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ApplicationForm } from "@/components/careers/ApplicationForm";
import { Card, Icon } from "@/components/ui";

export default function ApplyPage() {
  const { slug } = useParams<{ slug: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });

  if (school === undefined) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">Loading…</p></div>;
  }
  if (!school) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">School not found</p></div>;
  }

  return (
    <div>
      <section className="max-w-[640px] mx-auto px-6 pt-14 pb-8">
        <Link
          href={`/careers/${slug}`}
          className="inline-flex items-center gap-1 text-body-s text-accent hover:underline mb-6"
        >
          <Icon name="ChevronLeft" size={14} /> Back to {school.name}
        </Link>
        <p className="text-micro text-ink-tertiary mb-2.5">{school.name}</p>
        <h1 className="text-display-m text-ink tracking-tight mb-2">General application</h1>
        <p className="text-body-l text-ink-secondary leading-relaxed">
          Submit your application and we'll reach out when a matching position opens.
        </p>
      </section>
      <section className="max-w-[640px] mx-auto px-6 pb-20">
        <Card padding="lg" elevation={1}>
          <ApplicationForm schoolId={school._id} slug={slug} />
        </Card>
      </section>
    </div>
  );
}
