import { renderHook } from "@testing-library/react-native";

const mockUseQuery = jest.fn();
jest.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
jest.mock("@convex/_generated/api", () => ({
  api: {
    users: { listSchoolStaff: "users:listSchoolStaff" },
    decisionRules: { listActive: "decisionRules:listActive" },
  },
}));

import { useStaffDirectory } from "@/hooks/use-staff-directory";
import { useActiveDecisionRules } from "@/hooks/use-active-decision-rules";

describe("useStaffDirectory", () => {
  beforeEach(() => mockUseQuery.mockReset());
  it("returns staff array from listSchoolStaff", () => {
    mockUseQuery.mockReturnValue([
      { _id: "u1", name: "Mrs Iyer", role: "principal" },
      { _id: "u2", name: "Mr Rao", role: "teacher" },
    ]);
    const { result } = renderHook(() => useStaffDirectory({ schoolId: "s1" }));
    expect(result.current.staff).toHaveLength(2);
    expect(result.current.staff[0]).toEqual({ _id: "u1", name: "Mrs Iyer", role: "principal" });
  });

  it("passes the schoolId to listSchoolStaff", () => {
    mockUseQuery.mockReturnValue([]);
    renderHook(() => useStaffDirectory({ schoolId: "s1" }));
    expect(mockUseQuery.mock.calls[0][0]).toBe("users:listSchoolStaff");
    expect(mockUseQuery.mock.calls[0][1]).toEqual({ schoolId: "s1" });
  });

  it("skips when schoolId is null", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderHook(() => useStaffDirectory({ schoolId: null }));
    expect(mockUseQuery.mock.calls[0][1]).toBe("skip");
  });

  it("reports loading when the query is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useStaffDirectory({ schoolId: "s1" }));
    expect(result.current.loading).toBe(true);
    expect(result.current.staff).toEqual([]);
  });
});

describe("useActiveDecisionRules", () => {
  beforeEach(() => mockUseQuery.mockReset());
  it("returns active rules", () => {
    mockUseQuery.mockReturnValue([{ _id: "r1", name: "Strict Hire" }]);
    const { result } = renderHook(() => useActiveDecisionRules({ schoolId: "s1" }));
    expect(result.current.rules).toEqual([{ _id: "r1", name: "Strict Hire" }]);
  });

  it("skips when schoolId is null", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderHook(() => useActiveDecisionRules({ schoolId: null }));
    expect(mockUseQuery.mock.calls[0][1]).toBe("skip");
  });
});
