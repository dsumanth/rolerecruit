"use client";

import { cn } from "@/lib/utils";

interface TabItem {
  value: string;
  label: string;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div role="tablist" className={cn("flex gap-1 border-b border-hairline", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative px-3.5 py-2 text-body-s transition-colors duration-fast ease-apple-out",
              active ? "text-ink font-semibold" : "text-ink-secondary hover:text-ink",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {item.label}
              {item.count != null && (
                <span className="text-caption text-ink-tertiary tabular-nums">{item.count}</span>
              )}
            </span>
            {active && (
              <span
                aria-hidden
                className="absolute left-3.5 right-3.5 -bottom-px h-[2px] rounded-full bg-accent-grad"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
