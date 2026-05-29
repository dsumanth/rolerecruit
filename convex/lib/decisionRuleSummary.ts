import type {
  Rule,
  Condition,
  RuleAction,
  Recommendation,
  EvaluatorRole,
} from "./decisionRuleEngine";

export type FieldLabelLookup = (fieldKey: string, formTemplateId?: string) => string | undefined;

const ACTION_LABEL: Record<RuleAction, string> = {
  advance: "Move forward",
  reject: "Reject",
  redemo: "Schedule another demo",
  manual: "Let me decide manually",
};

const REC_LABEL: Record<Recommendation, string> = { hire: "Hire", maybe: "Maybe", reject: "Reject" };

const ROLE_LABEL: Record<EvaluatorRole, string> = {
  principal: "Principal",
  hod: "HOD",
  hr_admin: "HR Admin",
  teacher: "Teacher",
};

const OP_WORD: Record<"atLeast" | "atMost" | "exactly", string> = {
  atLeast: "at least",
  atMost: "at most",
  exactly: "exactly",
};

export function describeAction(action: RuleAction): string {
  return ACTION_LABEL[action];
}

export function describeCondition(cond: Condition, getLabel?: FieldLabelLookup): string {
  switch (cond.type) {
    case "recCount":
      return `${OP_WORD[cond.op]} ${cond.value} recommended ${REC_LABEL[cond.rec]}`;
    case "recPercent":
      return `${OP_WORD[cond.op]} ${cond.value}% recommended ${REC_LABEL[cond.rec]}`;
    case "scoreAvg": {
      const label = getLabel?.(cond.fieldKey, cond.formTemplateId) ?? cond.fieldKey;
      return `average of ${label} is ${OP_WORD[cond.op]} ${cond.value}`;
    }
    case "overallScore":
      return `overall weighted score is ${OP_WORD[cond.op]} ${cond.value}`;
    case "roleSubmitted": {
      const which = cond.mode === "allOf" ? "all of" : "any of";
      return `${which} these submitted: ${cond.roles.map((r) => ROLE_LABEL[r]).join(", ")}`;
    }
    case "roleVerdict":
      return `the ${ROLE_LABEL[cond.role]} recommended ${REC_LABEL[cond.rec]}`;
  }
}

export function summarizeRule(rule: Rule, getLabel?: FieldLabelLookup): string {
  const stepText = rule.steps.map((step) => {
    const conds =
      step.conditions.length === 0
        ? "always"
        : step.conditions
            .map((c) => describeCondition(c, getLabel))
            .join(step.match === "all" ? " and " : " or ");
    return `if ${conds}, ${describeAction(step.action)}`;
  });
  const body = stepText.length
    ? `${stepText.join("; ")}; otherwise, ${describeAction(rule.otherwise)}`
    : describeAction(rule.otherwise);
  return `Once everyone finishes: ${body}.`;
}
