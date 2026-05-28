import { render, screen, fireEvent } from "@testing-library/react-native";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: { demoId: "d1" } }),
}));

const mockUseAggregate = jest.fn();
jest.mock("@/hooks/use-demo-aggregate", () => ({
  useDemoAggregate: (id: string) => mockUseAggregate(id),
}));

const mockApply = jest.fn().mockResolvedValue(undefined);
jest.mock("convex/react", () => ({
  useMutation: () => mockApply,
}));
jest.mock("@convex/_generated/api", () => ({
  api: { demoSessions: { applyDecision: "demoSessions:applyDecision" } },
}));

jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => ({ userProfileId: "u-hr", isHR: true, schoolId: "s1" }),
}));

import { DemoSummaryScreen } from "@/screens/demo-summary";

describe("DemoSummaryScreen", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockApply.mockClear();
    mockUseAggregate.mockReset();
  });

  it("shows loading state", () => {
    mockUseAggregate.mockReturnValue({ loading: true, demo: null, perEvaluator: [] });
    render(<DemoSummaryScreen />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("renders demo metadata and recommendation tally", () => {
    mockUseAggregate.mockReturnValue({
      loading: false,
      demo: {
        _id: "d1",
        applicationId: "app1",
        status: "completed",
        mode: "live",
        format: "classroom",
        durationMinutes: 30,
        scheduledAt: 1_700_000_000_000,
        appliedDecision: null,
      },
      invitesByStatus: { submitted: 2 },
      recommendationTally: { hire: 2, maybe: 0, reject: 0 },
      dimensionAverages: {},
      perEvaluator: [
        {
          invite: { _id: "i1", evaluatorRole: "principal", status: "submitted" },
          profile: { name: "Mrs Iyer" },
          evaluation: { recommendation: "hire" },
        },
      ],
    });
    render(<DemoSummaryScreen />);
    expect(screen.getByText("Mrs Iyer")).toBeTruthy();
    expect(screen.getByText(/hire: 2/i)).toBeTruthy();
  });

  it("renders the applied decision banner when present", () => {
    mockUseAggregate.mockReturnValue({
      loading: false,
      demo: {
        _id: "d1",
        applicationId: "app1",
        status: "completed",
        mode: "live",
        format: "classroom",
        durationMinutes: 30,
        scheduledAt: 1_700_000_000_000,
        appliedDecision: { action: "advance", appliedAt: 1_700_000_000_000, note: "Strong fit" },
      },
      invitesByStatus: { submitted: 2 },
      recommendationTally: { hire: 2, maybe: 0, reject: 0 },
      dimensionAverages: {},
      perEvaluator: [],
    });
    render(<DemoSummaryScreen />);
    expect(screen.getByText(/Advanced/)).toBeTruthy();
    expect(screen.getByText(/Strong fit/)).toBeTruthy();
    expect(screen.queryByText(/^Advance$/)).toBeNull();
  });

  it("hides decision row when demo status is not completed", () => {
    mockUseAggregate.mockReturnValue({
      loading: false,
      demo: {
        _id: "d1",
        applicationId: "app1",
        status: "scheduled",
        mode: "live",
        format: "classroom",
        durationMinutes: 30,
        scheduledAt: 1_700_000_000_000,
        appliedDecision: null,
      },
      invitesByStatus: {},
      recommendationTally: { hire: 0, maybe: 0, reject: 0 },
      dimensionAverages: {},
      perEvaluator: [],
    });
    render(<DemoSummaryScreen />);
    expect(screen.queryByText(/^Advance$/)).toBeNull();
    expect(screen.queryByText(/^Reject$/)).toBeNull();
  });

  it("dispatches advance decision via mutation", () => {
    mockUseAggregate.mockReturnValue({
      loading: false,
      demo: {
        _id: "d1",
        applicationId: "app1",
        status: "completed",
        mode: "live",
        format: "classroom",
        durationMinutes: 30,
        scheduledAt: 1_700_000_000_000,
        appliedDecision: null,
      },
      invitesByStatus: { submitted: 2 },
      recommendationTally: { hire: 2, maybe: 0, reject: 0 },
      dimensionAverages: {},
      perEvaluator: [],
    });
    render(<DemoSummaryScreen />);
    fireEvent.press(screen.getByText("Advance"));
    expect(mockApply).toHaveBeenCalledWith(
      expect.objectContaining({ demoId: "d1", action: "advance", appliedBy: "u-hr" }),
    );
  });

  it("navigates to ScheduleDemo for re-demo with parentDemoId", () => {
    mockUseAggregate.mockReturnValue({
      loading: false,
      demo: {
        _id: "d1",
        applicationId: "app1",
        status: "completed",
        mode: "live",
        format: "classroom",
        durationMinutes: 30,
        scheduledAt: 1_700_000_000_000,
        appliedDecision: null,
      },
      invitesByStatus: { submitted: 2 },
      recommendationTally: { hire: 2, maybe: 0, reject: 0 },
      dimensionAverages: {},
      perEvaluator: [],
    });
    render(<DemoSummaryScreen />);
    fireEvent.press(screen.getByText("Schedule re-demo"));
    expect(mockNavigate).toHaveBeenCalledWith("ScheduleDemo", {
      applicationId: "app1",
      parentDemoId: "d1",
    });
  });
});
