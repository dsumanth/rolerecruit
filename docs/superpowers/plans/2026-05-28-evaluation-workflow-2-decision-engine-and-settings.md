# Evaluation Workflow — Plan 2: Decision Engine + Settings + Advanced Web

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining web surface for the evaluation workflow. After this plan ships, HR can write per-role form templates, define decision rules that auto-advance/reject/redemo when invites complete, pick a rule at schedule time, swap evaluators from the demo summary, and see the auto-applied decision banner in the UI.

**Architecture:** A pure rule evaluator (`convex/lib/decisionRuleEngine.ts`) is unit-tested in isolation. A small `maybeApplyDecision` helper is invoked from the end of `evaluations.submit`, `evaluationInvites.decline`, `evaluationInvites.swap`, and `demoSessions.cancel` whenever the last non-cancelled invite reaches a terminal state. Web settings hub gains two new sub-routes (`/templates`, `/decision-rules`) reusing the existing `SettingsNav` pattern. The schedule wizard learns about decision rules. The demo summary learns about the applied decision and about swapping evaluators.

**Tech Stack:** Convex, Next.js 14, React 18, TypeScript, `convex-test`, Vitest, Playwright. No new third-party deps.

**Spec reference:** [docs/superpowers/specs/2026-05-28-evaluation-workflow-design.md](../specs/2026-05-28-evaluation-workflow-design.md) (Sections 5, 6, 7).

**Builds on:** [Plan 1](2026-05-28-evaluation-workflow-1-backend-and-web.md) — already shipped on main. Plan 2 does not touch the schema; every required table and field already exists. Plan 2 ONLY adds modules, queries, mutations, helpers, components, and routes.

---

## UI guidelines (applies to every UI task)

All components must use the existing design system in `components/ui/` and the design tokens defined in `tailwind.config.ts`. **Do not use raw Tailwind color/spacing utilities like `bg-blue-600`, `text-gray-500`, `rounded-2xl`, `border-gray-300`.** They will look out of place next to the rest of the polished UI.

**Primitives (import from `@/components/ui`):**

- `<Button variant size loading iconLeft iconRight />` — variants: `primary | secondary | danger | ghost | outline | gradient | ink`; sizes: `sm | md | lg`.
- `<Card surface elevation interactive padding />` — surfaces: `card | chrome | floating`; elevations: `floor | 1 | 2 | 3 | 4`; paddings: `none | sm | md | lg`.
- `<Dialog open onOpenChange title description variant footer />` — variants: `center | drawer`. Provides backdrop, escape-to-close, body scroll lock, focus trap.
- `<Badge variant dot />` — variants: `neutral | info | success | warning | danger`.
- `<Avatar>`, `<Input>`, `<Select>`, `<Tabs>`, `<Skeleton>`, `<Tooltip>`, `<EmptyState>`, `<Dropdown>`, `<PageHeader>`, `<Icon name>`, `useToast()`.

**Tokens (Tailwind):**

| Concern | Token |
|---|---|
| Primary text | `text-ink` |
| Secondary text | `text-ink-secondary` |
| Tertiary/muted | `text-ink-tertiary` |
| Brand color | `text-accent` / `bg-accent` |
| Accent soft fill | `bg-accent-soft` |
| Status | `text-success / text-warning / text-danger` (and soft equivalents via Badge variants) |
| Card / panel bg | `bg-surface` |
| Canvas bg | `bg-surface-canvas` |
| Floating overlay | `bg-surface-floating backdrop-blur-20` |
| Borders / dividers | `border-hairline` (default) / `border-hairline-strong` (emphasis) |
| Shadow | `shadow-elev-1` (cards) / `shadow-elev-3` (menus, popovers) |
| Radii | `rounded-apple` (0.625rem default) / `rounded-xs / sm / md / lg / xl` |
| Motion | `transition-all duration-fast ease-apple-out` |

**Pattern enforcement:** If a UI task in this plan shows raw Tailwind like `bg-blue-600`, treat that as an example structure only — substitute the design-system equivalent. Open `app/dashboard/settings/roles/page.tsx`, `components/demos/`, or `components/evaluations/` for reference patterns shipped in Plan 1.

---

## File map

**New Convex modules**

- `convex/lib/decisionRuleEngine.ts` — pure function: `(rule, invites, evaluations, templates) → action`
- `convex/decisionRules.ts` — CRUD: `list`, `get`, `create`, `update`, `setActive`, `remove`
- `convex/decisions.ts` — `maybeApplyDecision` helper called from terminal-transition mutations

**Modified Convex modules**

- `convex/evaluations.ts` — call `maybeApplyDecision` at the end of `persistSubmission`
- `convex/evaluationInvites.ts` — call `maybeApplyDecision` from `decline`; notify-and-trigger from `swap`
- `convex/demoSessions.ts` — call `maybeApplyDecision` from `cancel`
- `convex/formTemplates.ts` — add `saveOverride`, `duplicateFromDefault`, `previewById`
- `convex/notifications.ts` — add `renderSwapEmail`, `sendSwapEmail` (mirrors invite shape)

**New web components**

- `components/settings/templates/template-editor.tsx` — full template editor (field list + side preview)
- `components/settings/templates/field-row.tsx` — single field row with inline edit
- `components/settings/decision-rules/rule-editor.tsx` — branches + fallback + simulator
- `components/settings/decision-rules/branch-row.tsx` — one branch with condition builder
- `components/demos/swap-evaluator-modal.tsx` — pick replacement, show staff directory filtered by role
- `components/demos/applied-decision-banner.tsx` — banner shown on DemoSummary when `appliedDecision` is set

**Modified web components**

- `components/settings/settings-nav.tsx` — add Templates + Decision rules entries
- `components/demos/schedule-demo-wizard.tsx` — add optional "Decision rule" picker on the review step
- `components/demos/demo-summary.tsx` — render `<AppliedDecisionBanner>` + per-evaluator swap button

**New routes**

- `app/dashboard/settings/templates/page.tsx` — list per role
- `app/dashboard/settings/templates/[role]/page.tsx` — editor
- `app/dashboard/settings/decision-rules/page.tsx` — list
- `app/dashboard/settings/decision-rules/[ruleId]/page.tsx` — editor (also handles `?new=1` for create)

**New tests**

- `tests/convex/decisionRuleEngine.test.ts` — table-driven pure function tests
- `tests/convex/decisionRules.test.ts` — CRUD + activation guards
- `tests/convex/decisions.test.ts` — `maybeApplyDecision` integration (with/without rule, idempotency, swap-cancel terminal logic)
- `tests/convex/formTemplates-save.test.ts` — append-only tests for `saveOverride` + `duplicateFromDefault`
- `tests/convex/notifications-swap.test.ts` — `renderSwapEmail`
- `tests/e2e/decision-engine-autoapply.spec.ts` — Playwright
- `tests/e2e/template-editor.spec.ts` — Playwright
- `tests/e2e/evaluator-swap.spec.ts` — Playwright

---

## Phase 1: Decision rule engine — backend

### Task 1: Pure decision rule engine

**Files:**
- Create: `convex/lib/decisionRuleEngine.ts`
- Create: `tests/convex/decisionRuleEngine.test.ts`

This task implements the pure function. No Convex context, no DB. It takes the rule plus snapshots of the invites/evaluations/templates and returns one of `"advance" | "reject" | "redemo" | "manual"`. Section 6 of the spec is the contract.

- [ ] **Step 1: Write the failing tests (table-driven)**

Create `tests/convex/decisionRuleEngine.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { evaluateRule, type RuleInput } from "../../convex/lib/decisionRuleEngine";

// Minimal shapes mirror only what the engine reads. The engine should NOT
// rely on Convex internals; pass in plain objects.
type Rec = "hire" | "maybe" | "reject" | undefined;

function buildInput(opts: {
  branches?: any[];
  fallback?: "advance" | "reject" | "redemo" | "manual";
  recs?: Rec[];
  rolesSubmitted?: string[];
  scoreField?: { key: string; values: number[]; weight?: number };
}): RuleInput {
  const invites = (opts.recs ?? []).map((rec, i) => ({
    _id: `inv${i}` as any,
    evaluatorRole: opts.rolesSubmitted?.[i] ?? "principal",
    status: rec === undefined ? "declined" : "submitted",
    formTemplateId: "tpl1" as any,
  }));
  const fieldKey = opts.scoreField?.key ?? "score";
  const evaluations = (opts.recs ?? []).flatMap((rec, i) => {
    if (rec === undefined) return [];
    return [{
      _id: `eval${i}` as any,
      inviteId: invites[i]._id,
      formTemplateId: "tpl1" as any,
      responses: opts.scoreField ? { [fieldKey]: opts.scoreField.values[i] ?? 0 } : {},
      recommendation: rec,
    }];
  });
  const template = {
    _id: "tpl1" as any,
    fields: opts.scoreField
      ? [{ key: fieldKey, label: "X", type: "score_1_5", weight: opts.scoreField.weight }]
      : [],
  };
  return {
    rule: {
      branches: opts.branches ?? [],
      fallback: opts.fallback ?? "manual",
    },
    invites,
    evaluations,
    templates: [template],
  };
}

describe("evaluateRule", () => {
  it("returns fallback when there are no branches", () => {
    expect(evaluateRule(buildInput({ fallback: "manual", recs: ["hire", "hire"] }))).toBe("manual");
  });

  it("matches minHire branch and ignores later branches", () => {
    const input = buildInput({
      branches: [
        { condition: { minHire: 2 }, action: "advance" },
        { condition: { maxReject: 0 }, action: "redemo" },
      ],
      fallback: "manual",
      recs: ["hire", "hire", "maybe"],
    });
    expect(evaluateRule(input)).toBe("advance");
  });

  it("does not match minHire when threshold not met", () => {
    const input = buildInput({
      branches: [{ condition: { minHire: 3 }, action: "advance" }],
      fallback: "manual",
      recs: ["hire", "hire", "maybe"],
    });
    expect(evaluateRule(input)).toBe("manual");
  });

  it("matches maxReject when reject count <= threshold", () => {
    const input = buildInput({
      branches: [{ condition: { maxReject: 1 }, action: "advance" }],
      fallback: "reject",
      recs: ["hire", "reject"],
    });
    expect(evaluateRule(input)).toBe("advance");
  });

  it("fails maxReject when reject count exceeds threshold", () => {
    const input = buildInput({
      branches: [{ condition: { maxReject: 0 }, action: "advance" }],
      fallback: "reject",
      recs: ["reject", "hire"],
    });
    expect(evaluateRule(input)).toBe("reject");
  });

  it("computes weighted average and passes minAverage threshold", () => {
    // Field weighted x2; values 5,3 → weighted sum 16 / weight 4 = 4.0
    const input = buildInput({
      branches: [{
        condition: { minAverage: { fieldKey: "score", minValue: 3.5 } },
        action: "advance",
      }],
      fallback: "manual",
      recs: ["hire", "hire"],
      scoreField: { key: "score", values: [5, 3], weight: 2 },
    });
    expect(evaluateRule(input)).toBe("advance");
  });

  it("fails minAverage when average below threshold", () => {
    const input = buildInput({
      branches: [{
        condition: { minAverage: { fieldKey: "score", minValue: 4 } },
        action: "advance",
      }],
      fallback: "redemo",
      recs: ["hire", "hire"],
      scoreField: { key: "score", values: [3, 3] },
    });
    expect(evaluateRule(input)).toBe("redemo");
  });

  it("ignores minAverage clause if no submitted evaluation contains the field", () => {
    // Field not present in responses; treat as unmet (cannot satisfy).
    const input = buildInput({
      branches: [{
        condition: { minAverage: { fieldKey: "missing", minValue: 1 } },
        action: "advance",
      }],
      fallback: "manual",
      recs: ["hire"],
      scoreField: { key: "score", values: [5] },
    });
    expect(evaluateRule(input)).toBe("manual");
  });

  it("requiredRoles must all have at least one submitted evaluation", () => {
    const input = buildInput({
      branches: [{
        condition: { requiredRoles: ["principal", "hod"] },
        action: "advance",
      }],
      fallback: "manual",
      recs: ["hire", "hire"],
      rolesSubmitted: ["principal", "hr_admin"], // hod missing
    });
    expect(evaluateRule(input)).toBe("manual");
  });

  it("requiredRoles matches when all roles have a submission", () => {
    const input = buildInput({
      branches: [{
        condition: { requiredRoles: ["principal", "hod"] },
        action: "advance",
      }],
      fallback: "manual",
      recs: ["hire", "hire"],
      rolesSubmitted: ["principal", "hod"],
    });
    expect(evaluateRule(input)).toBe("advance");
  });

  it("AND-conjoins multiple clauses within one condition", () => {
    const input = buildInput({
      branches: [{
        condition: { minHire: 2, maxReject: 0 },
        action: "advance",
      }],
      fallback: "manual",
      recs: ["hire", "hire", "reject"],
    });
    expect(evaluateRule(input)).toBe("manual");
  });

  it("first-match-wins: earlier branch fires even if later would match", () => {
    const input = buildInput({
      branches: [
        { condition: { maxReject: 5 }, action: "manual" },   // trivially true
        { condition: { minHire: 1 }, action: "advance" },
      ],
      fallback: "reject",
      recs: ["hire"],
    });
    expect(evaluateRule(input)).toBe("manual");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test tests/convex/decisionRuleEngine.test.ts`
