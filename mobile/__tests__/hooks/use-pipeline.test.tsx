import { renderHook } from "@testing-library/react-native";

const mockUseQuery = jest.fn();
const mockUsePaginated = jest.fn();
jest.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  usePaginatedQuery: (...args: unknown[]) => mockUsePaginated(...args),
}));
jest.mock("@convex/_generated/api", () => ({
  api: {
    jobs: { listBySchool: "jobs:listBySchool" },
    applications: { getPipelineForJob: "applications:getPipelineForJob" },
    pipeline_config: { getActiveStages: "pipeline_config:getActiveStages" },
  },
}));

import { usePipeline, groupByStage } from "@/hooks/use-pipeline";

describe("groupByStage", () => {
  it("buckets applications by stage id", () => {
    const out = groupByStage([
      { _id: "a1", stage: "sourced" },
      { _id: "a2", stage: "demo_scheduled" },
      { _id: "a3", stage: "sourced" },
    ] as any);
    expect(out.sourced).toHaveLength(2);
    expect(out.demo_scheduled).toHaveLength(1);
  });

  it("returns an empty bucket for stages with no applications", () => {
    expect(groupByStage([]).demo_scheduled ?? []).toEqual([]);
  });
});

describe("usePipeline", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUsePaginated.mockReset();
  });

  it("skips queries until schoolId is known", () => {
    mockUseQuery.mockReturnValue(undefined);
    mockUsePaginated.mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: jest.fn(),
    });
    renderHook(() => usePipeline({ schoolId: null }));
    const calls = mockUsePaginated.mock.calls;
    expect(calls[0][1]).toBe("skip");
  });

  it("skips applications query until a job is selected", () => {
    mockUseQuery.mockReturnValue([]);
    mockUsePaginated.mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: jest.fn(),
    });
    renderHook(() => usePipeline({ schoolId: "s1" }));
    const appsCall = mockUsePaginated.mock.calls.find(
      (c) => c[0] === "applications:getPipelineForJob",
    );
    expect(appsCall?.[1]).toBe("skip");
  });

  it("exposes jobs, stages, and applicationsByStage when data is loaded", () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === "pipeline_config:getActiveStages") {
        return [{ id: "sourced", name: "Sourced", order: 0 }];
      }
      return undefined;
    });
    mockUsePaginated.mockImplementation((ref: string) => {
      if (ref === "jobs:listBySchool") {
        return {
          results: [{ _id: "j1", title: "Math Teacher" }],
          status: "CanLoadMore",
          loadMore: jest.fn(),
        };
      }
      return {
        results: [],
        status: "CanLoadMore",
        loadMore: jest.fn(),
      };
    });
    const { result } = renderHook(() => usePipeline({ schoolId: "s1" }));
    expect(result.current.jobs).toEqual([{ _id: "j1", title: "Math Teacher" }]);
    expect(result.current.stages).toEqual([
      { id: "sourced", name: "Sourced", order: 0 },
    ]);
    expect(result.current.applicationsByStage).toEqual({});
  });
});
