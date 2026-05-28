import { describe, it, expect } from "vitest";
import { evaluateRule, type RuleInput } from "../../convex/lib/decisionRuleEngine";

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

  it("treats minAverage clause as unmet when no submitted evaluation contains the field", () => {
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
      rolesSubmitted: ["principal", "hr_admin"],
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
        { condition: { maxReject: 5 }, action: "manual" },
        { condition: { minHire: 1 }, action: "advance" },
      ],
      fallback: "reject",
      recs: ["hire"],
    });
    expect(evaluateRule(input)).toBe("manual");
  });
});
