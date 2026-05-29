import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { useMobileSpeechRecognition } from "@/hooks/use-mobile-speech-recognition";
import { colors, fonts, radii, space } from "@/theme";

type Capture = {
  fieldKey: string;
  transcript: string;
  summaryPoints: string[];
  language: string;
  durationSec: number;
  processedAt: number;
};

export function DictationOverlay({
  fieldKey,
  language,
  onComplete,
  onCancel,
}: {
  fieldKey: string;
  language: string;
  onComplete: (capture: Capture) => void;
  onCancel: () => void;
}) {
  const { interim, finalTranscript, listening, start, stop, durationSec } =
    useMobileSpeechRecognition({ language });
  const summarize = useAction(api.voiceProcessing.summarizeTranscript);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await start();
      if (!ok && mounted) onCancel();
    })();
    return () => {
      mounted = false;
      stop();
    };
  }, [start, stop, onCancel]);

  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [listening]);

  async function finish() {
    stop();
    if (!finalTranscript.trim()) {
      onCancel();
      return;
    }
    setBusy(true);
    try {
      const result = await summarize({
        transcript: finalTranscript.trim(),
        fieldKey,
        language,
        durationSec: durationSec(),
      });
      onComplete({
        fieldKey,
        transcript: finalTranscript.trim(),
        summaryPoints: result.summaryPoints,
        language: result.language,
        durationSec: durationSec(),
        processedAt: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.92)", padding: space[6], alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: 96, height: 96, borderRadius: radii.pill,
          backgroundColor: colors.danger,
          alignItems: "center", justifyContent: "center",
          marginBottom: space[6],
          opacity: listening ? 1 : 0.4,
        }}
      >
        <Ionicons name="mic" size={36} color={colors.inverse} />
      </View>
      <Text style={{ color: colors.inverse, fontSize: fonts.size.lg, fontWeight: fonts.weight.semibold }}>
        {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
      </Text>
      <Text style={{ color: colors.inverse, marginTop: space[4], textAlign: "center", maxWidth: 320, minHeight: 60 }}>
        {interim || finalTranscript || "Listening..."}
      </Text>
      <Text style={{ color: colors.inkTertiary, fontSize: fonts.size.xs, marginTop: space[2] }}>
        Detected language: {language}
      </Text>

      <View style={{ flexDirection: "row", marginTop: space[8], gap: space[4] }}>
        <Pressable
          accessibilityLabel="cancel-dictation"
          onPress={() => { stop(); onCancel(); }}
          style={{ paddingHorizontal: space[5], paddingVertical: space[3], borderRadius: radii.pill, borderWidth: 1, borderColor: colors.inverse }}
        >
          <Text style={{ color: colors.inverse, fontWeight: fonts.weight.semibold }}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="stop-dictation"
          onPress={finish}
          disabled={busy}
          style={{
            paddingHorizontal: space[5], paddingVertical: space[3],
            borderRadius: radii.pill, backgroundColor: colors.inverse,
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Text style={{ color: colors.ink, fontWeight: fonts.weight.semibold }}>
            {busy ? "Summarizing..." : "Stop"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
