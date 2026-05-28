"use client";

interface Props {
  loadedCount: number;
  totalCount: number;
  entityLabel: string;
  onSelectAllMatching: () => void;
}

export function SelectAllMatchingBanner({ loadedCount, totalCount, entityLabel, onSelectAllMatching }: Props) {
  if (totalCount <= loadedCount) return null;
  return (
    <div className="bg-accent-soft border border-hairline-strong text-ink rounded-lg shadow-elev-1 flex items-center gap-3 px-4 py-2 min-w-[420px]">
      <span className="text-body-s flex-1">
        All {loadedCount} {entityLabel} on this page selected.
      </span>
      <button
        onClick={onSelectAllMatching}
        className="text-body-s font-semibold text-accent hover:underline transition-colors duration-fast ease-apple-out"
      >
        Select all {totalCount.toLocaleString()} matching
      </button>
    </div>
  );
}
