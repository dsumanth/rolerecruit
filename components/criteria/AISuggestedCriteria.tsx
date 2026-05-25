interface SuggestedDimension {
  name: string;
  weight: number;
  config: Record<string, any>;
}

interface Props {
  suggested: {
    dimensions: SuggestedDimension[];
    minimumScore: number;
    autoRejectScore: number;
  } | null;
  loading: boolean;
  onAccept: () => void;
  onGenerate: () => void;
}

export function AISuggestedCriteria({ suggested, loading, onAccept, onGenerate }: Props) {
  return (
    <div className="rounded-apple bg-surface border border-surface-tertiary p-5 mb-6">
      <h3 className="text-sm font-semibold text-ink mb-3">AI Suggested Criteria</h3>
      {loading ? (
        <p className="text-sm text-ink-secondary">Generating suggestions...</p>
      ) : suggested ? (
        <>
          <div className="space-y-2 mb-4">
            {suggested.dimensions.map((d) => (
              <div key={d.name} className="flex justify-between text-sm">
                <span className="text-ink">{d.name}</span>
                <span className="text-ink-secondary">{(d.weight * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onAccept} className="py-2 px-4 rounded-apple bg-accent text-white text-xs font-medium hover:bg-accent-hover">Accept All</button>
            <button type="button" onClick={onGenerate} className="py-2 px-4 rounded-apple bg-surface-secondary text-xs text-ink">Regenerate</button>
          </div>
        </>
      ) : (
        <button type="button" onClick={onGenerate} className="py-2 px-4 rounded-apple bg-accent/10 text-accent text-sm font-medium hover:bg-accent/10">
          Generate AI Suggestions
        </button>
      )}
    </div>
  );
}
