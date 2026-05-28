"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Badge, Card, Button } from "@/components/ui";
import { ScoringRuleEditor } from "@/components/criteria/ScoringRuleEditor";
import { CriteriaNaturalLanguageEditor } from "@/components/criteria/CriteriaNaturalLanguageEditor";

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
  const saveCriteriaText = useMutation(api.jobs.saveCriteriaText);
  const suggestCriteria = useAction(api.scoring.suggestCriteria);
  const [saving, setSaving] = useState(false);
  const [suggested, setSuggested] = useState<any>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const handleGenerateSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const result = await suggestCriteria({ jobId: id as any });
      if (result) setSuggested(result);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSave = async (dimensions: any[], minimumScore: number, autoRejectScore: number) => {
    setSaving(true);
    try {
      await saveRules({
        jobId: id as any,
        scoringRules: { dimensions, minimumScore, autoRejectScore, generatedBy: "manual", version: 1 },
      });
    } finally {
      setSaving(false);
    }
  };

  if (!job) return null;

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/jobs", label: "Jobs" }}
        title={job.title ?? "Scoring criteria"}
        subtitle={[job.subject, job.level, job.board].filter(Boolean).join(" · ")}
        status={jobBadge(job.status)}
        actions={
          <Button
            variant="secondary"
            size="md"
            iconLeft="Sparkles"
            onClick={handleGenerateSuggestions}
            loading={loadingSuggestions}
          >
            {loadingSuggestions ? "Generating…" : "Generate with AI"}
          </Button>
        }
      />

      <JobTabs jobId={id} active="criteria" />

      <div className="mt-7 space-y-5">
        <Card padding="md" elevation={1}>
          <h3 className="text-body-s font-semibold text-ink mb-3">Criteria (natural language)</h3>
          <CriteriaNaturalLanguageEditor
            initialValue={(job as any).criteria ?? ""}
            onSave={(text) => { saveCriteriaText({ jobId: id as any, text }); }}
          />
        </Card>

        <Card padding="md" elevation={1}>
          <h3 className="text-body-s font-semibold text-ink mb-4">Scoring rules</h3>
          <ScoringRuleEditor
            initialDimensions={suggested?.dimensions ?? (job as any).scoringRules?.dimensions ?? []}
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
