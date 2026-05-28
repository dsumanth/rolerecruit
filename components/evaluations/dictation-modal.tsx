"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";

export type VoiceInput = {
  fieldKey: string;
  transcript: string;
  summaryPoints: string[];
  language: string;
  durationSec: number;
  processedAt: number;
};

export type SummarizeFn = (args: {
  transcript: string;
  fieldKey: string;
  language: string;
  durationSec: number;
}) => Promise<{ summaryPoints: string[]; language: string }>;

interface DictationModalProps {
  open: boolean;
  onClose: () => void;
  fieldKey: string;
  onComplete: (input: VoiceInput) => void;
  summarize?: SummarizeFn;
  supportOverride?: boolean;
  initialTranscript?: string;
}

type Phase = "recording" | "processing" | "error";

export function DictationModal({
  open,
  onClose,
  fieldKey,
  onComplete,
  summarize,
  supportOverride,
  initialTranscript,
}: DictationModalProps) {
  const speech = useSpeechRecognition({ lang: "en-IN" });
  const supported = supportOverride ?? speech.supported;
  const startTimeRef = useRef<number>(0);
  const [phase, setPhase] = useState<Phase>("recording");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open && supported && supportOverride === undefined) {
      startTimeRef.current = Date.now();
      speech.start();
    }
    // We intentionally exclude `speech` from deps: the hook's `start` is
    // stable across renders, and re-running on every render would re-arm
    // recognition each tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supported, supportOverride]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  if (!supported) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Dictation not supported"
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div
          aria-hidden
          onClick={onClose}
          className="absolute inset-0 bg-black/30 backdrop-blur-[12px]"
        />
        <div className="relative bg-surface-floating backdrop-blur-20 border border-hairline rounded-apple shadow-elev-3 max-w-sm w-[92vw] p-6 text-center">
          <p className="text-body text-ink">
            Dictation requires Chrome, Edge, or Safari.
          </p>
          <div className="mt-5 flex justify-center">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleStop = async () => {
    speech.stop();
    setPhase("processing");
    const liveTranscript = (speech.finalTranscript + speech.interim).trim();
    const transcript = initialTranscript ?? liveTranscript;
    const durationSec = Math.max(
      1,
      Math.round((Date.now() - startTimeRef.current) / 1000),
    );
    try {
      const result = await summarize?.({
        transcript,
        fieldKey,
        language: "en-IN",
        durationSec,
      });
      if (!result) throw new Error("No summary returned");
      onComplete({
        fieldKey,
        transcript,
        summaryPoints: result.summaryPoints,
        language: result.language,
        durationSec,
        processedAt: Date.now(),
      });
      onClose();
    } catch (e) {
      setPhase("error");
      setErrMsg(e instanceof Error ? e.message : "Failed to summarize");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dictation"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div aria-hidden className="absolute inset-0 bg-ink/95 backdrop-blur-20" />
      <div className="relative text-center p-8 max-w-sm text-surface-canvas">
        {phase === "recording" && (
          <>
            <div
              aria-hidden
              className="w-20 h-20 rounded-full bg-danger mx-auto mb-6 animate-pulse"
            />
            <p className="text-body text-surface-canvas/80 mb-6 min-h-[3rem]">
              {speech.interim || initialTranscript || "Listening..."}
            </p>
            <div className="flex flex-col items-center gap-3">
              <Button variant="primary" size="lg" onClick={handleStop}>
                Tap to stop
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}
        {phase === "processing" && (
          <p className="text-body text-surface-canvas/80">Summarizing...</p>
        )}
        {phase === "error" && (
          <>
            <p className="text-body text-danger mb-4">{errMsg}</p>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
