"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

export interface UseSpeechRecognitionResult {
  supported: boolean;
  interim: string;
  finalTranscript: string;
  listening: boolean;
  start: () => void;
  stop: () => void;
}

export function useSpeechRecognition(opts: { lang?: string } = {}): UseSpeechRecognitionResult {
  const [interim, setInterim] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const supported =
    typeof window !== "undefined" &&
    !!((window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition);

  const start = useCallback(() => {
    if (!supported) return;
    const w = window as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = opts.lang ?? navigator.language ?? "en-IN";
    rec.onresult = (e) => {
      let interimText = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) setFinalTranscript((prev) => prev + finalText);
      setInterim(interimText);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setFinalTranscript("");
    setInterim("");
    rec.start();
    setListening(true);
  }, [opts.lang, supported]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return { supported, interim, finalTranscript, listening, start, stop };
}
