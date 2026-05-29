"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import "./date-picker.css";

type DatePickerSize = "sm" | "md" | "lg";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: DatePickerSize;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const sizeClasses: Record<DatePickerSize, string> = {
  sm: "h-8 text-caption px-3",
  md: "h-[38px] text-body-s px-3",
  lg: "h-11 text-body px-4",
};

const TRIGGER_BASE =
  "w-full rounded-sm bg-surface border border-hairline-strong text-ink outline-none transition-all duration-fast ease-apple-out flex items-center justify-between gap-2 text-left focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:opacity-50 disabled:cursor-not-allowed";

function parseIso(value: string): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

const labelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  size = "md",
  disabled = false,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = parseIso(value);
  const label = selected ? labelFormatter.format(selected) : null;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, close]);

  return (
    <div ref={wrapRef} className={cn("relative inline-block w-full", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(TRIGGER_BASE, sizeClasses[size])}
      >
        <span className={cn(label ? "text-ink" : "text-ink-tertiary")}>
          {label ?? placeholder}
        </span>
        <Icon name="Calendar" size={14} className="text-ink-tertiary" />
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute z-50 mt-1 left-0 rounded-md border border-hairline-strong bg-surface-floating backdrop-blur-20 shadow-elev-3 p-2"
        >
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              if (d) {
                onChange(toIso(d));
                close();
              }
            }}
            showOutsideDays
          />
        </div>
      )}
    </div>
  );
}
