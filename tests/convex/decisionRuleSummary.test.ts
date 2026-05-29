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
