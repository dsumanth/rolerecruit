"use client";

import type { Condition, EvaluatorRole, Recommendation } from "@/convex/lib/decisionRuleEngine";
import { Button, Input, Select } from "@/components/ui";
import { FieldPicker } from "./field-picker";

const REC_OPTS = [
  { value: "hire", label: "Hire" },
  { value: "maybe", label: "Maybe" },
  { value: "reject", label: "Reject" },
];
const ROLE_OPTS = [
  { value: "principal", label: "Principal" },
  { value: "hod", label: "HOD" },
  { value: "hr_admin", label: "HR Admin" },
  { value: "teacher", label: "Teacher" },
];
const COUNT_OPTS = [
  { value: "atLeast", label: "at least" },
  { value: "atMost", label: "at most" },
  { value: "exactly", label: "exactly" },
];
const RANGE_OPTS = [
  { value: "atLeast", label: "at least" },
  { value: "atMost", label: "at most" },
];

interface ConditionRowProps {
  condition: Condition;
  schoolId: string;
  onChange: (next: Condition) => void;
  onRemove: () => void;
}

export function ConditionRow({ condition, schoolId, onChange, onRemove }: ConditionRowProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-body-s text-ink">
      <div className="flex-1 flex items-center gap-2 flex-wrap">{renderBody()}</div>
      <Button variant="ghost" size="sm" iconLeft="X" onClick={onRemove} aria-label="Remove condition">
        <span className="sr-only">Remove condition</span>
      </Button>
    </div>
  );

  function num(v: string) {
    return Number(v) || 0;
  }

  function renderBody() {
    switch (condition.type) {
      case "recCount":
        return (
          <>
            <Select value={condition.op} options={COUNT_OPTS} onChange={(op) => onChange({ ...condition, op: op as any })} className="w-28" />
            <Input type="number" min={0} max={50} value={condition.value} onChange={(e) => onChange({ ...condition, value: num(e.target.value) })} className="w-16" size="sm" />
            <span>recommended</span>
            <Select value={condition.rec} options={REC_OPTS} onChange={(rec) => onChange({ ...condition, rec: rec as Recommendation })} className="w-28" />
          </>
        );
      case "recPercent":
        return (
          <>
            <Select value={condition.op} options={RANGE_OPTS} onChange={(op) => onChange({ ...condition, op: op as any })} className="w-28" />
            <Input type="number" min={0} max={100} value={condition.value} onChange={(e) => onChange({ ...condition, value: num(e.target.value) })} className="w-16" size="sm" />
            <span>% recommended</span>
            <Select value={condition.rec} options={REC_OPTS} onChange={(rec) => onChange({ ...condition, rec: rec as Recommendation })} className="w-28" />
          </>
        );
      case "scoreAvg":
        return (
          <>
            <span>average of</span>
            <FieldPicker
              schoolId={schoolId}
              value={{ formTemplateId: condition.formTemplateId, fieldKey: condition.fieldKey }}
              onChange={(sel) => onChange({ ...condition, formTemplateId: sel.formTemplateId, fieldKey: sel.fieldKey })}
            />
            <span>is</span>
            <Select value={condition.op} options={RANGE_OPTS} onChange={(op) => onChange({ ...condition, op: op as any })} className="w-28" />
            <Input type="number" step="0.1" min={0} value={condition.value} onChange={(e) => onChange({ ...condition, value: num(e.target.value) })} className="w-20" size="sm" />
          </>
        );
      case "overallScore":
        return (
          <>
            <span>overall weighted score is</span>
            <Select value={condition.op} options={RANGE_OPTS} onChange={(op) => onChange({ ...condition, op: op as any })} className="w-28" />
            <Input type="number" step="0.1" min={0} value={condition.value} onChange={(e) => onChange({ ...condition, value: num(e.target.value) })} className="w-20" size="sm" />
          </>
        );
      case "roleSubmitted":
        return (
          <>
            <Select value={condition.mode} options={[{ value: "allOf", label: "all of" }, { value: "anyOf", label: "any of" }]} onChange={(m) => onChange({ ...condition, mode: m as any })} className="w-28" />
            <span>these submitted:</span>
            {ROLE_OPTS.map((r) => {
              const on = condition.roles.includes(r.value as EvaluatorRole);
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    const set = new Set(condition.roles);
                    if (on) set.delete(r.value as EvaluatorRole);
                    else set.add(r.value as EvaluatorRole);
                    onChange({ ...condition, roles: Array.from(set) });
                  }}
                  className={"rounded-full px-2.5 py-1 text-caption transition-colors duration-fast " + (on ? "bg-accent text-surface-canvas" : "bg-surface border border-hairline-strong text-ink-secondary hover:bg-accent-soft")}
                >
                  {r.label}
                </button>
              );
            })}
          </>
        );
      case "roleVerdict":
        return (
          <>
            <span>the</span>
            <Select value={condition.role} options={ROLE_OPTS} onChange={(role) => onChange({ ...condition, role: role as EvaluatorRole })} className="w-32" />
            <span>recommended</span>
            <Select value={condition.rec} options={REC_OPTS} onChange={(rec) => onChange({ ...condition, rec: rec as Recommendation })} className="w-28" />
          </>
        );
    }
  }
}
