// components/shared/pool-origin-badge.tsx
"use client";
import { Sparkles } from "lucide-react";

interface Props {
  source?: "careers_site" | "talent_pool_match" | "agent_sourced" | "triage_cross_match" | "manual";
  poolName?: string | null;
}

export function PoolOriginBadge({ source, poolName }: Props) {
  if (!source || source === "careers_site" || source === "manual") return null;
  const label =
    source === "talent_pool_match" ? `From Talent Pool${poolName ? ` — ${poolName}` : ""}` :
    source === "agent_sourced" ? "Agent Sourced" :
    source === "triage_cross_match" ? "Cross-role suggestion" :
    "Surfaced";
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 text-xs px-2 py-0.5 ring-1 ring-amber-200">
      <Sparkles className="h-3 w-3" />{label}
    </span>
  );
}