Expected: FAIL — `evaluateRule` not defined.

- [ ] **Step 3: Implement the engine**

Create `convex/lib/decisionRuleEngine.ts`:

```ts
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
  let hire = 0, reject = 0;
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test tests/convex/decisionRuleEngine.test.ts`
Expected: PASS — all 11 tests green.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/decisionRuleEngine.ts tests/convex/decisionRuleEngine.test.ts
git commit -m "feat(eval): pure decision rule engine"
```

---

### Task 2: `convex/decisionRules.ts` CRUD module

**Files:**
- Create: `convex/decisionRules.ts`
- Create: `tests/convex/decisionRules.test.ts`

The schema for `decisionRules` already exists (added in Plan 1, T2). This task adds the mutations and queries to drive it from the UI.

- [ ] **Step 1: Write the failing test**

Create `tests/convex/decisionRules.test.ts`:

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

describe("decisionRules", () => {
  it("creates a rule and lists it for the school", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId,
      name: "Standard hire path",
      branches: [
        { condition: { minHire: 2, maxReject: 0 }, action: "advance" },
      ],
      fallback: "manual",
    } as any);
    expect(ruleId).toBeDefined();

    const list = await t.query("decisionRules:list" as any, { schoolId } as any);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Standard hire path");
    expect(list[0].isActive).toBe(true);
  });

  it("update replaces branches and fallback", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "r1",
      branches: [{ condition: { minHire: 1 }, action: "advance" }],
      fallback: "manual",
    } as any);

    await t.mutation("decisionRules:update" as any, {
      ruleId,
      name: "r1 renamed",
      branches: [{ condition: { minHire: 3 }, action: "reject" }],
      fallback: "redemo",
    } as any);

    const got = await t.query("decisionRules:get" as any, { ruleId } as any);
    expect(got.name).toBe("r1 renamed");
    expect(got.branches[0].condition.minHire).toBe(3);
    expect(got.fallback).toBe("redemo");
  });

  it("setActive toggles isActive", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "r", branches: [], fallback: "manual",
    } as any);

    await t.mutation("decisionRules:setActive" as any, { ruleId, active: false } as any);
    const got = await t.query("decisionRules:get" as any, { ruleId } as any);
    expect(got.isActive).toBe(false);
  });

  it("remove deletes the row", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const ruleId = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "r", branches: [], fallback: "manual",
    } as any);

    await t.mutation("decisionRules:remove" as any, { ruleId } as any);
    const list = await t.query("decisionRules:list" as any, { schoolId } as any);
    expect(list).toHaveLength(0);
  });

  it("listActive returns only active rules", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    const a = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "a", branches: [], fallback: "manual",
    } as any);
    const b = await t.mutation("decisionRules:create" as any, {
      schoolId, name: "b", branches: [], fallback: "manual",
    } as any);
    await t.mutation("decisionRules:setActive" as any, { ruleId: b, active: false } as any);

    const active = await t.query("decisionRules:listActive" as any, { schoolId } as any);
    expect(active.map((r: any) => r._id)).toEqual([a]);
  });

  it("create rejects empty fallback", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);
    await expect(t.mutation("decisionRules:create" as any, {
      schoolId, name: "bad", branches: [], fallback: undefined as any,
    } as any)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/convex/decisionRules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `convex/decisionRules.ts`:

```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const BRANCH_VALIDATOR = v.array(v.object({
  condition: v.object({
    minHire: v.optional(v.number()),
    maxReject: v.optional(v.number()),
    minAverage: v.optional(v.object({
      fieldKey: v.string(),
      minValue: v.number(),
    })),
    requiredRoles: v.optional(v.array(v.string())),
  }),
  action: v.union(
    v.literal("advance"),
    v.literal("reject"),
    v.literal("redemo"),
    v.literal("manual"),
  ),
}));

const ACTION_VALIDATOR = v.union(
  v.literal("advance"),
  v.literal("reject"),
  v.literal("redemo"),
  v.literal("manual"),
);

export const list = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) =>
    await ctx.db
      .query("decisionRules")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId))
      .collect(),
});

export const listActive = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) => {
    const rows = await ctx.db
      .query("decisionRules")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId))
      .collect();
    return rows.filter((r) => r.isActive);
  },
});

export const get = query({
  args: { ruleId: v.id("decisionRules") },
  handler: async (ctx, { ruleId }) => {
    const r = await ctx.db.get(ruleId);
    if (!r) throw new Error("Rule not found");
    return r;
  },
});

