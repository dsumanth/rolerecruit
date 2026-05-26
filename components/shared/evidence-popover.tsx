// components/shared/evidence-popover.tsx
"use client";
import { useState } from "react";
import { Info } from "lucide-react";

interface Evidence {
  quote: string;
  offset: number;
  context: string;
}

interface Props {
  value: string;
  evidence?: Evidence;
}

export function EvidencePopover({ value, evidence }: Props) {
  const [open, setOpen] = useState(false);
  if (!evidence) {
    return <span className="text-sm">{value}</span>;
  }
  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="text-sm underline decoration-dotted hover:decoration-solid inline-flex items-center gap-1"
      >
        {value}
        <Info className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-72 p-3 bg-white rounded shadow-lg ring-1 ring-gray-200 text-xs">
          <div className="font-medium text-gray-700 mb-1">Evidence</div>
          <div className="italic text-gray-600 mb-2">&ldquo;{evidence.quote}&rdquo;</div>
          <div className="text-gray-500">Context: &hellip;{evidence.context}&hellip;</div>
        </div>
      )}
    </span>
  );
}
