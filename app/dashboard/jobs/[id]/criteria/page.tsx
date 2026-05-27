"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Badge, Card } from "@/components/ui";
import { AISuggestedCriteria } from "@/components/criteria/AISuggestedCriteria";
import { ScoringRuleEditor } from "@/components/criteria/ScoringRuleEditor";

function jobBadge(status: string) {
  if (status === "active") return <Badge dot variant="success">Active</Badge>;
  if (status === "draft") return <Badge dot variant="neutral">Draft</Badge>;
  if (status === "paused") return <Badge dot variant="warning">On hold</Badge>;
  if (status === "filled") return <Badge dot variant="success">Filled</Badge>;
  return <Badge dot variant="neutral">Closed</Badge>;
}

export default function CriteriaPage() {
  const { id } = useParams<{ id: string }>();
  const job = useQuery(api.jobs.get, { jobId: id as any });
  const saveRules = useMutation(api.jobs.saveScoringRules as any);
  const suggestCriteria = useAction(api.scoring.suggestCriteria);
  const [saving, setSaving] = useState(false);
  const [suggested, setSuggested] = useState<any>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const handleGenerateSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const result = await suggestCriteria({ jobId: id as any });
      if (result) setSuggested(result);
    } catch {
      setSuggested({
        dimensions: [
          { name: "qualifications", weight: 0.4, config: { required: job?.qualifications ?? [], preferred: [] } },
          { name: "experience", weight: 0.3, config: { minYears: job?.minExperience ?? 0, idealYears: (job?.minExperience ?? 0) + 5 } },
          { name: "subjectMatch", weight: 0.2, config: { subjects: [job?.subject ?? ""] } },
          { name: "certifications", weight: 0.1, config: { required: [] } },
        ],
        minimumScore: 60,
        autoRejectScore: 30,
      });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSave = async (dimensions: any[], minimumScore: number, autoRejectScore: number) => {
    setSaving(true);
    try {
      await saveRules({
        jobId: id as any,
        scoringRules: {
          dimensions,
          minimumScore,
          autoRejectScore,
          generatedBy: "manual",
          version: 1,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/jobs", label: "Jobs" }}
        title={job?.title ?? "Scoring criteria"}
        subtitle={job ? [job.subject, job.level, job.board].filter(Boolean).join(" · ") : undefined}
        status={job ? jobBadge(job.status) : undefined}
      />

      <JobTabs jobId={id} active="criteria" />

      <div className="mt-7 space-y-5">
        <AISuggestedCriteria
          suggested={suggested}
          loading={loadingSuggestions}
          onAccept={() => setLoadingSuggestions(false)}
          onGenerate={handleGenerateSuggestions}
        />

        <Card padding="md" elevation={1}>
          <h3 className="text-body-s font-semibold text-ink mb-4">Current rules</h3>
          <ScoringRuleEditor
            initialDimensions={suggested?.dimensions ?? []}
            onSave={handleSave}
            saving={saving}
          />
        </Card>
      </div>
    </div>
  );
}

function JobTabs({ jobId, active }: { jobId: string; active: "overview" | "pipeline" | "sourcing" | "criteria" }) {
  const tabs: Array<{ value: typeof active; label: string; href: string }> = [
    { value: "overview", label: "Overview", href: `/dashboard/jobs/${jobId}` },
    { value: "pipeline", label: "Pipeline", href: `/dashboard/jobs/${jobId}/pipeline` },
    { value: "sourcing", label: "Sourcing", href: `/dashboard/jobs/${jobId}/sourcing` },
    { value: "criteria", label: "Criteria", href: `/dashboard/jobs/${jobId}/criteria` },
  ];
  return (
    <div role="tablist" className="flex gap-1 border-b border-hairline">
      {tabs.map((t) => {
        const a = t.value === active;
        return (
          <Link
            key={t.value}
            href={t.href}
            role="tab"
            aria-selected={a}
            className={`relative px-3.5 py-2 text-body-s ${a ? "text-ink font-semibold" : "text-ink-secondary hover:text-ink"} transition-colors duration-fast`}
          >
            {t.label}
            {a && (
              <span
                aria-hidden
                className="absolute left-3.5 right-3.5 -bottom-px h-[2px] rounded-full bg-accent-grad"
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
