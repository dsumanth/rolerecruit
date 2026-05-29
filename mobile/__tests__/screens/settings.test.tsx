import { render, screen, fireEvent } from "@testing-library/react-native";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import { SettingsScreen } from "@/screens/settings";

describe("SettingsScreen", () => {
  beforeEach(() => mockNavigate.mockClear());

  it("renders three rows: templates, rules, notifications", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("Form templates")).toBeTruthy();
    expect(screen.getByText("Decision rules")).toBeTruthy();
    expect(screen.getByText("Notifications")).toBeTruthy();
  });

  it("navigates to Templates when tapped", () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText("Form templates"));
    expect(mockNavigate).toHaveBeenCalledWith("Templates");
  });
});
