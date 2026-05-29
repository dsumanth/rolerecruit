"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Select } from "@/components/ui";

const SEP = "::";
const SCORE_TYPES = new Set(["score_1_5", "score_1_10"]);

export type FieldSelection = { formTemplateId?: string; fieldKey: string };

interface FieldPickerProps {
  schoolId: string;
  value: FieldSelection;
  onChange: (next: FieldSelection) => void;
}

// Returns a lookup usable by summarizeRule: (fieldKey, formTemplateId) => label.
export function useFieldLabelLookup(schoolId: string) {
  const templates = useQuery(api.formTemplates.listForSchool, { schoolId: schoolId as Id<"schools"> });
  return useMemo(() => {
    const byScoped = new Map<string, string>();
    const byKey = new Map<string, string>();
    for (const t of templates ?? []) {
      for (const f of t.fields) {
        byScoped.set(`${t._id}${SEP}${f.key}`, f.label);
        if (!byKey.has(f.key)) byKey.set(f.key, f.label);
      }
    }
    return (fieldKey: string, formTemplateId?: string) =>
      (formTemplateId ? byScoped.get(`${formTemplateId}${SEP}${fieldKey}`) : undefined) ?? byKey.get(fieldKey);
  }, [templates]);
}

export function FieldPicker({ schoolId, value, onChange }: FieldPickerProps) {
  const templates = useQuery(api.formTemplates.listForSchool, { schoolId: schoolId as Id<"schools"> });

  const options = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (const t of (templates ?? []).filter((x) => x.isActive)) {
      for (const f of t.fields) {
        if (!SCORE_TYPES.has(f.type)) continue;
        opts.push({ value: `${t._id}${SEP}${f.key}`, label: `${t.name} - ${f.label}` });
      }
    }
    return opts;
  }, [templates]);

  const current = value.formTemplateId ? `${value.formTemplateId}${SEP}${value.fieldKey}` : "";

  return (
    <Select
      value={current}
      placeholder="Choose a score question"
      options={options}
      onChange={(v) => {
        const [formTemplateId, fieldKey] = v.split(SEP);
        onChange({ formTemplateId, fieldKey });
      }}
      className="min-w-[16rem]"
    />
  );
}
