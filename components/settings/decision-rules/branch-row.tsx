"use client";

import { Badge, Button, Icon, Input, Select } from "@/components/ui";

const ACTION_OPTIONS = [
  { value: "advance", label: "Advance application" },
  { value: "reject", label: "Reject application" },
  { value: "redemo", label: "Schedule re-demo" },
  { value: "manual", label: "Send to manual review" },
];

const ROLE_OPTIONS = [
  { value: "principal", label: "Principal" },
  { value: "hod", label: "HOD" },
  { value: "hr_admin", label: "HR Admin" },
  { value: "teacher", label: "Teacher" },
];

export type DraftBranch = {
  condition: {
    minHire?: number;
    maxReject?: number;
    minAverage?: { fieldKey: string; minValue: number };
    requiredRoles?: string[];
  };
  action: "advance" | "reject" | "redemo" | "manual";
};

interface BranchRowProps {
  branch: DraftBranch;
  index: number;
  onChange: (next: DraftBranch) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function BranchRow({
  branch, index, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: BranchRowProps) {
  const { condition } = branch;

  return (
    <div className="rounded-apple border border-hairline bg-surface p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="neutral">If #{index + 1}</Badge>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" iconLeft="ChevronUp" disabled={isFirst} onClick={onMoveUp} aria-label="Move up">
            <span className="sr-only">Move up</span>
          </Button>
          <Button variant="ghost" size="sm" iconLeft="ChevronDown" disabled={isLast} onClick={onMoveDown} aria-label="Move down">
            <span className="sr-only">Move down</span>
          </Button>
          <Button variant="ghost" size="sm" iconLeft="Trash2" onClick={onRemove} aria-label="Remove branch">
            <span className="sr-only">Remove branch</span>
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <ClauseLine
          label="At least"
          value={condition.minHire}
          onChange={(v) => onChange({ ...branch, condition: { ...condition, minHire: v } })}
          suffix="invites recommended Hire"
        />
        <ClauseLine
          label="At most"
          value={condition.maxReject}
          onChange={(v) => onChange({ ...branch, condition: { ...condition, maxReject: v } })}
          suffix="invites recommended Reject"
        />
        <MinAverageClause
          value={condition.minAverage}
          onChange={(v) => onChange({ ...branch, condition: { ...condition, minAverage: v } })}
        />
        <RequiredRolesClause
          value={condition.requiredRoles}
          onChange={(v) => onChange({ ...branch, condition: { ...condition, requiredRoles: v } })}
        />
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-hairline">
        <Icon name="ArrowRight" size={14} />
        <span className="text-caption text-ink-secondary">Then</span>
        <Select
          aria-label="Action"
          value={branch.action}
          onChange={(value) => onChange({ ...branch, action: value as DraftBranch["action"] })}
          options={ACTION_OPTIONS}
          className="flex-1 max-w-xs"
        />
      </div>
    </div>
  );
}

function ClauseLine({
  label, value, onChange, suffix,
}: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; suffix: string }) {
  const enabled = value !== undefined;
  return (
    <label className="flex items-center gap-2 text-body-s text-ink">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked ? 1 : undefined)}
        className="rounded border-hairline-strong"
      />
      <span>{label}</span>
      <Input
        type="number"
        min={0}
        max={20}
        value={enabled ? value : ""}
        disabled={!enabled}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-16"
        size="sm"
      />
      <span className="text-ink-secondary">{suffix}</span>
    </label>
  );
}

function MinAverageClause({
  value, onChange,
}: { value: { fieldKey: string; minValue: number } | undefined; onChange: (v: { fieldKey: string; minValue: number } | undefined) => void }) {
  const enabled = value !== undefined;
  return (
    <label className="flex items-center gap-2 text-body-s text-ink flex-wrap">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked ? { fieldKey: "subjectKnowledge", minValue: 3 } : undefined)}
        className="rounded border-hairline-strong"
      />
      <span>Average of</span>
      <Input
        value={enabled ? value!.fieldKey : ""}
        disabled={!enabled}
        onChange={(e) => enabled && onChange({ ...value!, fieldKey: e.target.value })}
        placeholder="fieldKey"
        className="w-44"
        size="sm"
      />
      <span>is at least</span>
      <Input
        type="number"
        step="0.1"
        min={0}
        value={enabled ? value!.minValue : ""}
        disabled={!enabled}
        onChange={(e) => enabled && onChange({ ...value!, minValue: Number(e.target.value) || 0 })}
        className="w-20"
        size="sm"
      />
    </label>
  );
}

function RequiredRolesClause({
  value, onChange,
}: { value: string[] | undefined; onChange: (v: string[] | undefined) => void }) {
  const enabled = value !== undefined;
  const selected = new Set(value ?? []);

  const toggle = (role: string) => {
    const next = new Set(selected);
    if (next.has(role)) next.delete(role); else next.add(role);
    onChange(Array.from(next));
  };

  return (
    <div className="flex items-center gap-2 text-body-s text-ink flex-wrap">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked ? [] : undefined)}
        className="rounded border-hairline-strong"
      />
      <span>Submitted by</span>
      {ROLE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={!enabled}
          onClick={() => toggle(opt.value)}
          className={
            "rounded-full px-2.5 py-1 text-caption transition-colors duration-fast " +
            (selected.has(opt.value)
              ? "bg-accent text-surface-canvas"
              : "bg-surface border border-hairline-strong text-ink-secondary hover:bg-accent-soft") +
            (enabled ? "" : " opacity-50 cursor-not-allowed")
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
