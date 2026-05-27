"use client";

interface Props {
  label: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ label, onUndo, onDismiss }: Props) {
  return (
    <div className="relative bg-ink text-surface rounded-lg shadow-lg flex items-center gap-4 px-4 py-3 min-w-[280px] overflow-hidden">
      <span className="text-body-s flex-1">{label}</span>
      <button
        onClick={onUndo}
        className="text-body-s font-semibold underline hover:no-underline"
      >
        Undo
      </button>
      <button onClick={onDismiss} aria-label="Dismiss" className="text-ink-secondary hover:text-surface">
        &#x2715;
      </button>
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-accent"
        style={{
          width: "100%",
          animation: "shrink-x 10s linear forwards",
        }}
      />
    </div>
  );
}
