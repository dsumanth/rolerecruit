import { render, screen, fireEvent } from "@testing-library/react-native";
import { TextField } from "@/components/evaluations/form-field-text";
import { ChoiceField } from "@/components/evaluations/form-field-choice";
import { RecommendationButtons } from "@/components/evaluations/recommendation-buttons";

describe("TextField", () => {
  it("renders label and propagates input changes", () => {
    const onChange = jest.fn();
    render(<TextField label="Comments" value="" onChange={onChange} />);
    fireEvent.changeText(screen.getByPlaceholderText("Type your notes..."), "good");
    expect(onChange).toHaveBeenCalledWith("good");
  });

  it("shows the mic button when allowDictation is true", () => {
    render(<TextField label="x" value="" onChange={() => {}} allowDictation onMicPress={() => {}} />);
    expect(screen.getByLabelText("dictate")).toBeTruthy();
  });

  it("hides the mic button when allowDictation is false", () => {
    render(<TextField label="x" value="" onChange={() => {}} allowDictation={false} />);
    expect(screen.queryByLabelText("dictate")).toBeNull();
  });
});

describe("ChoiceField", () => {
  it("renders each choice as a tappable chip and reports the picked value", () => {
    const onChange = jest.fn();
    render(<ChoiceField label="Region" choices={["North", "South"]} value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText("South"));
    expect(onChange).toHaveBeenCalledWith("South");
  });
});

describe("RecommendationButtons", () => {
  it("renders three buttons and reports selection", () => {
    const onChange = jest.fn();
    render(<RecommendationButtons value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText("Hire"));
    expect(onChange).toHaveBeenCalledWith("hire");
  });
});
