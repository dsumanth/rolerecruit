"use client";

import { MessageComposer } from "@/components/outreach/message-composer";

export function OutreachTab({
  applicationId,
  candidateId,
  candidateName,
  candidatePhone,
  schoolName,
}: {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  candidatePhone: string;
  schoolName?: string;
}) {
  return (
    <MessageComposer
      applicationId={applicationId}
      candidateId={candidateId}
      candidateName={candidateName}
      candidatePhone={candidatePhone}
      schoolName={schoolName}
    />
  );
}