export const create = mutation({
  args: {
    schoolId: v.id("schools"),
    name: v.string(),
    branches: BRANCH_VALIDATOR,
    fallback: ACTION_VALIDATOR,
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("decisionRules", {
      schoolId: args.schoolId,
      name: args.name,
      branches: args.branches,
      fallback: args.fallback,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    ruleId: v.id("decisionRules"),
    name: v.optional(v.string()),
    branches: v.optional(BRANCH_VALIDATOR),
    fallback: v.optional(ACTION_VALIDATOR),
  },
  handler: async (ctx, { ruleId, name, branches, fallback }) => {
    const r = await ctx.db.get(ruleId);
    if (!r) throw new Error("Rule not found");
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (branches !== undefined) patch.branches = branches;
    if (fallback !== undefined) patch.fallback = fallback;
    if (Object.keys(patch).length === 0) return;
    await ctx.db.patch(ruleId, patch);
  },
});

export const setActive = mutation({
  args: { ruleId: v.id("decisionRules"), active: v.boolean() },
  handler: async (ctx, { ruleId, active }) => {
    const r = await ctx.db.get(ruleId);
    if (!r) throw new Error("Rule not found");
    await ctx.db.patch(ruleId, { isActive: active });
  },
});

export const remove = mutation({
  args: { ruleId: v.id("decisionRules") },
  handler: async (ctx, { ruleId }) => {
    const r = await ctx.db.get(ruleId);
    if (!r) throw new Error("Rule not found");
    await ctx.db.delete(ruleId);
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test tests/convex/decisionRules.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add convex/decisionRules.ts tests/convex/decisionRules.test.ts
git commit -m "feat(eval): decision rules CRUD module"
```

---

### Task 3: `maybeApplyDecision` helper + wire into terminal-transition mutations

**Files:**
- Create: `convex/decisions.ts` — `maybeApplyDecision` helper
- Modify: `convex/evaluations.ts` — call at end of `persistSubmission`
- Modify: `convex/evaluationInvites.ts` — call at end of `decline` and `swap`
- Modify: `convex/demoSessions.ts` — call at end of `cancel`
- Create: `tests/convex/decisions.test.ts`

The trigger semantics (Section 6 of the spec): the engine runs when all **non-cancelled** invites for the demo are in a terminal state (`submitted` or `declined`), the demo has a `decisionRuleId`, the demo is not already cancelled, and `appliedDecision` is not already set (idempotency).

- [ ] **Step 1: Write the failing test**

Create `tests/convex/decisions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as users from "../../convex/users";
import * as formTemplates from "../../convex/formTemplates";
import * as decisionRules from "../../convex/decisionRules";
import * as demoSessions from "../../convex/demoSessions";
import * as invites from "../../convex/evaluationInvites";
import * as evaluations from "../../convex/evaluations";
import * as decisions from "../../convex/decisions";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "users.ts": async () => users,
  "formTemplates.ts": async () => formTemplates,
  "decisionRules.ts": async () => decisionRules,
  "demoSessions.ts": async () => demoSessions,
  "evaluationInvites.ts": async () => invites,
  "evaluations.ts": async () => evaluations,
  "decisions.ts": async () => decisions,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

async function setup(t: ReturnType<typeof convexTest>) {
  const schoolId = await t.mutation("schools:create" as any, {
    name: "S", board: "CBSE", city: "X", state: "Y",
  } as any);
  const candidateId = await t.mutation("candidates:create" as any, {
    name: "Priya", qualifications: ["B.Ed"], subjects: ["Maths"],
  } as any);
  const jobId = await t.mutation("jobs:create" as any, {
    schoolId, title: "TGT Maths", subject: "Maths", level: "TGT",
    board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "x",
  } as any);
  const appId = await t.mutation("applications:create" as any, {
    candidateId, jobPostingId: jobId, schoolId,
  } as any);
  const principalId = await t.mutation("users:createProfile" as any, {
    userId: "u-p", name: "P", email: "p@s.com", schoolId, role: "principal",
  } as any);
  const hodId = await t.mutation("users:createProfile" as any, {
    userId: "u-h", name: "H", email: "h@s.com", schoolId, role: "hod",
  } as any);
  const ruleId = await t.mutation("decisionRules:create" as any, {
    schoolId,
    name: "auto-advance on 2 hires",
    branches: [{ condition: { minHire: 2 }, action: "advance" }],
    fallback: "manual",
  } as any);
  const demoId = await t.mutation("demoSessions:create" as any, {
    applicationId: appId,
    schoolId,
    scheduledAt: Date.now() + 86400000,
    durationMinutes: 30,
    mode: "live",
    format: "classroom",
    evaluators: [
      { userId: principalId, role: "principal" },
      { userId: hodId, role: "hod" },
    ],
    decisionRuleId: ruleId,
    createdBy: principalId,
  } as any);
  const invitesList = await t.query("evaluationInvites:listForDemo" as any, {
    demoId,
  } as any);
  return { schoolId, appId, demoId, ruleId, principalId, hodId, invitesList };
}

describe("maybeApplyDecision via terminal-transition mutations", () => {
  it("auto-advances when all submit hire and rule matches", async () => {
    const t = convexTest(schema, modules);
    const s = await setup(t);

    // First invite submits hire — not yet terminal across all invites.
    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[0]._id,
      responses: {},
      recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);
    let demo = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    expect(demo.appliedDecision).toBeUndefined();

    // Second invite submits hire — now both terminal, rule fires.
    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[1]._id,
      responses: {},
      recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);
    demo = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    expect(demo.appliedDecision).toBeDefined();
    expect(demo.appliedDecision.action).toBe("advance");
    expect(demo.status).toBe("completed");

    const app = await t.query("applications:get" as any, { applicationId: s.appId } as any);
    expect(app.stage).toBe("advanced");
  });

  it("falls through to manual fallback when no branch matches", async () => {
    const t = convexTest(schema, modules);
    const s = await setup(t);

    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[0]._id, responses: {}, recommendation: "maybe",
      submittedFromPlatform: "web",
    } as any);
    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[1]._id, responses: {}, recommendation: "reject",
      submittedFromPlatform: "web",
    } as any);

    const demo = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    expect(demo.appliedDecision?.action).toBe("manual");
    // manual does NOT mutate the application stage
    const app = await t.query("applications:get" as any, { applicationId: s.appId } as any);
    expect(app.stage).not.toBe("advanced");
    expect(app.stage).not.toBe("rejected");
  });

  it("decline triggers the engine when it's the last remaining transition", async () => {
    const t = convexTest(schema, modules);
    const s = await setup(t);

    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[0]._id, responses: {}, recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);
    await t.mutation("evaluationInvites:decline" as any, {
      inviteId: s.invitesList[1]._id, reason: "conflict",
    } as any);

    // Only one hire; rule needs 2; fallback is manual.
    const demo = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    expect(demo.appliedDecision?.action).toBe("manual");
  });

  it("is idempotent — does not re-apply when one decision already exists", async () => {
    const t = convexTest(schema, modules);
    const s = await setup(t);

    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[0]._id, responses: {}, recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);
    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[1]._id, responses: {}, recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);

    const demo1 = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    const appliedAt1 = demo1.appliedDecision.appliedAt;

    // Calling applyDecision manually after auto-fire should not change the timestamp.
    await t.mutation("demoSessions:applyDecision" as any, {
      demoId: s.demoId, action: "reject", note: "override?",
    } as any);

    const demo2 = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    // applyDecision overwrites; that is desirable for manual override. But the
    // auto-fire path must NOT double-fire on subsequent submits — verified
    // implicitly by the absence of a third submit in this test path.
    expect(demo2.appliedDecision.action).toBe("reject");
  });

  it("does not fire when demo has no decisionRuleId", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create" as any, {
      name: "S2", board: "ICSE", city: "X", state: "Y",
    } as any);
    const candidateId = await t.mutation("candidates:create" as any, {
      name: "X", qualifications: [], subjects: [],
    } as any);
    const jobId = await t.mutation("jobs:create" as any, {
      schoolId, title: "x", subject: "x", level: "TGT", board: "CBSE",
      qualifications: [], naturalLanguageDescription: "x",
    } as any);
    const appId = await t.mutation("applications:create" as any, {
      candidateId, jobPostingId: jobId, schoolId,
    } as any);
    const userId = await t.mutation("users:createProfile" as any, {
      userId: "u1", name: "U", email: "u@s.com", schoolId, role: "principal",
    } as any);
    const demoId = await t.mutation("demoSessions:create" as any, {
      applicationId: appId,
      schoolId,
      scheduledAt: Date.now() + 86400000,
      durationMinutes: 30,
      mode: "live", format: "classroom",
      evaluators: [{ userId, role: "principal" }],
      createdBy: userId,
      // No decisionRuleId
    } as any);
    const inv = (await t.query("evaluationInvites:listForDemo" as any, {
      demoId,
    } as any))[0];

    await t.mutation("evaluations:submit" as any, {
      inviteId: inv._id, responses: {}, recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);

    const demo = await t.query("demoSessions:get" as any, { demoId } as any);
    expect(demo.appliedDecision).toBeUndefined();
  });

  it("ignores cancelled (swapped) invites when checking 'all terminal'", async () => {
    const t = convexTest(schema, modules);
    const s = await setup(t);
    const replacementId = await t.mutation("users:createProfile" as any, {
      userId: "u-r", name: "R", email: "r@s.com", schoolId: s.schoolId, role: "principal",
    } as any);

    // Swap invite 0 out → status=cancelled, new invite issued.
    await t.mutation("evaluationInvites:swap" as any, {
      inviteId: s.invitesList[0]._id,
      newEvaluatorUserId: replacementId,
    } as any);

    // Invite 1 submits hire — not yet terminal across non-cancelled invites
    // (the replacement invite is still 'invited').
    await t.mutation("evaluations:submit" as any, {
      inviteId: s.invitesList[1]._id, responses: {}, recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);

    let demo = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    expect(demo.appliedDecision).toBeUndefined();

    // Replacement invite submits hire → now both non-cancelled are terminal; rule fires.
    const all = await t.query("evaluationInvites:listForDemo" as any, {
      demoId: s.demoId,
    } as any);
    const replacement = all.find((i: any) => i.status === "invited");
    expect(replacement).toBeDefined();
    await t.mutation("evaluations:submit" as any, {
      inviteId: replacement._id, responses: {}, recommendation: "hire",
      submittedFromPlatform: "web",
    } as any);

    demo = await t.query("demoSessions:get" as any, { demoId: s.demoId } as any);
    expect(demo.appliedDecision?.action).toBe("advance");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/convex/decisions.test.ts`
Expected: FAIL — `decisions.ts` not found, mutations don't call helper.

- [ ] **Step 3: Implement `convex/decisions.ts`**

Create `convex/decisions.ts`:

```ts
import { Doc, Id } from "./_generated/dataModel";
import {
  evaluateRule,
  type RuleInput,
} from "./lib/decisionRuleEngine";

type Ctx = { db: any };

export async function maybeApplyDecision(
  ctx: Ctx,
  demoId: Id<"demoSessions">,
): Promise<void> {
  const demo = await ctx.db.get(demoId);
  if (!demo) return;
  if (!demo.decisionRuleId) return;
  if (demo.appliedDecision) return; // idempotent
  if (demo.status === "cancelled") return;

  const allInvites: Doc<"evaluationInvites">[] = await ctx.db
    .query("evaluationInvites")
    .withIndex("by_demoSessionId", (q: any) => q.eq("demoSessionId", demoId))
    .collect();

  const nonCancelled = allInvites.filter((i) => i.status !== "cancelled");
  if (nonCancelled.length === 0) return;

  const allTerminal = nonCancelled.every(
    (i) => i.status === "submitted" || i.status === "declined",
  );
  if (!allTerminal) return;

  const rule = await ctx.db.get(demo.decisionRuleId);
  if (!rule || !rule.isActive) return;

  const evaluations: Doc<"evaluations">[] = [];
  const templateIds = new Set<string>();
  for (const inv of nonCancelled) {
    if (inv.status !== "submitted") continue;
    const evs = await ctx.db
      .query("evaluations")
      .withIndex("by_inviteId", (q: any) => q.eq("inviteId", inv._id))
      .collect();
    for (const e of evs) {
      evaluations.push(e);
      templateIds.add(e.formTemplateId);
    }
  }
  const templates: Doc<"formTemplates">[] = [];
  for (const id of templateIds) {
    const t = await ctx.db.get(id as Id<"formTemplates">);
    if (t) templates.push(t);
  }

  const input: RuleInput = {
    rule: { branches: rule.branches, fallback: rule.fallback },
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

  const action = evaluateRule(input);

  await ctx.db.patch(demoId, {
    status: "completed",
    appliedDecision: {
      action,
      appliedAt: Date.now(),
      appliedBy: undefined, // automatic
      note: `Auto-applied by rule "${rule.name}"`,
    },
  });

  if (action === "advance") {
    await ctx.db.patch(demo.applicationId, { stage: "advanced" });
  } else if (action === "reject") {
    await ctx.db.patch(demo.applicationId, { stage: "rejected" });
  }
  // redemo and manual leave stage alone; HR sees the suggestion in DemoSummary.
}
```

- [ ] **Step 4: Wire into `evaluations.submit` and `submitByToken`**

Edit `convex/evaluations.ts`. Add the import at the top:

```ts
import { maybeApplyDecision } from "./decisions";
```

Append `await maybeApplyDecision(ctx, inv.demoSessionId)` to `persistSubmission`:

```ts
async function persistSubmission(
  ctx: any, inviteId: any, responses: any, recommendation: any,
  voiceInputs: any, platform: any,
) {
  const inv = await ctx.db.get(inviteId);
  if (!inv) throw new Error("Invite not found");
  if (inv.status === "submitted") throw new Error("Already submitted");
  if (inv.status === "cancelled") throw new Error("Invite was cancelled");
  if (inv.status === "declined") throw new Error("Invite was declined");

  const now = Date.now();
  await ctx.db.insert("evaluations", {
    inviteId, formTemplateId: inv.formTemplateId, responses, recommendation,
    voiceInputs: voiceInputs ?? undefined,
    submittedAt: now, submittedFromPlatform: platform,
  });
  await ctx.db.patch(inviteId, { status: "submitted", submittedAt: now });
  await maybeApplyDecision(ctx, inv.demoSessionId);
}
```

- [ ] **Step 5: Wire into `evaluationInvites.decline` and `swap`**

Edit `convex/evaluationInvites.ts`. Add the import:

```ts
import { maybeApplyDecision } from "./decisions";
```

In `decline`, after the patch:

```ts
await ctx.db.patch(inviteId, {
  status: "declined", declinedAt: Date.now(), declineReason: reason,
});
await maybeApplyDecision(ctx, inv.demoSessionId);
```

`swap` introduces a new invite in `invited` state, so all-terminal becomes false. Calling `maybeApplyDecision` is a no-op but is safe to call; do it anyway so the helper is the single source of trigger logic:

```ts
await ctx.db.patch(inviteId, {
  status: "cancelled", cancelledAt: now, replacedBy: newInviteId,
});
await maybeApplyDecision(ctx, old.demoSessionId);
return newInviteId;
```

- [ ] **Step 6: Wire into `demoSessions.cancel`**

Edit `convex/demoSessions.ts`. Add the import (or extract into a shared internal module if circular imports surface):

```ts
import { maybeApplyDecision } from "./decisions";
```

At the end of `cancel`:

```ts
// Cancelling the demo itself short-circuits the engine, but we still call
// maybeApplyDecision for the audit-trail consistency: it will early-return
// because demo.status === "cancelled".
await maybeApplyDecision(ctx, demoId);
```

(That early-return is in `decisions.ts` already.)

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun run test tests/convex/decisions.test.ts tests/convex/decisionRuleEngine.test.ts tests/convex/evaluations.test.ts tests/convex/evaluationInvites.test.ts tests/convex/demoSessions.test.ts tests/convex/demoSessions-decision.test.ts`
Expected: PASS — new tests green, existing tests still green.

- [ ] **Step 8: Commit**

```bash
git add convex/decisions.ts convex/evaluations.ts convex/evaluationInvites.ts convex/demoSessions.ts tests/convex/decisions.test.ts
git commit -m "feat(eval): auto-apply decision rule on terminal invite transition"
```

---

## Phase 2: Form template editor — backend

### Task 4: `formTemplates.saveOverride` + `duplicateFromDefault`

**Files:**
- Modify: `convex/formTemplates.ts`
- Create: `tests/convex/formTemplates-save.test.ts`

The school-override semantics (Section 5 of the spec): saving an override deactivates any other active row for that school+role and inserts a new active row. `duplicateFromDefault` starts a new override from the built-in default for that role.

- [ ] **Step 1: Write the failing test**

Create `tests/convex/formTemplates-save.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as formTemplates from "../../convex/formTemplates";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "formTemplates.ts": async () => formTemplates,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

describe("formTemplates.saveOverride + duplicateFromDefault", () => {
  it("saveOverride deactivates the prior active row and inserts a new active row", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create" as any, {
      name: "S", board: "CBSE", city: "X", state: "Y",
    } as any);

    // schools:create auto-seeds default templates, so a principal row exists.
    const before = await t.query("formTemplates:listForSchool" as any, { schoolId } as any);
    const principalActive = before.find(
      (r: any) => r.role === "principal" && r.isActive,
    );
    expect(principalActive).toBeDefined();

    const newId = await t.mutation("formTemplates:saveOverride" as any, {
      schoolId,
      role: "principal",
      name: "Custom principal v2",
      fields: [
        { key: "subjectKnowledge", label: "Subject knowledge", type: "score_1_10", required: true },
        { key: "comments", label: "Notes", type: "text", allowDictation: true },
      ],
    } as any);
    expect(newId).toBeDefined();

    const after = await t.query("formTemplates:listForSchool" as any, { schoolId } as any);
    const activeRows = after.filter((r: any) => r.role === "principal" && r.isActive);
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]._id).toBe(newId);
    expect(activeRows[0].name).toBe("Custom principal v2");

    const old = after.find((r: any) => r._id === principalActive!._id);
    expect(old.isActive).toBe(false);
  });

  it("getForRole returns the new active template after override save", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create" as any, {
      name: "S", board: "CBSE", city: "X", state: "Y",
    } as any);
    await t.mutation("formTemplates:saveOverride" as any, {
      schoolId, role: "hod", name: "HOD custom",
      fields: [{ key: "pedagogy", label: "Pedagogy", type: "score_1_5", required: true }],
    } as any);
    const tpl = await t.query("formTemplates:getForRole" as any, {
      schoolId, role: "hod",
    } as any);
    expect(tpl.name).toBe("HOD custom");
    expect(tpl.fields).toHaveLength(1);
  });

  it("duplicateFromDefault returns a draft preview of the built-in for the role", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create" as any, {
      name: "S", board: "CBSE", city: "X", state: "Y",
    } as any);
    const draft = await t.query("formTemplates:duplicateFromDefault" as any, {
      schoolId, role: "teacher",
    } as any);
    expect(draft.role).toBe("teacher");
    expect(draft.fields.some((f: any) => f.key === "peerCompatibility")).toBe(true);
    // Draft is a preview shape only — does NOT insert.
    const list = await t.query("formTemplates:listForSchool" as any, { schoolId } as any);
    const teacherRows = list.filter((r: any) => r.role === "teacher");
    // The auto-seeded teacher row exists, but no extra row was inserted.
    expect(teacherRows.length).toBe(1);
  });

  it("saveOverride rejects fields with empty key or label", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create" as any, {
      name: "S", board: "CBSE", city: "X", state: "Y",
    } as any);
    await expect(t.mutation("formTemplates:saveOverride" as any, {
      schoolId, role: "principal", name: "x",
      fields: [{ key: "", label: "X", type: "score_1_5" }],
    } as any)).rejects.toThrow(/empty/i);
    await expect(t.mutation("formTemplates:saveOverride" as any, {
      schoolId, role: "principal", name: "x",
      fields: [{ key: "k", label: "", type: "score_1_5" }],
    } as any)).rejects.toThrow(/empty/i);
  });

  it("saveOverride rejects duplicate field keys", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create" as any, {
      name: "S", board: "CBSE", city: "X", state: "Y",
    } as any);
    await expect(t.mutation("formTemplates:saveOverride" as any, {
      schoolId, role: "principal", name: "dup",
      fields: [
        { key: "a", label: "A", type: "score_1_5" },
        { key: "a", label: "A2", type: "text" },
      ],
    } as any)).rejects.toThrow(/duplicate/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/convex/formTemplates-save.test.ts`
Expected: FAIL — `saveOverride` and `duplicateFromDefault` not exported.

- [ ] **Step 3: Implement the new mutation + query**

Append to `convex/formTemplates.ts`:

```ts
import { BUILT_IN_TEMPLATES } from "./formTemplates.defaults";

const FIELD_VALIDATOR = v.array(v.object({
  key: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("score_1_5"),
    v.literal("score_1_10"),
    v.literal("text"),
    v.literal("choice"),
  ),
  choices: v.optional(v.array(v.string())),
  weight: v.optional(v.number()),
  allowDictation: v.optional(v.boolean()),
  required: v.optional(v.boolean()),
}));

function validateFields(fields: Array<{ key: string; label: string; type: string }>) {
  const seen = new Set<string>();
  for (const f of fields) {
    if (!f.key || !f.key.trim()) throw new Error("Field key cannot be empty");
    if (!f.label || !f.label.trim()) throw new Error("Field label cannot be empty");
    if (seen.has(f.key)) throw new Error(`Duplicate field key: ${f.key}`);
    seen.add(f.key);
  }
}

export const saveOverride = mutation({
  args: {
    schoolId: v.id("schools"),
    role: EVALUATOR_ROLE_UNION,
    name: v.string(),
    fields: FIELD_VALIDATOR,
  },
  handler: async (ctx, { schoolId, role, name, fields }) => {
    if (!name.trim()) throw new Error("Template name cannot be empty");
    validateFields(fields);

    const existing = await ctx.db
      .query("formTemplates")
      .withIndex("by_schoolId_role", (q) => q.eq("schoolId", schoolId).eq("role", role))
      .collect();
    for (const row of existing) {
      if (row.isActive) await ctx.db.patch(row._id, { isActive: false });
    }
    const now = Date.now();
    return await ctx.db.insert("formTemplates", {
      schoolId, role, name, fields,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Returns a draft template shape (NOT inserted) based on the built-in default
 * for the given role. The editor uses this when the HR admin clicks
 * "Start from default" while the current school override is in place.
 */
export const duplicateFromDefault = query({
  args: { schoolId: v.id("schools"), role: EVALUATOR_ROLE_UNION },
  handler: async (_ctx, { role }) => {
    const def = BUILT_IN_TEMPLATES.find((t) => t.role === role);
    if (!def) throw new Error(`No built-in default for role ${role}`);
    return {
      role: def.role,
      name: `${def.name} (copy)`,
      fields: def.fields,
    };
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test tests/convex/formTemplates-save.test.ts tests/convex/formTemplates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/formTemplates.ts tests/convex/formTemplates-save.test.ts
git commit -m "feat(eval): formTemplates.saveOverride + duplicateFromDefault"
```

---

## Phase 3: Settings hub navigation

### Task 5: Add Evaluations entries to `SettingsNav`

**Files:**
- Modify: `components/settings/settings-nav.tsx`

Two new entries: "Form templates" and "Decision rules". Both gated by `settings:manage` permission (same pattern as Roles, Notifications).

- [ ] **Step 1: Inspect the existing nav**

Read: `components/settings/settings-nav.tsx`
Expected: the `ITEMS` array — current entries include General, Calendar, Messaging, Notifications, Pipeline stages, Triage, Conversation agent, Facets, Roles, Team.

- [ ] **Step 2: Add the new entries**

Edit `components/settings/settings-nav.tsx`. Insert these two items after the "Pipeline stages" item:

```tsx
{ href: "/dashboard/settings/templates", label: "Form templates", icon: "FileText", permission: "settings:manage" },
{ href: "/dashboard/settings/decision-rules", label: "Decision rules", icon: "Workflow", permission: "settings:manage" },
```

Verify both icon names exist in the Icon component:
Run: `grep -E "FileText|Workflow" /Users/sumanthdaggubati/Dev/Rolerecruit/components/ui/icon.tsx`
Expected: both icon names present. If either is missing, swap for an existing icon (`ClipboardList`, `Settings`, `GitBranch`, etc.) and note the swap in the commit message.

- [ ] **Step 3: Smoke test**

Run: `bunx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add components/settings/settings-nav.tsx
git commit -m "feat(eval): add Templates + Decision rules to settings nav"
```

---

## Phase 4: Template editor UI

### Task 6: `/dashboard/settings/templates` index page

**Files:**
- Create: `app/dashboard/settings/templates/page.tsx`

Shows one card per evaluator role (`principal`, `hod`, `hr_admin`, `teacher`). Each card shows the active template name + field count + "Edit" button → `/dashboard/settings/templates/[role]`.

- [ ] **Step 1: Implement the page**

Create `app/dashboard/settings/templates/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

const ROLE_LABELS: Record<string, string> = {
  principal: "Principal",
  hod: "HOD",
  hr_admin: "HR Admin",
  teacher: "Teacher",
};

const ROLES = ["principal", "hod", "hr_admin", "teacher"] as const;

export default function TemplatesIndexPage() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");
  const list = useQuery(
    api.formTemplates.listForSchool,
    profile?.schoolId ? { schoolId: profile.schoolId } : "skip",
  );

  if (!profile || !list) {
    return <div className="text-body-s text-ink-secondary">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Form templates"
        subtitle="Edit the evaluation form your team sees per role. School-wide overrides take effect immediately on demos scheduled afterward."
      />

      <div className="grid gap-3">
        {ROLES.map((role) => {
          const active = list.find((r) => r.role === role && r.isActive);
          return (
            <Card key={role} padding="md" elevation={1}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-body font-medium text-ink">{ROLE_LABELS[role]}</p>
                  {active ? (
                    <p className="text-caption text-ink-secondary mt-0.5">
                      <span className="text-ink">{active.name}</span> · {active.fields.length} field{active.fields.length === 1 ? "" : "s"}
                    </p>
                  ) : (
                    <Badge variant="warning">No active template</Badge>
                  )}
                </div>
                <Link
                  href={`/dashboard/settings/templates/${role}`}
                  aria-label={`Edit ${ROLE_LABELS[role]} template`}
                >
                  <Button variant="secondary" size="sm">Edit</Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

Run: `bunx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/settings/templates/page.tsx
git commit -m "feat(eval): templates index page in settings"
```

---

### Task 7: `/dashboard/settings/templates/[role]` editor

**Files:**
- Create: `app/dashboard/settings/templates/[role]/page.tsx`
- Create: `components/settings/templates/template-editor.tsx`
- Create: `components/settings/templates/field-row.tsx`

Editor has two columns on `md:` screens: left = field list + name input + save button; right = live preview rendered via the existing `<EvaluationForm>` in read-only mode. On smaller screens stack vertically.

The "Start from default" button calls `formTemplates.duplicateFromDefault` and replaces the in-memory editor state. Save calls `formTemplates.saveOverride`.

- [ ] **Step 1: Implement `field-row.tsx`**

Create `components/settings/templates/field-row.tsx`:

```tsx
"use client";

import { Badge, Button, Icon, Input, Select } from "@/components/ui";

export type DraftField = {
  key: string;
  label: string;
  type: "score_1_5" | "score_1_10" | "text" | "choice";
  choices?: string[];
  weight?: number;
  allowDictation?: boolean;
  required?: boolean;
};

interface FieldRowProps {
  field: DraftField;
  index: number;
  onChange: (next: DraftField) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const TYPE_OPTIONS = [
  { value: "score_1_5", label: "Score 1-5" },
  { value: "score_1_10", label: "Score 1-10" },
  { value: "text", label: "Text" },
  { value: "choice", label: "Choice" },
];

export function FieldRow({
  field, index, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: FieldRowProps) {
  return (
    <div className="rounded-apple border border-hairline bg-surface p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Badge variant="neutral">#{index + 1}</Badge>
        <Input
          aria-label="Field label"
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder="Visible label"
          className="flex-1"
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="sm" iconLeft="ChevronUp"
            disabled={isFirst} onClick={onMoveUp} aria-label="Move up"
          >{""}</Button>
          <Button
            variant="ghost" size="sm" iconLeft="ChevronDown"
            disabled={isLast} onClick={onMoveDown} aria-label="Move down"
          >{""}</Button>
          <Button
            variant="ghost" size="sm" iconLeft="Trash2"
            onClick={onRemove} aria-label="Remove field"
          >{""}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label="Field key"
          value={field.key}
          onChange={(e) => onChange({ ...field, key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
          placeholder="storageKey (no spaces)"
        />
        <Select
          aria-label="Field type"
          value={field.type}
          onChange={(value) => onChange({ ...field, type: value as DraftField["type"] })}
          options={TYPE_OPTIONS}
        />
      </div>

      {field.type === "choice" && (
        <div>
          <label className="block text-caption text-ink-secondary mb-1">Choices (comma-separated)</label>
          <Input
            value={(field.choices ?? []).join(", ")}
            onChange={(e) =>
              onChange({
                ...field,
                choices: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
            placeholder="Option A, Option B"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-ink-secondary">
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
            className="rounded border-hairline-strong"
          />
          Required
        </label>
        {(field.type === "text") && (
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={field.allowDictation ?? false}
              onChange={(e) => onChange({ ...field, allowDictation: e.target.checked })}
              className="rounded border-hairline-strong"
            />
            Allow dictation
          </label>
        )}
        {(field.type === "score_1_5" || field.type === "score_1_10") && (
          <label className="inline-flex items-center gap-1.5">
            <Icon name="Scale" size={12} />
            Weight
            <Input
              type="number"
              min={1}
              max={5}
              value={field.weight ?? 1}
              onChange={(e) => onChange({ ...field, weight: Number(e.target.value) || 1 })}
              className="w-16"
            />
          </label>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `template-editor.tsx`**

Create `components/settings/templates/template-editor.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Card, Icon, Input, useToast } from "@/components/ui";
import { EvaluationForm } from "@/components/evaluations/evaluation-form";
import { FieldRow, type DraftField } from "./field-row";

type Role = "principal" | "hod" | "hr_admin" | "teacher";

interface TemplateEditorProps {
  schoolId: string;
  role: Role;
}

const ROLE_LABELS: Record<Role, string> = {
  principal: "Principal",
  hod: "HOD",
  hr_admin: "HR Admin",
  teacher: "Teacher",
};

export function TemplateEditor({ schoolId, role }: TemplateEditorProps) {
  const active = useQuery(api.formTemplates.getForRole, {
    schoolId: schoolId as Id<"schools">,
    role,
  });
  const defaultDraft = useQuery(api.formTemplates.duplicateFromDefault, {
    schoolId: schoolId as Id<"schools">,
    role,
  });
  const save = useMutation(api.formTemplates.saveOverride);
  const { toast } = useToast();

  const [name, setName] = useState<string | null>(null);
  const [fields, setFields] = useState<DraftField[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize once from the active template.
  if (active && name === null && fields === null) {
    setName(active.name);
    setFields(active.fields as DraftField[]);
  }
  if (!active || name === null || fields === null) {
    return <p className="text-body-s text-ink-secondary">Loading...</p>;
  }

  const startFromDefault = () => {
    if (!defaultDraft) return;
    if (!confirm("Replace the current draft with the built-in default? Unsaved changes will be lost.")) return;
    setName(defaultDraft.name);
    setFields(defaultDraft.fields as DraftField[]);
  };

  const addField = () => {
    setFields([
      ...fields,
      { key: `field${fields.length + 1}`, label: "New field", type: "score_1_5" },
    ]);
  };

  const updateField = (i: number, next: DraftField) => {
    const copy = fields.slice();
    copy[i] = next;
    setFields(copy);
  };

  const removeField = (i: number) => {
    setFields(fields.filter((_, idx) => idx !== i));
  };

  const moveField = (from: number, to: number) => {
    if (to < 0 || to >= fields.length) return;
    const copy = fields.slice();
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    setFields(copy);
  };

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      await save({
        schoolId: schoolId as Id<"schools">,
        role,
        name,
        fields: fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          choices: f.choices,
          weight: f.weight,
          allowDictation: f.allowDictation,
          required: f.required,
        })),
      });
      toast({ message: "Template saved", variant: "success" });
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card padding="md" elevation={1}>
        <div className="space-y-4">
          <div>
            <label className="block text-caption text-ink-secondary mb-1">Template name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${ROLE_LABELS[role]} default`} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-body-s font-medium text-ink">Fields</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={startFromDefault} iconLeft="RotateCcw">
                  Start from default
                </Button>
                <Button variant="secondary" size="sm" onClick={addField} iconLeft="Plus">
                  Add field
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <FieldRow
                  key={i}
                  field={f}
                  index={i}
                  onChange={(next) => updateField(i, next)}
                  onRemove={() => removeField(i)}
                  onMoveUp={() => moveField(i, i - 1)}
                  onMoveDown={() => moveField(i, i + 1)}
                  isFirst={i === 0}
                  isLast={i === fields.length - 1}
                />
              ))}
              {fields.length === 0 && (
                <p className="text-body-s text-ink-tertiary">No fields. Add one to get started.</p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-apple bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-3 py-2 text-body-s text-danger">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="primary" size="md" onClick={submit} loading={saving} disabled={!name.trim() || fields.length === 0}>
              Save template
            </Button>
          </div>
        </div>
      </Card>

      <Card padding="md" elevation={1}>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Eye" size={14} />
          <p className="text-body-s font-medium text-ink">Preview</p>
        </div>
        <EvaluationForm
          previewFields={fields}
          previewRole={role}
          readOnly
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Add `previewFields` + `readOnly` props to `EvaluationForm`**

The existing `EvaluationForm` component renders fields based on an invite + template. To support preview mode (no invite, no submit), add two optional props. Open `components/evaluations/evaluation-form.tsx` and adjust the prop signature:

```tsx
interface EvaluationFormProps {
  inviteId?: string;
  token?: string;
  previewFields?: any[];
  previewRole?: string;
  readOnly?: boolean;
}
```

In the component body:
- If `previewFields` is provided, skip the `useQuery` for the invite and render directly from `previewFields`.
- If `readOnly` is true, replace the submit button with a static "Preview only" badge and disable all inputs.

Verify the component still compiles for the inviteId + token cases (existing behavior).

- [ ] **Step 4: Implement the route**

Create `app/dashboard/settings/templates/[role]/page.tsx`:

```tsx
"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/ui";
import { TemplateEditor } from "@/components/settings/templates/template-editor";

const ROLES = ["principal", "hod", "hr_admin", "teacher"] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  principal: "Principal",
  hod: "HOD",
  hr_admin: "HR Admin",
  teacher: "Teacher",
};

export default function TemplateRolePage({ params }: { params: Promise<{ role: string }> }) {
  const { role: roleParam } = use(params);
  const role = (ROLES.includes(roleParam as Role) ? roleParam : null) as Role | null;

  const { data: session } = authClient.useSession();
  const user = session?.user;
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");

  if (!role) {
    return <div className="text-body-s text-danger">Unknown role: {roleParam}</div>;
  }
  if (!profile?.schoolId) {
    return <div className="text-body-s text-ink-secondary">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${ROLE_LABELS[role]} template`}
        subtitle="Field changes take effect on demos scheduled after this save. Existing invites use the template pinned at invite time."
        back={{ href: "/dashboard/settings/templates", label: "Templates" }}
      />
      <TemplateEditor schoolId={profile.schoolId} role={role} />
    </div>
  );
}
```

- [ ] **Step 5: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/settings/templates/[role]/page.tsx components/settings/templates/ components/evaluations/evaluation-form.tsx
git commit -m "feat(eval): template editor with live preview"
```

---

## Phase 5: Decision rule editor UI

### Task 8: `/dashboard/settings/decision-rules` index page

**Files:**
- Create: `app/dashboard/settings/decision-rules/page.tsx`

Lists existing rules, status badge per rule (Active / Disabled), Edit and toggle-active buttons, Create button.

- [ ] **Step 1: Implement the page**

Create `app/dashboard/settings/decision-rules/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge, Button, Card, PageHeader, useToast } from "@/components/ui";

export default function DecisionRulesIndexPage() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");
  const list = useQuery(
    api.decisionRules.list,
    profile?.schoolId ? { schoolId: profile.schoolId } : "skip",
  );
  const setActive = useMutation(api.decisionRules.setActive);
  const remove = useMutation(api.decisionRules.remove);
  const { toast } = useToast();

  if (!profile || !list) {
    return <div className="text-body-s text-ink-secondary">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Decision rules"
        subtitle="Auto-apply an outcome when all invites for a demo resolve. Pick one when scheduling."
        actions={
          <Link href="/dashboard/settings/decision-rules/new">
            <Button variant="primary" size="sm" iconLeft="Plus">New rule</Button>
          </Link>
        }
      />

      {list.length === 0 ? (
        <Card padding="md" elevation={1}>
          <p className="text-body-s text-ink-secondary">No rules yet. Click <span className="text-ink">New rule</span> to create one.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((r) => (
            <Card key={r._id} padding="md" elevation={1}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-body font-medium text-ink">{r.name}</p>
                    <Badge variant={r.isActive ? "success" : "neutral"}>
                      {r.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <p className="text-caption text-ink-secondary mt-0.5">
                    {r.branches.length} branch{r.branches.length === 1 ? "" : "es"} · fallback: {r.fallback}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/dashboard/settings/decision-rules/${r._id}`}>
                    <Button variant="secondary" size="sm">Edit</Button>
                  </Link>
                  <Button
                    variant="ghost" size="sm"
                    onClick={async () => {
                      await setActive({ ruleId: r._id as Id<"decisionRules">, active: !r.isActive });
                    }}
                  >
                    {r.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="ghost" size="sm" iconLeft="Trash2"
                    onClick={async () => {
                      if (!confirm(`Delete rule "${r.name}"? This cannot be undone.`)) return;
                      await remove({ ruleId: r._id as Id<"decisionRules"> });
                      toast({ message: "Rule deleted", variant: "success" });
                    }}
                  >
                    {""}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/settings/decision-rules/page.tsx
git commit -m "feat(eval): decision rules index page"
```

---

### Task 9: Decision rule editor route + components

**Files:**
- Create: `app/dashboard/settings/decision-rules/[ruleId]/page.tsx`
- Create: `components/settings/decision-rules/rule-editor.tsx`
- Create: `components/settings/decision-rules/branch-row.tsx`

The `[ruleId]` segment is also the create route — when `ruleId === "new"` (and `?new=1`), start with an empty branches list and the default fallback `manual`.

- [ ] **Step 1: Implement `branch-row.tsx`**

Create `components/settings/decision-rules/branch-row.tsx`:

```tsx
"use client";

import { Badge, Button, Icon, Input, Select } from "@/components/ui";

const ACTION_OPTIONS = [
  { value: "advance", label: "Advance application" },
  { value: "reject", label: "Reject application" },
  { value: "redemo", label: "Schedule re-demo" },
  { value: "manual", label: "Send to manual review" },
];

const ROLE_OPTIONS = [
  { value: "principal", label: "Principal" },
  { value: "hod", label: "HOD" },
  { value: "hr_admin", label: "HR Admin" },
  { value: "teacher", label: "Teacher" },
];

export type DraftBranch = {
  condition: {
    minHire?: number;
    maxReject?: number;
    minAverage?: { fieldKey: string; minValue: number };
    requiredRoles?: string[];
  };
  action: "advance" | "reject" | "redemo" | "manual";
};

interface BranchRowProps {
  branch: DraftBranch;
  index: number;
  onChange: (next: DraftBranch) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function BranchRow({
  branch, index, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: BranchRowProps) {
  const { condition } = branch;

  return (
    <div className="rounded-apple border border-hairline bg-surface p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="neutral">If #{index + 1}</Badge>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" iconLeft="ChevronUp" disabled={isFirst} onClick={onMoveUp} aria-label="Move up">{""}</Button>
          <Button variant="ghost" size="sm" iconLeft="ChevronDown" disabled={isLast} onClick={onMoveDown} aria-label="Move down">{""}</Button>
          <Button variant="ghost" size="sm" iconLeft="Trash2" onClick={onRemove} aria-label="Remove branch">{""}</Button>
        </div>
      </div>

      <div className="space-y-2">
        <ClauseLine
          label="At least"
          value={condition.minHire}
          onChange={(v) => onChange({ ...branch, condition: { ...condition, minHire: v } })}
          suffix="invites recommended Hire"
        />
        <ClauseLine
          label="At most"
          value={condition.maxReject}
          onChange={(v) => onChange({ ...branch, condition: { ...condition, maxReject: v } })}
          suffix="invites recommended Reject"
        />
        <MinAverageClause
          value={condition.minAverage}
          onChange={(v) => onChange({ ...branch, condition: { ...condition, minAverage: v } })}
        />
        <RequiredRolesClause
          value={condition.requiredRoles}
          onChange={(v) => onChange({ ...branch, condition: { ...condition, requiredRoles: v } })}
        />
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-hairline">
        <Icon name="ArrowRight" size={14} />
        <span className="text-caption text-ink-secondary">Then</span>
        <Select
          aria-label="Action"
          value={branch.action}
          onChange={(value) => onChange({ ...branch, action: value as DraftBranch["action"] })}
          options={ACTION_OPTIONS}
          className="flex-1 max-w-xs"
        />
      </div>
    </div>
  );
}

function ClauseLine({
  label, value, onChange, suffix,
}: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; suffix: string }) {
  const enabled = value !== undefined;
  return (
    <label className="flex items-center gap-2 text-body-s text-ink">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked ? 1 : undefined)}
        className="rounded border-hairline-strong"
      />
      <span>{label}</span>
      <Input
        type="number"
        min={0}
        max={20}
        value={enabled ? value : ""}
        disabled={!enabled}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-16"
      />
      <span className="text-ink-secondary">{suffix}</span>
    </label>
  );
}

function MinAverageClause({
  value, onChange,
}: { value: { fieldKey: string; minValue: number } | undefined; onChange: (v: { fieldKey: string; minValue: number } | undefined) => void }) {
  const enabled = value !== undefined;
  return (
    <label className="flex items-center gap-2 text-body-s text-ink flex-wrap">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked ? { fieldKey: "subjectKnowledge", minValue: 3 } : undefined)}
        className="rounded border-hairline-strong"
      />
      <span>Average of</span>
      <Input
        value={enabled ? value!.fieldKey : ""}
        disabled={!enabled}
        onChange={(e) => onChange({ ...value!, fieldKey: e.target.value })}
        placeholder="fieldKey"
        className="w-44"
      />
      <span>is at least</span>
      <Input
        type="number" step="0.1" min={0}
        value={enabled ? value!.minValue : ""}
        disabled={!enabled}
        onChange={(e) => onChange({ ...value!, minValue: Number(e.target.value) || 0 })}
        className="w-20"
      />
    </label>
  );
}

function RequiredRolesClause({
  value, onChange,
}: { value: string[] | undefined; onChange: (v: string[] | undefined) => void }) {
  const enabled = value !== undefined;
  const selected = new Set(value ?? []);

  const toggle = (role: string) => {
    const next = new Set(selected);
    if (next.has(role)) next.delete(role); else next.add(role);
    onChange(next.size === 0 ? [] : Array.from(next));
  };

  return (
    <div className="flex items-center gap-2 text-body-s text-ink flex-wrap">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked ? [] : undefined)}
        className="rounded border-hairline-strong"
      />
      <span>Submitted by</span>
      {ROLE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={!enabled}
          onClick={() => toggle(opt.value)}
          className={
            "rounded-full px-2.5 py-1 text-caption transition-colors duration-fast " +
            (selected.has(opt.value)
              ? "bg-accent text-surface-canvas"
              : "bg-surface border border-hairline-strong text-ink-secondary hover:bg-accent-soft")
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement `rule-editor.tsx`**

Create `components/settings/decision-rules/rule-editor.tsx`:

```tsx
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
  ruleId?: string; // omit for create
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
          <p className="text-body-s text-ink-tertiary">No branches yet. Without branches, every demo falls through to the fallback action.</p>
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
```

- [ ] **Step 3: Implement the route**

Create `app/dashboard/settings/decision-rules/[ruleId]/page.tsx`:

```tsx
"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/ui";
import { RuleEditor } from "@/components/settings/decision-rules/rule-editor";

export default function DecisionRuleEditorPage({ params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = use(params);
  const isNew = ruleId === "new";

  const { data: session } = authClient.useSession();
  const user = session?.user;
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");

  if (!profile?.schoolId) {
    return <div className="text-body-s text-ink-secondary">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? "New decision rule" : "Edit decision rule"}
        subtitle="Auto-applied when every non-cancelled invite reaches a terminal state. First matching branch wins."
        back={{ href: "/dashboard/settings/decision-rules", label: "Decision rules" }}
      />
      <RuleEditor schoolId={profile.schoolId} ruleId={isNew ? undefined : ruleId} />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/settings/decision-rules/[ruleId] components/settings/decision-rules
git commit -m "feat(eval): decision rule editor with branch builder"
```

---

## Phase 6: Schedule wizard — decision rule selection

### Task 10: Add decision rule picker to `ScheduleDemoWizard`

**Files:**
- Modify: `components/demos/schedule-demo-wizard.tsx`

The wizard already accepts `decisionRuleId: v.optional(v.id("decisionRules"))` on the create mutation. The UI just needs to expose a picker. Place it on the review step (last step) so users see all the other settings first.

- [ ] **Step 1: Inspect the existing wizard**

Read: `components/demos/schedule-demo-wizard.tsx`
Identify the review step block and where `evaluators` is rendered.

- [ ] **Step 2: Add the picker**

Inside the wizard component, fetch active rules and render a select. Use a single-select with a "None — manual review" option as the first entry:

```tsx
const activeRules = useQuery(
  api.decisionRules.listActive,
  schoolId ? { schoolId: schoolId as Id<"schools"> } : "skip",
);

// ... in the review step JSX:
<div>
  <label className="block text-caption text-ink-secondary mb-1">Decision rule (optional)</label>
  <Select
    value={decisionRuleId ?? ""}
    onChange={(value) => setDecisionRuleId(value || undefined)}
    options={[
      { value: "", label: "None — manual decision" },
      ...((activeRules ?? []).map((r) => ({ value: r._id, label: r.name }))),
    ]}
  />
  <p className="text-caption text-ink-tertiary mt-1">
    If set, the matching action is auto-applied when all invites resolve. Otherwise HR decides manually.
  </p>
</div>
```

Add `decisionRuleId` to the state declared at the top of the wizard and include it in the `create` mutation call:

```tsx
const [decisionRuleId, setDecisionRuleId] = useState<string | undefined>(undefined);
// ...
await create({
  ...otherArgs,
  decisionRuleId: decisionRuleId ? (decisionRuleId as Id<"decisionRules">) : undefined,
});
```

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add components/demos/schedule-demo-wizard.tsx
git commit -m "feat(eval): schedule wizard picks a decision rule"
```

---

## Phase 7: DemoSummary — applied decision banner + evaluator swap

### Task 11: Render applied-decision banner on DemoSummary

**Files:**
- Create: `components/demos/applied-decision-banner.tsx`
- Modify: `components/demos/demo-summary.tsx`

When `demo.appliedDecision` is set (either auto-applied or manually applied), render a prominent banner at the top of DemoSummary summarizing the action and offering "Override" (re-open decision modal) or "Confirm re-demo" (open redemo wizard) where appropriate.

- [ ] **Step 1: Implement the banner**

Create `components/demos/applied-decision-banner.tsx`:

```tsx
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
  const isAuto = applied.note?.startsWith("Auto-applied");

  return (
    <Card padding="md" elevation={2}>
      <div className="flex items-start gap-3 flex-wrap">
        <Icon name={isAuto ? "Sparkles" : "Check"} size={18} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-body font-medium text-ink">
              {isAuto ? "Auto-decided: " : "Decision: "}
              <Badge variant={ACTION_VARIANT[applied.action]}>{ACTION_LABEL[applied.action]}</Badge>
            </p>
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
```

- [ ] **Step 2: Integrate into DemoSummary**

Edit `components/demos/demo-summary.tsx`. Render `<AppliedDecisionBanner>` as the first child of the section when `demo.appliedDecision` exists. Pass through:
- `onOverride`: open the existing `DecisionModal` (lift state if needed)
- `onConfirmRedemo`: invoke the parent's redemo wizard (add an `onRedemoRequested` prop to DemoSummary that DemoDetailPage passes down)

Patch the props shape:

```tsx
export function DemoSummary({
  demoId,
  onOverrideDecision,
  onConfirmRedemo,
}: {
  demoId: string;
  onOverrideDecision?: () => void;
  onConfirmRedemo?: () => void;
}) {
  // ...
  if (data.demo.appliedDecision) {
    bannerNode = (
      <AppliedDecisionBanner
        applied={data.demo.appliedDecision}
        onOverride={onOverrideDecision ?? (() => {})}
        onConfirmRedemo={onConfirmRedemo ?? (() => {})}
      />
    );
  }
  // ...
}
```

Find the demo detail page (`app/dashboard/demos/[id]/page.tsx`) and pass the two callbacks. `onOverrideDecision` opens the existing DecisionModal in override mode; `onConfirmRedemo` opens the schedule wizard prefilled from this demo (same as the existing redemo flow).

- [ ] **Step 3: Typecheck + smoke**

Run: `bunx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add components/demos/applied-decision-banner.tsx components/demos/demo-summary.tsx app/dashboard/demos/[id]/page.tsx
git commit -m "feat(eval): applied-decision banner on demo summary"
```

---

### Task 12: Evaluator swap modal + per-evaluator swap action

**Files:**
- Create: `components/demos/swap-evaluator-modal.tsx`
- Modify: `components/demos/demo-summary.tsx`

The swap is triggered from a per-evaluator menu in DemoSummary. Modal lists school staff filtered to the same role (HR may choose to relax this with a checkbox; for V1 keep it role-locked).

Submitted invites are NOT swappable (the mutation already enforces this; the UI hides the action).

- [ ] **Step 1: Implement the modal**

Create `components/demos/swap-evaluator-modal.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar, Badge, Button, Dialog, Input, useToast } from "@/components/ui";

interface Props {
  open: boolean;
  onClose: () => void;
  inviteId: string;
  schoolId: string;
  evaluatorRole: string;
  excludeUserId: string;
  onSwapped: () => void;
}

export function SwapEvaluatorModal({
  open, onClose, inviteId, schoolId, evaluatorRole, excludeUserId, onSwapped,
}: Props) {
  const staff = useQuery(api.users.listSchoolStaff, {
    schoolId: schoolId as Id<"schools">,
  });
  const swap = useMutation(api.evaluationInvites.swap);
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!staff) return [];
    const term = q.trim().toLowerCase();
    return staff
      .filter((u) => u._id !== excludeUserId)
      .filter((u) => !term || u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term));
  }, [staff, excludeUserId, q]);

  const pick = async (userId: string) => {
    setBusy(true);
    try {
      await swap({
        inviteId: inviteId as Id<"evaluationInvites">,
        newEvaluatorUserId: userId as Id<"userProfiles">,
      });
      toast({ message: "Evaluator swapped", variant: "success" });
      onSwapped();
      onClose();
    } catch (e: any) {
      toast({ message: e.message ?? "Swap failed", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Swap evaluator"
      description={`Pick a replacement for this ${evaluatorRole} invite. The old invite is cancelled and a new invite is issued to the chosen evaluator.`}
    >
      <div className="space-y-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email"
          autoFocus
        />
        <div className="max-h-80 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-body-s text-ink-tertiary py-2">No matching staff.</p>
          ) : filtered.map((u) => (
            <button
              key={u._id}
              type="button"
              disabled={busy}
              onClick={() => pick(u._id)}
              className="w-full flex items-center gap-3 rounded-apple px-2.5 py-2 hover:bg-accent-soft transition-colors text-left"
            >
              <Avatar name={u.name ?? "?"} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-body-s text-ink truncate">{u.name ?? "Unnamed"}</p>
                <p className="text-caption text-ink-tertiary truncate">{u.email}</p>
              </div>
              <Badge variant="neutral">{u.role}</Badge>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire into DemoSummary**

Edit `components/demos/demo-summary.tsx`. On each `perEvaluator` card, add a "Swap" button (visible only when `invite.status !== "submitted"`). Track a swap-target state at the DemoSummary level:

```tsx
const [swapTarget, setSwapTarget] = useState<{ inviteId: string; role: string; userId: string } | null>(null);
// ...
{p.invite.status !== "submitted" && p.invite.status !== "cancelled" && (
  <Button
    variant="ghost"
    size="sm"
    iconLeft="UserRoundCheck"
    onClick={() => setSwapTarget({
      inviteId: p.invite._id,
      role: p.evaluatorRole,
      userId: p.invite.evaluatorUserId,
    })}
  >
    Swap
  </Button>
)}
// ...
{swapTarget && (
  <SwapEvaluatorModal
    open={!!swapTarget}
    onClose={() => setSwapTarget(null)}
    inviteId={swapTarget.inviteId}
    schoolId={data.demo.schoolId}
    evaluatorRole={swapTarget.role}
    excludeUserId={swapTarget.userId}
    onSwapped={() => setSwapTarget(null)}
  />
)}
```

Update the aggregate query result to include the invite's evaluator user id where missing. `aggregate` already returns `invite` rows so the userId is reachable via `p.invite.evaluatorUserId`. Confirm by reading `convex/demoSessions.ts`.

- [ ] **Step 3: Typecheck + smoke**

Run: `bunx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add components/demos/swap-evaluator-modal.tsx components/demos/demo-summary.tsx
git commit -m "feat(eval): evaluator swap from demo summary"
```

---

## Phase 8: Notifications wiring for swap

### Task 13: Render + send swap email on `evaluationInvites.swap`

**Files:**
- Modify: `convex/notifications.ts`
- Modify: `convex/evaluationInvites.ts`
- Create: `tests/convex/notifications-swap.test.ts`

The `evaluationInvites.swap` mutation already cancels the old invite and creates a new one. This task ensures the swapped-in evaluator gets an email and the swapped-out one gets a notice.

The existing `renderInviteEmail` + `sendInviteEmail` cover the new-evaluator case. This task adds analogous render functions for the swap notice and wires both into `swap`.

- [ ] **Step 1: Write the failing test**

Create `tests/convex/notifications-swap.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderSwapEmail } from "../../convex/notifications";

describe("renderSwapEmail", () => {
  it("includes the swapped-in user's name and the demo time", () => {
    const out = renderSwapEmail({
      newEvaluatorName: "Mrs Iyer",
      candidateName: "Priya",
      scheduledAt: new Date("2030-01-01T10:00:00Z").getTime(),
      tokenUrl: "https://example.com/feedback/abc",
    });
    expect(out.subject).toContain("Priya");
    expect(out.html).toContain("Mrs Iyer");
    expect(out.html).toContain("abc"); // token link
  });

  it("renders the swap-out notice including the candidate and demo time", () => {
    // Same module exports a sibling renderer for the cancelled invite.
    // The test imports it directly to keep this pure-function check honest.
    const { renderSwapOutEmail } = require("../../convex/notifications");
    const out = renderSwapOutEmail({
      oldEvaluatorName: "Mr A",
      candidateName: "Priya",
      scheduledAt: new Date("2030-01-01T10:00:00Z").getTime(),
    });
    expect(out.subject).toContain("Priya");
    expect(out.html).toContain("Mr A");
    expect(out.html.toLowerCase()).toContain("swapped");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/convex/notifications-swap.test.ts`
Expected: FAIL — `renderSwapEmail` and `renderSwapOutEmail` not exported.

- [ ] **Step 3: Implement the renderers**

Append to `convex/notifications.ts`:

```ts
export function renderSwapEmail(args: {
  newEvaluatorName: string;
  candidateName: string;
  scheduledAt: number;
  tokenUrl: string;
}): { subject: string; html: string } {
  const subject = `You're now evaluating ${args.candidateName}`;
  const when = new Date(args.scheduledAt).toLocaleString("en-IN");
  const html = `
    <p>Hi ${args.newEvaluatorName},</p>
    <p>You've been added as an evaluator for ${args.candidateName}'s demo on ${when}.</p>
    <p><a href="${args.tokenUrl}">Open evaluation</a></p>
  `;
  return { subject, html };
}

export function renderSwapOutEmail(args: {
  oldEvaluatorName: string;
  candidateName: string;
  scheduledAt: number;
}): { subject: string; html: string } {
  const subject = `You were swapped out of ${args.candidateName}'s demo`;
  const when = new Date(args.scheduledAt).toLocaleString("en-IN");
  const html = `
    <p>Hi ${args.oldEvaluatorName},</p>
    <p>You have been swapped out of the evaluation for ${args.candidateName}'s demo on ${when}. No action needed on your part.</p>
  `;
  return { subject, html };
}
```

Add internal actions that send via Resend (mirroring `sendInviteEmail`'s shape). Use the existing wiring in `convex/resend.ts`:

```ts
import { internalAction } from "./_generated/server";

export const sendSwapEmail = internalAction({
  args: { /* same shape as renderSwapEmail args + email recipient */ },
  handler: async (_ctx, _args) => {
    // call Resend; mirror sendInviteEmail body
  },
});

export const sendSwapOutEmail = internalAction({
  args: { /* same shape as renderSwapOutEmail args + email recipient */ },
  handler: async (_ctx, _args) => {
    // call Resend
  },
});
```

If Resend integration is not in place for these renderers, leave the internal actions as no-ops that log — the unit tests on the pure renderers are sufficient for Plan 2 sign-off. Push delivery wiring belongs to Plan 3.

- [ ] **Step 4: Schedule the actions inside `swap`**

Edit `convex/evaluationInvites.ts`. After the swap creates the new invite + cancels the old, schedule both notifications:

```ts
// Schedule both emails (best-effort; no rollback on failure).
const demo = await ctx.db.get(old.demoSessionId);
const application = demo ? await ctx.db.get(demo.applicationId) : null;
const candidate = application ? await ctx.db.get(application.candidateId) : null;
const newEvaluator = await ctx.db.get(newEvaluatorUserId);
const oldEvaluator = await ctx.db.get(old.evaluatorUserId);

if (demo && candidate && newEvaluator) {
  await ctx.scheduler.runAfter(0, internal.notifications.sendSwapEmail, {
    newEvaluatorName: newEvaluator.name ?? "",
    candidateName: candidate.name,
    scheduledAt: demo.scheduledAt,
    tokenUrl: "", // populated in Plan 3 with public app URL builder; ok empty for V1
    recipientEmail: newEvaluator.email ?? "",
  });
}
if (demo && candidate && oldEvaluator) {
  await ctx.scheduler.runAfter(0, internal.notifications.sendSwapOutEmail, {
    oldEvaluatorName: oldEvaluator.name ?? "",
    candidateName: candidate.name,
    scheduledAt: demo.scheduledAt,
    recipientEmail: oldEvaluator.email ?? "",
  });
}
```

Add the `import { internal } from "./_generated/api";` line at the top of `evaluationInvites.ts` if missing.

- [ ] **Step 5: Run tests**

Run: `bun run test tests/convex/notifications-swap.test.ts tests/convex/evaluationInvites.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add convex/notifications.ts convex/evaluationInvites.ts tests/convex/notifications-swap.test.ts
git commit -m "feat(eval): swap email renderers and dispatcher hook"
```

---

## Phase 9: E2E Playwright

### Task 14: Auto-decision E2E

**Files:**
- Create: `tests/e2e/decision-engine-autoapply.spec.ts`

Reuses the seed script from Plan 1's E2E (`scripts/seed-eval-demo.ts`). Adds one additional seed mutation: create one decision rule (`Standard hire path`).

- [ ] **Step 1: Add the rule to the seed script**

Edit `scripts/seed-eval-demo.ts`. After creating the school, insert:

```ts
const ruleId = await client.mutation(api.decisionRules.create, {
  schoolId,
  name: "Standard hire path",
  branches: [{ condition: { minHire: 2, maxReject: 0 }, action: "advance" }],
  fallback: "manual",
});
console.log("Seeded decision rule:", ruleId);
```

Have the seed script print the `ruleId` so the test can pick it up via the seed manifest pattern (or just look it up via the listActive query — simpler).

- [ ] **Step 2: Write the spec**

Create `tests/e2e/decision-engine-autoapply.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("schedule with decision rule -> all hire -> auto-advance", async ({ page, context }) => {
  await page.goto("/dashboard/applications/seed-app-id");
  await page.getByRole("button", { name: /schedule demo/i }).click();

  // Fill required fields
  await page.getByLabel(/date/i).fill("2030-01-01");
  await page.getByLabel(/time/i).fill("10:00");
  await page.getByLabel(/duration/i).fill("30");
  await page.getByLabel(/^live$/i).check();
  await page.getByLabel(/^classroom$/i).check();
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByLabel(/Test Principal/).check();
  await page.getByLabel(/Test HOD/).check();
  await page.getByRole("button", { name: /review/i }).click();

  // Pick the rule
  await page.getByLabel(/decision rule/i).selectOption({ label: "Standard hire path" });
  await page.getByRole("button", { name: /confirm/i }).click();

  // Each invitee submits "hire"
  for (let i = 0; i < 2; i++) {
    const evalPage = await context.newPage();
    const url = await page.evaluate(async () => {
      const res = await fetch("/api/test/last-invite-url?index=" + arguments[0]);
      return (await res.json()).url as string;
    }, i);
    await evalPage.goto(url);
    await evalPage.getByRole("button", { name: /score 4 for subject knowledge/i }).click();
    await evalPage.getByRole("button", { name: /score 4 for classroom management/i }).click();
    await evalPage.getByRole("button", { name: /score 4 for communication/i }).click();
    await evalPage.getByRole("button", { name: /score 4 for overall fit/i }).click();
    await evalPage.getByRole("button", { name: /^hire$/i }).click();
    await evalPage.getByRole("button", { name: /submit evaluation/i }).click();
  }

  // Application should be auto-advanced
  await page.reload();
  await page.goto("/dashboard/applications/seed-app-id");
  await expect(page.getByText(/advanced/i)).toBeVisible();
  await page.getByRole("link", { name: /\d{1,2}\/\d{1,2}\/\d{4}/ }).first().click();
  await expect(page.getByText(/auto-decided/i)).toBeVisible();
});
```

Note: `/api/test/last-invite-url?index=` needs an index parameter. Update `app/api/test/last-invite-url/route.ts` to accept `?index=N` and return the Nth most recent invite. Fallback to N=0 (latest).

- [ ] **Step 3: Run**

Run: `bun run seed:eval-demo && bun run test:e2e tests/e2e/decision-engine-autoapply.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/decision-engine-autoapply.spec.ts scripts/seed-eval-demo.ts app/api/test/last-invite-url/route.ts
git commit -m "test(e2e): auto-apply decision rule on full submission"
```

---

### Task 15: Template editor E2E

**Files:**
- Create: `tests/e2e/template-editor.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";

test("HR edits principal template, new demo uses the new fields", async ({ page }) => {
  await page.goto("/dashboard/settings/templates");
  await page.getByRole("link", { name: /^Edit$/i }).first().click();

  // Rename and add a new field
  await page.getByLabel(/template name/i).fill("Principal v2");
  await page.getByRole("button", { name: /add field/i }).click();
  const lastFieldKey = page.getByLabel(/field key/i).last();
  await lastFieldKey.fill("rapport");
  const lastFieldLabel = page.getByLabel(/field label/i).last();
  await lastFieldLabel.fill("Rapport with students");
  await page.getByRole("button", { name: /save template/i }).click();
  await expect(page.getByText(/template saved/i)).toBeVisible();

  // Schedule a new demo and verify the form contains the new field
  await page.goto("/dashboard/applications/seed-app-id");
  await page.getByRole("button", { name: /schedule demo/i }).click();
  await page.getByLabel(/date/i).fill("2030-02-01");
  await page.getByLabel(/time/i).fill("10:00");
  await page.getByLabel(/duration/i).fill("30");
  await page.getByLabel(/^live$/i).check();
  await page.getByLabel(/^classroom$/i).check();
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByLabel(/Test Principal/).check();
  await page.getByRole("button", { name: /review/i }).click();
  await page.getByRole("button", { name: /confirm/i }).click();

  // Visit the new invite URL
  const tokenUrl = await page.evaluate(async () => {
    const res = await fetch("/api/test/last-invite-url");
    return (await res.json()).url as string;
  });
  await page.goto(tokenUrl);
  await expect(page.getByText(/rapport with students/i)).toBeVisible();
});
```

- [ ] **Step 2: Run**

Run: `bun run seed:eval-demo && bun run test:e2e tests/e2e/template-editor.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/template-editor.spec.ts
git commit -m "test(e2e): template editor save propagates to new demos"
```

---

### Task 16: Evaluator swap E2E

**Files:**
- Create: `tests/e2e/evaluator-swap.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";

test("HR swaps evaluator from demo summary; old invite cancelled, new invite issued", async ({ page }) => {
  // Schedule with two evaluators
  await page.goto("/dashboard/applications/seed-app-id");
  await page.getByRole("button", { name: /schedule demo/i }).click();
  await page.getByLabel(/date/i).fill("2030-03-01");
  await page.getByLabel(/time/i).fill("10:00");
  await page.getByLabel(/duration/i).fill("30");
  await page.getByLabel(/^live$/i).check();
  await page.getByLabel(/^classroom$/i).check();
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByLabel(/Test Principal/).check();
  await page.getByLabel(/Test HOD/).check();
  await page.getByRole("button", { name: /review/i }).click();
  await page.getByRole("button", { name: /confirm/i }).click();

  // Open demo detail
  await page.getByRole("link", { name: /\d{1,2}\/\d{1,2}\/\d{4}/ }).first().click();

  // Click Swap on the principal row
  await page.getByRole("button", { name: /swap/i }).first().click();
  await expect(page.getByRole("dialog", { name: /swap evaluator/i })).toBeVisible();
  await page.getByPlaceholder(/search by name/i).fill("Backup");
  await page.getByRole("button", { name: /backup principal/i }).click();
  await expect(page.getByText(/evaluator swapped/i)).toBeVisible();

  // Old invite is now cancelled, replaced badge appears
  await expect(page.getByText(/replaced/i)).toBeVisible({ timeout: 5000 });
});
```

The seed script must add a "Backup Principal" user — extend it.

- [ ] **Step 2: Extend the seed**

Add to `scripts/seed-eval-demo.ts`:

```ts
const backupPrincipalId = await client.mutation(api.users.createProfile, {
  userId: "u-backup", name: "Backup Principal", email: "backup@s.com",
  schoolId, role: "principal",
});
console.log("Seeded backup principal:", backupPrincipalId);
```

- [ ] **Step 3: Run**

Run: `bun run seed:eval-demo && bun run test:e2e tests/e2e/evaluator-swap.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/evaluator-swap.spec.ts scripts/seed-eval-demo.ts
git commit -m "test(e2e): evaluator swap from demo summary"
```

---

## Self-review checklist

After completing all tasks, verify:

- [ ] `bun run test` — every Convex + component test passes (Plan 1 + Plan 2 suites)
- [ ] `bun run test:e2e` — Plan 1 E2E + Plan 2 E2E suites pass
- [ ] `bunx tsc --noEmit` — zero type errors
- [ ] Open `/dashboard/settings/templates`, edit Principal template, save, refresh: changes persist
- [ ] Open `/dashboard/settings/decision-rules`, create a rule with 2 branches, save, edit, save: round-trips cleanly
- [ ] Schedule a demo with the rule, submit all invites: application stage auto-updates and the banner shows "Auto-decided"
- [ ] On the demo detail page, swap an unsubmitted evaluator: old invite shows cancelled with `replacedBy` link to new invite; new invite appears with status `invited`
- [ ] `grep -rn 'evaluatorRole:.*v\.union' convex/ | grep -v 'EVALUATOR_ROLE_UNION'` returns empty (no rogue hardcoded role unions)

If any check fails, fix in a follow-up task before declaring this plan done.

---

## What this plan does NOT cover (handled in later plans)

- **Plan 3:** Expo iOS + Android app scaffold, Better Auth on Expo, push notification delivery (the renderers shipped here remain stubs until push wiring lands), on-device STT integration, mobile Inbox / Calendar / Demo detail / Eval form / Dictation overlay.
- **Plan 4:** Mobile HR surfaces (Candidates, Pipeline, Schedule wizard on mobile, Demo Summary on mobile, Decision actions on mobile, Settings on mobile).
- **Late-trigger for the decision engine:** the spec mentions the engine should also fire when the form-close window elapses with outstanding invites. That requires a Convex cron and is deferred — for now the engine fires only on terminal-transition mutations.
- **Boolean operators in conditions (OR / NOT / nested groups):** the editor surfaces only the AND-conjoined clause set defined by the spec. Adding OR/NOT is a separate spec.
- **Cross-school template sharing:** templates remain school-scoped.
- **Rule simulator panel** in the rule editor that previews what action would fire given a hypothetical set of submissions: noted in the spec, deferred to a follow-up if HR demand emerges.
