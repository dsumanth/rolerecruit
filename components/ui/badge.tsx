import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const VARIANT_BG: Record<BadgeVariant, string> = {
  neutral: "bg-hairline text-ink",
  info: "bg-accent-soft text-accent",
  success: "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[color-mix(in_srgb,var(--success)_75%,var(--ink-1))]",
  warning: "bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[color-mix(in_srgb,var(--warning)_75%,var(--ink-1))]",
  danger: "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-danger",
};

const DOT_COLOR: Record<BadgeVariant, string> = {
  neutral: "var(--ink-3)",
  info: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

export function Badge({ children, variant = "neutral", dot, className }: BadgeProps) {
  if (dot) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-caption font-medium text-ink",
          className,
        )}
      >
        <span
          data-dot
          className="h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: DOT_COLOR[variant],
            boxShadow: `0 0 0 3px color-mix(in srgb, ${DOT_COLOR[variant]} 18%, transparent)`,
          }}
        />
        {children}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs px-2 py-0.5 text-caption font-medium",
        VARIANT_BG[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
