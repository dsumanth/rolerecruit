"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icon";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline" | "gradient" | "ink";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:opacity-90 active:opacity-100",
  secondary: "bg-surface-canvas text-ink hover:bg-hairline",
  danger: "bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-danger hover:bg-[color-mix(in_srgb,var(--danger)_15%,transparent)]",
  ghost: "text-ink-secondary hover:bg-accent-soft hover:text-ink",
  outline: "border border-hairline-strong text-ink hover:border-accent hover:text-accent",
  gradient: "bg-accent-grad text-white shadow-[0_2px_4px_rgba(0,113,227,0.2),0_8px_24px_rgba(0,113,227,0.2)] hover:opacity-95",
  ink: "bg-ink text-surface-canvas shadow-[0_1px_2px_rgba(0,0,0,0.1),0_4px_12px_rgba(0,0,0,0.12)] hover:translate-y-[-1px]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-caption gap-1.5",
  md: "px-4 py-2 text-body-s gap-1.5",
  lg: "px-6 py-2.5 text-body gap-2",
};

const iconSize: Record<ButtonSize, number> = { sm: 13, md: 14, lg: 16 };

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  iconLeft,
  iconRight,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition-all duration-fast ease-apple-out disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        iconLeft && <Icon name={iconLeft} size={iconSize[size]} />
      )}
      {children}
      {!loading && iconRight && <Icon name={iconRight} size={iconSize[size]} />}
    </button>
  );
}
