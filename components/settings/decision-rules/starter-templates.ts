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
