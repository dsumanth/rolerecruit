import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  illustration?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, illustration, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-6", className)}>
      {illustration ? (
        <div className="mb-5">{illustration}</div>
      ) : icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-accent-soft text-accent">
          {icon}
        </div>
      ) : null}
      <h3 className="text-title-l text-ink">{title}</h3>
      {description && <p className="mt-1 text-body-s text-ink-secondary max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
