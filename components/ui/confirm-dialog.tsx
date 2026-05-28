"use client";

import { ReactNode } from "react";
import { Button } from "./button";

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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-surface border border-hairline rounded-lg shadow-elev-3 max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-body font-semibold text-ink mb-2">{title}</h2>
        <div className="text-body-s text-ink-secondary mb-5">{body}</div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={variant === "destructive" ? "danger" : "primary"} size="md" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
