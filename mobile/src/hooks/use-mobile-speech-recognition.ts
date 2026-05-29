import { useCallback, useRef, useState } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

export function useMobileSpeechRecognition({ language = "en-IN" }: { language?: string } = {}) {
  const [interim, setInterim] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const startedAt = useRef<number>(0);

  useSpeechRecognitionEvent("result", (e: any) => {
    const text = e?.results?.[0]?.transcript ?? "";
    if (e?.isFinal) setFinalTranscript((prev) => prev + text);
    else setInterim(text);
  });

  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("error", () => setListening(false));

  const start = useCallback(async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return false;
    setInterim("");
    setFinalTranscript("");
    startedAt.current = Date.now();
    ExpoSpeechRecognitionModule.start({
      lang: language,
      interimResults: true,
      continuous: true,
    });
    setListening(true);
    return true;
  }, [language]);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
    setListening(false);
  }, []);

  const durationSec = () => Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));

  return { interim, finalTranscript, listening, start, stop, durationSec };
}
