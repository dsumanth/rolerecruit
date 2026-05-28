"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Card, Icon, Input, useToast } from "@/components/ui";
import { EvaluationForm } from "@/components/evaluations/evaluation-form";
import { FieldRow, type DraftField } from "./field-row";

type Role = "principal" | "hod" | "hr_admin" | "teacher";

interface TemplateEditorProps {
  schoolId: string;
  role: Role;
}

const ROLE_LABELS: Record<Role, string> = {
  principal: "Principal",
  hod: "HOD",
  hr_admin: "HR Admin",
  teacher: "Teacher",
};

export function TemplateEditor({ schoolId, role }: TemplateEditorProps) {
  const active = useQuery(api.formTemplates.getForRole, {
    schoolId: schoolId as Id<"schools">,
    role,
  });
  const defaultDraft = useQuery(api.formTemplates.duplicateFromDefault, {
    schoolId: schoolId as Id<"schools">,
    role,
  });
  const save = useMutation(api.formTemplates.saveOverride);
  const { toast } = useToast();

  const [name, setName] = useState<string | null>(null);
  const [fields, setFields] = useState<DraftField[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (active && name === null && fields === null) {
    setName(active.name);
    setFields(active.fields as DraftField[]);
  }
  if (!active || name === null || fields === null) {
    return <p className="text-body-s text-ink-secondary">Loading...</p>;
  }

  const startFromDefault = () => {
    if (!defaultDraft) return;
    if (!confirm("Replace the current draft with the built-in default? Unsaved changes will be lost.")) return;
    setName(defaultDraft.name);
    setFields(defaultDraft.fields as DraftField[]);
  };

  const addField = () => {
    setFields([
      ...fields,
      { key: `field${fields.length + 1}`, label: "New field", type: "score_1_5" },
    ]);
  };

  const updateField = (i: number, next: DraftField) => {
    const copy = fields.slice();
    copy[i] = next;
    setFields(copy);
  };

  const removeField = (i: number) => {
    setFields(fields.filter((_, idx) => idx !== i));
  };

  const moveField = (from: number, to: number) => {
    if (to < 0 || to >= fields.length) return;
    const copy = fields.slice();
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    setFields(copy);
  };

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      await save({
        schoolId: schoolId as Id<"schools">,
        role,
        name,
        fields: fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          choices: f.choices,
          weight: f.weight,
          allowDictation: f.allowDictation,
          required: f.required,
        })),
      });
      toast({ message: "Template saved", variant: "success" });
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const previewTemplate = {
    _id: "preview",
    name,
    role,
    fields,
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card padding="md" elevation={1}>
        <div className="space-y-4">
          <div>
            <label className="block text-caption text-ink-secondary mb-1">Template name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${ROLE_LABELS[role]} default`} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-body-s font-medium text-ink">Fields</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={startFromDefault} iconLeft="RotateCcw">
                  Start from default
                </Button>
                <Button variant="secondary" size="sm" onClick={addField} iconLeft="Plus">
                  Add field
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <FieldRow
                  key={i}
                  field={f}
                  index={i}
                  onChange={(next) => updateField(i, next)}
                  onRemove={() => removeField(i)}
                  onMoveUp={() => moveField(i, i - 1)}
                  onMoveDown={() => moveField(i, i + 1)}
                  isFirst={i === 0}
                  isLast={i === fields.length - 1}
                />
              ))}
              {fields.length === 0 && (
                <p className="text-body-s text-ink-tertiary">No fields. Add one to get started.</p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-apple bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-3 py-2 text-body-s text-danger">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="primary" size="md" onClick={submit} loading={saving} disabled={!name.trim() || fields.length === 0}>
              Save template
            </Button>
          </div>
        </div>
      </Card>

      <Card padding="md" elevation={1}>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Eye" size={14} />
          <p className="text-body-s font-medium text-ink">Preview</p>
        </div>
        <EvaluationForm template={previewTemplate} readOnly />
      </Card>
    </div>
  );
}
