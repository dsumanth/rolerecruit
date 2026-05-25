"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge, Button, Card } from "@/components/ui";

interface GlobalCriteriaPanelProps {
  schoolId: string;
  onClose: () => void;
}

interface DimensionInput {
  name: string;
  weight: number;
}

export function GlobalCriteriaPanel({ schoolId, onClose }: GlobalCriteriaPanelProps) {
  const existing = useQuery(api.globalCriteria.get, { schoolId: schoolId as any });
  const saveCriteria = useMutation(api.globalCriteria.save);
  const suggestCriteria = useAction(api.globalCriteria.suggest);
  const scoreAll = useAction(api.globalCriteria.scoreAllCandidates);

  const [mode, setMode] = useState<"view" | "edit" | "suggest">(
    existing ? "view" : "edit"
  );
  const [minimumScore, setMinimumScore] = useState(existing?.scoringRules.minimumScore ?? 60);
  const [autoRejectScore, setAutoRejectScore] = useState(existing?.scoringRules.autoRejectScore ?? 30);
  const [dimensions, setDimensions] = useState<DimensionInput[]>(
    existing?.scoringRules.dimensions.map((d: any) => ({
      name: d.name,
      weight: d.weight,
    })) ?? []
  );
  const [loading, setLoading] = useState(false);
  const [scoring, setScoring] = useState(false);

  const handleSuggest = async () => {
    setLoading(true);
    try {
      const result = await suggestCriteria({ schoolId: schoolId as any });
      setDimensions(result.dimensions.map((d: any) => ({ name: d.name, weight: d.weight })));
      setMinimumScore(result.minimumScore);
      setAutoRejectScore(result.autoRejectScore);
      setMode("suggest");
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (dimensions.length === 0) return;
    const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
    const normalizedDimensions = dimensions.map((d) => ({
      name: d.name,
      weight: d.weight / totalWeight,
      config: getDefaultConfig(d.name),
    }));

    await saveCriteria({
      schoolId: schoolId as any,
      scoringRules: {
        dimensions: normalizedDimensions,
        minimumScore,
        autoRejectScore,
        generatedBy: mode === "suggest" ? "agent_reviewed" : "manual",
        version: existing?.scoringRules.version ?? 0,
      },
    });
    setMode("view");
  };

  const handleScoreAll = async () => {
    setScoring(true);
    try {
      await scoreAll({ schoolId: schoolId as any });
    } catch {
      // ignore
    } finally {
      setScoring(false);
    }
  };

  const addDimension = () => {
    setDimensions([...dimensions, { name: "", weight: 0.2 }]);
  };

  const updateDimension = (index: number, field: keyof DimensionInput, value: any) => {
    const updated = [...dimensions];
    updated[index] = { ...updated[index], [field]: value };
    setDimensions(updated);
  };

  const removeDimension = (index: number) => {
    setDimensions(dimensions.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      <Card surface="floating" elevation={4} padding="lg" className="relative max-w-lg w-full mx-4 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-title-m text-ink">Global Scoring Criteria</h3>
          <button
            onClick={onClose}
            className="text-ink-tertiary hover:text-ink transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {mode === "view" && existing ? (
          <div className="space-y-4">
            <p className="text-body-s text-ink-secondary">
              Scoring criteria used to evaluate all candidates in the talent bank.
            </p>
            <div className="space-y-2">
              {existing.scoringRules.dimensions.map((dim: any) => (
                <div key={dim.name} className="flex items-center justify-between px-3 py-2 rounded-sm bg-surface-canvas">
                  <span className="text-body-s text-ink">{dim.name}</span>
                  <Badge variant="neutral">
                    {Math.round(dim.weight * 100)}%
                  </Badge>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 text-caption text-ink-secondary">
              <span>Min Score: <span className="text-ink font-medium">{existing.scoringRules.minimumScore}</span></span>
              <span>Auto-Reject: <span className="text-ink font-medium">{existing.scoringRules.autoRejectScore}</span></span>
              <Badge variant={existing.scoringRules.generatedBy === "agent" ? "info" : "neutral"}>
                v{existing.scoringRules.version}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => {
                setDimensions(existing.scoringRules.dimensions.map((d: any) => ({
                  name: d.name,
                  weight: d.weight,
                })));
                setMinimumScore(existing.scoringRules.minimumScore);
                setAutoRejectScore(existing.scoringRules.autoRejectScore);
                setMode("edit");
              }}>
                Edit
              </Button>
              <Button size="sm" variant="primary" onClick={handleScoreAll} loading={scoring}>
                Score All Candidates
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-body-s text-ink-secondary">
              Define scoring dimensions and weights to evaluate every candidate in your talent bank.
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-caption font-medium text-ink-secondary">Dimensions</span>
                <Button size="sm" variant="secondary" onClick={handleSuggest} loading={loading}>
                  Suggest with AI
                </Button>
              </div>

              {dimensions.map((dim, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={dim.name}
                    onChange={(e) => updateDimension(i, "name", e.target.value)}
                    placeholder="Dimension name"
                    className="flex-1 text-body-s px-3 py-1.5 rounded-sm bg-surface border border-hairline-strong text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                  <input
                    type="number"
                    value={Math.round(dim.weight * 100)}
                    onChange={(e) => updateDimension(i, "weight", Number(e.target.value) / 100)}
                    min={0}
                    max={100}
                    className="w-16 text-body-s px-2 py-1.5 rounded-sm bg-surface border border-hairline-strong text-ink text-center focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                  <span className="text-caption text-ink-secondary">%</span>
                  <button
                    onClick={() => removeDimension(i)}
                    className="text-ink-tertiary hover:text-danger transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              <Button size="sm" variant="ghost" onClick={addDimension}>
                + Add Dimension
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-caption text-ink-secondary block mb-1">Minimum Score</label>
                <input
                  type="number"
                  value={minimumScore}
                  onChange={(e) => setMinimumScore(Number(e.target.value))}
                  min={0}
                  max={100}
                  className="w-full text-body-s px-3 py-1.5 rounded-sm bg-surface border border-hairline-strong text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
              <div>
                <label className="text-caption text-ink-secondary block mb-1">Auto-Reject Score</label>
                <input
                  type="number"
                  value={autoRejectScore}
                  onChange={(e) => setAutoRejectScore(Number(e.target.value))}
                  min={0}
                  max={100}
                  className="w-full text-body-s px-3 py-1.5 rounded-sm bg-surface border border-hairline-strong text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="primary"
                onClick={handleSave}
                disabled={dimensions.length === 0 || dimensions.some((d) => !d.name.trim())}
              >
                Save Criteria
              </Button>
              {existing && (
                <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function getDefaultConfig(name: string): any {
  switch (name) {
    case "qualifications":
      return { required: [], preferred: [] };
    case "experience":
      return { minYears: 0, idealYears: 5 };
    case "certifications":
      return { required: [] };
    case "subjectMatch":
      return { subjects: [] };
    case "location":
      return { preferLocal: true };
    default:
      return {};
  }
}
