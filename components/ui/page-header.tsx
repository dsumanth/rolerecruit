import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  back?: { href: string; label: string };
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, eyebrow, subtitle, back, status, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-7", className)}>
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1 text-body-s font-medium text-ink-secondary hover:text-ink mb-3 transition-colors"
        >
          <Icon name="ChevronLeft" size={14} />
          {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="text-caption font-medium text-ink-secondary mb-1">{eyebrow}</div>}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-display-m text-ink">{title}</h1>
            {status}
          </div>
          {subtitle && <p className="text-body-s text-ink-secondary mt-1.5">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
