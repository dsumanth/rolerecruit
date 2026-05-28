"use client";

import { Badge, Button, Input, Select } from "@/components/ui";

export type DraftField = {
  key: string;
  label: string;
  type: "score_1_5" | "score_1_10" | "text" | "choice";
  choices?: string[];
  weight?: number;
  allowDictation?: boolean;
  required?: boolean;
};

interface FieldRowProps {
  field: DraftField;
  index: number;
  onChange: (next: DraftField) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const TYPE_OPTIONS = [
  { value: "score_1_5", label: "Score 1-5" },
  { value: "score_1_10", label: "Score 1-10" },
  { value: "text", label: "Text" },
  { value: "choice", label: "Choice" },
];

export function FieldRow({
  field, index, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: FieldRowProps) {
  return (
    <div className="rounded-apple border border-hairline bg-surface p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Badge variant="neutral">#{index + 1}</Badge>
        <Input
          aria-label="Field label"
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder="Visible label"
          className="flex-1"
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            iconLeft="ChevronUp"
            disabled={isFirst}
            onClick={onMoveUp}
            aria-label="Move up"
          >
            <span className="sr-only">Move up</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconLeft="ChevronDown"
            disabled={isLast}
            onClick={onMoveDown}
            aria-label="Move down"
          >
            <span className="sr-only">Move down</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconLeft="Trash2"
            onClick={onRemove}
            aria-label="Remove field"
          >
            <span className="sr-only">Remove field</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label="Field key"
          value={field.key}
          onChange={(e) => onChange({ ...field, key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
          placeholder="storageKey (no spaces)"
        />
        <Select
          aria-label="Field type"
          value={field.type}
          onChange={(value) => onChange({ ...field, type: value as DraftField["type"] })}
          options={TYPE_OPTIONS}
        />
      </div>

      {field.type === "choice" && (
        <div>
          <label className="block text-caption text-ink-secondary mb-1">Choices (comma-separated)</label>
          <Input
            value={(field.choices ?? []).join(", ")}
            onChange={(e) =>
              onChange({
                ...field,
                choices: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
            placeholder="Option A, Option B"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-ink-secondary">
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
            className="rounded border-hairline-strong"
          />
          Required
        </label>
        {field.type === "text" && (
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={field.allowDictation ?? false}
              onChange={(e) => onChange({ ...field, allowDictation: e.target.checked })}
              className="rounded border-hairline-strong"
            />
            Allow dictation
          </label>
        )}
        {(field.type === "score_1_5" || field.type === "score_1_10") && (
          <label className="inline-flex items-center gap-1.5">
            <span>Weight</span>
            <Input
              type="number"
              min={1}
              max={5}
              value={field.weight ?? 1}
              onChange={(e) => onChange({ ...field, weight: Number(e.target.value) || 1 })}
              className="w-16"
              size="sm"
            />
          </label>
        )}
      </div>
    </div>
  );
}
