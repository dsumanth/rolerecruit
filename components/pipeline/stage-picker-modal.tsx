"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export const FALLBACK_STAGES: Array<{ id: string; name: string }> = [
  { id: "sourced", name: "Sourced" },
  { id: "screened", name: "Screened" },
  { id: "demo_scheduled", name: "Demo Scheduled" },
  { id: "demo_completed", name: "Demo Completed" },
  { id: "offer_sent", name: "Offer Sent" },
  { id: "hired", name: "Hired" },
  { id: "rejected", name: "Rejected" },
  { id: "on_hold", name: "On Hold" },
];

export function StagePicker({
  value,
  onChange,
  stages = FALLBACK_STAGES,
}: {
  value: string;
  onChange: (s: string) => void;
  stages?: Array<{ id: string; name: string }>;
}) {
  return (
    <select
      className="w-full px-3 py-2 rounded-sm bg-surface border border-hairline-strong text-ink text-body-s outline-none transition-all duration-fast ease-apple-out focus:border-accent focus:ring-2 focus:ring-accent-soft"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select a stage…</option>
      {stages.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

export function StagePickerModal({
  open,
  onClose,
  count,
  stages,
  onMove,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  stages?: Array<{ id: string; name: string }>;
  onMove: (stage: string) => Promise<void> | void;
}) {
  const [picked, setPicked] = useState<string>("");

  if (!open) return null;

  const handleClose = () => {
    setPicked("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"
      onClick={handleClose}
    >
      <div
        className="bg-surface border border-hairline rounded-lg shadow-elev-3 p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-body font-semibold text-ink mb-3">Move {count} to stage</h3>
        <StagePicker value={picked} onChange={setPicked} stages={stages} />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="md" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={!picked}
            onClick={async () => {
              await onMove(picked);
              setPicked("");
            }}
          >
            Move
          </Button>
        </div>
      </div>
    </div>
  );
}
