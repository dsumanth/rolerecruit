"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { ApplicationStatus } from "@/components/tracking/ApplicationStatus";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Card } from "@/components/ui";

export default function TrackPage() {
  return (
    <ConvexClientProvider>
      <TrackPageInner />
    </ConvexClientProvider>
  );
}

function TrackPageInner() {
  const { token } = useParams<{ token: string }>();
  const app = useQuery(api.tracking.getByToken, token ? { token } : "skip");

  if (app === undefined) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center p-6">
        <Card padding="lg" elevation={1} className="max-w-[480px] text-center">
          <p className="text-body-s text-ink-secondary">Loading...</p>
        </Card>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center p-6">
        <Card padding="lg" elevation={1} className="max-w-[480px] text-center">
          <h2 className="text-title-l text-ink mb-2">Application not found</h2>
          <p className="text-body-s text-ink-secondary">This tracking link is invalid or has expired.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas flex items-center justify-center p-6">
      <ApplicationStatus
        stage={app.stage}
        jobTitle={app.job?.title}
        candidateName={app.candidate?.name ?? "Candidate"}
        schoolName={app.school?.name ?? ""}
      />
    </div>
  );
}
