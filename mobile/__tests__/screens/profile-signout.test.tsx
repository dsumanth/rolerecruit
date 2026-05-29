import { render, screen, fireEvent } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";

const mockSignOut = jest.fn();
const mockNavigate = jest.fn();
const mockUseRoleContext = jest.fn();

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
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => mockUseRoleContext(),
}));

import { ProfileScreen } from "@/screens/profile";

describe("ProfileScreen sign-out", () => {
  beforeEach(() => {
    mockSignOut.mockClear();
    mockNavigate.mockClear();
    mockUseRoleContext.mockReturnValue({
      loading: false,
      isHR: false,
      role: null,
      permissions: [],
      userProfileId: null,
      schoolId: null,
    });
  });

  it("shows the user's name and signs out when tapped", () => {
    render(<ProfileScreen />);
    expect(screen.getByText("Mrs Iyer")).toBeTruthy();
    expect(screen.getByText("p@s.com")).toBeTruthy();
    fireEvent.press(screen.getByText("Sign out"));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("hides the Settings link for non-HR users", () => {
    render(<ProfileScreen />);
    expect(screen.queryByText("Settings")).toBeNull();
  });

  it("shows a Settings link for HR users that navigates to Settings", () => {
    mockUseRoleContext.mockReturnValue({
      loading: false,
      isHR: true,
      role: "hr_admin",
      permissions: [],
      userProfileId: "u1",
      schoolId: "s1",
    });
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText("Settings"));
    expect(mockNavigate).toHaveBeenCalledWith("Settings");
  });
});

describe("ProfileScreen notification permission", () => {
  beforeEach(() => {
    mockUseRoleContext.mockReturnValue({
      loading: false,
      isHR: false,
      role: null,
      permissions: [],
      userProfileId: null,
      schoolId: null,
    });
  });

  it("shows 'Enabled' when expo-notifications reports granted", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: "granted" });
    const { findByText } = render(<ProfileScreen />);
    expect(await findByText("Enabled")).toBeTruthy();
  });
});
