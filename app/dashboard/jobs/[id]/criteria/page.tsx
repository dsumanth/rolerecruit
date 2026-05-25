"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AISuggestedCriteria } from "@/components/criteria/AISuggestedCriteria";
import { ScoringRuleEditor } from "@/components/criteria/ScoringRuleEditor";

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
      // Fallback to local heuristic
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

  if (!job) return <div className="p-8 text-ink-secondary">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-ink mb-2">Scoring Criteria</h1>
      <p className="text-sm text-ink-secondary mb-6">{job.title} — {job.subject} {job.level}</p>

      <AISuggestedCriteria
        suggested={suggested}
        loading={loadingSuggestions}
        onAccept={() => setLoadingSuggestions(false)}
        onGenerate={handleGenerateSuggestions}
      />

      <div className="rounded-apple bg-surface border border-surface-tertiary p-5">
        <h3 className="text-sm font-semibold text-ink mb-4">Current Rules</h3>
        <ScoringRuleEditor
          initialDimensions={suggested?.dimensions ?? []}
          onSave={handleSave}
          saving={saving}
        />
      </div>
    </div>
  );
}
