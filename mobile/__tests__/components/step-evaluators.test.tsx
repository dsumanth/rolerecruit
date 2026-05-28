import { render, screen, fireEvent } from "@testing-library/react-native";
import { StepEvaluators } from "@/components/demos/schedule-wizard/step-evaluators";

const staff = [
  { _id: "u1", name: "Mrs Iyer", role: "principal" as const },
  { _id: "u2", name: "Mr Rao", role: "teacher" as const },
];

describe("StepEvaluators", () => {
  it("shows the Location field when format is classroom", () => {
    render(
      <StepEvaluators
        format="classroom"
        location=""
        videoUrl=""
        staff={staff}
        selected={[]}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByPlaceholderText(/classroom/i)).toBeTruthy();
  });

  it("shows the Video URL field when format is recorded", () => {
    render(
      <StepEvaluators
        format="recorded"
        location=""
        videoUrl=""
        staff={staff}
        selected={[]}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByPlaceholderText(/https/i)).toBeTruthy();
  });

  it("does not show location or video fields when format is mock", () => {
    render(
      <StepEvaluators
        format="mock"
        location=""
        videoUrl=""
        staff={staff}
        selected={[]}
        onChange={jest.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText(/classroom/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/https/i)).toBeNull();
  });

  it("toggles staff selection on tap", () => {
    const onChange = jest.fn();
    render(
      <StepEvaluators
        format="mock"
        location=""
        videoUrl=""
        staff={staff}
        selected={[]}
        onChange={onChange}
      />,
    );
    fireEvent.press(screen.getByText("Mrs Iyer"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ evaluators: [{ userId: "u1", role: "principal" }] }),
    );
  });

  it("removes a staff member from selection when tapped again", () => {
    const onChange = jest.fn();
    render(
      <StepEvaluators
        format="mock"
        location=""
        videoUrl=""
        staff={staff}
        selected={[{ userId: "u1", role: "principal" }]}
        onChange={onChange}
      />,
    );
    // When selected, "Mrs Iyer" appears in both the chip and the row.
    // Tap the row (last match) to deselect.
    const matches = screen.getAllByText("Mrs Iyer");
    fireEvent.press(matches[matches.length - 1]);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ evaluators: [] }),
    );
  });

  it("emits a location patch when typing in the location field", () => {
    const onChange = jest.fn();
    render(
      <StepEvaluators
        format="classroom"
        location=""
        videoUrl=""
        staff={staff}
        selected={[]}
        onChange={onChange}
      />,
    );
    fireEvent.changeText(screen.getByPlaceholderText(/classroom/i), "Room 7");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ location: "Room 7" }));
  });
});
