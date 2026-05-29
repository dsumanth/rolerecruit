import { act, renderHook } from "@testing-library/react-native";
import { useMobileSpeechRecognition } from "@/hooks/use-mobile-speech-recognition";

const speech = jest.requireMock("expo-speech-recognition") as any;

describe("useMobileSpeechRecognition", () => {
  it("starts listening and accumulates final transcript over multiple events", async () => {
    const { result } = renderHook(() => useMobileSpeechRecognition({ language: "en-IN" }));
    await act(async () => await result.current.start());
    act(() => speech.__emit("result", { isFinal: true, results: [{ transcript: "Priya was strong." }] }));
    act(() => speech.__emit("result", { isFinal: true, results: [{ transcript: " She paced well." }] }));
    expect(result.current.finalTranscript).toBe("Priya was strong. She paced well.");
  });

  it("captures interim transcripts separately", async () => {
    const { result } = renderHook(() => useMobileSpeechRecognition({ language: "en-IN" }));
    await act(async () => await result.current.start());
    act(() => speech.__emit("result", { isFinal: false, results: [{ transcript: "partial..." }] }));
    expect(result.current.interim).toBe("partial...");
    expect(result.current.finalTranscript).toBe("");
  });

  it("stop sets listening to false", async () => {
    const { result } = renderHook(() => useMobileSpeechRecognition({ language: "en-IN" }));
    await act(async () => await result.current.start());
    expect(result.current.listening).toBe(true);
    act(() => result.current.stop());
    expect(result.current.listening).toBe(false);
  });
});
