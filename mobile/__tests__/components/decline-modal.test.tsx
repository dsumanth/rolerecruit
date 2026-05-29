import { render, screen, fireEvent } from "@testing-library/react-native";
import { DeclineModal } from "@/components/demos/decline-modal";

const mockDeclineMutation = jest.fn().mockResolvedValue(undefined);
jest.mock("convex/react", () => ({
  useMutation: () => mockDeclineMutation,
}));
jest.mock("@convex/_generated/api", () => ({
  api: { evaluationInvites: { decline: "evaluationInvites:decline" } },
}));

describe("DeclineModal", () => {
  beforeEach(() => mockDeclineMutation.mockClear());

  it("submits with the typed reason and closes", async () => {
    const onClose = jest.fn();
    render(<DeclineModal inviteId={"i1" as any} onClose={onClose} />);
    fireEvent.changeText(screen.getByPlaceholderText("Why are you declining?"), "On leave");
    fireEvent.press(screen.getByText("Confirm decline"));
    expect(mockDeclineMutation).toHaveBeenCalledWith({ inviteId: "i1", reason: "On leave" });
  });
});
