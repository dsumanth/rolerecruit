"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  shortlist: "Shortlist",
  demo_schedule: "Demo Schedule",
  feedback_request: "Feedback Request",
  offer: "Offer",
  rejection: "Rejection",
  custom: "Custom",
};

const TYPE_COLORS: Record<string, string> = {
  shortlist: "bg-surface-secondary text-ink",
  demo_schedule: "bg-green-50 text-success",
  feedback_request: "bg-accent/10 text-accent",
  offer: "bg-green-50 text-success",
  rejection: "bg-red-50 text-danger",
  custom: "bg-surface-secondary text-ink-secondary",
};

export function OutreachHistory({ jobId }: { jobId: string }) {
  const groups = useQuery(api.outreach.getOutreachHistoryForJob, {
    jobId: jobId as any,
  });

  if (!groups) {
    return (
      <div className="rounded-apple bg-surface border border-surface-tertiary p-8 text-center">
        <p className="text-sm text-ink-secondary">Loading outreach history...</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-apple bg-surface border border-surface-tertiary p-8 text-center">
        <p className="text-sm text-ink-secondary">
          No messages sent yet. Open a candidate from the pipeline to send outreach.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group: any) => (
        <div
          key={group.applicationId}
          className="rounded-apple bg-surface border border-surface-tertiary overflow-hidden"
        >
          <div className="px-5 py-3 bg-surface-secondary border-b border-surface-tertiary">
            <p className="text-sm font-medium text-ink">{group.candidateName}</p>
          </div>
          <div className="divide-y divide-[#e8e8ed]">
            {group.messages.map((msg: any) => (
              <div key={msg._id} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      TYPE_COLORS[msg.type] ?? "bg-surface-secondary text-ink-secondary"
                    )}
                  >
                    {TYPE_LABELS[msg.type] ?? msg.type}
                  </span>
                  <span className="text-xs text-ink-tertiary">
                    {new Date(msg.sentAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {msg.status === "failed" && (
                      <span className="ml-2 text-danger">Failed</span>
                    )}
                  </span>
                </div>
                <p className="text-sm text-ink whitespace-pre-wrap">{msg.body}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
