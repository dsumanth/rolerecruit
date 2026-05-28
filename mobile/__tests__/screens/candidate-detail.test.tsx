import { render, screen, fireEvent } from "@testing-library/react-native";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { candidateId: "c1" } }),
}));

const mockCandidate = {
  _id: "c1",
  name: "Priya Iyer",
  email: "p@s",
  subjects: ["Math"],
};
const mockApplications = [
  { _id: "a1", candidateId: "c1", schoolId: "s1", stage: "demo_scheduled" },
];
const mockDemos = [
  {
    _id: "d1",
    scheduledAt: 1_700_000_000_000,
    durationMinutes: 30,
    mode: "live",
    format: "classroom",
    status: "scheduled",
  },
];

jest.mock("convex/react", () => ({
  useQuery: (name: unknown) => {
    if (typeof name === "string" && name.includes("candidates:get")) return mockCandidate;
    if (typeof name === "string" && name.includes("applications:listForCandidate"))
      return mockApplications;
    if (typeof name === "string" && name.includes("demoSessions:listForCandidate"))
      return mockDemos;
    return undefined;
  },
}));

jest.mock("@convex/_generated/api", () => ({
  api: {
    candidates: { get: "candidates:get" },
    applications: { listForCandidate: "applications:listForCandidate" },
    demoSessions: { listForCandidate: "demoSessions:listForCandidate" },
  },
}));

import { CandidateDetailScreen } from "@/screens/candidate-detail";

describe("CandidateDetailScreen", () => {
  beforeEach(() => mockNavigate.mockClear());

  it("renders candidate hero + one demo card", () => {
    render(<CandidateDetailScreen />);
    expect(screen.getByText("Priya Iyer")).toBeTruthy();
    expect(screen.getByText(/live/i)).toBeTruthy();
  });

  it("navigates to ScheduleDemo when Schedule new demo is pressed", () => {
    render(<CandidateDetailScreen />);
    fireEvent.press(screen.getByText("Schedule new demo"));
    expect(mockNavigate).toHaveBeenCalledWith("ScheduleDemo", { applicationId: "a1" });
  });
});
