import { render, screen, fireEvent } from "@testing-library/react-native";
import { PressableButton } from "@/components/ui/pressable-button";

describe("PressableButton", () => {
  it("renders the label", () => {
    render(<PressableButton onPress={() => {}}>Submit</PressableButton>);
    expect(screen.getByText("Submit")).toBeTruthy();
  });
  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    render(<PressableButton onPress={onPress}>Tap</PressableButton>);
    fireEvent.press(screen.getByText("Tap"));
    expect(onPress).toHaveBeenCalled();
  });
  it("does not call onPress when disabled", () => {
    const onPress = jest.fn();
    render(<PressableButton onPress={onPress} disabled>Tap</PressableButton>);
    fireEvent.press(screen.getByText("Tap"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
