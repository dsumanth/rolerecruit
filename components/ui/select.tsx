"use client";

import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes, ReactNode } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink appearance-none transition-all duration-normal ease-apple-ease",
        "focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
