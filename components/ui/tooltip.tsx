"use client";

import { useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  delay?: number;
  side?: "top" | "bottom";
}

export function Tooltip({ content, children, delay = 400, side = "top" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={
            "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-sm bg-[var(--ink-1)] px-2 py-1 text-caption text-[var(--card-bg)] shadow-elev-2 " +
            (side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5")
          }
        >
          {content}
        </span>
      )}
    </span>
  );
}
