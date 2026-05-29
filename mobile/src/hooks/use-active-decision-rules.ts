import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export interface DecisionRuleRow {
  _id: string;
  name: string;
}

export function useActiveDecisionRules({ schoolId }: { schoolId: string | null }) {
  const rows = useQuery(
    api.decisionRules.listActive,
    schoolId ? { schoolId: schoolId as any } : "skip",
  );
  return {
    rules: (rows ?? []) as DecisionRuleRow[],
    loading: rows === undefined,
  };
}
