"use client";

import React, {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DropdownProps {
  trigger: ReactElement;
  children: ReactNode;
  align?: "start" | "end";
  side?: "top" | "bottom";
  className?: string;
}

const DropdownCloseContext = createContext<() => void>(() => {});

export function Dropdown({ trigger, children, align = "start", side = "bottom", className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger, {
        onClick: (e: React.MouseEvent) => {
          (trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
          setOpen((v) => !v);
        },
      } as React.HTMLAttributes<HTMLElement>)
    : trigger;

  return (
    <div ref={wrapRef} className="relative inline-block">
      {triggerEl}
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 min-w-[200px] rounded-md border bg-[var(--floating-bg)] backdrop-blur-20 p-1 shadow-elev-3",
            side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
          style={{ borderColor: "var(--chrome-border)" }}
        >
          <DropdownCloseContext.Provider value={close}>{children}</DropdownCloseContext.Provider>
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  onSelect: () => void;
  children: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

export function DropdownItem({ onSelect, children, destructive, disabled }: DropdownItemProps) {
  const close = useContext(DropdownCloseContext);
  return (
    <button
      role="menuitem"
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onSelect();
        close();
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-body-s text-left transition-colors duration-fast ease-apple-out",
        destructive
          ? "text-danger hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]"
          : "text-ink hover:bg-accent-soft",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

export function DropdownDivider() {
  return <div className="my-1 h-px bg-hairline" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-1.5 pb-0.5 text-micro text-ink-secondary">{children}</div>;
}
