import { render, screen, fireEvent } from "@testing-library/react-native";
import { StepWhen } from "@/components/demos/schedule-wizard/step-when";

describe("StepWhen", () => {
  it("renders date, time, duration inputs and mode/format chips", () => {
    render(
      <StepWhen
        value={{ date: "2026-06-15", time: "11:30", durationMinutes: 30, mode: "live", format: "classroom" }}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByDisplayValue("2026-06-15")).toBeTruthy();
    expect(screen.getByDisplayValue("11:30")).toBeTruthy();
    expect(screen.getByText("live")).toBeTruthy();
    expect(screen.getByText("classroom")).toBeTruthy();
  });

  it("calls onChange with new mode when a mode chip is tapped", () => {
    const onChange = jest.fn();
    render(
      <StepWhen
        value={{ date: "2026-06-15", time: "11:30", durationMinutes: 30, mode: "live", format: "classroom" }}
        onChange={onChange}
      />,
    );
    fireEvent.press(screen.getByText("post"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: "post" }));
  });

  it("calls onChange with new format when a format chip is tapped", () => {
    const onChange = jest.fn();
    render(
      <StepWhen
        value={{ date: "2026-06-15", time: "11:30", durationMinutes: 30, mode: "live", format: "classroom" }}
        onChange={onChange}
      />,
    );
    fireEvent.press(screen.getByText("recorded"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ format: "recorded" }));
  });

  it("updates date via TextInput", () => {
    const onChange = jest.fn();
    render(
      <StepWhen
        value={{ date: "2026-06-15", time: "11:30", durationMinutes: 30, mode: "live", format: "classroom" }}
        onChange={onChange}
      />,
    );
    fireEvent.changeText(screen.getByDisplayValue("2026-06-15"), "2026-07-01");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-07-01" }));
  });

  it("parses duration as integer", () => {
    const onChange = jest.fn();
    render(
      <StepWhen
        value={{ date: "2026-06-15", time: "11:30", durationMinutes: 30, mode: "live", format: "classroom" }}
        onChange={onChange}
      />,
    );
    fireEvent.changeText(screen.getByDisplayValue("30"), "45");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 45 }));
  });
});
