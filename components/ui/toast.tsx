"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icon";

type ToastVariant = "success" | "error" | "info";

interface ToastInput {
  variant?: ToastVariant;
  message: string;
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastInput, "duration">> {
  id: number;
  duration: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_ICON: Record<ToastVariant, IconName> = {
  success: "CheckCircle2",
  error: "XCircle",
  info: "Info",
};

const VARIANT_COLOR: Record<ToastVariant, string> = {
  success: "var(--success)",
  error: "var(--danger)",
  info: "var(--accent)",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.random();
    const next: ToastItem = {
      id,
      variant: input.variant ?? "info",
      message: input.message,
      duration: input.duration ?? 4000,
    };
    setItems((prev) => [...prev, next]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <ToastRow key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, item.duration);
    return () => clearTimeout(t);
  }, [item.duration, onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-center gap-3 rounded-md bg-surface-floating backdrop-blur-20 border border-hairline shadow-elev-3 px-4 py-3 min-w-[260px] max-w-[420px]",
      )}
      style={{ borderLeft: `3px solid ${VARIANT_COLOR[item.variant]}` }}
    >
      <Icon name={VARIANT_ICON[item.variant]} size={16} color={VARIANT_COLOR[item.variant]} />
      <div className="text-body-s text-ink flex-1">{item.message}</div>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
