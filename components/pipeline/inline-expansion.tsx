"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { MessageComposer } from "@/components/outreach/message-composer";
import { DemoScheduler } from "@/components/outreach/demo-scheduler";
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

  return (
    <div className="border-t border-hairline bg-surface-canvas px-6 py-4">
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
        {tab === "evaluate" && <EvaluateTabContent applicationId={app._id} />}
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

function EvaluateTabContent({ applicationId }: { applicationId: string }) {
  const createEval = useMutation(api.evaluations.create);
  const [evaluatorRole, setEvaluatorRole] = useState<string>("principal");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [token, setToken] = useState("");

  const handleRequest = async () => {
    setSending(true);
    setResult(null);
    try {
      const evalResult = await createEval({
        applicationId: applicationId as any,
        evaluatorRole: evaluatorRole as "principal" | "hod" | "hr_admin",
      });
      setToken((evalResult as any).token ?? "");
      setResult("success");
    } catch {
      setResult("error");
    } finally {
      setSending(false);
    }
  };

  const feedbackUrl = token ? `/feedback/${token}` : "";

  return (
    <div className="space-y-4 max-w-md">
      <p className="text-sm text-ink-secondary">
        Request a demo lesson evaluation from a team member.
      </p>

      <div>
        <label className="block text-xs text-ink-secondary mb-1">Evaluator Role</label>
        <Select
          value={evaluatorRole}
          onChange={setEvaluatorRole}
          options={[
            { value: "principal", label: "Principal" },
            { value: "hod", label: "HOD" },
            { value: "hr_admin", label: "HR Admin" },
          ]}
        />
      </div>

      {result === "success" && (
        <div className="px-3 py-2 rounded-apple bg-green-50 text-sm text-success">
          Evaluation request created. Share this link:
          <br />
          <code className="text-xs text-ink break-all">{feedbackUrl}</code>
        </div>
      )}
      {result === "error" && (
        <div className="px-3 py-2 rounded-apple bg-red-50 text-sm text-danger">
          Failed to create evaluation request.
        </div>
      )}

      <Button
        variant="primary"
        size="md"
        loading={sending}
        onClick={handleRequest}
        className="w-full"
      >
        Request Evaluation
      </Button>
    </div>
  );
}
