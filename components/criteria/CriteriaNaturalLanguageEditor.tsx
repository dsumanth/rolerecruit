"use client";

import { useState } from "react";

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
        className="w-full min-h-[180px] p-3 border border-hairline rounded text-body-s"
        placeholder="Describe the ideal candidate in plain language — qualifications, experience, must-haves, deal-breakers."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
      />
      <div className="absolute bottom-2 right-3 text-body-xs text-ink-secondary">
        {saving ? "Saving…" : saved ? "Saved" : ""}
      </div>
    </div>
  );
}
