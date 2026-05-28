export type RuleAction = "advance" | "reject" | "redemo" | "manual";

export type RuleCondition = {
  minHire?: number;
  maxReject?: number;
  minAverage?: { fieldKey: string; minValue: number };
  requiredRoles?: string[];
};

export type RuleBranch = { condition: RuleCondition; action: RuleAction };

export type Rule = { branches: RuleBranch[]; fallback: RuleAction };

export type RuleInviteSnapshot = {
  _id: string;
  evaluatorRole: string;
  status: string;
  formTemplateId: string;
};

export type RuleEvaluationSnapshot = {
  _id: string;
  inviteId: string;
  formTemplateId: string;
  responses: Record<string, number | string>;
  recommendation?: "hire" | "maybe" | "reject";
};

export type RuleTemplateSnapshot = {
  _id: string;
  fields: { key: string; type: string; weight?: number }[];
};

export type RuleInput = {
  rule: Rule;
  invites: RuleInviteSnapshot[];
  evaluations: RuleEvaluationSnapshot[];
  templates: RuleTemplateSnapshot[];
};

function countRecommendations(evs: RuleEvaluationSnapshot[]) {
  let hire = 0;
  let reject = 0;
  for (const e of evs) {
    if (e.recommendation === "hire") hire += 1;
    else if (e.recommendation === "reject") reject += 1;
  }
  return { hire, reject };
}

function weightedAverage(
  fieldKey: string,
  evs: RuleEvaluationSnapshot[],
  templates: RuleTemplateSnapshot[],
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const e of evs) {
    const tpl = templates.find((t) => t._id === e.formTemplateId);
    if (!tpl) continue;
    const field = tpl.fields.find((f) => f.key === fieldKey);
    if (!field) continue;
    if (field.type !== "score_1_5" && field.type !== "score_1_10") continue;
    const value = e.responses[fieldKey];
    if (typeof value !== "number") continue;
    const w = field.weight ?? 1;
    weightedSum += value * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
}

function submittedRoles(invites: RuleInviteSnapshot[]): Set<string> {
  const set = new Set<string>();
  for (const i of invites) {
    if (i.status === "submitted") set.add(i.evaluatorRole);
  }
  return set;
}

function conditionMatches(
  cond: RuleCondition,
  evs: RuleEvaluationSnapshot[],
  invites: RuleInviteSnapshot[],
  templates: RuleTemplateSnapshot[],
): boolean {
  const { hire, reject } = countRecommendations(evs);

  if (cond.minHire !== undefined && hire < cond.minHire) return false;
  if (cond.maxReject !== undefined && reject > cond.maxReject) return false;

  if (cond.minAverage) {
    const avg = weightedAverage(cond.minAverage.fieldKey, evs, templates);
    if (avg === null) return false;
    if (avg < cond.minAverage.minValue) return false;
  }

  if (cond.requiredRoles && cond.requiredRoles.length > 0) {
    const roles = submittedRoles(invites);
    for (const r of cond.requiredRoles) {
      if (!roles.has(r)) return false;
    }
  }

  return true;
}

export function evaluateRule(input: RuleInput): RuleAction {
  const { rule, invites, evaluations, templates } = input;
  for (const branch of rule.branches) {
    if (conditionMatches(branch.condition, evaluations, invites, templates)) {
      return branch.action;
    }
  }
  return rule.fallback;
}
