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
