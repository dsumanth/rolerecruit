"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Rule } from "@/convex/lib/decisionRuleEngine";
import { describeAction, describeCondition, type FieldLabelLookup } from "@/convex/lib/decisionRuleSummary";
import { Badge, Card, Icon, Select } from "@/components/ui";

export function RuleTester({ schoolId, rule, getLabel }: { schoolId: string; rule: Rule; getLabel?: FieldLabelLookup }) {
  const [demoId, setDemoId] = useState<string>("");
  const demos = useQuery(api.decisionRules.recentDecidedDemos, { schoolId: schoolId as Id<"schools"> });
  const result = useQuery(
    api.decisionRules.previewRuleOnDemo,
    demoId ? { demoId: demoId as Id<"demoSessions">, rule } : "skip",
  );

  return (
    <Card padding="md" elevation={1}>
      <div className="flex items-center gap-2 mb-3">
        <Icon name="FlaskConical" size={14} />
        <p className="text-body-s font-medium text-ink">Test against a past demo</p>
      </div>
      <Select
        value={demoId}
        placeholder="Pick a completed demo"
        options={(demos ?? []).map((d) => ({ value: d.demoId as string, label: d.label }))}
        onChange={setDemoId}
        className="max-w-md"
      />
      {result && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-caption text-ink-secondary">Result:</span>
            <Badge variant="info">{describeAction(result.action)}</Badge>
            {result.matchedStepIndex !== null && (
              <span className="text-caption text-ink-tertiary">matched step {result.matchedStepIndex + 1}</span>
            )}
          </div>
          <div className="space-y-1">
            {result.steps.map((s) => (
              <div key={s.index} className="text-caption">
                <span className={s.matched ? "text-success" : "text-ink-tertiary"}>
                  Step {s.index + 1} {s.matched ? "matched" : "did not match"}
                </span>
                <ul className="ml-4 list-disc">
                  {s.conditions.map((c, i) => (
                    <li key={i} className={c.passed ? "text-ink-secondary" : "text-ink-tertiary"}>
                      {c.passed ? "PASS" : "FAIL"} - {describeCondition(c.condition, getLabel)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
