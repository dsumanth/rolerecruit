"use client";

import { ReactNode } from "react";

interface Props {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  variant?: "destructive" | "neutral";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, body, confirmLabel, variant = "destructive", onConfirm, onCancel,
}: Props) {
  if (!open) return null;
  const confirmClass =
    variant === "destructive"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-accent hover:bg-accent-strong text-white";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-surface rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-ink mb-3">{title}</h2>
        <div className="text-body-s text-ink-secondary mb-5">{body}</div>
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 text-body-s text-ink-secondary hover:text-ink" onClick={onCancel}>
            Cancel
          </button>
          <button className={`px-4 py-2 text-body-s font-medium rounded ${confirmClass}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
