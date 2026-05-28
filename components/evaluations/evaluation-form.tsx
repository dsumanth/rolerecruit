"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

type FieldType = "score_1_5" | "score_1_10" | "text" | "choice";

type Field = {
  key: string;
  label: string;
  type: FieldType;
  choices?: string[];
  weight?: number;
  allowDictation?: boolean;
  required?: boolean;
};

type Template = {
  _id: string;
  name: string;
  role: "principal" | "hod" | "hr_admin" | "teacher";
  fields: Field[];
};

type VoiceInput = {
  fieldKey: string;
  transcript: string;
  summaryPoints: string[];
  language: string;
  durationSec: number;
  processedAt: number;
};

type Recommendation = "hire" | "maybe" | "reject";

const RECOMMENDATIONS: Array<{ value: Recommendation; label: string }> = [
  { value: "hire", label: "Hire" },
  { value: "maybe", label: "Maybe" },
  { value: "reject", label: "Reject" },
];

function ScoreRow({
  fieldKey,
  label,
  max,
  value,
  onSelect,
}: {
  fieldKey: string;
  label: string;
  max: 5 | 10;
  value: number | undefined;
  onSelect: (n: number) => void;
}) {
  const values = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <div className={cn("flex flex-wrap gap-2", max === 10 && "gap-1.5")}>
      {values.map((n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            id={n === 1 ? fieldKey : undefined}
            aria-label={`Score ${n} for ${label.toLowerCase()}`}
            aria-pressed={selected}
            onClick={() => onSelect(n)}
            className={cn(
              "inline-flex items-center justify-center rounded-full font-medium transition-all duration-fast ease-apple-out border",
              max === 5 ? "min-w-10 h-10 px-3 text-body-s" : "min-w-9 h-9 px-2.5 text-caption",
              selected
                ? "bg-accent text-white border-accent"
                : "bg-surface text-ink border-hairline-strong hover:border-accent hover:text-accent",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function ChoiceRow({
  fieldKey,
  label,
  choices,
  value,
  onSelect,
}: {
  fieldKey: string;
  label: string;
  choices: string[];
  value: string | undefined;
  onSelect: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" id={fieldKey}>
      {choices.map((c) => {
        const selected = value === c;
        return (
          <button
            key={c}
            type="button"
            aria-label={`${c} for ${label.toLowerCase()}`}
            aria-pressed={selected}
            onClick={() => onSelect(c)}
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1.5 text-caption font-medium transition-all duration-fast ease-apple-out border",
              selected
                ? "bg-accent-soft text-accent border-accent"
                : "bg-surface text-ink-secondary border-hairline hover:text-ink hover:border-hairline-strong",
            )}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

export function EvaluationForm({
  template,
  initialResponses,
  initialVoiceInputs,
  onDictate,
  onSubmit,
}: {
  template: Template;
  initialResponses?: Record<string, number | string>;
  initialVoiceInputs?: VoiceInput[];
  onDictate?: (fieldKey: string) => Promise<VoiceInput | null>;
  onSubmit: (data: {
    responses: Record<string, number | string>;
    recommendation: Recommendation | undefined;
    voiceInputs: VoiceInput[];
  }) => void;
}) {
  const [responses, setResponses] = useState<Record<string, number | string>>(initialResponses ?? {});
  const [voiceInputs, setVoiceInputs] = useState<VoiceInput[]>(initialVoiceInputs ?? []);
  const [recommendation, setRecommendation] = useState<Recommendation | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const setValue = (key: string, value: number | string) => {
    setResponses((prev) => ({ ...prev, [key]: value }));
  };

  const handleDictate = async (fieldKey: string) => {
    if (!onDictate) return;
    const result = await onDictate(fieldKey);
    if (!result) return;
    setVoiceInputs((prev) => [...prev.filter((v) => v.fieldKey !== fieldKey), result]);
    setValue(fieldKey, result.summaryPoints.map((b) => `• ${b}`).join("\n"));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of template.fields) {
      if (f.required && (responses[f.key] === undefined || responses[f.key] === "")) {
        setError(`${f.label} is required`);
        return;
      }
    }
    if (!recommendation) {
      setError("Please pick a recommendation");
      return;
    }
    setError(null);
    onSubmit({ responses, recommendation, voiceInputs });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {template.fields.map((f) => (
        <div key={f.key} className="space-y-2">
          <label
            htmlFor={f.type === "text" ? f.key : undefined}
            className="block text-body-s font-semibold text-ink"
          >
            {f.label}
            {f.required && <span className="text-ink-tertiary font-normal"> *</span>}
          </label>

          {f.type === "score_1_5" && (
            <ScoreRow
              fieldKey={f.key}
              label={f.label}
              max={5}
              value={typeof responses[f.key] === "number" ? (responses[f.key] as number) : undefined}
              onSelect={(n) => setValue(f.key, n)}
            />
          )}

          {f.type === "score_1_10" && (
            <ScoreRow
              fieldKey={f.key}
              label={f.label}
              max={10}
              value={typeof responses[f.key] === "number" ? (responses[f.key] as number) : undefined}
              onSelect={(n) => setValue(f.key, n)}
            />
          )}

          {f.type === "text" && (
            <div className="space-y-2">
              <textarea
                id={f.key}
                value={(responses[f.key] as string) ?? ""}
                onChange={(e) => setValue(f.key, e.target.value)}
                rows={6}
                className="w-full rounded-sm bg-surface border border-hairline-strong px-3 py-2 text-body-s text-ink placeholder:text-ink-tertiary outline-none transition-all duration-fast ease-apple-out focus:border-accent focus:ring-2 focus:ring-accent-soft resize-none"
              />
              {f.allowDictation && onDictate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  iconLeft="Mic"
                  onClick={() => handleDictate(f.key)}
                >
                  Dictate
                </Button>
              )}
            </div>
          )}

          {f.type === "choice" && f.choices && (
            <ChoiceRow
              fieldKey={f.key}
              label={f.label}
              choices={f.choices}
              value={typeof responses[f.key] === "string" ? (responses[f.key] as string) : undefined}
              onSelect={(c) => setValue(f.key, c)}
            />
          )}
        </div>
      ))}

      <div className="space-y-2 pt-2 border-t border-hairline">
        <label className="block text-body-s font-semibold text-ink">
          Recommendation
          <span className="text-ink-tertiary font-normal"> *</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {RECOMMENDATIONS.map((r) => {
            const active = recommendation === r.value;
            return (
              <Button
                key={r.value}
                type="button"
                variant={active ? "primary" : "outline"}
                size="lg"
                onClick={() => setRecommendation(r.value)}
                className="w-full"
              >
                {r.label}
              </Button>
            );
          })}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-body-s text-danger">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-surface-floating backdrop-blur-20 border-t border-hairline">
        <Button type="submit" variant="primary" size="lg" className="w-full">
          Submit evaluation
        </Button>
      </div>
    </form>
  );
}
