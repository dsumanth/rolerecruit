import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { DictationOverlay } from "@/components/evaluations/dictation-overlay";

const mockSummarize = jest.fn().mockResolvedValue({ summaryPoints: ["a", "b", "c"], language: "en-IN" });
jest.mock("convex/react", () => ({
  useAction: () => mockSummarize,
}));
jest.mock("@convex/_generated/api", () => ({
  api: { voiceProcessing: { summarizeTranscript: "voiceProcessing:summarizeTranscript" } },
}));

const speech = jest.requireMock("expo-speech-recognition") as any;

describe("DictationOverlay", () => {
  beforeEach(() => mockSummarize.mockClear());

  it("shows interim transcript while listening", async () => {
    render(<DictationOverlay fieldKey="comments" language="en-IN" onComplete={jest.fn()} onCancel={jest.fn()} />);
    act(() => speech.__emit("result", { isFinal: false, results: [{ transcript: "partial..." }] }));
    expect(screen.getByText("partial...")).toBeTruthy();
  });

  it("on stop summarizes and calls onComplete with the capture", async () => {
    const onComplete = jest.fn();
    render(<DictationOverlay fieldKey="comments" language="en-IN" onComplete={onComplete} onCancel={jest.fn()} />);
    act(() => speech.__emit("result", { isFinal: true, results: [{ transcript: "Priya was strong." }] }));
    fireEvent.press(screen.getByLabelText("stop-dictation"));
    await waitFor(() => expect(mockSummarize).toHaveBeenCalled());
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      fieldKey: "comments",
      transcript: "Priya was strong.",
      summaryPoints: ["a", "b", "c"],
      language: "en-IN",
    }));
  });
});
