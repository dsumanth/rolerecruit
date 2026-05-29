import { renderHook } from "@testing-library/react-native";
import { useSession } from "@/hooks/use-session";

jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false, error: null }),
    signOut: jest.fn(),
  },
}));

describe("useSession", () => {
  it("returns signed-out state when there is no session", () => {
    const { result } = renderHook(() => useSession());
    expect(result.current.signedIn).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
