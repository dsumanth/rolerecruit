"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui";
import { InboxThread } from "@/components/dashboard/inbox-thread";

interface Props {
  applicationId: string;
}

export function InboxThreadPanel({ applicationId }: Props) {
  const appId = applicationId as Id<"applications">;
  const app = useQuery(api.applications.get, { applicationId: appId });

  if (!app) {
    return (
      <Card padding="lg">
        <div className="text-body-s text-ink-secondary">Loading...</div>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl">
      <InboxThread applicationId={appId} candidateId={app.candidateId} />
    </div>
  );
}
