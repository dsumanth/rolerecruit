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
      <div className="bg-surface-elev border border-hairline-strong rounded-lg shadow-elev-4 flex items-center gap-3 px-4 py-2.5 min-w-[420px]">
        <span className="text-body-s font-medium text-ink flex-1">{label}</span>
        <div className="flex items-center gap-2">{children}</div>
        <button
          onClick={onClear}
          className="text-body-s text-ink-secondary hover:text-ink transition-colors duration-fast ease-apple-out ml-2"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
