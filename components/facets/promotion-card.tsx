"use client";

import { useMutation } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type Status = Doc<"facetPromotionCandidates">["status"];

const STATUS_META: Record<
  Status,
  { variant: "warning" | "success" | "neutral" | "info"; label: string }
> = {
  pending: { variant: "warning", label: "Pending" },
  promoted: { variant: "success", label: "Promoted" },
  dismissed: { variant: "neutral", label: "Dismissed" },
  demoted: { variant: "info", label: "Demoted" },
};

interface Props {
  row: Doc<"facetPromotionCandidates">;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PromotionCard({ row }: Props) {
  const { data: session } = authClient.useSession();
  const actorUserId = session?.user.id ?? "unknown";
  const promote = useMutation(api.facetPromotion.promote);
  const dismiss = useMutation(api.facetPromotion.dismiss);
  const demote = useMutation(api.facetPromotion.demote);

  const meta = STATUS_META[row.status] ?? STATUS_META.pending;
  const samples = row.sampleEvidence.slice(0, 3);

  return (
    <div className="rounded-lg bg-surface border border-hairline shadow-elev-1 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-body font-medium text-ink truncate">{row.key}</h3>
            <Badge variant={meta.variant} dot>
              {meta.label}
            </Badge>
            <span className="text-caption text-ink-secondary tabular-nums">
              {row.occurrenceCount} candidate{row.occurrenceCount === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-caption text-ink-tertiary mt-1.5">
            First seen {formatDate(row.firstSeenAt)}
          </p>
          {samples.length > 0 && (
            <ul className="mt-3 space-y-1">
              {samples.map((s, i) => (
                <li key={i} className="text-caption text-ink-secondary italic">
                  &ldquo;{s.quote}&rdquo;
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {row.status === "pending" && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => promote({ key: row.key, actorUserId })}
              >
                <Icon name="Check" size={14} /> Promote
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => dismiss({ key: row.key, actorUserId })}
              >
                <Icon name="X" size={14} /> Dismiss
              </Button>
            </>
          )}
          {row.status === "promoted" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => demote({ key: row.key, actorUserId })}
            >
              <Icon name="TrendingDown" size={14} /> Demote
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
