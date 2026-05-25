import { Card, Button } from "@/components/ui";

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
    <Card padding="md" elevation={1}>
      <h3 className="text-body-s font-semibold text-ink mb-3">AI suggested criteria</h3>
      {loading ? (
        <p className="text-body-s text-ink-secondary">Generating suggestions...</p>
      ) : suggested ? (
        <>
          <div className="space-y-2 mb-4">
            {suggested.dimensions.map((d) => (
              <div key={d.name} className="flex justify-between text-body-s">
                <span className="text-ink">{d.name}</span>
                <span className="text-ink-secondary tabular-nums">{(d.weight * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={onAccept}>Accept All</Button>
            <Button variant="secondary" size="sm" onClick={onGenerate}>Regenerate</Button>
          </div>
        </>
      ) : (
        <div className="rounded-md bg-accent-soft p-4">
          <p className="text-body-s text-ink mb-3">
            Let AI propose dimensions and weights based on this role.
          </p>
          <Button variant="primary" size="md" iconLeft="Sparkles" onClick={onGenerate}>
            Generate AI Suggestions
          </Button>
        </div>
      )}
    </Card>
  );
}
