import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export interface DemoAggregate {
  loading: boolean;
  demo: any | null;
  invitesByStatus: Record<string, number> | null;
  recommendationTally: Record<string, number> | null;
  dimensionAverages: Record<string, number> | null;
  perEvaluator: any[];
}

const LOADING: DemoAggregate = {
  loading: true,
  demo: null,
  invitesByStatus: null,
  recommendationTally: null,
  dimensionAverages: null,
  perEvaluator: [],
};

export function useDemoAggregate(demoId: string | null): DemoAggregate {
  const data = useQuery(
    api.demoSessions.aggregate,
    demoId ? { demoId: demoId as any } : "skip",
  );
  if (data === undefined) return LOADING;
  return {
    loading: false,
    demo: data.demo,
    invitesByStatus: data.invitesByStatus,
    recommendationTally: data.recommendationTally,
    dimensionAverages: data.dimensionAverages,
    perEvaluator: data.perEvaluator ?? [],
  };
}
