import { render, screen } from "@testing-library/react-native";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders the children", () => {
    render(<Badge tone="success">Submitted</Badge>);
    expect(screen.getByText("Submitted")).toBeTruthy();
  });
  it("accepts every tone without crashing", () => {
    const tones = ["info", "success", "warning", "danger", "neutral"] as const;
    for (const tone of tones) {
      render(<Badge tone={tone}>x</Badge>);
    }
  });
});
