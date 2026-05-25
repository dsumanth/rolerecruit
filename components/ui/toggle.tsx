"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onCheckedChange, label, disabled, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-[22px] w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-fast ease-apple-out",
        checked ? "bg-success" : "bg-hairline-strong",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "absolute h-[18px] w-[18px] rounded-full bg-white shadow-elev-1 transition-[left] duration-base ease-apple-out",
          checked ? "left-[16px]" : "left-[2px]",
        )}
      />
    </button>
  );
}
