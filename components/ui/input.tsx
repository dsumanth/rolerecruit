"use client";

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";
import { Icon, type IconName } from "./icon";

type InputSize = "sm" | "md" | "lg";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: InputSize;
  iconLeft?: IconName;
}

const sizeClasses: Record<InputSize, string> = {
  sm: "h-8 text-caption px-3",
  md: "h-[38px] text-body-s px-3",
  lg: "h-11 text-body px-4",
};

export function Input({ size = "md", iconLeft, className, ...props }: InputProps) {
  if (iconLeft) {
    return (
      <div className="relative inline-flex w-full">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary">
          <Icon name={iconLeft} size={size === "sm" ? 13 : 14} />
        </span>
        <input
          {...props}
          className={cn(
            "w-full rounded-sm bg-surface border border-hairline-strong text-ink placeholder:text-ink-tertiary outline-none transition-all duration-fast ease-apple-out focus:border-accent focus:ring-2 focus:ring-accent-soft",
            "pl-8",
            sizeClasses[size],
            className,
          )}
        />
      </div>
    );
  }

  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-sm bg-surface border border-hairline-strong text-ink placeholder:text-ink-tertiary outline-none transition-all duration-fast ease-apple-out focus:border-accent focus:ring-2 focus:ring-accent-soft",
        sizeClasses[size],
        className,
      )}
    />
  );
}
