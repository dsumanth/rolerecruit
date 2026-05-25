"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
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
        <p className="text-body-s text-ink-secondary py-4 text-center">
          No criteria configured. Use AI suggestions to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {dimensions.map((d) => (
            <DimensionSlider key={d.name} {...d} onWeightChange={handleWeightChange} onRemove={handleRemove} />
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-body-s font-medium text-ink mb-1">Minimum score</label>
          <Input
            type="number"
            value={minimumScore}
            onChange={(e) => setMinimumScore(parseInt(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-body-s font-medium text-ink mb-1">Auto-reject below</label>
          <Input
            type="number"
            value={autoRejectScore}
            onChange={(e) => setAutoRejectScore(parseInt(e.target.value))}
          />
        </div>
      </div>
      <Button
        variant="primary"
        size="md"
        loading={saving}
        onClick={() => onSave(dimensions, minimumScore, autoRejectScore)}
      >
        Save Criteria
      </Button>
    </div>
  );
}
