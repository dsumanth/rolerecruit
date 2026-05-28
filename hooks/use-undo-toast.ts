// hooks/use-undo-toast.ts
import { useCallback, useEffect, useRef, useState } from "react";

export interface UndoToast {
  id: string;
  label: string;
  onUndo: () => void | Promise<void>;
  createdAt: number;
}

const TTL_MS = 10_000;

export function useUndoToast() {
  const [toasts, setToasts] = useState<UndoToast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback((args: { label: string; onUndo: () => void | Promise<void> }) => {
    const id = Math.random().toString(36).slice(2, 10);
    const toast: UndoToast = { id, label: args.label, onUndo: args.onUndo, createdAt: Date.now() };
    setToasts((ts) => [...ts, toast]);
    const timer = setTimeout(() => dismiss(id), TTL_MS);
    timersRef.current.set(id, timer);
    return id;
  }, [dismiss]);

  const undo = useCallback(async (id: string) => {
    const toast = toasts.find((t) => t.id === id);
    if (!toast) return;
    await toast.onUndo();
    dismiss(id);
  }, [toasts, dismiss]);

  useEffect(() => () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  return { toasts, show, undo, dismiss };
}
