"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { ApplicationStatus } from "@/components/tracking/ApplicationStatus";

export default function TrackPage() {
  const { token } = useParams<{ token: string }>();
  const app = useQuery(api.tracking.getByToken, token ? { token } : "skip");

  if (app === undefined) {
    return <div className="max-w-lg mx-auto px-6 py-20"><p className="text-ink-secondary text-center">Loading...</p></div>;
  }

  if (!app) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20">
        <div className="rounded-apple bg-surface border border-surface-tertiary p-8 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-ink">Application Not Found</h2>
          <p className="text-sm text-ink-secondary mt-2">This tracking link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-secondary py-20 px-6">
      <ApplicationStatus
        stage={app.stage}
        jobTitle={app.job?.title}
        candidateName={app.candidate?.name ?? "Candidate"}
        schoolName={app.school?.name ?? ""}
      />
    </div>
  );
}
