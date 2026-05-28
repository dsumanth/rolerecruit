"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  initialValue: string;
  onSave: (text: string) => void | Promise<void>;
}

export function CriteriaNaturalLanguageEditor({ initialValue, onSave }: Props) {
  const [text, setText] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleBlur = async () => {
    if (text === initialValue) return;
    setSaving(true);
    try {
      await onSave(text);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <textarea
        className={cn(
          "w-full min-h-[180px] px-3 py-2.5 rounded-sm bg-surface border border-hairline-strong text-ink text-body-s",
          "placeholder:text-ink-tertiary outline-none transition-all duration-fast ease-apple-out",
          "focus:border-accent focus:ring-2 focus:ring-accent-soft resize-y",
        )}
        placeholder="Describe the ideal candidate in plain language — qualifications, experience, must-haves, deal-breakers."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
      />
      <div className="absolute bottom-3 right-3 text-caption text-ink-tertiary tabular-nums">
        {saving ? "Saving…" : saved ? "Saved" : ""}
      </div>
    </div>
  );
}
