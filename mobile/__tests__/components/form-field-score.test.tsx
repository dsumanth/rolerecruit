import { render, screen, fireEvent } from "@testing-library/react-native";
import { ScoreField } from "@/components/evaluations/form-field-score";

describe("ScoreField", () => {
  it("renders 5 buttons for a score_1_5 field and reports the picked value", () => {
    const onChange = jest.fn();
    render(<ScoreField label="Subject knowledge" type="score_1_5" value={undefined} onChange={onChange} />);
    expect(screen.getByText("Subject knowledge")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("score-3"));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("renders 10 buttons for a score_1_10 field", () => {
    render(<ScoreField label="Pedagogy" type="score_1_10" value={undefined} onChange={() => {}} />);
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByLabelText(`score-${i}`)).toBeTruthy();
    }
  });

  it("marks the current value as selected", () => {
    render(<ScoreField label="x" type="score_1_5" value={4} onChange={() => {}} />);
    const picked = screen.getByLabelText("score-4");
    expect(picked.props.accessibilityState?.selected).toBe(true);
  });
});
