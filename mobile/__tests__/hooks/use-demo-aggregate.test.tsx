import { renderHook } from "@testing-library/react-native";

const mockUseQuery = jest.fn();
jest.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
jest.mock("@convex/_generated/api", () => ({
  api: { demoSessions: { aggregate: "demoSessions:aggregate" } },
}));

import { useDemoAggregate } from "@/hooks/use-demo-aggregate";

describe("useDemoAggregate", () => {
  beforeEach(() => mockUseQuery.mockReset());

  it("returns loading=true until query resolves", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useDemoAggregate("d1"));
    expect(result.current.loading).toBe(true);
    expect(result.current.demo).toBeNull();
    expect(result.current.perEvaluator).toEqual([]);
  });

  it("returns demo + tallies when query resolves", () => {
    mockUseQuery.mockReturnValue({
      demo: { _id: "d1", status: "completed", appliedDecision: null },
      invitesByStatus: { submitted: 2, declined: 0, invited: 0 },
      recommendationTally: { hire: 2, maybe: 0, reject: 0 },
      dimensionAverages: { subjectKnowledge: 4.5 },
      perEvaluator: [],
    });
    const { result } = renderHook(() => useDemoAggregate("d1"));
    expect(result.current.loading).toBe(false);
    expect(result.current.recommendationTally?.hire).toBe(2);
    expect(result.current.dimensionAverages?.subjectKnowledge).toBe(4.5);
  });

  it("passes the demoId to the query", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderHook(() => useDemoAggregate("d1"));
    expect(mockUseQuery.mock.calls[0][0]).toBe("demoSessions:aggregate");
    expect(mockUseQuery.mock.calls[0][1]).toEqual({ demoId: "d1" });
  });

  it("skips when demoId is null", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderHook(() => useDemoAggregate(null));
    expect(mockUseQuery.mock.calls[0][1]).toBe("skip");
  });
});
