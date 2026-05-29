import { render, screen, fireEvent } from "@testing-library/react-native";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockUseRoleContext = jest.fn();
jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => mockUseRoleContext(),
}));

const mockUsePipeline = jest.fn();
jest.mock("@/hooks/use-pipeline", () => ({
  usePipeline: (opts: unknown) => mockUsePipeline(opts),
}));

const mockUseQuery = jest.fn();
jest.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
jest.mock("@convex/_generated/api", () => ({
  api: { candidates: { get: "candidates:get" } },
}));

import { PipelineScreen } from "@/screens/pipeline";

describe("PipelineScreen", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUseQuery.mockReset();
    mockUseRoleContext.mockReturnValue({
      loading: false,
      isHR: true,
      schoolId: "s1",
    });
  });

  it("renders the empty-state prompt when no job is selected", () => {
    mockUsePipeline.mockReturnValue({
      jobs: [{ _id: "j1", title: "Math Teacher" }],
      selectedJobId: null,
      setSelectedJobId: jest.fn(),
      stages: [],
      applicationsByStage: {},
      loading: false,
    });
    mockUseQuery.mockReturnValue(undefined);
    render(<PipelineScreen />);
    expect(screen.getByText("Math Teacher")).toBeTruthy();
    expect(screen.getByText("Pick a role")).toBeTruthy();
  });

  it("shows a job picker and renders apps when a job is selected", () => {
    mockUsePipeline.mockReturnValue({
      jobs: [{ _id: "j1", title: "Math Teacher" }],
      selectedJobId: "j1",
      setSelectedJobId: jest.fn(),
      stages: [{ id: "demo_scheduled", name: "Demo Scheduled" }],
      applicationsByStage: {
        demo_scheduled: [
          {
            _id: "a1",
            candidateId: "c1",
            stage: "demo_scheduled",
            aiMatchScore: 0.87,
          },
        ],
      },
      loading: false,
    });
    mockUseQuery.mockReturnValue({ _id: "c1", name: "Priya Iyer" });
    render(<PipelineScreen />);
    expect(screen.getByText("Math Teacher")).toBeTruthy();
    expect(screen.getByText("Demo Scheduled")).toBeTruthy();
    expect(screen.getByText("Priya Iyer")).toBeTruthy();
    expect(screen.getByText("87%")).toBeTruthy();
  });

  it("calls setSelectedJobId when a job chip is tapped", () => {
    const setSelectedJobId = jest.fn();
    mockUsePipeline.mockReturnValue({
      jobs: [{ _id: "j1", title: "Math Teacher" }],
      selectedJobId: null,
      setSelectedJobId,
      stages: [],
      applicationsByStage: {},
      loading: false,
    });
    mockUseQuery.mockReturnValue(undefined);
    render(<PipelineScreen />);
    fireEvent.press(screen.getByText("Math Teacher"));
    expect(setSelectedJobId).toHaveBeenCalledWith("j1");
  });

  it("renders empty state when the selected stage has no applications", () => {
    mockUsePipeline.mockReturnValue({
      jobs: [{ _id: "j1", title: "Math Teacher" }],
      selectedJobId: "j1",
      setSelectedJobId: jest.fn(),
      stages: [{ id: "demo_scheduled", name: "Demo Scheduled" }],
      applicationsByStage: {},
      loading: false,
    });
    mockUseQuery.mockReturnValue(undefined);
    render(<PipelineScreen />);
    expect(screen.getByText("No applications")).toBeTruthy();
  });

  it("navigates to CandidateDetail when an application card is tapped", () => {
    mockUsePipeline.mockReturnValue({
      jobs: [{ _id: "j1", title: "Math Teacher" }],
      selectedJobId: "j1",
      setSelectedJobId: jest.fn(),
      stages: [{ id: "demo_scheduled", name: "Demo Scheduled" }],
      applicationsByStage: {
        demo_scheduled: [
          { _id: "a1", candidateId: "c1", stage: "demo_scheduled" },
        ],
      },
      loading: false,
    });
    mockUseQuery.mockReturnValue({ _id: "c1", name: "Priya Iyer" });
    render(<PipelineScreen />);
    fireEvent.press(screen.getByText("Priya Iyer"));
    expect(mockNavigate).toHaveBeenCalledWith("CandidateDetail", {
      candidateId: "c1",
    });
  });
});
