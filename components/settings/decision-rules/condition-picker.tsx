"use client";

import type { Condition } from "@/convex/lib/decisionRuleEngine";
import { Button, Dropdown, DropdownItem } from "@/components/ui";
import { defaultCondition, type ConditionType } from "./starter-templates";

const TYPES: { type: ConditionType; label: string; help: string }[] = [
  { type: "recCount", label: "Number of recommendations", help: "e.g. at least 2 recommended Hire" },
  { type: "recPercent", label: "Share of recommendations", help: "e.g. at least 70% recommended Hire" },
  { type: "scoreAvg", label: "Average of a score question", help: "e.g. average Subject Knowledge is at least 4" },
  { type: "overallScore", label: "Overall weighted score", help: "e.g. overall score is at least 7" },
  { type: "roleSubmitted", label: "Who evaluated", help: "e.g. Principal and HOD both submitted" },
  { type: "roleVerdict", label: "A specific person's verdict", help: "e.g. the Principal recommended Hire" },
];

export function ConditionPicker({ onAdd }: { onAdd: (c: Condition) => void }) {
  return (
    <Dropdown trigger={<Button variant="secondary" size="sm" iconLeft="Plus">Add condition</Button>}>
      {TYPES.map((t) => (
        <DropdownItem key={t.type} onSelect={() => onAdd(defaultCondition(t.type))}>
          <div className="flex flex-col">
            <span className="text-body-s text-ink">{t.label}</span>
            <span className="text-caption text-ink-tertiary">{t.help}</span>
          </div>
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
