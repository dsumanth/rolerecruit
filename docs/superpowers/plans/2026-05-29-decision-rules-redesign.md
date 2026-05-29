# Decision Rules Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the jargon-heavy, fixed-condition decision-rule editor with a plain-language sentence builder backed by a flexible, typed condition model, with a live English summary, a "test against a past demo" preview, starter templates, and read-only mobile views.

**Architecture:** A pure evaluation engine (`convex/lib/decisionRuleEngine.ts`) gains a new `Rule = { steps, otherwise }` model whose steps each carry a `match: "all"|"any"` and a list of typed `Condition`s. A pure summary helper (`convex/lib/decisionRuleSummary.ts`) renders any rule to English and is shared by web and mobile. The Convex `decisionRules` table, validators, and `convex/decisions.ts` wiring move to the new shape. The web editor is rebuilt from focused components; mobile becomes read-only.

**Tech Stack:** Convex (TypeScript), Next.js 14 + React (web), React Native (mobile), Vitest (web/convex tests), Jest (mobile tests), bun for package scripts.

**Conventions (from `.commandcode/taste/taste.md`):** strict red-green TDD, single-responsibility files, no em-dashes or `--` in code, no "Co-authored-by" trailers, bun over npm, use existing design tokens, design config UIs for non-technical users.

**Test command:** `bun run test -- <path>` runs Vitest (script is `vitest run`). Mobile: `cd mobile && bun run test -- <path>`.

---

## Phasing

- **Phase 1 (Tasks 1-4):** Pure backend logic - engine types, `evaluateRule`/`explainRule`, summary helper. No Convex/schema yet, fully unit tested.
- **Phase 2 (Tasks 5-9):** Convex schema, validators, legacy purge, `decisions.ts` wiring, preview queries. Integration tested.
- **Phase 3 (Tasks 10-16):** Web editor + list rebuild.
- **Phase 4 (Tasks 17-19):** Mobile read-only.

Each phase ends in a working, testable state. Commit after every task (every step that says "Commit").

---

## File map

**Phase 1 (pure logic):**
- Modify: `convex/lib/decisionRuleEngine.ts` (new types, `evaluateRule`, `explainRule`)
- Create: `convex/lib/decisionRuleSummary.ts` (rule to English)
- Rewrite: `tests/convex/decisionRuleEngine.test.ts`
- Create: `tests/convex/decisionRuleSummary.test.ts`

**Phase 2 (Convex):**
- Modify: `convex/schema.ts:510-539` (decisionRules table)
- Modify: `convex/decisionRules.ts` (validators, create/update, preview queries)
- Modify: `convex/decisions.ts` (extract `buildRuleInputForDemo`, new rule shape)
- Rewrite: `tests/convex/decisionRules.test.ts`, `tests/convex/demoSessions-decision.test.ts`, `tests/convex/decisions.test.ts` fixtures to new shape

**Phase 3 (web):**
- Modify: `components/settings/decision-rules/rule-editor.tsx`
- Create: `components/settings/decision-rules/outcome-step.tsx` (replaces `branch-row.tsx`)
- Create: `components/settings/decision-rules/condition-row.tsx`
- Create: `components/settings/decision-rules/condition-picker.tsx`
- Create: `components/settings/decision-rules/field-picker.tsx`
- Create: `components/settings/decision-rules/rule-summary.tsx`
- Create: `components/settings/decision-rules/rule-tester.tsx`
- Create: `components/settings/decision-rules/starter-templates.ts`
- Delete: `components/settings/decision-rules/branch-row.tsx`
- Modify: `app/dashboard/settings/decision-rules/page.tsx` (list subtitle uses summary)

**Phase 4 (mobile):**
- Modify: `mobile/src/screens/decision-rules.tsx` (summary, read-only, remove New button)
- Delete: `mobile/src/screens/rule-editor.tsx`, `mobile/src/components/settings/branch-row.tsx`
- Modify: `mobile/src/navigation/app-nav.tsx` (remove `RuleEditor` route)
- Modify: `mobile/__tests__/screens/decision-rules.test.tsx`

---

## Phase 1: Pure backend logic

### Task 1: New engine types and `recCount` / `recPercent` conditions

**Files:**
- Modify: `convex/lib/decisionRuleEngine.ts` (full rewrite of types + engine)
- Rewrite: `tests/convex/decisionRuleEngine.test.ts`

- [ ] **Step 1: Replace the engine test file with the new-model test harness and first tests**

Replace the entire contents of `tests/convex/decisionRuleEngine.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import {
  evaluateRule,
  explainRule,
  type Rule,
  type RuleInput,
  type Recommendation,
} from "../../convex/lib/decisionRuleEngine";

type Rec = Recommendation | undefined;

// Builds a RuleInput from a flat description. Each entry in `recs` is one
// invite/evaluation; `undefined` means the invite was declined (no evaluation).
function buildInput(opts: {
  rule: Rule;
  recs?: Rec[];
  roles?: string[];
  scoreField?: { key: string; values: number[]; weight?: number; type?: string };
}): RuleInput {
  const fieldKey = opts.scoreField?.key ?? "score";
  const invites = (opts.recs ?? []).map((rec, i) => ({
    _id: `inv${i}`,
    evaluatorRole: opts.roles?.[i] ?? "principal",
    status: rec === undefined ? "declined" : "submitted",
    formTemplateId: "tpl1",
  }));
  const evaluations = (opts.recs ?? []).flatMap((rec, i) =>
    rec === undefined
      ? []
      : [{
          _id: `eval${i}`,
          inviteId: `inv${i}`,
          formTemplateId: "tpl1",
          responses: opts.scoreField ? { [fieldKey]: opts.scoreField.values[i] ?? 0 } : {},
          recommendation: rec,
        }],
  );
  const template = {
    _id: "tpl1",
    fields: opts.scoreField
      ? [{ key: fieldKey, type: opts.scoreField.type ?? "score_1_5", weight: opts.scoreField.weight }]
      : [],
  };
  return { rule: opts.rule, invites, evaluations, templates: [template] };
}

describe("evaluateRule - recCount", () => {
  it("returns otherwise when there are no steps", () => {
    const rule: Rule = { steps: [], otherwise: "manual" };
    expect(evaluateRule(buildInput({ rule, recs: ["hire", "hire"] }))).toBe("manual");
  });

  it("matches recCount atLeast and ignores later steps", () => {
    const rule: Rule = {
      steps: [
        { match: "all", conditions: [{ type: "recCount", rec: "hire", op: "atLeast", value: 2 }], action: "advance" },
        { match: "all", conditions: [{ type: "recCount", rec: "reject", op: "atMost", value: 0 }], action: "redemo" },
      ],
      otherwise: "manual",
    };
    expect(evaluateRule(buildInput({ rule, recs: ["hire", "hire", "maybe"] }))).toBe("advance");
  });

  it("fails recCount atLeast when threshold not met", () => {
    const rule: Rule = {
      steps: [{ match: "all", conditions: [{ type: "recCount", rec: "hire", op: "atLeast", value: 3 }], action: "advance" }],
      otherwise: "manual",
    };
    expect(evaluateRule(buildInput({ rule, recs: ["hire", "hire", "maybe"] }))).toBe("manual");
  });

  it("supports recCount atMost and exactly", () => {
    const atMost: Rule = {
      steps: [{ match: "all", conditions: [{ type: "recCount", rec: "reject", op: "atMost", value: 1 }], action: "advance" }],
      otherwise: "reject",
    };
    expect(evaluateRule(buildInput({ rule: atMost, recs: ["hire", "reject"] }))).toBe("advance");

    const exactly: Rule = {
      steps: [{ match: "all", conditions: [{ type: "recCount", rec: "hire", op: "exactly", value: 2 }], action: "advance" }],
      otherwise: "manual",
    };
    expect(evaluateRule(buildInput({ rule: exactly, recs: ["hire", "hire"] }))).toBe("advance");
    expect(evaluateRule(buildInput({ rule: exactly, recs: ["hire"] }))).toBe("manual");
  });

  it("recPercent computes share of submitted evaluations", () => {
    const rule: Rule = {
      steps: [{ match: "all", conditions: [{ type: "recPercent", rec: "hire", op: "atLeast", value: 51 }], action: "advance" }],
      otherwise: "manual",
    };
    expect(evaluateRule(buildInput({ rule, recs: ["hire", "hire", "reject"] }))).toBe("advance"); // 66%
    expect(evaluateRule(buildInput({ rule, recs: ["hire", "reject"] }))).toBe("manual"); // 50%
  });

  it("recPercent with zero submissions is treated as 0 percent", () => {
    const rule: Rule = {
      steps: [{ match: "all", conditions: [{ type: "recPercent", rec: "hire", op: "atLeast", value: 1 }], action: "advance" }],
      otherwise: "manual",
    };
    expect(evaluateRule(buildInput({ rule, recs: [undefined] }))).toBe("manual");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- tests/convex/decisionRuleEngine.test.ts`
