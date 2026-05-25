interface Props {
  name: string;
  board: string;
  city: string;
}

export function SchoolHeader({ name, board, city }: Props) {
  return (
    <div className="bg-surface border-b border-hairline">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{name}</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-surface-canvas text-ink-secondary font-medium">{board}</span>
          <span className="text-sm text-ink-secondary">{city}</span>
        </div>
      </div>
    </div>
  );
}
