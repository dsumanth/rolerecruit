import { renderHook } from "@testing-library/react-native";

const mockUseQuery = jest.fn();
jest.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
jest.mock("@convex/_generated/api", () => ({
  api: { users: { getMobileRoleContext: "users:getMobileRoleContext" } },
}));

const mockUseSession = jest.fn();
jest.mock("@/hooks/use-session", () => ({ useSession: () => mockUseSession() }));

import { useRoleContext } from "@/hooks/use-role-context";

describe("useRoleContext", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseSession.mockReset();
  });

  it("returns loading=true while session is loading", () => {
    mockUseSession.mockReturnValue({ loading: true, user: null });
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useRoleContext());
    expect(result.current.loading).toBe(true);
  });

  it("returns isHR=false when not signed in", () => {
    mockUseSession.mockReturnValue({ loading: false, user: null });
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useRoleContext());
    expect(result.current.loading).toBe(false);
    expect(result.current.isHR).toBe(false);
  });

  it("returns isHR=true when query returns hr_admin", () => {
    mockUseSession.mockReturnValue({ loading: false, user: { id: "u1" } });
    mockUseQuery.mockReturnValue({
      isHR: true, role: "hr_admin", permissions: ["*"],
      userProfileId: "p1", schoolId: "s1",
    });
    const { result } = renderHook(() => useRoleContext());
    expect(result.current.isHR).toBe(true);
    expect(result.current.role).toBe("hr_admin");
  });
});
