import { render, screen, fireEvent } from "@testing-library/react-native";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => ({ schoolId: "s1", isHR: true }),
}));
jest.mock("convex/react", () => ({
  useQuery: () => ({ schoolId: "s1", name: "Principal default" }),
}));
jest.mock("@convex/_generated/api", () => ({
  api: { formTemplates: { getForRole: "formTemplates:getForRole" } },
}));

import { TemplatesIndexScreen } from "@/screens/templates";

describe("TemplatesIndexScreen", () => {
  beforeEach(() => mockNavigate.mockClear());

  it("lists the four roles", () => {
    render(<TemplatesIndexScreen />);
    expect(screen.getByText("Principal")).toBeTruthy();
    expect(screen.getByText("HOD")).toBeTruthy();
    expect(screen.getByText("HR Admin")).toBeTruthy();
    expect(screen.getByText("Teacher")).toBeTruthy();
  });

  it("opens editor with the chosen role", () => {
    render(<TemplatesIndexScreen />);
    fireEvent.press(screen.getByText("Principal"));
    expect(mockNavigate).toHaveBeenCalledWith("TemplateEditor", { role: "principal" });
  });
});