Expected: FAIL (old engine exports `RuleBranch`/`branches`; `explainRule`, new `Rule` shape, `recCount` not handled).

- [ ] **Step 3: Rewrite the engine with new types and a context builder**

Replace the entire contents of `convex/lib/decisionRuleEngine.ts` with:

```ts
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

// Weighted average of one field across evaluations, optionally restricted to one template.
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

// Weighted average across every score field of every evaluation.
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
      const total = ctx.evaluations.length;
      const pct = total === 0 ? 0 : (recCount(ctx.evaluations, cond.rec) / total) * 100;
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test -- tests/convex/decisionRuleEngine.test.ts`
Expected: PASS (recCount + recPercent describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add convex/lib/decisionRuleEngine.ts tests/convex/decisionRuleEngine.test.ts
git commit -m "feat(engine): new decision-rule model with recCount/recPercent and explainRule"
```

### Task 2: Score conditions (`scoreAvg`, `overallScore`)

**Files:**
- Test: `tests/convex/decisionRuleEngine.test.ts` (append describe block)
- Implementation already present from Task 1 (verify it passes).

- [ ] **Step 1: Append failing/confirming tests for score conditions**

Append to `tests/convex/decisionRuleEngine.test.ts`:

```ts
describe("evaluateRule - scores", () => {
  it("scoreAvg passes when weighted average meets threshold", () => {
    const rule: Rule = {
      steps: [{ match: "all", conditions: [{ type: "scoreAvg", fieldKey: "score", op: "atLeast", value: 3.5 }], action: "advance" }],
      otherwise: "manual",
    };
    const input = buildInput({ rule, recs: ["hire", "hire"], scoreField: { key: "score", values: [5, 3], weight: 2 } });
    expect(evaluateRule(input)).toBe("advance"); // (5+3)/2 = 4
  });

  it("scoreAvg fails when average below threshold", () => {
    const rule: Rule = {
      steps: [{ match: "all", conditions: [{ type: "scoreAvg", fieldKey: "score", op: "atLeast", value: 4 }], action: "advance" }],
      otherwise: "redemo",
    };
    const input = buildInput({ rule, recs: ["hire", "hire"], scoreField: { key: "score", values: [3, 3] } });
    expect(evaluateRule(input)).toBe("redemo");
  });

  it("scoreAvg is unmet when no evaluation contains the field", () => {
    const rule: Rule = {
      steps: [{ match: "all", conditions: [{ type: "scoreAvg", fieldKey: "missing", op: "atLeast", value: 1 }], action: "advance" }],
      otherwise: "manual",
    };
    const input = buildInput({ rule, recs: ["hire"], scoreField: { key: "score", values: [5] } });
    expect(evaluateRule(input)).toBe("manual");
  });

  it("scoreAvg restricted to a formTemplateId only averages that template", () => {
    const rule: Rule = {
      steps: [{ match: "all", conditions: [{ type: "scoreAvg", formTemplateId: "tpl1", fieldKey: "score", op: "atLeast", value: 4 }], action: "advance" }],
      otherwise: "manual",
    };
    const input = buildInput({ rule, recs: ["hire"], scoreField: { key: "score", values: [5] } });
    expect(evaluateRule(input)).toBe("advance");
    const miss: Rule = {
      steps: [{ match: "all", conditions: [{ type: "scoreAvg", formTemplateId: "tplX", fieldKey: "score", op: "atLeast", value: 1 }], action: "advance" }],
      otherwise: "manual",
    };
    expect(evaluateRule(buildInput({ rule: miss, recs: ["hire"], scoreField: { key: "score", values: [5] } }))).toBe("manual");
  });

  it("overallScore averages every score field across evaluations", () => {
    const rule: Rule = {
      steps: [{ match: "all", conditions: [{ type: "overallScore", op: "atLeast", value: 4 }], action: "advance" }],
      otherwise: "manual",
    };
    const input = buildInput({ rule, recs: ["hire", "hire"], scoreField: { key: "score", values: [5, 3] } });
    expect(evaluateRule(input)).toBe("advance"); // mean 4
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `bun run test -- tests/convex/decisionRuleEngine.test.ts`
Expected: PASS (engine from Task 1 already implements these).

- [ ] **Step 3: Commit**

```bash
git add tests/convex/decisionRuleEngine.test.ts
git commit -m "test(engine): cover scoreAvg and overallScore conditions"
```

### Task 3: Role conditions, ANY/ALL, first-match

**Files:**
- Test: `tests/convex/decisionRuleEngine.test.ts` (append describe block)

- [ ] **Step 1: Append tests for roles, match modes, explainRule**

Append to `tests/convex/decisionRuleEngine.test.ts`:

```ts
describe("evaluateRule - roles and match modes", () => {
  it("roleSubmitted allOf requires every listed role to have submitted", () => {
    const rule: Rule = {
      steps: [{ match: "all", conditions: [{ type: "roleSubmitted", mode: "allOf", roles: ["principal", "hod"] }], action: "advance" }],
      otherwise: "manual",
    };
    expect(evaluateRule(buildInput({ rule, recs: ["hire", "hire"], roles: ["principal", "hod"] }))).toBe("advance");
    expect(evaluateRule(buildInput({ rule, recs: ["hire", "hire"], roles: ["principal", "hr_admin"] }))).toBe("manual");
  });

  it("roleSubmitted anyOf needs at least one listed role", () => {
    const rule: Rule = {
      steps: [{ match: "all", conditions: [{ type: "roleSubmitted", mode: "anyOf", roles: ["principal", "hod"] }], action: "advance" }],
      otherwise: "manual",
    };
    expect(evaluateRule(buildInput({ rule, recs: ["hire"], roles: ["hod"] }))).toBe("advance");
  });

  it("roleVerdict matches a specific role's recommendation (veto)", () => {
    const rule: Rule = {
      steps: [{ match: "all", conditions: [{ type: "roleVerdict", role: "principal", rec: "hire" }], action: "advance" }],
      otherwise: "manual",
    };
    expect(evaluateRule(buildInput({ rule, recs: ["hire", "reject"], roles: ["principal", "teacher"] }))).toBe("advance");
    expect(evaluateRule(buildInput({ rule, recs: ["reject", "hire"], roles: ["principal", "teacher"] }))).toBe("manual");
  });

  it("match all requires every condition; match any requires one", () => {
    const allRule: Rule = {
      steps: [{
        match: "all",
        conditions: [
          { type: "recCount", rec: "hire", op: "atLeast", value: 2 },
          { type: "recCount", rec: "reject", op: "atMost", value: 0 },
        ],
        action: "advance",
      }],
      otherwise: "manual",
    };
    expect(evaluateRule(buildInput({ rule: allRule, recs: ["hire", "hire", "reject"] }))).toBe("manual");

    const anyRule: Rule = { ...allRule, steps: [{ ...allRule.steps[0], match: "any" }] };
    expect(evaluateRule(buildInput({ rule: anyRule, recs: ["hire", "hire", "reject"] }))).toBe("advance");
  });

  it("first matching step wins", () => {
    const rule: Rule = {
      steps: [
        { match: "all", conditions: [{ type: "recCount", rec: "reject", op: "atMost", value: 5 }], action: "manual" },
        { match: "all", conditions: [{ type: "recCount", rec: "hire", op: "atLeast", value: 1 }], action: "advance" },
      ],
      otherwise: "reject",
    };
    expect(evaluateRule(buildInput({ rule, recs: ["hire"] }))).toBe("manual");
  });

  it("explainRule reports matched step index and per-condition results", () => {
    const rule: Rule = {
      steps: [{
        match: "all",
        conditions: [
          { type: "recCount", rec: "hire", op: "atLeast", value: 2 },
          { type: "recCount", rec: "reject", op: "atMost", value: 0 },
        ],
        action: "advance",
      }],
      otherwise: "manual",
    };
    const ex = explainRule(buildInput({ rule, recs: ["hire", "reject"] }));
    expect(ex.action).toBe("manual");
    expect(ex.matchedStepIndex).toBeNull();
    expect(ex.steps[0].conditions.map((c) => c.passed)).toEqual([false, false]);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `bun run test -- tests/convex/decisionRuleEngine.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/convex/decisionRuleEngine.test.ts
git commit -m "test(engine): cover role conditions, match modes, first-match, explainRule"
```

### Task 4: Plain-English summary helper

**Files:**
- Create: `convex/lib/decisionRuleSummary.ts`
- Create: `tests/convex/decisionRuleSummary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/convex/decisionRuleSummary.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  summarizeRule,
  describeAction,
  describeCondition,
} from "../../convex/lib/decisionRuleSummary";
import type { Rule } from "../../convex/lib/decisionRuleEngine";

describe("describeAction", () => {
  it("maps actions to friendly labels", () => {
    expect(describeAction("advance")).toBe("Move forward");
    expect(describeAction("reject")).toBe("Reject");
    expect(describeAction("redemo")).toBe("Schedule another demo");
    expect(describeAction("manual")).toBe("Let me decide manually");
  });
});

describe("describeCondition", () => {
  it("renders each condition type as a phrase", () => {
    expect(describeCondition({ type: "recCount", rec: "hire", op: "atLeast", value: 2 })).toBe("at least 2 recommended Hire");
    expect(describeCondition({ type: "recCount", rec: "reject", op: "exactly", value: 0 })).toBe("exactly 0 recommended Reject");
    expect(describeCondition({ type: "recPercent", rec: "hire", op: "atLeast", value: 51 })).toBe("at least 51% recommended Hire");
    expect(describeCondition({ type: "overallScore", op: "atLeast", value: 7 })).toBe("overall weighted score is at least 7");
    expect(describeCondition({ type: "roleSubmitted", mode: "allOf", roles: ["principal", "hod"] })).toBe("all of these submitted: Principal, HOD");
    expect(describeCondition({ type: "roleVerdict", role: "principal", rec: "hire" })).toBe("the Principal recommended Hire");
  });

  it("uses a field-label lookup for scoreAvg, falling back to the raw key", () => {
    const cond = { type: "scoreAvg", fieldKey: "subjectKnowledge", op: "atLeast", value: 4 } as const;
    expect(describeCondition(cond, () => "Subject Knowledge")).toBe("average of Subject Knowledge is at least 4");
    expect(describeCondition(cond)).toBe("average of subjectKnowledge is at least 4");
  });
});

describe("summarizeRule", () => {
  it("joins ALL conditions with 'and' and appends the otherwise step", () => {
    const rule: Rule = {
      steps: [{
        match: "all",
        conditions: [
          { type: "recCount", rec: "hire", op: "atLeast", value: 2 },
          { type: "recCount", rec: "reject", op: "atMost", value: 0 },
        ],
        action: "advance",
      }],
      otherwise: "manual",
    };
    expect(summarizeRule(rule)).toBe(
      "Once everyone finishes: if at least 2 recommended Hire and at most 0 recommended Reject, Move forward; otherwise, Let me decide manually.",
    );
  });

  it("joins ANY conditions with 'or'", () => {
    const rule: Rule = {
      steps: [{
        match: "any",
        conditions: [
          { type: "roleVerdict", role: "principal", rec: "hire" },
          { type: "recPercent", rec: "hire", op: "atLeast", value: 70 },
        ],
        action: "advance",
      }],
      otherwise: "reject",
    };
    expect(summarizeRule(rule)).toBe(
      "Once everyone finishes: if the Principal recommended Hire or at least 70% recommended Hire, Move forward; otherwise, Reject.",
    );
  });

  it("renders an otherwise-only rule with no steps", () => {
    expect(summarizeRule({ steps: [], otherwise: "manual" })).toBe(
      "Once everyone finishes: Let me decide manually.",
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- tests/convex/decisionRuleSummary.test.ts`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement the summary helper**

Create `convex/lib/decisionRuleSummary.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test -- tests/convex/decisionRuleSummary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/decisionRuleSummary.ts tests/convex/decisionRuleSummary.test.ts
git commit -m "feat(engine): add shared plain-English decision-rule summary helper"
```

---

## Phase 2: Convex schema, validators, wiring

> **Why a purge first:** Convex validates all existing documents when a new schema is pushed. Old `decisionRules` rows still carry `branches`/`fallback` and would block the push to the new `steps`/`otherwise` shape. This project is dev-only with a clean-cutover policy, so we delete legacy rows before changing the schema rather than writing a dual-shape migration.

### Task 5: Purge legacy decision rules (one-time dev op)

**Files:**
- Modify: `convex/decisionRules.ts` (add a temporary internal mutation)

- [ ] **Step 1: Add a purge mutation under the current schema**

Add to the bottom of `convex/decisionRules.ts` (keep the existing `branches` validators for now):

```ts
import { internalMutation } from "./_generated/server";

// One-time dev cleanup before the steps/otherwise schema migration. Remove after running.
export const _devPurgeLegacyRules = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("decisionRules").collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return rows.length;
  },
});
```

- [ ] **Step 2: Ensure Convex dev is running and run the purge**

Run (in the repo root, with `bunx convex dev` already running in another terminal):
```bash
bunx convex run decisionRules:_devPurgeLegacyRules
```
Expected: prints the number of deleted rows (often `0` in a fresh dev DB). No error.

- [ ] **Step 3: Commit**

```bash
git add convex/decisionRules.ts
git commit -m "chore(convex): add one-time legacy decision-rule purge"
```

### Task 6: New `decisionRules` schema, validators, create/update

**Files:**
- Rewrite: `tests/convex/decisionRules.test.ts`
- Modify: `convex/schema.ts:510-539`
- Modify: `convex/decisionRules.ts`

- [ ] **Step 1: Rewrite the decisionRules test for the new shape**

Replace the entire contents of `tests/convex/decisionRules.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as decisionRules from "../../convex/decisionRules";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "decisionRules.ts": async () => decisionRules,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

async function setupSchool(t: ReturnType<typeof convexTest>) {
  return await t.mutation("schools:create" as any, {
    name: "S", board: "CBSE", city: "X", state: "Y",
  } as any);
}

const advanceOn2Hires = {
  match: "all" as const,
  conditions: [{ type: "recCount" as const, rec: "hire" as const, op: "atLeast" as const, value: 2 }],
  action: "advance" as const,
};

describe("decisionRules", () => {
  it("creates a rule with steps/otherwise and lists it", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "Standard hire path", steps: [advanceOn2Hires], otherwise: "manual",
    } as any);
    expect(ruleId).toBeDefined();
    const list = await t.query("decisionRules:list" as any, { schoolId } as any);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Standard hire path");
    expect(list[0].isActive).toBe(true);
  });

  it("update replaces steps and otherwise", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "r1", steps: [advanceOn2Hires], otherwise: "manual",
    } as any);
    await t.mutation("decisionRules:update" as any, {
      ruleId, name: "r1 renamed",
      steps: [{ match: "all", conditions: [{ type: "recCount", rec: "hire", op: "atLeast", value: 3 }], action: "reject" }],
      otherwise: "redemo",
    } as any);
    const got = await t.query("decisionRules:get" as any, { ruleId } as any);
    expect(got.name).toBe("r1 renamed");
    expect(got.steps[0].conditions[0].value).toBe(3);
    expect(got.otherwise).toBe("redemo");
  });

  it("accepts every condition type", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const id = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "all types",
      steps: [{
        match: "any",
        conditions: [
          { type: "recCount", rec: "hire", op: "exactly", value: 1 },
          { type: "recPercent", rec: "reject", op: "atMost", value: 25 },
          { type: "scoreAvg", fieldKey: "subjectKnowledge", op: "atLeast", value: 4 },
          { type: "overallScore", op: "atLeast", value: 7 },
          { type: "roleSubmitted", mode: "allOf", roles: ["principal", "hod"] },
          { type: "roleVerdict", role: "principal", rec: "hire" },
        ],
        action: "advance",
      }],
      otherwise: "manual",
    } as any);
    expect(id).toBeDefined();
  });

  it("setActive toggles isActive", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "r", steps: [], otherwise: "manual",
    } as any);
    await t.mutation("decisionRules:setActive" as any, { ruleId, active: false } as any);
    const got = await t.query("decisionRules:get" as any, { ruleId } as any);
    expect(got.isActive).toBe(false);
  });

  it("remove deletes the row", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "r", steps: [], otherwise: "manual",
    } as any);
    await t.mutation("decisionRules:remove" as any, { ruleId } as any);
    expect(await t.query("decisionRules:list" as any, { schoolId } as any)).toHaveLength(0);
  });

  it("listActive returns only active rules", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const a = await t.mutation("decisionRules:create" as any, { schoolId, name: "a", steps: [], otherwise: "manual" } as any);
    const b = await t.mutation("decisionRules:create" as any, { schoolId, name: "b", steps: [], otherwise: "manual" } as any);
    await t.mutation("decisionRules:setActive" as any, { ruleId: b, active: false } as any);
    const active = await t.query("decisionRules:listActive" as any, { schoolId } as any);
    expect(active.map((r: any) => r._id)).toEqual([a]);
  });

  it("rejects empty name", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    await expect(t.mutation("decisionRules:create" as any, {
      schoolId, name: "  ", steps: [], otherwise: "manual",
    } as any)).rejects.toThrow(/name/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- tests/convex/decisionRules.test.ts`
Expected: FAIL (create/update still expect `branches`/`fallback`; schema rejects `steps`).

- [ ] **Step 3: Update the schema table**

In `convex/schema.ts`, replace the `decisionRules` table definition (lines ~510-539) with:

```ts
  decisionRules: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    steps: v.array(v.object({
      match: v.union(v.literal("all"), v.literal("any")),
      conditions: v.array(decisionConditionValidator),
      action: decisionActionValidator,
    })),
    otherwise: decisionActionValidator,
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_schoolId", ["schoolId"]),
```

Add these shared validators near the top of `convex/schema.ts` (after the imports, before `defineSchema`):

```ts
const decisionActionValidator = v.union(
  v.literal("advance"),
  v.literal("reject"),
  v.literal("redemo"),
  v.literal("manual"),
);

const decisionRecValidator = v.union(v.literal("hire"), v.literal("maybe"), v.literal("reject"));
const decisionRoleValidator = v.union(
  v.literal("principal"),
  v.literal("hod"),
  v.literal("hr_admin"),
  v.literal("teacher"),
);
const decisionRangeOp = v.union(v.literal("atLeast"), v.literal("atMost"));
const decisionCountOp = v.union(v.literal("atLeast"), v.literal("atMost"), v.literal("exactly"));

const decisionConditionValidator = v.union(
  v.object({ type: v.literal("recCount"), rec: decisionRecValidator, op: decisionCountOp, value: v.number() }),
  v.object({ type: v.literal("recPercent"), rec: decisionRecValidator, op: decisionRangeOp, value: v.number() }),
  v.object({ type: v.literal("scoreAvg"), formTemplateId: v.optional(v.string()), fieldKey: v.string(), op: decisionRangeOp, value: v.number() }),
  v.object({ type: v.literal("overallScore"), op: decisionRangeOp, value: v.number() }),
  v.object({ type: v.literal("roleSubmitted"), mode: v.union(v.literal("allOf"), v.literal("anyOf")), roles: v.array(decisionRoleValidator) }),
  v.object({ type: v.literal("roleVerdict"), role: decisionRoleValidator, rec: decisionRecValidator }),
);
```

- [ ] **Step 4: Rewrite the decisionRules validators and mutations**

In `convex/decisionRules.ts`, replace `BRANCH_VALIDATOR` and `ACTION_VALIDATOR` (and their use in `create`/`update`) with a `STEP_VALIDATOR`. Remove the `_devPurgeLegacyRules` mutation from Task 5 now that the purge is done. The top of the file becomes:

```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const REC = v.union(v.literal("hire"), v.literal("maybe"), v.literal("reject"));
const ROLE = v.union(v.literal("principal"), v.literal("hod"), v.literal("hr_admin"), v.literal("teacher"));
const RANGE_OP = v.union(v.literal("atLeast"), v.literal("atMost"));
const COUNT_OP = v.union(v.literal("atLeast"), v.literal("atMost"), v.literal("exactly"));

const ACTION_VALIDATOR = v.union(
  v.literal("advance"),
  v.literal("reject"),
  v.literal("redemo"),
  v.literal("manual"),
);

const CONDITION_VALIDATOR = v.union(
  v.object({ type: v.literal("recCount"), rec: REC, op: COUNT_OP, value: v.number() }),
  v.object({ type: v.literal("recPercent"), rec: REC, op: RANGE_OP, value: v.number() }),
  v.object({ type: v.literal("scoreAvg"), formTemplateId: v.optional(v.string()), fieldKey: v.string(), op: RANGE_OP, value: v.number() }),
  v.object({ type: v.literal("overallScore"), op: RANGE_OP, value: v.number() }),
  v.object({ type: v.literal("roleSubmitted"), mode: v.union(v.literal("allOf"), v.literal("anyOf")), roles: v.array(ROLE) }),
  v.object({ type: v.literal("roleVerdict"), role: ROLE, rec: REC }),
);

const STEP_VALIDATOR = v.array(v.object({
  match: v.union(v.literal("all"), v.literal("any")),
  conditions: v.array(CONDITION_VALIDATOR),
  action: ACTION_VALIDATOR,
}));
```

Then update `create` and `update` to use `steps`/`otherwise`:

```ts
export const create = mutation({
  args: { schoolId: v.id("schools"), name: v.string(), steps: STEP_VALIDATOR, otherwise: ACTION_VALIDATOR },
  handler: async (ctx, args) => {
    if (!args.name.trim()) throw new Error("Rule name cannot be empty");
    return await ctx.db.insert("decisionRules", {
      schoolId: args.schoolId,
      name: args.name,
      steps: args.steps,
      otherwise: args.otherwise,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    ruleId: v.id("decisionRules"),
    name: v.optional(v.string()),
    steps: v.optional(STEP_VALIDATOR),
    otherwise: v.optional(ACTION_VALIDATOR),
  },
  handler: async (ctx, { ruleId, name, steps, otherwise }) => {
    const r = await ctx.db.get(ruleId);
    if (!r) throw new Error("Rule not found");
    const patch: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!name.trim()) throw new Error("Rule name cannot be empty");
      patch.name = name;
    }
    if (steps !== undefined) patch.steps = steps;
    if (otherwise !== undefined) patch.otherwise = otherwise;
    if (Object.keys(patch).length === 0) return;
    await ctx.db.patch(ruleId, patch);
  },
});
```

`list`, `listActive`, `get`, `setActive`, `remove` are unchanged.

- [ ] **Step 5: Run to verify it passes**

Run: `bun run test -- tests/convex/decisionRules.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts convex/decisionRules.ts tests/convex/decisionRules.test.ts
git commit -m "feat(convex): migrate decisionRules to steps/otherwise model"
```

### Task 7: Wire `decisions.ts` to the new rule shape

**Files:**
- Modify: `convex/decisions.ts`
- Modify: `tests/convex/decisions.test.ts` (fixtures to new shape)

- [ ] **Step 1: Update the decisions integration test fixtures**

In `tests/convex/decisions.test.ts`, change every `decisionRules:create` payload from `branches`/`fallback` to `steps`/`otherwise`. The rule on lines ~57-60 becomes:

```ts
  const ruleId = await t.mutation("decisionRules:create" as any, {
    schoolId,
    name: "auto-advance on 2 hires",
    steps: [{ match: "all", conditions: [{ type: "recCount", rec: "hire", op: "atLeast", value: 2 }], action: "advance" }],
    otherwise: "manual",
  } as any);
```

Apply the same conversion to any other rule created later in this file (search for `branches:` and replace each with the equivalent `steps`/`otherwise`; a bare `branches: []` becomes `steps: [], otherwise: "manual"`). The test titled "falls through to manual fallback when no branch matches" keeps its assertions; only the rule payload shape changes.

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- tests/convex/decisions.test.ts`
Expected: FAIL (`decisions.ts` still reads `rule.branches`/`rule.fallback`).

- [ ] **Step 3: Extract a shared input builder and use the new shape**

In `convex/decisions.ts`, refactor so the snapshot building is reusable by the preview query (Task 8). Replace the body from line 33 (`const rule = await ctx.db.get(...)`) through the `const input: RuleInput = {...}` block with a call to a new exported helper, and add the helper:

```ts
export async function buildRuleInputForDemo(
  ctx: DbCtx,
  rule: { steps: any[]; otherwise: any },
  nonCancelled: Doc<"evaluationInvites">[],
): Promise<RuleInput> {
  const evaluations: Doc<"evaluations">[] = [];
  const templateIds = new Set<string>();
  for (const inv of nonCancelled) {
    if (inv.status !== "submitted") continue;
    const evs: Doc<"evaluations">[] = await ctx.db
      .query("evaluations")
      .withIndex("by_inviteId", (q: any) => q.eq("inviteId", inv._id))
      .collect();
    for (const e of evs) {
      evaluations.push(e);
      templateIds.add(e.formTemplateId as unknown as string);
    }
  }
  const templates: Doc<"formTemplates">[] = [];
  for (const id of templateIds) {
    const t = await ctx.db.get(id as Id<"formTemplates">);
    if (t) templates.push(t);
  }
  return {
    rule: { steps: rule.steps, otherwise: rule.otherwise },
    invites: nonCancelled.map((i) => ({
      _id: i._id as unknown as string,
      evaluatorRole: i.evaluatorRole,
      status: i.status,
      formTemplateId: i.formTemplateId as unknown as string,
    })),
    evaluations: evaluations.map((e) => ({
      _id: e._id as unknown as string,
      inviteId: e.inviteId as unknown as string,
      formTemplateId: e.formTemplateId as unknown as string,
      responses: e.responses as Record<string, number | string>,
      recommendation: e.recommendation,
    })),
    templates: templates.map((t) => ({
      _id: t._id as unknown as string,
      fields: t.fields.map((f) => ({ key: f.key, type: f.type, weight: f.weight })),
    })),
  };
}
```

Then in `maybeApplyDecision`, replace the inline snapshot block with:

```ts
  const input = await buildRuleInputForDemo(ctx, rule, nonCancelled);
  const action = evaluateRule(input);
```

Keep the rest of `maybeApplyDecision` (the `ctx.db.patch`, stage updates, scheduler call) unchanged.

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test -- tests/convex/decisions.test.ts tests/convex/demoSessions-decision.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/decisions.ts tests/convex/decisions.test.ts
git commit -m "refactor(convex): wire decisions to steps/otherwise via shared input builder"
```

### Task 8: Preview queries for "test against a past demo"

**Files:**
- Modify: `convex/decisionRules.ts` (add `recentDecidedDemos`, `previewRuleOnDemo`)
- Test: `tests/convex/decisionRules.test.ts` (append preview tests)

- [ ] **Step 1: Append failing preview tests**

Append to `tests/convex/decisionRules.test.ts` a test that seeds a demo with submitted evaluations and previews a draft rule. Reuse the richer setup from `tests/convex/decisions.test.ts` (copy its `setup` helper and module list into this file, or import shared seed helpers if they exist). The key assertions:

```ts
describe("decisionRules preview", () => {
  it("previewRuleOnDemo returns the action and per-step explanation for a draft rule", async () => {
    // ... seed school, application, demo with 2 submitted 'hire' invites (see decisions.test.ts setup) ...
    // const { demoId, schoolId } = await seedDecidedDemo(t);
    const result = await t.query("decisionRules:previewRuleOnDemo" as any, {
      demoId,
      rule: {
        steps: [{ match: "all", conditions: [{ type: "recCount", rec: "hire", op: "atLeast", value: 2 }], action: "advance" }],
        otherwise: "manual",
      },
    } as any);
    expect(result.action).toBe("advance");
    expect(result.matchedStepIndex).toBe(0);
    expect(result.steps[0].conditions[0].passed).toBe(true);
  });

  it("recentDecidedDemos lists completed demos for the school", async () => {
    // const { schoolId } = await seedDecidedDemo(t);
    const demos = await t.query("decisionRules:recentDecidedDemos" as any, { schoolId } as any);
    expect(demos.length).toBeGreaterThan(0);
    expect(demos[0]).toHaveProperty("demoId");
    expect(demos[0]).toHaveProperty("label");
  });
});
```

> Implementation note for the engineer: write a `seedDecidedDemo(t)` helper in this test file modeled on `tests/convex/decisions.test.ts` `setup` (create school, candidate, job, application, demo, two invites set to `submitted`, two evaluations with `recommendation: "hire"`). Add `demoSessions`, `evaluationInvites`, `evaluations`, `applications`, `jobs`, `candidates`, `users`, `formTemplates`, `decisions` to the `modules` map (copy from `decisions.test.ts`).

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- tests/convex/decisionRules.test.ts`
Expected: FAIL (queries not defined).

- [ ] **Step 3: Implement the preview queries**

Add to `convex/decisionRules.ts`:

```ts
import { explainRule } from "./lib/decisionRuleEngine";
import { buildRuleInputForDemo } from "./decisions";

const PREVIEW_RULE_VALIDATOR = v.object({ steps: STEP_VALIDATOR, otherwise: ACTION_VALIDATOR });

export const recentDecidedDemos = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) => {
    const demos = await ctx.db
      .query("demoSessions")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId))
      .collect();
    const completed = demos
      .filter((d) => d.status === "completed")
      .sort((a, b) => b.scheduledAt - a.scheduledAt)
      .slice(0, 10);
    const out = [];
    for (const d of completed) {
      const app = await ctx.db.get(d.applicationId);
      const candidate = app ? await ctx.db.get(app.candidateId) : null;
      out.push({
        demoId: d._id,
        label: `${candidate?.name ?? "Candidate"} - ${new Date(d.scheduledAt).toLocaleDateString("en-IN")}`,
      });
    }
    return out;
  },
});

export const previewRuleOnDemo = query({
  args: { demoId: v.id("demoSessions"), rule: PREVIEW_RULE_VALIDATOR },
  handler: async (ctx, { demoId, rule }) => {
    const demo = await ctx.db.get(demoId);
    if (!demo) throw new Error("Demo not found");
    const allInvites = await ctx.db
      .query("evaluationInvites")
      .withIndex("by_demoSessionId", (q) => q.eq("demoSessionId", demoId))
      .collect();
    const nonCancelled = allInvites.filter((i) => i.status !== "cancelled");
    const input = await buildRuleInputForDemo({ db: ctx.db }, rule, nonCancelled);
    return explainRule(input);
  },
});
```

> Note: `recentDecidedDemos` relies on a `by_schoolId` index on `demoSessions`. If it does not exist, add `.index("by_schoolId", ["schoolId"])` to the `demoSessions` table in `convex/schema.ts` (check first with: `grep -n "demoSessions" convex/schema.ts` and inspect its indexes). `candidates` documents expose `name`; confirm with `grep -n "name" convex/schema.ts` near the `candidates` table.

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test -- tests/convex/decisionRules.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/decisionRules.ts convex/schema.ts tests/convex/decisionRules.test.ts
git commit -m "feat(convex): add decision-rule preview queries for past demos"
```

---

## Phase 3: Web editor rebuild

All web components reuse the pure types from `@/convex/lib/decisionRuleEngine`
(`Condition`, `OutcomeStep`, `Rule`, `RuleAction`, `EvaluatorRole`) and the
summary from `@/convex/lib/decisionRuleSummary`. Styling follows the existing
`branch-row.tsx` patterns and uses design tokens only (no raw values).

**Verification:** these components are interaction-driven, so they are verified
in the running app with the preview tools, not unit tests. Start the dev server
once with `preview_start` and keep it running across Phase 3.

### Task 9: Condition defaults and starter templates

**Files:**
- Create: `components/settings/decision-rules/starter-templates.ts`
- Test: `tests/convex/decisionRuleSummary.test.ts` (append a starter sanity test)

- [ ] **Step 1: Append a test that starter templates summarize cleanly**

Append to `tests/convex/decisionRuleSummary.test.ts`:

```ts
import { STARTER_TEMPLATES, defaultCondition } from "../../components/settings/decision-rules/starter-templates";

describe("starter templates", () => {
  it("every starter summarizes to a non-empty sentence", () => {
    for (const s of STARTER_TEMPLATES) {
      const text = summarizeRule(s.rule);
      expect(text.startsWith("Once everyone finishes:")).toBe(true);
      expect(text.length).toBeGreaterThan(30);
    }
  });

  it("defaultCondition produces a valid condition for each type", () => {
    expect(defaultCondition("recCount")).toMatchObject({ type: "recCount", rec: "hire", op: "atLeast" });
    expect(defaultCondition("roleVerdict")).toMatchObject({ type: "roleVerdict", role: "principal", rec: "hire" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test -- tests/convex/decisionRuleSummary.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create the starter templates and default factory**

Create `components/settings/decision-rules/starter-templates.ts`:

```ts
import type { Condition, Rule } from "@/convex/lib/decisionRuleEngine";

export type ConditionType = Condition["type"];

export function defaultCondition(type: ConditionType): Condition {
  switch (type) {
    case "recCount":
      return { type, rec: "hire", op: "atLeast", value: 1 };
    case "recPercent":
      return { type, rec: "hire", op: "atLeast", value: 50 };
    case "scoreAvg":
      return { type, fieldKey: "", op: "atLeast", value: 3 };
    case "overallScore":
      return { type, op: "atLeast", value: 3 };
    case "roleSubmitted":
      return { type, mode: "allOf", roles: [] };
    case "roleVerdict":
      return { type, role: "principal", rec: "hire" };
  }
}

export const STARTER_TEMPLATES: { id: string; name: string; description: string; rule: Rule }[] = [
  {
    id: "standard",
    name: "Standard hire path",
    description: "Move forward when at least 2 recommend Hire and nobody recommends Reject.",
    rule: {
      steps: [{
        match: "all",
        conditions: [
          { type: "recCount", rec: "hire", op: "atLeast", value: 2 },
          { type: "recCount", rec: "reject", op: "atMost", value: 0 },
        ],
        action: "advance",
      }],
      otherwise: "manual",
    },
  },
  {
    id: "strict",
    name: "Strict (unanimous only)",
    description: "Move forward only when everyone recommends Hire; reject if anyone recommends Reject.",
    rule: {
      steps: [
        { match: "all", conditions: [{ type: "recPercent", rec: "reject", op: "atLeast", value: 1 }], action: "reject" },
        { match: "all", conditions: [{ type: "recPercent", rec: "hire", op: "atLeast", value: 100 }], action: "advance" },
      ],
      otherwise: "manual",
    },
  },
  {
    id: "senior-veto",
    name: "Senior veto",
    description: "If the Principal recommends Hire, move forward; if the Principal recommends Reject, reject.",
    rule: {
      steps: [
        { match: "all", conditions: [{ type: "roleVerdict", role: "principal", rec: "reject" }], action: "reject" },
        { match: "all", conditions: [{ type: "roleVerdict", role: "principal", rec: "hire" }], action: "advance" },
      ],
      otherwise: "manual",
    },
  },
];
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test -- tests/convex/decisionRuleSummary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/settings/decision-rules/starter-templates.ts tests/convex/decisionRuleSummary.test.ts
git commit -m "feat(web): decision-rule condition defaults and starter templates"
```

### Task 10: Score-field picker (grouped by form)

**Files:**
- Create: `components/settings/decision-rules/field-picker.tsx`

- [ ] **Step 1: Create the field picker**

Create `components/settings/decision-rules/field-picker.tsx`:

```tsx
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
```

> Note: `scoreAvg` here always sets a `formTemplateId` (the field is chosen from a specific form). That matches the engine, which restricts the average to that template when `formTemplateId` is present.

- [ ] **Step 2: Verify it compiles**

Run: `bun run build` (or rely on the dev server from `preview_start` showing no type errors in `preview_logs`).
Expected: no TypeScript errors referencing `field-picker.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/settings/decision-rules/field-picker.tsx
git commit -m "feat(web): grouped score-field picker for decision rules"
```

### Task 11: Condition row and condition picker

**Files:**
- Create: `components/settings/decision-rules/condition-row.tsx`
- Create: `components/settings/decision-rules/condition-picker.tsx`

- [ ] **Step 1: Create the condition row**

Create `components/settings/decision-rules/condition-row.tsx`:

```tsx
"use client";

import type { Condition, EvaluatorRole, Recommendation } from "@/convex/lib/decisionRuleEngine";
import { Button, Input, Select } from "@/components/ui";
import { FieldPicker } from "./field-picker";

const REC_OPTS = [
  { value: "hire", label: "Hire" },
  { value: "maybe", label: "Maybe" },
  { value: "reject", label: "Reject" },
];
const ROLE_OPTS = [
  { value: "principal", label: "Principal" },
  { value: "hod", label: "HOD" },
  { value: "hr_admin", label: "HR Admin" },
  { value: "teacher", label: "Teacher" },
];
const COUNT_OPTS = [
  { value: "atLeast", label: "at least" },
  { value: "atMost", label: "at most" },
  { value: "exactly", label: "exactly" },
];
const RANGE_OPTS = [
  { value: "atLeast", label: "at least" },
  { value: "atMost", label: "at most" },
];

interface ConditionRowProps {
  condition: Condition;
  schoolId: string;
  onChange: (next: Condition) => void;
  onRemove: () => void;
}

export function ConditionRow({ condition, schoolId, onChange, onRemove }: ConditionRowProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-body-s text-ink">
      <div className="flex-1 flex items-center gap-2 flex-wrap">{renderBody()}</div>
      <Button variant="ghost" size="sm" iconLeft="X" onClick={onRemove} aria-label="Remove condition">
        <span className="sr-only">Remove condition</span>
      </Button>
    </div>
  );

  function num(v: string) {
    return Number(v) || 0;
  }

  function renderBody() {
    switch (condition.type) {
      case "recCount":
        return (
          <>
            <Select value={condition.op} options={COUNT_OPTS} onChange={(op) => onChange({ ...condition, op: op as any })} className="w-28" />
            <Input type="number" min={0} max={50} value={condition.value} onChange={(e) => onChange({ ...condition, value: num(e.target.value) })} className="w-16" size="sm" />
            <span>recommended</span>
            <Select value={condition.rec} options={REC_OPTS} onChange={(rec) => onChange({ ...condition, rec: rec as Recommendation })} className="w-28" />
          </>
        );
      case "recPercent":
        return (
          <>
            <Select value={condition.op} options={RANGE_OPTS} onChange={(op) => onChange({ ...condition, op: op as any })} className="w-28" />
            <Input type="number" min={0} max={100} value={condition.value} onChange={(e) => onChange({ ...condition, value: num(e.target.value) })} className="w-16" size="sm" />
            <span>% recommended</span>
            <Select value={condition.rec} options={REC_OPTS} onChange={(rec) => onChange({ ...condition, rec: rec as Recommendation })} className="w-28" />
          </>
        );
      case "scoreAvg":
        return (
          <>
            <span>average of</span>
            <FieldPicker
              schoolId={schoolId}
              value={{ formTemplateId: condition.formTemplateId, fieldKey: condition.fieldKey }}
              onChange={(sel) => onChange({ ...condition, formTemplateId: sel.formTemplateId, fieldKey: sel.fieldKey })}
            />
            <span>is</span>
            <Select value={condition.op} options={RANGE_OPTS} onChange={(op) => onChange({ ...condition, op: op as any })} className="w-28" />
            <Input type="number" step="0.1" min={0} value={condition.value} onChange={(e) => onChange({ ...condition, value: num(e.target.value) })} className="w-20" size="sm" />
          </>
        );
      case "overallScore":
        return (
          <>
            <span>overall weighted score is</span>
            <Select value={condition.op} options={RANGE_OPTS} onChange={(op) => onChange({ ...condition, op: op as any })} className="w-28" />
            <Input type="number" step="0.1" min={0} value={condition.value} onChange={(e) => onChange({ ...condition, value: num(e.target.value) })} className="w-20" size="sm" />
          </>
        );
      case "roleSubmitted":
        return (
          <>
            <Select value={condition.mode} options={[{ value: "allOf", label: "all of" }, { value: "anyOf", label: "any of" }]} onChange={(m) => onChange({ ...condition, mode: m as any })} className="w-28" />
            <span>these submitted:</span>
            {ROLE_OPTS.map((r) => {
              const on = condition.roles.includes(r.value as EvaluatorRole);
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    const set = new Set(condition.roles);
                    if (on) set.delete(r.value as EvaluatorRole);
                    else set.add(r.value as EvaluatorRole);
                    onChange({ ...condition, roles: Array.from(set) });
                  }}
                  className={"rounded-full px-2.5 py-1 text-caption transition-colors duration-fast " + (on ? "bg-accent text-surface-canvas" : "bg-surface border border-hairline-strong text-ink-secondary hover:bg-accent-soft")}
                >
                  {r.label}
                </button>
              );
            })}
          </>
        );
      case "roleVerdict":
        return (
          <>
            <span>the</span>
            <Select value={condition.role} options={ROLE_OPTS} onChange={(role) => onChange({ ...condition, role: role as EvaluatorRole })} className="w-32" />
            <span>recommended</span>
            <Select value={condition.rec} options={REC_OPTS} onChange={(rec) => onChange({ ...condition, rec: rec as Recommendation })} className="w-28" />
          </>
        );
    }
  }
}
```

- [ ] **Step 2: Create the condition picker**

Create `components/settings/decision-rules/condition-picker.tsx`:

```tsx
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
```

> Note: confirm `DropdownItem` accepts an `onSelect` prop (check `components/ui/dropdown.tsx`). If the API differs (e.g. `onClick`), adapt the prop name accordingly.

- [ ] **Step 3: Verify it compiles**

Check `preview_logs` for type errors in these two files; fix any prop mismatches against the real `Select`/`Dropdown` APIs.

- [ ] **Step 4: Commit**

```bash
git add components/settings/decision-rules/condition-row.tsx components/settings/decision-rules/condition-picker.tsx
git commit -m "feat(web): sentence-style condition row and add-condition picker"
```

### Task 12: Outcome step (replaces branch row)

**Files:**
- Create: `components/settings/decision-rules/outcome-step.tsx`

- [ ] **Step 1: Create the outcome step**

Create `components/settings/decision-rules/outcome-step.tsx`:

```tsx
"use client";

import type { Condition, OutcomeStep, RuleAction } from "@/convex/lib/decisionRuleEngine";
import { Badge, Button, Select } from "@/components/ui";
import { ConditionRow } from "./condition-row";
import { ConditionPicker } from "./condition-picker";

const ACTION_OPTS = [
  { value: "advance", label: "Move forward" },
  { value: "reject", label: "Reject" },
  { value: "redemo", label: "Schedule another demo" },
  { value: "manual", label: "Let me decide manually" },
];

interface OutcomeStepEditorProps {
  step: OutcomeStep;
  index: number;
  schoolId: string;
  onChange: (next: OutcomeStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function OutcomeStepEditor({
  step, index, schoolId, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: OutcomeStepEditorProps) {
  const setCondition = (i: number, next: Condition) =>
    onChange({ ...step, conditions: step.conditions.map((c, j) => (j === i ? next : c)) });
  const removeCondition = (i: number) =>
    onChange({ ...step, conditions: step.conditions.filter((_, j) => j !== i) });

  return (
    <div className="rounded-apple border border-hairline bg-surface p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="neutral">Step {index + 1}</Badge>
        <span className="text-caption text-ink-secondary">When</span>
        <Select
          value={step.match}
          options={[{ value: "all", label: "ALL" }, { value: "any", label: "ANY" }]}
          onChange={(m) => onChange({ ...step, match: m as "all" | "any" })}
          className="w-24"
        />
        <span className="text-caption text-ink-secondary">of these are true:</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" iconLeft="ChevronUp" disabled={isFirst} onClick={onMoveUp} aria-label="Move up"><span className="sr-only">Move up</span></Button>
        <Button variant="ghost" size="sm" iconLeft="ChevronDown" disabled={isLast} onClick={onMoveDown} aria-label="Move down"><span className="sr-only">Move down</span></Button>
        <Button variant="ghost" size="sm" iconLeft="Trash2" onClick={onRemove} aria-label="Remove step"><span className="sr-only">Remove step</span></Button>
      </div>

      {step.conditions.length === 0 ? (
        <p className="text-body-s text-ink-tertiary">No conditions yet. This step would always match. Add at least one condition.</p>
      ) : (
        <div className="space-y-2">
          {step.conditions.map((c, i) => (
            <ConditionRow key={i} condition={c} schoolId={schoolId} onChange={(next) => setCondition(i, next)} onRemove={() => removeCondition(i)} />
          ))}
        </div>
      )}

      <ConditionPicker onAdd={(c) => onChange({ ...step, conditions: [...step.conditions, c] })} />

      <div className="flex items-center gap-2 pt-2 border-t border-hairline">
        <span className="text-caption text-ink-secondary">then</span>
        <Select value={step.action} options={ACTION_OPTS} onChange={(a) => onChange({ ...step, action: a as RuleAction })} className="flex-1 max-w-xs" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles** (check `preview_logs`).

- [ ] **Step 3: Commit**

```bash
git add components/settings/decision-rules/outcome-step.tsx
git commit -m "feat(web): outcome-step editor with ALL/ANY and action"
```

### Task 13: Rule summary card and rule tester

**Files:**
- Create: `components/settings/decision-rules/rule-summary.tsx`
- Create: `components/settings/decision-rules/rule-tester.tsx`

- [ ] **Step 1: Create the summary card**

Create `components/settings/decision-rules/rule-summary.tsx`:

```tsx
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
```

- [ ] **Step 2: Create the rule tester**

Create `components/settings/decision-rules/rule-tester.tsx`:

```tsx
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
```

> Note: confirm the `Icon` set includes `Sparkles` and `FlaskConical` (check `components/ui/icon.tsx`). If `FlaskConical` is absent, use an available icon such as `Beaker` or `Play`.

- [ ] **Step 3: Verify both compile** (check `preview_logs`).

- [ ] **Step 4: Commit**

```bash
git add components/settings/decision-rules/rule-summary.tsx components/settings/decision-rules/rule-tester.tsx
git commit -m "feat(web): live rule summary card and past-demo tester"
```

### Task 14: Rebuild the rule editor and wire the page

**Files:**
- Modify: `components/settings/decision-rules/rule-editor.tsx` (full rewrite)
- Delete: `components/settings/decision-rules/branch-row.tsx`

- [ ] **Step 1: Rewrite the rule editor**

Replace the entire contents of `components/settings/decision-rules/rule-editor.tsx` with:

```tsx
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
```

- [ ] **Step 2: Delete the obsolete branch row**

Run:
```bash
git rm components/settings/decision-rules/branch-row.tsx
```
Then check nothing else imports it:
```bash
grep -rn "branch-row" app components --include=*.tsx
```
Expected: no remaining references on web (mobile has its own copy, handled in Phase 4).

- [ ] **Step 3: Verify in the running app**

Using preview tools (server already started):
- `preview_eval` navigate to `/dashboard/settings/decision-rules/new`.
- `preview_snapshot`: confirm name field, the live summary card, the three starter examples, "Add step", "Otherwise" select, and the tester are present.
- Click a starter, add a step, add a condition of each type via the picker, change ALL/ANY, and confirm the summary card updates and shows readable text (no `fieldKey` raw values once a score field is chosen).
- Pick a demo in the tester and confirm a result with per-condition PASS/FAIL renders (requires at least one completed demo seeded; use `scripts/seed-eval-demo.ts` via `bun run seed:eval-demo` if needed).
- Save the rule; confirm the success toast and redirect.
- Check `preview_console_logs` and `preview_logs` for errors.

- [ ] **Step 4: Commit**

```bash
git add components/settings/decision-rules/rule-editor.tsx
git commit -m "feat(web): rebuild decision-rule editor as a plain-language sentence builder"
```

### Task 15: List page uses the plain-English summary

**Files:**
- Modify: `app/dashboard/settings/decision-rules/page.tsx`

- [ ] **Step 1: Replace the branch-count subtitle with a summary**

In `app/dashboard/settings/decision-rules/page.tsx`, add imports:

```tsx
import { summarizeRule } from "@/convex/lib/decisionRuleSummary";
import type { Rule } from "@/convex/lib/decisionRuleEngine";
```

Replace the card subtitle line (the `<p>` showing `{r.branches.length} branch...`) with:

```tsx
                  <p className="text-caption text-ink-secondary mt-0.5 line-clamp-2">
                    {summarizeRule({ steps: r.steps, otherwise: r.otherwise } as Rule)}
                  </p>
```

(The list query already returns the full documents, so `r.steps`/`r.otherwise` are available. Field labels are omitted here, so score conditions show the raw key in the list, which is acceptable for a compact subtitle; the editor shows full labels.)

- [ ] **Step 2: Verify in the running app**

- `preview_eval` navigate to `/dashboard/settings/decision-rules`.
- `preview_snapshot`: each rule card shows a readable "Once everyone finishes: ..." sentence instead of "N branches, fallback: ...".
- `preview_logs`: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/settings/decision-rules/page.tsx
git commit -m "feat(web): show plain-English summary on decision-rules list"
```

---

## Phase 4: Mobile read-only

> Mobile imports shared code via the `@convex` alias (used today as
> `@convex/_generated/api`). The summary helper at
> `convex/lib/decisionRuleSummary.ts` is therefore importable as
> `@convex/lib/decisionRuleSummary`. If Metro/Jest fails to resolve it, confirm
> the `@convex` path mapping in `mobile/tsconfig.json` and `mobile/babel.config.js`
> points at the repo-root `convex` directory.

### Task 16: Mobile list becomes read-only with a plain-English summary

**Files:**
- Modify: `mobile/__tests__/screens/decision-rules.test.tsx`
- Modify: `mobile/src/screens/decision-rules.tsx`

- [ ] **Step 1: Update the test to the new shape and read-only expectations**

Replace the entire contents of `mobile/__tests__/screens/decision-rules.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react-native";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => ({ schoolId: "s1", isHR: true }),
}));
jest.mock("convex/react", () => ({
  useQuery: () => [
    {
      _id: "r1",
      name: "Strict",
      isActive: true,
      steps: [
        { match: "all", conditions: [{ type: "recCount", rec: "hire", op: "atLeast", value: 2 }], action: "advance" },
      ],
      otherwise: "manual",
    },
  ],
}));
jest.mock("@convex/_generated/api", () => ({
  api: { decisionRules: { list: "decisionRules:list" } },
}));

import { DecisionRulesIndexScreen } from "@/screens/decision-rules";

describe("DecisionRulesIndexScreen", () => {
  it("renders the rule name and active badge", () => {
    render(<DecisionRulesIndexScreen />);
    expect(screen.getByText("Strict")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("renders a plain-English summary", () => {
    render(<DecisionRulesIndexScreen />);
    expect(
      screen.getByText(/Once everyone finishes: if at least 2 recommended Hire, Move forward/),
    ).toBeTruthy();
  });

  it("does not render a 'New rule' editing control", () => {
    render(<DecisionRulesIndexScreen />);
    expect(screen.queryByText("New rule")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mobile && bun run test -- decision-rules`
Expected: FAIL (screen still reads `r.branches` and renders a "New rule" button).

- [ ] **Step 3: Make the mobile list read-only with the summary helper**

Replace the entire contents of `mobile/src/screens/decision-rules.tsx` with:

```tsx
import { ScrollView, Text, View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { summarizeRule } from "@convex/lib/decisionRuleSummary";
import { useRoleContext } from "@/hooks/use-role-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { colors, fonts, space } from "@/theme";

export function DecisionRulesIndexScreen() {
  const role = useRoleContext();
  const rules = useQuery(
    api.decisionRules.list,
    role.schoolId ? { schoolId: role.schoolId as any } : "skip",
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4] }}
    >
      {(!rules || rules.length === 0) && (
        <EmptyState title="No rules yet" body="Decision rules are created on the web dashboard." />
      )}
      {(rules ?? []).map((r: any) => (
        <Card key={r._id} padding="md" style={{ marginBottom: space[3] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>
              {r.name}
            </Text>
            <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</Badge>
          </View>
          <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.xs, marginTop: space[2] }}>
            {summarizeRule({ steps: r.steps, otherwise: r.otherwise })}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}
```

> Note: if `Card` does not accept a `style` prop, wrap each card in a `<View style={{ marginBottom: space[3] }}>` instead (check `mobile/src/components/ui/card.tsx`).

- [ ] **Step 4: Run to verify it passes**

Run: `cd mobile && bun run test -- decision-rules`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/decision-rules.tsx mobile/__tests__/screens/decision-rules.test.tsx
git commit -m "feat(mobile): read-only decision rules with plain-English summary"
```

### Task 17: Remove the mobile editor and its route

**Files:**
- Delete: `mobile/src/screens/rule-editor.tsx`
- Delete: `mobile/src/components/settings/branch-row.tsx`
- Modify: `mobile/src/navigation/app-nav.tsx`

- [ ] **Step 1: Remove the editor screen, its component, and the route**

Run:
```bash
git rm mobile/src/screens/rule-editor.tsx mobile/src/components/settings/branch-row.tsx
```

In `mobile/src/navigation/app-nav.tsx`:
- Delete the import on line ~15: `import { RuleEditorScreen } from "@/screens/rule-editor";`
- Delete the `RuleEditor: { ruleId?: string };` entry from the route param list (line ~35).
- Delete the `<Stack.Screen name="RuleEditor" component={RuleEditorScreen} ... />` block (lines ~110-111 and surrounding JSX for that screen).

- [ ] **Step 2: Confirm no dangling references**

Run:
```bash
grep -rn "RuleEditor\|rule-editor\|settings/branch-row" mobile/src
```
Expected: no matches.

- [ ] **Step 3: Run the mobile test suite**

Run: `cd mobile && bun run test`
Expected: PASS (no references to removed modules).

- [ ] **Step 4: Commit**

```bash
git add mobile/src/navigation/app-nav.tsx
git commit -m "refactor(mobile): remove decision-rule editor (web-only authoring)"
```

---

## Final verification

- [ ] **Run the full web/convex suite:** `bun run test`
  Expected: all green, including the rewritten engine, summary, decisionRules, decisions, and demoSessions-decision tests.
- [ ] **Run the mobile suite:** `cd mobile && bun run test`
  Expected: all green.
- [ ] **Type/build check:** `bun run build`
  Expected: no TypeScript errors.
- [ ] **Manual smoke (web, preview tools):** create a rule from a starter, exercise each condition type, watch the live summary, run the tester against a seeded demo, save, and confirm the list shows the English summary.

---

## Self-review (filled in by the plan author)

**Spec coverage:**
- Plain-language wording, ANY/ALL, steps/otherwise, "Otherwise", friendly action labels: Tasks 1, 4, 12, 14.
- Full condition palette (counts, proportions, score thresholds, who evaluated, specific verdict): Tasks 1-3 (engine), 6 (validators), 11 (UI).
- Grouped score-field dropdown replacing raw `fieldKey`: Task 10.
- Live plain-English summary (editor + list, shared helper): Tasks 4, 13, 14, 15.
- Test against a past demo (explainRule + queries + UI): Tasks 1/3 (explainRule), 8 (queries), 13 (UI).
- Starter templates: Tasks 9, 14.
- Inline help: Task 11 (condition-picker help text). ALL/ANY is self-labelling in Task 12.
- Convex schema + validators + dev clean-cutover: Tasks 5, 6.
- decisions.ts wiring via shared input builder: Task 7.
- Mobile read-only with shared summary; editor removed: Tasks 16, 17.

**Placeholder scan:** The only intentionally-described (not fully-coded) piece is the `seedDecidedDemo` helper in Task 8, which references the concrete `setup` in `tests/convex/decisions.test.ts`; the assertions and query code are complete.

**Type consistency:** `Rule = { steps, otherwise }`, `OutcomeStep = { match, conditions, action }`, and the six `Condition` variants are identical across engine (Task 1), validators (Task 6), summary (Task 4), and all UI tasks. `explainRule` returns `{ action, matchedStepIndex, steps[] }` with `StepResult.conditions[].passed`, consumed unchanged by the tester (Task 13).

---

## Execution handoff

Implement with TDD, committing after each task. Phases are sequential: Phase 1 (pure logic) and Phase 2 (Convex) must land before Phase 3/4 UI, which depend on the new types and queries.

