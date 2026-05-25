interface Props {
  name: string;
  weight: number;
  config: Record<string, any>;
  onWeightChange: (name: string, weight: number) => void;
  onRemove: (name: string) => void;
}

export function DimensionSlider({ name, weight, config, onWeightChange, onRemove }: Props) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-md bg-surface-canvas border border-hairline">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-body-s font-medium text-ink">{name}</span>
          <button
            type="button"
            onClick={() => onRemove(name)}
            className="text-caption text-danger hover:underline transition-colors duration-fast"
          >
            Remove
          </button>
        </div>
        <pre className="text-caption text-ink-secondary truncate">{JSON.stringify(config)}</pre>
      </div>
      <div className="w-32">
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(weight * 100)}
          onChange={(e) => onWeightChange(name, parseInt(e.target.value) / 100)}
          className="w-full accent-[var(--accent)]"
        />
        <p className="text-caption text-center text-ink-secondary tabular-nums">{Math.round(weight * 100)}%</p>
      </div>
    </div>
  );
}
