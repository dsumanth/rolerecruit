"use client";

import type { Rule } from "@/convex/lib/decisionRuleEngine";
import { summarizeRule, type FieldLabelLookup } from "@/convex/lib/decisionRuleSummary";
import { Card, Icon } from "@/components/ui";

export function RuleSummary({ rule, getLabel }: { rule: Rule; getLabel?: FieldLabelLookup }) {
  return (
    <Card padding="md" elevation={1}>
      <div className="flex items-start gap-2">
        <Icon name="Sparkles" size={16} />
        <p className="text-body-s text-ink">{summarizeRule(rule, getLabel)}</p>
      </div>
    </Card>
  );
}
