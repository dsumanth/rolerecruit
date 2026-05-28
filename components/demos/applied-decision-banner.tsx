"use client";

import { Badge, Button, Card, Icon } from "@/components/ui";

type Action = "advance" | "reject" | "redemo" | "manual";

const ACTION_LABEL: Record<Action, string> = {
  advance: "Advanced",
  reject: "Rejected",
  redemo: "Re-demo suggested",
  manual: "Manual review",
};

const ACTION_VARIANT: Record<Action, "success" | "danger" | "warning" | "info"> = {
  advance: "success",
  reject: "danger",
  redemo: "warning",
  manual: "info",
};

interface Props {
  applied: {
    action: Action;
    appliedAt: number;
    appliedBy?: string;
    note?: string;
  };
  onOverride: () => void;
  onConfirmRedemo: () => void;
}

export function AppliedDecisionBanner({ applied, onOverride, onConfirmRedemo }: Props) {
  const isAuto = applied.note?.startsWith("Auto-applied") ?? false;

  return (
    <Card padding="md" elevation={2}>
      <div className="flex items-start gap-3 flex-wrap">
        <Icon name={isAuto ? "Sparkles" : "Check"} size={18} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-body font-medium text-ink">
              {isAuto ? "Auto-decided: " : "Decision: "}
            </p>
            <Badge variant={ACTION_VARIANT[applied.action]}>{ACTION_LABEL[applied.action]}</Badge>
          </div>
          {applied.note && (
            <p className="text-caption text-ink-secondary mt-1">{applied.note}</p>
          )}
          <p className="text-caption text-ink-tertiary mt-0.5">
            {new Date(applied.appliedAt).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="flex gap-2">
          {applied.action === "redemo" && (
            <Button variant="primary" size="sm" onClick={onConfirmRedemo}>
              Confirm re-demo
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onOverride}>
            Override
          </Button>
        </div>
      </div>
    </Card>
  );
}
