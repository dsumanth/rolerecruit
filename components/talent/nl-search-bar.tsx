// components/talent/nl-search-bar.tsx
"use client";
import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Input, Button } from "@/components/ui";

interface Props {
  onResults: (candidates: any[], intent: string) => void;
}

export function NlSearchBar({ onResults }: Props) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const search = useAction(api.talentSearch.searchNatural);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await search({ question: q });
      onResults(res.candidates, res.intent);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 mb-4">
      <div className="flex-1">
        <Input
          iconLeft="Sparkles"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Ask: "Physics teachers with JEE coaching and 3+ years"'
        />
      </div>
      <Button type="submit" variant="primary" size="md" disabled={loading || !q.trim()} loading={loading}>
        Search
      </Button>
    </form>
  );
}
