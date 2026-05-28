import { render, screen } from "@testing-library/react-native";
import App from "../App";

describe("App boots", () => {
  it("renders a smoke label", () => {
    render(<App />);
    expect(screen.getByLabelText("smoke")).toBeTruthy();
  });
});
