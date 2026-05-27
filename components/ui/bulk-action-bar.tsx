"use client";

import { ReactNode } from "react";

interface Props {
  count: number;
  countLabel?: string;
  onClear: () => void;
  banner?: ReactNode;
  children?: ReactNode;
}

export function BulkActionBar({ count, countLabel, onClear, banner, children }: Props) {
  if (count === 0) return null;
  const label = countLabel ? `${count} ${countLabel} selected` : `${count} selected`;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-stretch gap-2">
      {banner}
      <div className="bg-ink text-surface rounded-lg shadow-xl flex items-center gap-3 px-4 py-3 min-w-[420px]">
        <span className="text-body-s font-medium flex-1">{label}</span>
        <div className="flex items-center gap-2">{children}</div>
        <button
          onClick={onClear}
          className="text-body-s text-ink-secondary hover:text-surface ml-2"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
