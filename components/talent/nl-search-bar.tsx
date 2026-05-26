// components/talent/nl-search-bar.tsx
"use client";
import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Search, Loader2 } from "lucide-react";

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
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Ask: "Physics teachers with JEE coaching and 3+ years"'
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
      </button>
    </form>
  );
}
