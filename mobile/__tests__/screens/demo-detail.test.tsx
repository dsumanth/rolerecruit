import { render, screen, fireEvent } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";

const mockRole = jest.fn();
jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => mockRole(),
}));

import { DemoDetailScreen } from "@/screens/demo-detail";

const mockInvite = { _id: "i_me", status: "invited", evaluatorUserId: "u_me", evaluatorRole: "principal" };
const mockSibling = { _id: "i_other", status: "submitted", evaluatorUserId: "u_other", evaluatorRole: "hod" };
const mockDemo = {
  _id: "d1",
  applicationId: "app1",
  mode: "live" as const,
  scheduledAt: Date.now() + 60 * 60_000,
  durationMinutes: 30,
  format: "classroom" as const,
  location: "Room 12B",
};

jest.mock("convex/react", () => ({
  useQuery: jest.fn().mockImplementation((q: any) => {
    if (q === "applications:getWithCandidateAndJob") return { name: "Priya", subject: "Maths", _id: "app1" };
    if (q === "demoSessions:get") return mockDemo;
    if (q === "evaluationInvites:listForDemoWithProfiles") {
      return [
        { ...mockInvite, profile: { _id: "u_me", name: "Mrs Iyer" } },
        { ...mockSibling, profile: { _id: "u_other", name: "Mr Khan" } },
      ];
    }
    return null;
  }),
  useMutation: () => jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@convex/_generated/api", () => ({
  api: {
    applications: { getWithCandidateAndJob: "applications:getWithCandidateAndJob" },
    demoSessions: { get: "demoSessions:get" },
    evaluationInvites: {
      listForDemoWithProfiles: "evaluationInvites:listForDemoWithProfiles",
      markViewed: "evaluationInvites:markViewed",
    },
  },
}));

function withNav(node: React.ReactNode) {
  return <NavigationContainer>{node}</NavigationContainer>;
}

describe("DemoDetailScreen", () => {
  beforeEach(() => {
    mockRole.mockReturnValue({ isHR: false, userProfileId: "u_me", schoolId: "s1" });
  });

  it("shows the candidate name, location, and the sibling evaluator with only status (no scores)", () => {
    render(
      withNav(
        <DemoDetailScreen
          navigation={{ navigate: jest.fn() } as any}
          route={{ params: { demoId: "d1", inviteId: "i_me" } } as any}
        />,
      ),
    );
    expect(screen.getByText("Priya")).toBeTruthy();
    expect(screen.getByText(/Room 12B/)).toBeTruthy();
    expect(screen.getByText("Mr Khan")).toBeTruthy();
    expect(screen.getByText("Submitted")).toBeTruthy();
  });

  it("renders Start evaluation CTA", () => {
    const navigate = jest.fn();
    render(
      withNav(
        <DemoDetailScreen
          navigation={{ navigate } as any}
          route={{ params: { demoId: "d1", inviteId: "i_me" } } as any}
        />,
      ),
    );
    const cta = screen.getByText("Start evaluation");
    fireEvent.press(cta);
    expect(navigate).toHaveBeenCalledWith("EvaluationForm", { inviteId: "i_me", demoId: "d1" });
  });

  it("hides View summary link for non-HR users", () => {
    mockRole.mockReturnValue({ isHR: false, userProfileId: "u_me", schoolId: "s1" });
    render(
      withNav(
        <DemoDetailScreen
          navigation={{ navigate: jest.fn() } as any}
          route={{ params: { demoId: "d1", inviteId: "i_me" } } as any}
        />,
      ),
    );
    expect(screen.queryByText("View summary")).toBeNull();
  });

  it("shows View summary link for HR users and navigates to DemoSummary", () => {
    mockRole.mockReturnValue({ isHR: true, userProfileId: "u_hr", schoolId: "s1" });
    const navigate = jest.fn();
    render(
      withNav(
        <DemoDetailScreen
          navigation={{ navigate } as any}
          route={{ params: { demoId: "d1", inviteId: "i_me" } } as any}
        />,
      ),
    );
    fireEvent.press(screen.getByText("View summary"));
    expect(navigate).toHaveBeenCalledWith("DemoSummary", { demoId: "d1" });
  });
});
