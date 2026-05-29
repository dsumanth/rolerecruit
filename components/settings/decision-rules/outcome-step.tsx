"use client";

import type { Condition, OutcomeStep, RuleAction } from "@/convex/lib/decisionRuleEngine";
import { Badge, Button, Select } from "@/components/ui";
import { ConditionRow } from "./condition-row";
import { ConditionPicker } from "./condition-picker";

const ACTION_OPTS = [
  { value: "advance", label: "Move forward" },
  { value: "reject", label: "Reject" },
  { value: "redemo", label: "Schedule another demo" },
  { value: "manual", label: "Let me decide manually" },
];

interface OutcomeStepEditorProps {
  step: OutcomeStep;
  index: number;
  schoolId: string;
  onChange: (next: OutcomeStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function OutcomeStepEditor({
  step, index, schoolId, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: OutcomeStepEditorProps) {
  const setCondition = (i: number, next: Condition) =>
    onChange({ ...step, conditions: step.conditions.map((c, j) => (j === i ? next : c)) });
  const removeCondition = (i: number) =>
    onChange({ ...step, conditions: step.conditions.filter((_, j) => j !== i) });

  return (
    <div className="rounded-apple border border-hairline bg-surface p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="neutral">Step {index + 1}</Badge>
        <span className="text-caption text-ink-secondary">When</span>
        <Select
          value={step.match}
          options={[{ value: "all", label: "ALL" }, { value: "any", label: "ANY" }]}
          onChange={(m) => onChange({ ...step, match: m as "all" | "any" })}
          className="w-24"
        />
        <span className="text-caption text-ink-secondary">of these are true:</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" iconLeft="ChevronUp" disabled={isFirst} onClick={onMoveUp} aria-label="Move up"><span className="sr-only">Move up</span></Button>
        <Button variant="ghost" size="sm" iconLeft="ChevronDown" disabled={isLast} onClick={onMoveDown} aria-label="Move down"><span className="sr-only">Move down</span></Button>
        <Button variant="ghost" size="sm" iconLeft="Trash2" onClick={onRemove} aria-label="Remove step"><span className="sr-only">Remove step</span></Button>
      </div>

      {step.conditions.length === 0 ? (
        <p className="text-body-s text-ink-tertiary">No conditions yet. This step would always match. Add at least one condition.</p>
      ) : (
        <div className="space-y-2">
          {step.conditions.map((c, i) => (
            <ConditionRow key={i} condition={c} schoolId={schoolId} onChange={(next) => setCondition(i, next)} onRemove={() => removeCondition(i)} />
          ))}
        </div>
      )}

      <ConditionPicker onAdd={(c) => onChange({ ...step, conditions: [...step.conditions, c] })} />

      <div className="flex items-center gap-2 pt-2 border-t border-hairline">
        <span className="text-caption text-ink-secondary">then</span>
        <Select value={step.action} options={ACTION_OPTS} onChange={(a) => onChange({ ...step, action: a as RuleAction })} className="flex-1 max-w-xs" />
      </div>
    </div>
  );
}
