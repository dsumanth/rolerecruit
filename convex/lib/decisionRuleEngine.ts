export type RuleAction = "advance" | "reject" | "redemo" | "manual";
export type Recommendation = "hire" | "maybe" | "reject";
export type EvaluatorRole = "principal" | "hod" | "hr_admin" | "teacher";
export type CountOp = "atLeast" | "atMost" | "exactly";
export type RangeOp = "atLeast" | "atMost";

export type Condition =
  | { type: "recCount"; rec: Recommendation; op: CountOp; value: number }
  | { type: "recPercent"; rec: Recommendation; op: RangeOp; value: number }
  | { type: "scoreAvg"; formTemplateId?: string; fieldKey: string; op: RangeOp; value: number }
  | { type: "overallScore"; op: RangeOp; value: number }
  | { type: "roleSubmitted"; mode: "allOf" | "anyOf"; roles: EvaluatorRole[] }
  | { type: "roleVerdict"; role: EvaluatorRole; rec: Recommendation };

export type OutcomeStep = { match: "all" | "any"; conditions: Condition[]; action: RuleAction };
export type Rule = { steps: OutcomeStep[]; otherwise: RuleAction };

export type RuleInviteSnapshot = { _id: string; evaluatorRole: string; status: string; formTemplateId: string };
export type RuleEvaluationSnapshot = {
  _id: string;
  inviteId: string;
  formTemplateId: string;
  responses: Record<string, number | string>;
  recommendation?: Recommendation;
};
export type RuleTemplateSnapshot = { _id: string; fields: { key: string; type: string; weight?: number }[] };
export type RuleInput = {
  rule: Rule;
  invites: RuleInviteSnapshot[];
  evaluations: RuleEvaluationSnapshot[];
  templates: RuleTemplateSnapshot[];
};

export type ConditionResult = { condition: Condition; passed: boolean };
export type StepResult = { index: number; matched: boolean; conditions: ConditionResult[]; action: RuleAction };
export type RuleExplanation = { action: RuleAction; matchedStepIndex: number | null; steps: StepResult[] };

type EvalContext = {
  invites: RuleInviteSnapshot[];
  evaluations: RuleEvaluationSnapshot[];
  templates: RuleTemplateSnapshot[];
  roleByInvite: Map<string, string>;
};

function buildContext(input: RuleInput): EvalContext {
  const roleByInvite = new Map<string, string>();
  for (const inv of input.invites) roleByInvite.set(inv._id, inv.evaluatorRole);
  return { invites: input.invites, evaluations: input.evaluations, templates: input.templates, roleByInvite };
}

function compareRange(actual: number, op: RangeOp, target: number): boolean {
  return op === "atLeast" ? actual >= target : actual <= target;
}

function compareCount(actual: number, op: CountOp, target: number): boolean {
  if (op === "atLeast") return actual >= target;
  if (op === "atMost") return actual <= target;
  return actual === target;
}

function recCount(evs: RuleEvaluationSnapshot[], rec: Recommendation): number {
  return evs.filter((e) => e.recommendation === rec).length;
}

function isScoreField(type: string): boolean {
  return type === "score_1_5" || type === "score_1_10";
}

function fieldAverage(
  fieldKey: string,
  formTemplateId: string | undefined,
  ctx: EvalContext,
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const e of ctx.evaluations) {
    if (formTemplateId && e.formTemplateId !== formTemplateId) continue;
    const tpl = ctx.templates.find((t) => t._id === e.formTemplateId);
    if (!tpl) continue;
    const field = tpl.fields.find((f) => f.key === fieldKey);
    if (!field || !isScoreField(field.type)) continue;
    const value = e.responses[fieldKey];
    if (typeof value !== "number") continue;
    const w = field.weight ?? 1;
    weightedSum += value * w;
    totalWeight += w;
  }
  return totalWeight === 0 ? null : weightedSum / totalWeight;
}

function overallAverage(ctx: EvalContext): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const e of ctx.evaluations) {
    const tpl = ctx.templates.find((t) => t._id === e.formTemplateId);
    if (!tpl) continue;
    for (const field of tpl.fields) {
      if (!isScoreField(field.type)) continue;
      const value = e.responses[field.key];
      if (typeof value !== "number") continue;
      const w = field.weight ?? 1;
      weightedSum += value * w;
      totalWeight += w;
    }
  }
  return totalWeight === 0 ? null : weightedSum / totalWeight;
}

function submittedRoles(ctx: EvalContext): Set<string> {
  const set = new Set<string>();
  for (const i of ctx.invites) if (i.status === "submitted") set.add(i.evaluatorRole);
  return set;
}

function conditionPasses(cond: Condition, ctx: EvalContext): boolean {
  switch (cond.type) {
    case "recCount":
      return compareCount(recCount(ctx.evaluations, cond.rec), cond.op, cond.value);
    case "recPercent": {
      const submittedCount = ctx.evaluations.length;
      const pct = submittedCount === 0 ? 0 : (recCount(ctx.evaluations, cond.rec) / submittedCount) * 100;
      return compareRange(pct, cond.op, cond.value);
    }
    case "scoreAvg": {
      const avg = fieldAverage(cond.fieldKey, cond.formTemplateId, ctx);
      return avg === null ? false : compareRange(avg, cond.op, cond.value);
    }
    case "overallScore": {
      const avg = overallAverage(ctx);
      return avg === null ? false : compareRange(avg, cond.op, cond.value);
    }
    case "roleSubmitted": {
      const roles = submittedRoles(ctx);
      if (cond.roles.length === 0) return true;
      return cond.mode === "allOf"
        ? cond.roles.every((r) => roles.has(r))
        : cond.roles.some((r) => roles.has(r));
    }
    case "roleVerdict":
      return ctx.evaluations.some(
        (e) => e.recommendation === cond.rec && ctx.roleByInvite.get(e.inviteId) === cond.role,
      );
  }
}

function stepMatches(step: OutcomeStep, ctx: EvalContext): { matched: boolean; conditions: ConditionResult[] } {
  const conditions = step.conditions.map((condition) => ({ condition, passed: conditionPasses(condition, ctx) }));
  const matched =
    step.conditions.length === 0
      ? true
      : step.match === "all"
        ? conditions.every((c) => c.passed)
        : conditions.some((c) => c.passed);
  return { matched, conditions };
}

export function explainRule(input: RuleInput): RuleExplanation {
  const ctx = buildContext(input);
  const steps: StepResult[] = [];
  let action: RuleAction | null = null;
  let matchedStepIndex: number | null = null;
  input.rule.steps.forEach((step, index) => {
    const { matched, conditions } = stepMatches(step, ctx);
    steps.push({ index, matched, conditions, action: step.action });
    if (action === null && matched) {
      action = step.action;
      matchedStepIndex = index;
    }
  });
  return { action: action ?? input.rule.otherwise, matchedStepIndex, steps };
}

export function evaluateRule(input: RuleInput): RuleAction {
  return explainRule(input).action;
}
