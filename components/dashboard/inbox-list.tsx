"use client";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, EmptyState } from "@/components/ui";

interface Props {
  schoolId: Id<"schools">;
}

export function InboxList({ schoolId }: Props) {
  const rows = useQuery(api.inbox.listEscalated, { schoolId });

  if (!rows) {
    return (
      <Card padding="lg">
        <div className="text-body-s text-ink-secondary">Loading...</div>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Inbox zero"
        description="No conversations need your attention right now. The agent handles routine FAQs and reschedules automatically."
      />
    );
  }

  return (
    <ul className="space-y-2 max-w-3xl">
      {rows.map((r) => (
        <li key={r.applicationId}>
          <Link href={`/dashboard/inbox/${r.applicationId}`}>
            <Card padding="md" elevation={1} interactive>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-body-s font-medium text-ink">{r.candidateName}</span>
                    <span className="text-caption text-warning">{r.latestEscalationReason}</span>
                  </div>
                  <div className="text-body-s text-ink-secondary mt-1 line-clamp-2">{r.latestBody}</div>
                </div>
                <div className="text-caption text-ink-tertiary shrink-0">
                  {new Date(r.latestAt).toLocaleString()}
                </div>
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
