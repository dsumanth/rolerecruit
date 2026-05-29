# Decision Rules Redesign

Date: 2026-05-29
Status: Approved design, ready for implementation planning

## Problem

The decision rules editor in settings is written for engineers, not for the
principals and HR admins who actually configure it. Specific issues:

1. Jargon: "branches", "fallback", "terminal state", "non-cancelled invite",
   "first matching branch wins".
2. The score condition requires typing a raw internal field name
   (for example `subjectKnowledge`). A non-technical user cannot know these.
3. Only four fixed condition types exist, and the way they combine
   (AND inside a branch, first-match across branches) is implicit and
   unexplained.
4. No feedback about what a rule will actually do, so users cannot trust it.

The goal is a redesign that is both understandable by a non-technical user and
more flexible in what it can express.

## Background: how decision rules work today

A decision rule belongs to a school. A demo session has several invites, one
per evaluator (roles: principal, hod, hr_admin, teacher). Each evaluator
submits an evaluation with a recommendation (hire, maybe, reject) and scored
fields defined by a form template. When every non-cancelled invite reaches a
terminal state, the active rule is evaluated and an action is auto-applied:
advance, reject, redemo, or manual.

A rule today is `{ branches: Branch[], fallback: Action }`. Each branch is
`{ condition, action }`. The condition object ANDs up to four checks: `minHire`,
`maxReject`, `minAverage { fieldKey, minValue }`, `requiredRoles`. Branches are
evaluated in order and the first match wins; if none match, the fallback action
applies.

Relevant existing files:

- `app/dashboard/settings/decision-rules/page.tsx` (list)
- `app/dashboard/settings/decision-rules/[ruleId]/page.tsx` (editor page)
- `components/settings/decision-rules/rule-editor.tsx`
- `components/settings/decision-rules/branch-row.tsx`
- `convex/decisionRules.ts` (queries, mutations, validators)
- `convex/lib/decisionRuleEngine.ts` (pure evaluation engine)
- `mobile/src/screens/decision-rules.tsx` (read-only mobile view, out of scope)

## Goals

- Every part of the editor reads in plain, school-hiring language.
- A flexible, extensible set of conditions covering counts/proportions, score
  thresholds, who evaluated, and a specific evaluator's verdict (veto).
- Each outcome step lets the user choose whether ALL or ANY of its conditions
  must be true.
- Understanding aids: a live plain-English summary, the ability to test a rule
  against a past demo, starter templates, and inline help.

## Non-goals

- Changing how or when rules are triggered (still on all invites resolving).
- Authoring rules on mobile. Mobile becomes read-only (see Mobile section);
  all create/edit happens on web.
- Natural-language free-text rule entry.

## Mental model and wording

A rule is an ordered list of outcome steps, read top to bottom, first match
wins, plus a final "Otherwise" step that always applies.

Wording changes:

- "branches" becomes "outcome steps" (numbered).
- "fallback" becomes the final "Otherwise..." step.
- "all invites reach a terminal state" becomes "once everyone has finished
  their evaluation".
- Actions are relabelled (values unchanged): advance is "Move forward",
  reject is "Reject", redemo is "Schedule another demo", manual is
  "Let me decide manually".

Each step reads: "When [ALL / ANY] of these are true: ...conditions...
then [Action]."

## Condition palette

An "Add condition" menu offers the following. Each renders as one sentence row
with inline controls and is individually removable.

| Type | Reads like |
| --- | --- |
| Recommendation count | "At least / At most / Exactly [N] people recommended [Hire/Maybe/Reject]" |
| Recommendation proportion | "[Majority / at least X%] recommended [Hire/Maybe/Reject]" |
| Score threshold | "Average of [field, grouped by form] is [at least / at most] [value]" |
| Overall score | "Overall weighted score is [at least / at most] [value]" |
| Who evaluated | "[All of / Any of] these submitted: [role chips]" |
| Specific verdict (veto) | "The [role] recommended [Hire/Maybe/Reject]" |

