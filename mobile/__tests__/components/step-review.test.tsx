import { render, screen, fireEvent } from "@testing-library/react-native";
import { StepReview } from "@/components/demos/schedule-wizard/step-review";

describe("StepReview", () => {
  it("renders summary and decision rule picker", () => {
    render(
      <StepReview
        draft={{
          date: "2026-06-15",
          time: "11:30",
          durationMinutes: 30,
          mode: "live",
          format: "classroom",
          location: "12B",
          videoUrl: "",
          evaluators: [{ userId: "u1", role: "principal" }],
        }}
        rules={[{ _id: "r1", name: "Strict Hire" }]}
        selectedRuleId={null}
        onSelectRule={jest.fn()}
      />,
    );
    expect(screen.getByText("2026-06-15 11:30")).toBeTruthy();
    expect(screen.getByText("Strict Hire")).toBeTruthy();
  });

  it("notifies parent when a rule is tapped", () => {
    const onSelectRule = jest.fn();
    render(
      <StepReview
        draft={{
          date: "2026-06-15",
          time: "11:30",
          durationMinutes: 30,
          mode: "live",
          format: "classroom",
          location: "",
          videoUrl: "",
          evaluators: [],
        }}
        rules={[{ _id: "r1", name: "Strict Hire" }]}
        selectedRuleId={null}
        onSelectRule={onSelectRule}
      />,
    );
    fireEvent.press(screen.getByText("Strict Hire"));
    expect(onSelectRule).toHaveBeenCalledWith("r1");
  });

  it("clears the selection when the None option is tapped", () => {
    const onSelectRule = jest.fn();
    render(
      <StepReview
        draft={{
          date: "2026-06-15",
          time: "11:30",
          durationMinutes: 30,
          mode: "live",
          format: "classroom",
          location: "",
          videoUrl: "",
          evaluators: [],
        }}
        rules={[{ _id: "r1", name: "Strict Hire" }]}
        selectedRuleId={"r1"}
        onSelectRule={onSelectRule}
      />,
    );
    fireEvent.press(screen.getByText(/None/i));
    expect(onSelectRule).toHaveBeenCalledWith(null);
  });

  it("shows location row only when location is set", () => {
    render(
      <StepReview
        draft={{
          date: "2026-06-15",
          time: "11:30",
          durationMinutes: 30,
          mode: "live",
          format: "classroom",
          location: "12B",
          videoUrl: "",
          evaluators: [],
        }}
        rules={[]}
        selectedRuleId={null}
        onSelectRule={jest.fn()}
      />,
    );
    expect(screen.getByText(/Location: 12B/i)).toBeTruthy();
  });
});
