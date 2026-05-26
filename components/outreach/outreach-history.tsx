"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

const TYPE_LABELS: Record<string, string> = {
  shortlist: "Shortlist",
  demo_schedule: "Demo Schedule",
  feedback_request: "Feedback Request",
  offer: "Offer",
  rejection: "Rejection",
  custom: "Custom",
};

const TYPE_VARIANTS: Record<string, BadgeVariant> = {
  shortlist: "neutral",
  demo_schedule: "success",
  feedback_request: "info",
  offer: "success",
  rejection: "danger",
  custom: "neutral",
};

export function OutreachHistory({ jobId }: { jobId: string }) {
  const groups = useQuery(api.outreach.getOutreachHistoryForJob, {
    jobId: jobId as any,
  });

  if (!groups) {
    return (
      <Card padding="lg" elevation={1} className="text-center">
        <p className="text-body-s text-ink-secondary">Loading outreach history...</p>
      </Card>
    );
  }

  if (groups.length === 0) {
    return (
      <Card padding="lg" elevation={1} className="text-center">
        <p className="text-body-s text-ink-secondary">
          No messages sent yet. Open a candidate from the pipeline to send outreach.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group: any) => (
        <Card
          key={group.applicationId}
          padding="none"
          elevation={1}
          className="overflow-hidden"
        >
          <div className="px-5 py-3 bg-surface-canvas border-b border-hairline">
            <p className="text-body-s font-medium text-ink">{group.candidateName}</p>
          </div>
          <div className="divide-y divide-hairline">
            {group.messages.map((msg: any) => (
              <div key={msg._id} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant={TYPE_VARIANTS[msg.type] ?? "neutral"}>
                    {TYPE_LABELS[msg.type] ?? msg.type}
                  </Badge>
                  <span className="text-caption text-ink-tertiary">
                    {msg.sentAt ? new Date(msg.sentAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }) : "Draft"}
                    {msg.status === "failed" && (
                      <span className="ml-2 text-danger">Failed</span>
                    )}
                  </span>
                </div>
                <p className="text-body-s text-ink whitespace-pre-wrap">{msg.body}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
