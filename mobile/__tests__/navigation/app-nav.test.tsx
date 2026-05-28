import { render, screen } from "@testing-library/react-native";
import { AppNav } from "@/navigation/app-nav";

const mockUseSession = jest.fn();
const mockUseRoleContext = jest.fn();

jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => mockUseSession(),
    signIn: { magicLink: jest.fn() },
    signOut: jest.fn(),
  },
}));
jest.mock("@/hooks/use-register-push-token", () => ({
  useRegisterPushToken: () => undefined,
}));
jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => mockUseRoleContext(),
}));

jest.mock("@/screens/inbox", () => {
  const RN = require("react-native");
  return { InboxScreen: () => <RN.Text>InboxStub</RN.Text> };
});
jest.mock("@/screens/calendar", () => {
  const RN = require("react-native");
  return { CalendarScreen: () => <RN.Text>CalendarStub</RN.Text> };
});
jest.mock("@/screens/candidates", () => {
  const RN = require("react-native");
  return { CandidatesScreen: () => <RN.Text>CandidatesStub</RN.Text> };
});
jest.mock("@/screens/pipeline", () => {
  const RN = require("react-native");
  return { PipelineScreen: () => <RN.Text>PipelineStub</RN.Text> };
});
jest.mock("@/screens/profile", () => {
  const RN = require("react-native");
  return { ProfileScreen: () => <RN.Text>ProfileStub</RN.Text> };
});

describe("AppNav", () => {
  beforeEach(() => {
    mockUseSession.mockReset();
    mockUseRoleContext.mockReset();
  });

  it("renders the sign-in screen when there is no session", () => {
    mockUseSession.mockReturnValue({ data: null, isPending: false, error: null });
    mockUseRoleContext.mockReturnValue({
      loading: false,
      isHR: false,
      role: null,
      permissions: [],
      userProfileId: null,
      schoolId: null,
    });
    render(<AppNav />);
    expect(screen.getByText("Send sign-in link")).toBeTruthy();
  });

  it("renders HRTabs when signed in and isHR=true", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" }, session: { token: "tok" } },
      isPending: false,
      error: null,
    });
    mockUseRoleContext.mockReturnValue({
      loading: false,
      isHR: true,
      schoolId: "s1",
      userProfileId: "u1",
      role: "hr_admin",
      permissions: ["*"],
    });
    render(<AppNav />);
    expect(screen.getAllByText("Candidates").length).toBeGreaterThan(0);
  });
});
