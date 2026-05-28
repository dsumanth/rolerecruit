"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge, Button, Card, Icon, Input, Select, useToast } from "@/components/ui";
import { BranchRow, type DraftBranch } from "./branch-row";

const FALLBACK_OPTIONS = [
  { value: "advance", label: "Advance application" },
  { value: "reject", label: "Reject application" },
  { value: "redemo", label: "Schedule re-demo" },
  { value: "manual", label: "Send to manual review" },
];

interface RuleEditorProps {
  schoolId: string;
  ruleId?: string;
}

export function RuleEditor({ schoolId, ruleId }: RuleEditorProps) {
  const existing = useQuery(
    api.decisionRules.get,
    ruleId ? { ruleId: ruleId as Id<"decisionRules"> } : "skip",
  );
  const create = useMutation(api.decisionRules.create);
  const update = useMutation(api.decisionRules.update);
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState<string | null>(null);
  const [branches, setBranches] = useState<DraftBranch[] | null>(null);
  const [fallback, setFallback] = useState<DraftBranch["action"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ruleId && existing && name === null) {
    setName(existing.name);
    setBranches(existing.branches as DraftBranch[]);
    setFallback(existing.fallback);
  }
  if (!ruleId && name === null) {
    setName("");
    setBranches([]);
    setFallback("manual");
  }

  if (name === null || branches === null || fallback === null) {
    return <p className="text-body-s text-ink-secondary">Loading...</p>;
  }

  const addBranch = () =>
    setBranches([...branches, { condition: { minHire: 1 }, action: "advance" }]);

  const updateBranch = (i: number, next: DraftBranch) => {
    const copy = branches.slice();
    copy[i] = next;
    setBranches(copy);
  };

  const removeBranch = (i: number) => setBranches(branches.filter((_, idx) => idx !== i));

  const moveBranch = (from: number, to: number) => {
    if (to < 0 || to >= branches.length) return;
    const copy = branches.slice();
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    setBranches(copy);
  };

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      if (ruleId) {
        await update({
          ruleId: ruleId as Id<"decisionRules">,
          name, branches, fallback,
        });
        toast({ message: "Rule saved", variant: "success" });
      } else {
        const newId = await create({
          schoolId: schoolId as Id<"schools">,
          name, branches, fallback,
        });
        toast({ message: "Rule created", variant: "success" });
        router.replace(`/dashboard/settings/decision-rules/${newId}`);
      }
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <Card padding="md" elevation={1}>
        <label className="block text-caption text-ink-secondary mb-1">Rule name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard hire path" />
      </Card>

      <Card padding="md" elevation={1}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="info">Branches</Badge>
            <span className="text-caption text-ink-secondary">First match wins</span>
          </div>
          <Button variant="secondary" size="sm" iconLeft="Plus" onClick={addBranch}>Add branch</Button>
        </div>

        {branches.length === 0 ? (
          <p className="text-body-s text-ink-tertiary">
            No branches yet. Without branches, every demo falls through to the fallback action.
          </p>
        ) : (
          <div className="space-y-3">
            {branches.map((b, i) => (
              <BranchRow
                key={i}
                branch={b}
                index={i}
                onChange={(next) => updateBranch(i, next)}
                onRemove={() => removeBranch(i)}
                onMoveUp={() => moveBranch(i, i - 1)}
                onMoveDown={() => moveBranch(i, i + 1)}
                isFirst={i === 0}
                isLast={i === branches.length - 1}
              />
            ))}
          </div>
        )}
      </Card>

      <Card padding="md" elevation={1}>
        <div className="flex items-center gap-2 mb-2">
          <Icon name="GitBranch" size={14} />
          <p className="text-body-s font-medium text-ink">If no branch matches</p>
        </div>
        <Select
          value={fallback}
          onChange={(value) => setFallback(value as DraftBranch["action"])}
          options={FALLBACK_OPTIONS}
        />
      </Card>

      {error && (
        <div className="rounded-apple bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-3 py-2 text-body-s text-danger">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="primary" size="md" onClick={submit} loading={saving} disabled={!name.trim()}>
          {ruleId ? "Save rule" : "Create rule"}
        </Button>
      </div>
    </div>
  );
}
