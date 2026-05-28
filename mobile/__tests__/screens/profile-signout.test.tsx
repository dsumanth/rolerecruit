import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProfileScreen } from "@/screens/profile";

const mockSignOut = jest.fn();
jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { name: "Mrs Iyer", email: "p@s.com" }, session: { id: "s" } },
      isPending: false,
      error: null,
    }),
    signOut: () => mockSignOut(),
  },
}));

describe("ProfileScreen sign-out", () => {
  beforeEach(() => mockSignOut.mockClear());

  it("shows the user's name and signs out when tapped", () => {
    render(<ProfileScreen />);
    expect(screen.getByText("Mrs Iyer")).toBeTruthy();
    expect(screen.getByText("p@s.com")).toBeTruthy();
    fireEvent.press(screen.getByText("Sign out"));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