The score-field dropdown lists every score question across all active forms,
grouped and labelled by form (for example "Principal form > Subject
Knowledge"), per the chosen behaviour.

## Data model

Replace the fixed `condition` object with an outcome step that carries a
match mode and a list of typed conditions.

```ts
type RuleAction = "advance" | "reject" | "redemo" | "manual";
type Recommendation = "hire" | "maybe" | "reject";
type EvaluatorRole = "principal" | "hod" | "hr_admin" | "teacher";
type CompareOp = "atLeast" | "atMost" | "exactly"; // exactly only for counts

type Condition =
  | { type: "recCount"; rec: Recommendation; op: CompareOp; value: number }
  | { type: "recPercent"; rec: Recommendation; op: "atLeast" | "atMost"; value: number } // 0-100; majority is atLeast 51
  | { type: "scoreAvg"; formTemplateId?: string; fieldKey: string; op: "atLeast" | "atMost"; value: number }
  | { type: "overallScore"; op: "atLeast" | "atMost"; value: number }
  | { type: "roleSubmitted"; mode: "allOf" | "anyOf"; roles: EvaluatorRole[] }
  | { type: "roleVerdict"; role: EvaluatorRole; rec: Recommendation };

type OutcomeStep = { match: "all" | "any"; conditions: Condition[]; action: RuleAction };

type Rule = { steps: OutcomeStep[]; otherwise: RuleAction };
```

Notes:

- `scoreAvg.formTemplateId` is optional. When set, the average is computed only
  over evaluations using that form; when unset, it averages the field across any
  form that defines it (matching today's behaviour).
- `recPercent` is the denominator over all submitted evaluations. "Majority" is
  surfaced in the UI as a preset for `atLeast 51`.
- `overallScore` uses the same weighted-average computation already in the
  engine, applied across all weighted score fields of each evaluation.

### Convex schema and validators

The `decisionRules` table fields change from `branches` + `fallback` to
`steps` + `otherwise`. Per project convention (dev-only, clean cutover) the
shape is changed directly rather than kept backward compatible. If any decision
rules exist in the dev database, a one-time migration mutation converts old
`branches`/`fallback` documents into the new shape (each old branch becomes a
step with `match: "all"` and its conditions mapped one to one; `fallback`
becomes `otherwise`). New required nested fields follow the discriminated-union
shape above; the table-level `steps`/`otherwise` replace the old fields.

`convex/decisionRules.ts` validators (`BRANCH_VALIDATOR`, `ACTION_VALIDATOR`)
are rewritten as `STEP_VALIDATOR` (with a `v.union` of condition objects) and
reused by `create` and `update`.

## Engine

`convex/lib/decisionRuleEngine.ts` is updated to the new model:

- `evaluateRule` iterates `rule.steps`; a step matches when, for `match: "all"`,
  every condition is true, and for `match: "any"`, at least one is true.
  First matching step returns its action; otherwise returns `rule.otherwise`.
- A `conditionMatches(condition, snapshot)` function handles each `type`.
  Existing helpers (`countRecommendations`, `weightedAverage`,
  `submittedRoles`) are reused and extended (maybe counts, percentages,
  per-role verdict lookup, overall weighted score).
- The engine stays pure (no Convex context) so it is unit testable, and it
  returns enough detail for the tester (see below).

To support "test against a past demo", add a sibling pure function
`explainRule(input): { action, matchedStepIndex, steps: StepResult[] }` where
each `StepResult` lists per-condition pass/fail with a human-readable label.
`evaluateRule` can be a thin wrapper over `explainRule`.

## Plain-English summary

A new pure helper turns a `Rule` into a readable sentence or short list, for
example: "Once everyone finishes: if at least 2 recommended Hire and nobody
recommended Reject, Move forward. Otherwise, Let me decide manually."

Because both web and mobile use it, the helper lives in
`convex/lib/decisionRuleSummary.ts` (pure TypeScript, no Convex context), so it
can be imported from web (`@/convex/lib/...`) and mobile (`@convex/lib/...`)
alike. It is reused by:

- the web editor's live summary card (updates as the user edits),
- the web decision-rules list card subtitle (replaces "N branches, fallback:
  manual"),
- the mobile list and rule-detail views (see Mobile section).

The summary helper takes an optional field-label lookup as input (so it can
print "Subject Knowledge" instead of `subjectKnowledge`); when a label is not
provided it falls back to the raw key.

## Understanding aids

1. Live summary card at the top of the editor.
2. Test against a past demo: a panel that lets the user pick a recent completed
   demo for the school and shows the resulting action, which step matched, and a
   per-condition pass/fail explanation, driven by `explainRule`. This needs a
   Convex query that loads a recent completed demo's invites, evaluations, and
   templates as engine snapshots.
3. Starter templates: a small static set ("Standard hire path", "Strict,
   unanimous only", "Senior veto") offered when creating a new rule; selecting
   one pre-fills the editor state, which the user can then edit.
4. Inline help: short tooltips next to each condition type and the ALL/ANY
   toggle, in school-hiring terms, using existing UI tokens.

## Component structure

Split for single responsibility:

- `components/settings/decision-rules/rule-editor.tsx`: orchestrator and state
  (name, steps, otherwise, save). Renders summary, steps, tester.
- `outcome-step.tsx`: replaces `branch-row.tsx`. ALL/ANY toggle, ordered
  conditions, action select, move/remove.
- `condition-row.tsx`: renders one condition by `type` as a sentence.
- `condition-picker.tsx`: the "Add condition" menu.
- `field-picker.tsx`: grouped score-field dropdown, fed by a form-templates
  query.
- `rule-summary.tsx`: presentational wrapper over
  `convex/lib/decisionRuleSummary.ts`.
- `rule-tester.tsx`: the "test against a past demo" panel.
- `starter-templates.ts`: static starter rule data.

Existing `branch-row.tsx` is removed once `outcome-step.tsx` replaces it.

## Mobile

Mobile becomes read-only for decision rules, using the shared summary helper:

- `mobile/src/screens/decision-rules.tsx` (list): card subtitle uses
  `decisionRuleSummary` instead of `${branches.length} branch..., fallback:`.
  The "New rule" button is removed. Tapping a rule opens a read-only detail
  view (or expands inline) showing the full plain-English summary and the
  Active/Inactive badge.
- `mobile/src/screens/rule-editor.tsx` and the mobile-only
  `mobile/src/components/settings/branch-row` are removed, along with the
  `RuleEditor` route in `mobile/src/navigation/app-nav.tsx`. The existing
  `mobile/__tests__/screens/decision-rules.test.tsx` is updated to assert the
  summary text and the absence of editing controls.
- To render field labels in the summary, the mobile list queries active form
  templates for the school and passes the label lookup to the helper; if that
  query is not readily available it falls back to raw keys.

## Testing

Follow red-green TDD. Pure logic is unit tested first:

- `decisionRuleEngine` (`evaluateRule` and `explainRule`): one test per
  condition type, ALL vs ANY behaviour, step ordering/first-match, otherwise
  fallthrough, and edge cases (no submissions, missing field, zero-weight).
- `decisionRuleSummary`: representative rules produce the expected sentences,
  including field-label substitution and empty/otherwise-only rules.
- Convex validators accept valid new shapes and reject malformed ones.

Component behaviour (add/remove/reorder conditions, summary updates, tester
output) is verified in the running app, since these are interaction-driven.

## Open questions

- Whether to ship the dev migration mutation or simply recreate the few dev
  rules by hand. Default: write the small migration since it is cheap and safe.
