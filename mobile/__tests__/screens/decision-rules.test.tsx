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
      branches: [{ condition: { minHire: 2 }, action: "advance" }],
      fallback: "manual",
    },
  ],
}));
jest.mock("@convex/_generated/api", () => ({
  api: { decisionRules: { list: "decisionRules:list" } },
}));

import { DecisionRulesIndexScreen } from "@/screens/decision-rules";

describe("DecisionRulesIndexScreen", () => {
  it("renders the rule with active badge", () => {
    render(<DecisionRulesIndexScreen />);
    expect(screen.getByText("Strict")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });
});
