"use client";

import { DemoScheduler } from "@/components/outreach/demo-scheduler";

export function DemoTab({
  applicationId,
  candidateId,
  candidateName,
  candidatePhone,
}: {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  candidatePhone: string;
}) {
  return (
    <DemoScheduler
      applicationId={applicationId}
      candidateId={candidateId}
      candidateName={candidateName}
      candidatePhone={candidatePhone}
    />
  );
}
