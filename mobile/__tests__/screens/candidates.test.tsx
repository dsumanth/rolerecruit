import { render, screen, fireEvent } from "@testing-library/react-native";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockUseRoleContext = jest.fn();
jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => mockUseRoleContext(),
}));

const mockUseCandidates = jest.fn();
jest.mock("@/hooks/use-candidates", () => ({
  useCandidates: (opts: unknown) => mockUseCandidates(opts),
}));

import { CandidatesScreen } from "@/screens/candidates";

describe("CandidatesScreen", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUseRoleContext.mockReturnValue({
      loading: false,
      isHR: true,
      schoolId: "s1",
    });
    mockUseCandidates.mockReturnValue({
      rows: [
        { _id: "c1", name: "Priya Iyer", email: "p@s", subjects: ["Math"] },
        { _id: "c2", name: "Ravi Kumar", email: "r@s" },
      ],
      status: "CanLoadMore",
      loading: false,
      loadMore: jest.fn(),
      search: "",
      setSearch: jest.fn(),
    });
  });

  it("renders candidate cards", () => {
    render(<CandidatesScreen />);
    expect(screen.getByText("Priya Iyer")).toBeTruthy();
    expect(screen.getByText("Ravi Kumar")).toBeTruthy();
  });

  it("navigates to CandidateDetail when a card is tapped", () => {
    render(<CandidatesScreen />);
    fireEvent.press(screen.getByText("Priya Iyer"));
    expect(mockNavigate).toHaveBeenCalledWith("CandidateDetail", { candidateId: "c1" });
  });
});
