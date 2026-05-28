import { renderHook } from "@testing-library/react-native";

const mockUsePaginated = jest.fn();
jest.mock("convex/react", () => ({
  usePaginatedQuery: (...args: unknown[]) => mockUsePaginated(...args),
}));
jest.mock("@convex/_generated/api", () => ({
  api: { candidates: { listForSchool: "candidates:listForSchool" } },
}));

import { useCandidates } from "@/hooks/use-candidates";

describe("useCandidates", () => {
  beforeEach(() => mockUsePaginated.mockReset());

  it("passes schoolId + search filter to listForSchool", () => {
    mockUsePaginated.mockReturnValue({
      results: [],
      status: "CanLoadMore",
      loadMore: jest.fn(),
    });
    renderHook(() => useCandidates({ schoolId: "s1", initialSearch: "anu" }));
    const [, args] = mockUsePaginated.mock.calls[0];
    expect(args.schoolId).toBe("s1");
    expect(args.filter?.search).toBe("anu");
  });

  it("returns results from the paginated query", () => {
    mockUsePaginated.mockReturnValue({
      results: [{ _id: "c1", name: "Priya" }],
      status: "CanLoadMore",
      loadMore: jest.fn(),
    });
    const { result } = renderHook(() => useCandidates({ schoolId: "s1" }));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].name).toBe("Priya");
  });

  it("skips the paginated query when schoolId is null", () => {
    mockUsePaginated.mockReturnValue({
      results: [],
      status: "LoadingFirstPage",
      loadMore: jest.fn(),
    });
    renderHook(() => useCandidates({ schoolId: null }));
    const [, args] = mockUsePaginated.mock.calls[0];
    expect(args).toBe("skip");
  });
});
