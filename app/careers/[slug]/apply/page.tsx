"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { ApplicationForm } from "@/components/careers/ApplicationForm";
import { MarketingHero } from "@/components/careers/MarketingHero";
import { Card } from "@/components/ui";

export default function ApplyPage() {
  const { slug } = useParams<{ slug: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });

  if (school === undefined) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">Loading...</p></div>;
  }
  if (!school) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-body-s text-ink-secondary">School not found</p></div>;
  }

  return (
    <div>
      <MarketingHero
        size="compact"
        eyebrow={school.name}
        title="General application"
        body="Submit your application and we'll reach out when a matching position opens."
      />
      <section className="max-w-[640px] mx-auto px-6 pb-20">
        <Card padding="lg" elevation={1}>
          <ApplicationForm schoolId={school._id} slug={slug} />
        </Card>
      </section>
    </div>
  );
}
