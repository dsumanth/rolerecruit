import { render, screen } from "@testing-library/react-native";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => ({ schoolId: "s1", isHR: true }),
}));
jest.mock("convex/react", () => ({
  useQuery: () => [
    {
      _id: "r1",
      name: "Strict",
      isActive: true,
      steps: [
        { match: "all", conditions: [{ type: "recCount", rec: "hire", op: "atLeast", value: 2 }], action: "advance" },
      ],
      otherwise: "manual",
    },
  ],
}));
jest.mock("@convex/_generated/api", () => ({
  api: { decisionRules: { list: "decisionRules:list" } },
}));

import { DecisionRulesIndexScreen } from "@/screens/decision-rules";

describe("DecisionRulesIndexScreen", () => {
  it("renders the rule name and active badge", () => {
    render(<DecisionRulesIndexScreen />);
    expect(screen.getByText("Strict")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("renders a plain-English summary", () => {
    render(<DecisionRulesIndexScreen />);
    expect(
      screen.getByText(/Once everyone finishes: if at least 2 recommended Hire, Move forward/),
    ).toBeTruthy();
  });

  it("does not render a 'New rule' editing control", () => {
    render(<DecisionRulesIndexScreen />);
    expect(screen.queryByText("New rule")).toBeNull();
  });
});
