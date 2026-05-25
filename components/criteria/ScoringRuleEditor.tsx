"use client";

import { useState } from "react";
import { DimensionSlider } from "./DimensionSlider";

interface Dimension {
  name: string;
  weight: number;
  config: Record<string, any>;
}

interface Props {
  initialDimensions?: Dimension[];
  onSave: (dimensions: Dimension[], minimumScore: number, autoRejectScore: number) => void;
  saving: boolean;
}

export function ScoringRuleEditor({ initialDimensions = [], onSave, saving }: Props) {
  const [dimensions, setDimensions] = useState<Dimension[]>(initialDimensions);
  const [minimumScore, setMinimumScore] = useState(60);
  const [autoRejectScore, setAutoRejectScore] = useState(30);

  const handleWeightChange = (name: string, newWeight: number) => {
    setDimensions((prev) =>
      prev.map((d) => (d.name === name ? { ...d, weight: newWeight } : d))
    );
  };

  const handleRemove = (name: string) => {
    setDimensions((prev) => prev.filter((d) => d.name !== name));
  };

  return (
    <div className="space-y-4">
      {dimensions.length === 0 ? (
        <p className="text-sm text-ink-secondary py-4 text-center">No criteria configured. Use AI suggestions to get started.</p>
      ) : (
        dimensions.map((d) => (
          <DimensionSlider key={d.name} {...d} onWeightChange={handleWeightChange} onRemove={handleRemove} />
        ))
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Minimum Score</label>
          <input type="number" value={minimumScore} onChange={(e) => setMinimumScore(parseInt(e.target.value))} className="w-full px-4 py-2 rounded-apple bg-surface border border-surface-tertiary text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Auto-Reject Below</label>
          <input type="number" value={autoRejectScore} onChange={(e) => setAutoRejectScore(parseInt(e.target.value))} className="w-full px-4 py-2 rounded-apple bg-surface border border-surface-tertiary text-sm" />
        </div>
      </div>
      <button type="button" onClick={() => onSave(dimensions, minimumScore, autoRejectScore)} disabled={saving} className="py-2.5 px-5 rounded-apple bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50">
        {saving ? "Saving..." : "Save Criteria"}
      </button>
    </div>
  );
}
