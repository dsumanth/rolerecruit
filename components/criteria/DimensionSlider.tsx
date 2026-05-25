interface Props {
  name: string;
  weight: number;
  config: Record<string, any>;
  onWeightChange: (name: string, weight: number) => void;
  onRemove: (name: string) => void;
}

export function DimensionSlider({ name, weight, config, onWeightChange, onRemove }: Props) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-apple bg-surface-secondary">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-ink">{name}</span>
          <button type="button" onClick={() => onRemove(name)} className="text-xs text-danger hover:underline">Remove</button>
        </div>
        <pre className="text-xs text-ink-tertiary truncate">{JSON.stringify(config)}</pre>
      </div>
      <div className="w-32">
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(weight * 100)}
          onChange={(e) => onWeightChange(name, parseInt(e.target.value) / 100)}
          className="w-full"
        />
        <p className="text-xs text-center text-ink-secondary">{Math.round(weight * 100)}%</p>
      </div>
    </div>
  );
}
