"use client";

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink placeholder:text-ink-tertiary transition-all duration-normal ease-apple-ease",
        "focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}
