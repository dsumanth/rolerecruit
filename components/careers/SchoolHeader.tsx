import { Badge } from "@/components/ui";

interface Props {
  name: string;
  board: string;
  city: string;
}

export function SchoolHeader({ name, board, city }: Props) {
  return (
    <div className="border-b border-hairline">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-display-s text-ink tracking-tight">{name}</h1>
        <div className="flex items-center gap-3 mt-2">
          <Badge variant="neutral">{board}</Badge>
          <span className="text-body-s text-ink-secondary">{city}</span>
        </div>
      </div>
    </div>
  );
}
