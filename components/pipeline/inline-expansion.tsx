"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { MessageComposer } from "@/components/outreach/message-composer";
import { DemoScheduler } from "@/components/outreach/demo-scheduler";
import { DemosPanel } from "@/components/demos/demos-panel";
import { InboxThread } from "@/components/dashboard/inbox-thread";
import { useState } from "react";

const STAGE_LABELS: Record<string, string> = {
  sourced: "Sourced",
  screened: "Screened",
  demo_scheduled: "Demo Scheduled",
  demo_completed: "Demo Completed",
  offer_sent: "Offer Sent",
  hired: "Hired",
  rejected: "Rejected",
};

interface Application {
  _id: string;
  candidateId: string;
  stage: string;
  aiMatchScore?: number;
  candidate?: {
    _id: string;
    name: string;
    phone?: string;
    email?: string;
    location?: string;
    qualifications: string[];
    certifications: string[];
    boardExperience: string[];
    subjects: string[];
    yearsExperience?: number;
    currentSchool?: string;
    resumeUrl?: string;
  } | null;
}

interface InlineExpansionProps {
  app: Application;
}

export function InlineExpansion({ app }: InlineExpansionProps) {
  const [tab, setTab] = useState("info");

  const candidate = useQuery(api.candidates.get, {
    candidateId: app.candidateId as any,
  });

  const candidateName = candidate?.name ?? app.candidate?.name ?? "Candidate";
  const candidatePhone = candidate?.phone ?? app.candidate?.phone ?? "";

  const thread = useQuery(api.inbox.getThread, { applicationId: app._id as any });
  const hasEscalated = thread?.some(
    (m: any) => m.escalated === true && m.resolvedAt == null,
  );

  return (
    <div className="border-t border-hairline bg-surface-canvas px-6 py-4">
      {hasEscalated && (
        <div className="mb-4">
          <div className="text-micro text-warning mb-2">Conversation needs your attention</div>
          <InboxThread
            applicationId={app._id as any}
            candidateId={app.candidateId as any}
          />
        </div>
      )}

      <Tabs
        items={[
          { value: "info", label: "Info" },
          { value: "outreach", label: "Outreach" },
          { value: "demo", label: "Demo" },
          { value: "evaluate", label: "Evaluate" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="mt-4">
        {tab === "info" && <InfoTabContent app={app} candidate={candidate} onSwitchTab={setTab} />}
        {tab === "outreach" && (
          <MessageComposer
            applicationId={app._id}
            candidateId={app.candidateId}
            candidateName={candidateName}
            candidatePhone={candidatePhone}
          />
        )}
        {tab === "demo" && (
          <DemoScheduler
            applicationId={app._id}
            candidateId={app.candidateId}
            candidateName={candidateName}
            candidatePhone={candidatePhone}
          />
        )}
        {tab === "evaluate" && <EvaluateTabContent applicationId={app._id} candidateName={candidateName} />}
      </div>
    </div>
  );
}

function InfoTabContent({
  app,
  candidate,
  onSwitchTab,
}: {
  app: Application;
  candidate: any;
  onSwitchTab: (tab: string) => void;
}) {
  const fullApp = useQuery(api.applications.get, { applicationId: app._id as any });
  const schoolId = fullApp?.schoolId;
  const availableTransitions = useQuery(
    api.pipeline_config.getAvailableTransitions,
    schoolId ? { schoolId: schoolId as any, currentStageId: app.stage } : "skip"
  ) ?? [];
  const moveStage = useMutation(api.applications.moveStage);
  const stageList = useQuery(
    api.pipeline_config.getActiveStages,
    schoolId ? { schoolId: schoolId as any } : "skip"
  ) ?? [];

  const getStageName = (stageId: string) => {
    const found = stageList.find((s: any) => s.id === stageId);
    return found?.name ?? stageId;
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-ink-tertiary mb-0.5">Stage</p>
        <p className="text-sm text-ink">{STAGE_LABELS[app.stage] ?? app.stage}</p>
      </div>

      {availableTransitions.length > 0 && (
        <div className="col-span-2 mt-2 pt-3 border-t border-hairline">
          <p className="text-xs text-ink-secondary mb-1.5">Move to:</p>
          <div className="flex flex-wrap gap-1.5">
            {availableTransitions.map((t: any) => (
              <button
                key={t.toStageId}
                type="button"
                onClick={async () => {
                  await moveStage({ applicationId: app._id as any, newStage: t.toStageId });
                  if (t.toStageId === "demo_scheduled") {
                    onSwitchTab("demo");
                  } else if (t.toStageId === "offer_sent" || t.toStageId === "rejected") {
                    onSwitchTab("outreach");
                  }
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-surface-canvas text-ink hover:bg-accent hover:text-white transition-colors"
              >
                → {getStageName(t.toStageId)}
              </button>
            ))}
          </div>
        </div>
      )}

      {app.aiMatchScore != null && (
        <div>
          <p className="text-xs text-ink-tertiary mb-0.5">AI Match Score</p>
          <span className="text-sm font-medium text-ink tabular-nums">
            {app.aiMatchScore}%
          </span>
        </div>
      )}

      {candidate?.location && (
        <div>
          <p className="text-xs text-ink-tertiary mb-0.5">Location</p>
          <p className="text-sm text-ink">{candidate.location}</p>
        </div>
      )}

      {candidate?.phone && (
        <div>
          <p className="text-xs text-ink-tertiary mb-0.5">Phone</p>
          <p className="text-sm text-ink">{candidate.phone}</p>
        </div>
      )}

      {candidate?.email && (
        <div>
          <p className="text-xs text-ink-tertiary mb-0.5">Email</p>
          <p className="text-sm text-accent">{candidate.email}</p>
        </div>
      )}

      {candidate?.currentSchool && (
        <div>
          <p className="text-xs text-ink-tertiary mb-0.5">Current School</p>
          <p className="text-sm text-ink">{candidate.currentSchool}</p>
        </div>
      )}

      {candidate?.yearsExperience != null && (
        <div>
          <p className="text-xs text-ink-tertiary mb-0.5">Experience</p>
          <p className="text-sm text-ink">{candidate.yearsExperience} years</p>
        </div>
      )}

      {candidate?.subjects && candidate.subjects.length > 0 && (
        <div className="col-span-2">
          <p className="text-xs text-ink-tertiary mb-1">Subjects</p>
          <div className="flex flex-wrap gap-1">
            {candidate.subjects.map((s: string) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        </div>
      )}

      {candidate?.qualifications && candidate.qualifications.length > 0 && (
        <div className="col-span-2">
          <p className="text-xs text-ink-tertiary mb-1">Qualifications</p>
          <div className="flex flex-wrap gap-1">
            {candidate.qualifications.map((q: string) => (
              <Badge key={q}>{q}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EvaluateTabContent({ applicationId, candidateName }: { applicationId: string; candidateName: string }) {
  const app = useQuery(api.applications.get, { applicationId: applicationId as any });
  if (!app?.schoolId) {
    return <p className="text-sm text-ink-secondary">Loading...</p>;
  }
  return (
    <DemosPanel
      applicationId={applicationId}
      schoolId={app.schoolId as any}
      candidateName={candidateName}
    />
  );
}
