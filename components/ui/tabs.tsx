"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: readonly Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div className={cn("flex gap-1 border-b border-surface-tertiary", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
          className={cn(
            "text-xs font-medium px-3 py-2 border-b-2 transition-all duration-normal ease-apple-ease",
            activeTab === tab.key
              ? "border-accent text-accent"
              : "border-transparent text-ink-secondary hover:text-ink",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export type { Tab };
