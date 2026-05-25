"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

interface DialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description?: string;
  variant?: "center" | "drawer";
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  variant = "center",
  children,
  footer,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const isDrawer = variant === "drawer";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex"
      style={{ alignItems: isDrawer ? "stretch" : "center", justifyContent: isDrawer ? "flex-end" : "center" }}
    >
      <div
        aria-hidden
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/30 backdrop-blur-[12px]"
      />
      <div
        className={cn(
          "relative bg-surface shadow-elev-4 border border-hairline",
          isDrawer
            ? "h-full w-full max-w-[480px] rounded-l-lg"
            : "max-w-[480px] w-[92vw] rounded-lg",
        )}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-hairline">
          <div className="min-w-0">
            <h2 className="text-title-l text-ink">{title}</h2>
            {description && <p className="mt-1 text-body-s text-ink-secondary">{description}</p>}
          </div>
          <button
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="shrink-0 rounded-sm p-1 text-ink-secondary hover:bg-accent-soft hover:text-ink transition-colors duration-fast"
          >
            <Icon name="X" size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-hairline">{footer}</div>
        )}
      </div>
    </div>
  );
}
