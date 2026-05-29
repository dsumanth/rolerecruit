"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { OutcomeStep, Rule, RuleAction } from "@/convex/lib/decisionRuleEngine";
import { Badge, Button, Card, Icon, Input, Select, useToast } from "@/components/ui";
import { OutcomeStepEditor } from "./outcome-step";
import { RuleSummary } from "./rule-summary";
import { RuleTester } from "./rule-tester";
import { useFieldLabelLookup } from "./field-picker";
import { STARTER_TEMPLATES } from "./starter-templates";

const ACTION_OPTS = [
  { value: "advance", label: "Move forward" },
  { value: "reject", label: "Reject" },
  { value: "redemo", label: "Schedule another demo" },
  { value: "manual", label: "Let me decide manually" },
];

const emptyStep = (): OutcomeStep => ({ match: "all", conditions: [], action: "advance" });

export function RuleEditor({ schoolId, ruleId }: { schoolId: string; ruleId?: string }) {
  const existing = useQuery(api.decisionRules.get, ruleId ? { ruleId: ruleId as Id<"decisionRules"> } : "skip");
  const create = useMutation(api.decisionRules.create);
  const update = useMutation(api.decisionRules.update);
  const router = useRouter();
  const { toast } = useToast();
  const getLabel = useFieldLabelLookup(schoolId);

  const [name, setName] = useState<string | null>(null);
  const [steps, setSteps] = useState<OutcomeStep[] | null>(null);
  const [otherwise, setOtherwise] = useState<RuleAction | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ruleId && existing && name === null) {
    setName(existing.name);
    setSteps(existing.steps as OutcomeStep[]);
    setOtherwise(existing.otherwise as RuleAction);
  }
  if (!ruleId && name === null) {
    setName("");
    setSteps([]);
    setOtherwise("manual");
  }
  if (name === null || steps === null || otherwise === null) {
    return <p className="text-body-s text-ink-secondary">Loading...</p>;
  }

  const rule: Rule = { steps, otherwise };

  const applyStarter = (id: string) => {
    const s = STARTER_TEMPLATES.find((x) => x.id === id);
    if (!s) return;
    setSteps(s.rule.steps.map((st) => ({ ...st, conditions: [...st.conditions] })));
    setOtherwise(s.rule.otherwise);
    if (!name.trim()) setName(s.name);
  };

  const moveStep = (from: number, to: number) => {
    if (to < 0 || to >= steps.length) return;
    const copy = steps.slice();
    const [m] = copy.splice(from, 1);
    copy.splice(to, 0, m);
    setSteps(copy);
  };

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      if (ruleId) {
        await update({ ruleId: ruleId as Id<"decisionRules">, name, steps, otherwise });
        toast({ message: "Rule saved", variant: "success" });
      } else {
        const newId = await create({ schoolId: schoolId as Id<"schools">, name, steps, otherwise });
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

      <RuleSummary rule={rule} getLabel={getLabel} />

      {!ruleId && steps.length === 0 && (
        <Card padding="md" elevation={1}>
          <p className="text-body-s font-medium text-ink mb-2">Start from an example</p>
          <div className="grid gap-2">
            {STARTER_TEMPLATES.map((s) => (
              <button key={s.id} type="button" onClick={() => applyStarter(s.id)} className="text-left rounded-apple border border-hairline-strong p-3 hover:bg-accent-soft transition-colors duration-fast">
                <p className="text-body-s font-medium text-ink">{s.name}</p>
                <p className="text-caption text-ink-secondary">{s.description}</p>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card padding="md" elevation={1}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="info">Steps</Badge>
            <span className="text-caption text-ink-secondary">Checked top to bottom, first match wins</span>
          </div>
          <Button variant="secondary" size="sm" iconLeft="Plus" onClick={() => setSteps([...steps, emptyStep()])}>Add step</Button>
        </div>
        {steps.length === 0 ? (
          <p className="text-body-s text-ink-tertiary">No steps yet. Every demo will use the &quot;Otherwise&quot; outcome below.</p>
        ) : (
          <div className="space-y-3">
            {steps.map((s, i) => (
              <OutcomeStepEditor
                key={i}
                step={s}
                index={i}
                schoolId={schoolId}
                onChange={(next) => setSteps(steps.map((x, j) => (j === i ? next : x)))}
                onRemove={() => setSteps(steps.filter((_, j) => j !== i))}
                onMoveUp={() => moveStep(i, i - 1)}
                onMoveDown={() => moveStep(i, i + 1)}
                isFirst={i === 0}
                isLast={i === steps.length - 1}
              />
            ))}
          </div>
        )}
      </Card>

      <Card padding="md" elevation={1}>
        <div className="flex items-center gap-2 mb-2">
          <Icon name="GitBranch" size={14} />
          <p className="text-body-s font-medium text-ink">Otherwise</p>
        </div>
        <Select value={otherwise} onChange={(v) => setOtherwise(v as RuleAction)} options={ACTION_OPTS} />
      </Card>

      <RuleTester schoolId={schoolId} rule={rule} getLabel={getLabel} />

      {error && (
        <div className="rounded-apple bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-3 py-2 text-body-s text-danger">{error}</div>
      )}

      <div className="flex justify-end">
        <Button variant="primary" size="md" onClick={submit} loading={saving} disabled={!name.trim()}>
          {ruleId ? "Save rule" : "Create rule"}
        </Button>
      </div>
    </div>
  );
}
