"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { MessageComposer } from "@/components/outreach/message-composer";
import { DemoScheduler } from "@/components/outreach/demo-scheduler";

interface TabItem {
  value: string;
  label: string;
  count?: number;
}

interface Candidate {
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
}

interface Application {
  _id: string;
  candidateId: string;
  stage: string;
  aiMatchScore?: number;
  candidate?: Candidate | null;
}

interface Props {
  app: Application;
  schoolName?: string;
  onClose: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  sourced: "Sourced",
  screened: "Screened",
  demo_scheduled: "Demo Scheduled",
  demo_completed: "Demo Completed",
  offer_sent: "Offer Sent",
  hired: "Hired",
  rejected: "Rejected",
};

const DRAWER_TABS: TabItem[] = [
  { value: "info", label: "Info" },
  { value: "outreach", label: "Outreach" },
  { value: "demo", label: "Demo" },
  { value: "evaluate", label: "Evaluate" },
];

export function ApplicationDrawer({ app, schoolName, onClose }: Props) {
  const [tab, setTab] = useState("info");
  const candidate = useQuery(api.candidates.get, {
    candidateId: app.candidateId as any,
  });

  const candidateName = candidate?.name ?? "Candidate";
  const candidatePhone = candidate?.phone ?? "";

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-96 bg-surface backdrop-blur-20 border-l border-chrome z-50 overflow-y-auto shadow-elev-3">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-title-m text-ink">
              {candidateName}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <span className="text-xl leading-none">&times;</span>
            </Button>
          </div>

          <Tabs
            items={DRAWER_TABS}
            value={tab}
            onChange={setTab}
            className="mb-5"
          />

          {tab === "info" && <InfoTab app={app} candidate={candidate} onSwitchTab={setTab} />}

          {tab === "outreach" && (
            <MessageComposer
              applicationId={app._id}
              candidateId={app.candidateId}
              candidateName={candidateName}
              candidatePhone={candidatePhone}
              schoolName={schoolName}
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

          {tab === "evaluate" && <EvaluateTab applicationId={app._id} />}
        </div>
      </div>
    </>
  );
}

function InfoTab({ app, candidate, onSwitchTab }: { app: Application; candidate: Candidate | null | undefined; onSwitchTab: (tab: string) => void }) {
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
    <div className="space-y-5">
      <div>
        <p className="text-xs text-ink-tertiary mb-0.5">Stage</p>
        <span className="text-sm text-ink">{STAGE_LABELS[app.stage] ?? app.stage}</span>
      </div>

      {availableTransitions.length > 0 && (
        <div className="pt-3 border-t border-surface-tertiary">
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
                className="text-xs px-2.5 py-1 rounded-full bg-surface-secondary text-ink hover:bg-accent hover:text-white transition-colors"
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

      {!candidate ? (
        <div className="p-4 text-center text-sm text-ink-secondary">
          Loading candidate details...
        </div>
      ) : (
        <>
          {candidate.location && (
            <div>
              <p className="text-xs text-ink-tertiary mb-0.5">Location</p>
              <p className="text-sm text-ink">{candidate.location}</p>
            </div>
          )}

          {(candidate.phone || candidate.email) && (
            <div>
              <p className="text-xs text-ink-tertiary mb-0.5">Contact</p>
              {candidate.phone && <p className="text-sm text-ink">{candidate.phone}</p>}
              {candidate.email && <p className="text-sm text-accent">{candidate.email}</p>}
            </div>
          )}

          {candidate.yearsExperience != null && (
            <div>
              <p className="text-xs text-ink-tertiary mb-0.5">Experience</p>
              <p className="text-sm text-ink">{candidate.yearsExperience} years</p>
            </div>
          )}

          {candidate.currentSchool && (
            <div>
              <p className="text-xs text-ink-tertiary mb-0.5">Current School</p>
              <p className="text-sm text-ink">{candidate.currentSchool}</p>
            </div>
          )}

          {candidate.qualifications.length > 0 && (
            <div>
              <p className="text-xs text-ink-tertiary mb-1">Qualifications</p>
              <div className="flex flex-wrap gap-1">
                {candidate.qualifications.map((q) => (
                  <Badge key={q}>{q}</Badge>
                ))}
              </div>
            </div>
          )}

          {candidate.certifications.length > 0 && (
            <div>
              <p className="text-xs text-ink-tertiary mb-1">Certifications</p>
              <div className="flex flex-wrap gap-1">
                {candidate.certifications.map((c) => (
                  <Badge key={c} variant="success">{c}</Badge>
                ))}
              </div>
            </div>
          )}

          {candidate.boardExperience.length > 0 && (
            <div>
              <p className="text-xs text-ink-tertiary mb-1">Board Experience</p>
              <div className="flex flex-wrap gap-1">
                {candidate.boardExperience.map((b) => (
                  <Badge key={b}>{b}</Badge>
                ))}
              </div>
            </div>
          )}

          {candidate.subjects.length > 0 && (
            <div>
              <p className="text-xs text-ink-tertiary mb-1">Subjects</p>
              <div className="flex flex-wrap gap-1">
                {candidate.subjects.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EvaluateTab({ applicationId }: { applicationId: string }) {
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

  const feedbackUrl = token
    ? `/feedback/${token}`
    : "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-secondary">
        Request a demo lesson evaluation from a team member. They will receive a feedback link.
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
          Evaluation request created! Share this link with the evaluator:
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
