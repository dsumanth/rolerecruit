"use client";

interface Props {
  count: number;
  onClick?: () => void;
}

export function RejectionHistoryIndicator({ count, onClick }: Props) {
  if (count <= 0) return null;
  const label = count === 1 ? "1 prior reject" : `${count} prior rejects`;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="inline-flex items-center gap-1 text-body-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded"
      title="Click to view rejection history"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      {label}
    </button>
  );
}
