import { render, screen } from "@testing-library/react-native";
import { AppNav } from "@/navigation/app-nav";

jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false, error: null }),
    signIn: { magicLink: jest.fn() },
    signOut: jest.fn(),
  },
}));
jest.mock("@/hooks/use-register-push-token", () => ({
  useRegisterPushToken: () => undefined,
}));
jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => ({
    loading: false,
    isHR: false,
    role: null,
    permissions: [],
    userProfileId: null,
    schoolId: null,
  }),
}));

describe("AppNav", () => {
  it("renders the sign-in screen when there is no session", () => {
    render(<AppNav />);
    expect(screen.getByText("Send sign-in link")).toBeTruthy();
  });
});
