"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { MessageComposer } from "@/components/outreach/message-composer";
import { DemoScheduler } from "@/components/outreach/demo-scheduler";
import { PoolOriginBadge } from "@/components/shared/pool-origin-badge";
import { EvidencePopover } from "@/components/shared/evidence-popover";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UndoToast } from "@/components/ui/undo-toast";
import { useUndoToast } from "@/hooks/use-undo-toast";

interface TabItem {
  value: string;
  label: string;
  count?: number;
}

interface FacetValue {
  value: string;
  evidence: { quote: string; offset: number; context: string };
}

interface ParsedFacets {
  specializations: FacetValue[];
  gradeLevels: FacetValue[];
  pedagogicalApproach: FacetValue[];
  leadershipRoles: FacetValue[];
  extracurricular: FacetValue[];
  languages: FacetValue[];
  schoolTypes: FacetValue[];
  keyAchievements: FacetValue[];
  redFlags: FacetValue[];
  extras: Record<string, FacetValue[]>;
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
  candidateSummary?: string;
  parsedFacets?: ParsedFacets;
  parseStatus?: "pending" | "done" | "failed";
  parseError?: string;
  parsedAt?: number;
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
  { value: "triage", label: "Triage" },
  { value: "outreach", label: "Outreach" },
  { value: "demo", label: "Demo" },
  { value: "evaluate", label: "Evaluate" },
];

type Phase = "stable" | "exiting" | "pre-enter" | "entering";

export function ApplicationDrawer({ app: incomingApp, schoolName, onClose }: Props) {
  const [tab, setTab] = useState("info");
  const [displayedApp, setDisplayedApp] = useState(incomingApp);
  const [phase, setPhase] = useState<Phase>("stable");
  const displayedIdRef = useRef<string>(incomingApp._id);

  useEffect(() => {
    if (incomingApp._id === displayedIdRef.current) return;

    let cancelled = false;
    setPhase("exiting");

    const exitTimer = setTimeout(() => {
      if (cancelled) return;
      setDisplayedApp(incomingApp);
      displayedIdRef.current = incomingApp._id;
      setPhase("pre-enter");

      requestAnimationFrame(() => {
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (cancelled) return;
          setPhase("entering");

          setTimeout(() => {
            if (cancelled) return;
            setPhase("stable");
          }, 220);
        });
      });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(exitTimer);
    };
  }, [incomingApp]);

  const app = displayedApp;
  const candidateFromQuery = useQuery(api.candidates.get, {
    candidateId: app.candidateId as any,
  });
  const candidate = candidateFromQuery ?? (app.candidate as Candidate | null | undefined);
  const triageDecision = useQuery(
    api.triage.getByApplicationId,
    app._id ? { applicationId: app._id as any } : "skip",
  );
  const candidateForTriage = useQuery(
    api.candidates.get,
    app.candidateId ? { candidateId: app.candidateId as any } : "skip",
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const removeCandidate = useMutation(api.candidates.remove);
  const undo = useMutation(api.candidates.undoBatchDelete);
  const undoToast = useUndoToast();

  const candidateName = candidate?.name ?? "Candidate";
  const candidatePhone = candidate?.phone ?? "";

  const phaseClass =
    phase === "exiting"
      ? "transition-all duration-200 ease-out -translate-x-6 opacity-0"
      : phase === "pre-enter"
        ? "translate-x-6 opacity-0"
        : phase === "entering"
          ? "transition-all duration-200 ease-out translate-x-0 opacity-100"
          : "";

  return (
    <>
      <div className="fixed inset-y-0 right-0 w-96 bg-surface backdrop-blur-20 border-l border-chrome z-50 overflow-y-auto shadow-elev-3">
        <div className={cn("p-6", phaseClass)}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-title-m text-ink">
                {candidateName}
              </h2>
              <PoolOriginBadge source={(app as any).source} poolName={undefined} />
            </div>
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

          {tab === "triage" && (
            <TriageTab triageDecision={triageDecision} candidateForTriage={candidateForTriage} />
          )}

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

          <div className="border-t border-hairline p-4 mt-4">
            <button
              onClick={() => setConfirmOpen(true)}
              className="text-body-s text-red-600 hover:text-red-700 font-medium"
            >
              Delete candidate
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete ${candidate?.name ?? "candidate"}?`}
        body="This removes their resume, every application across roles, and all evaluations. You can undo within 10 seconds."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!candidate?._id) return;
          setConfirmOpen(false);
          const r = await removeCandidate({ candidateId: candidate._id as any });
          if (typeof onClose === "function") onClose();
          if (r.batchId) {
            undoToast.show({
              label: `Deleted ${candidate.name ?? "candidate"}`,
              onUndo: async () => { await undo({ batchId: r.batchId }); },
            });
          }
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      <div className="fixed top-6 right-6 z-50 space-y-2">
        {undoToast.toasts.map((t) => (
          <UndoToast key={t.id} label={t.label} onUndo={() => undoToast.undo(t.id)} onDismiss={() => undoToast.dismiss(t.id)} />
        ))}
      </div>
    </>
  );
}

function ParseStatusPill({ status, error }: { status?: string; error?: string }) {
  if (!status || status === "done") return null;
  if (status === "pending") {
    return (
      <div className="rounded-md bg-accent-soft border border-accent/20 px-3 py-2 text-xs text-accent">
        Parsing resume…
      </div>
    );
  }
  return (
    <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-3 py-2 text-xs text-danger">
      <div className="font-medium mb-0.5">Resume parsing failed</div>
      {error && <div className="text-ink-secondary">{error}</div>}
    </div>
  );
}

function FacetSection({
  label,
  values,
}: {
  label: string;
  values: FacetValue[] | undefined;
}) {
  if (!values || values.length === 0) return null;
  return (
    <div>
      <p className="text-xs text-ink-tertiary mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {values.map((v, i) => (
          <span key={i} className="text-xs bg-surface-canvas px-2 py-0.5 rounded">
            <EvidencePopover value={v.value} evidence={v.evidence} />
          </span>
        ))}
      </div>
    </div>
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
  const profileGraph = useQuery(
    api.graph.profileGraphForCandidate,
    candidate?._id ? { candidateId: candidate._id as any } : "skip",
  );

  const getStageName = (stageId: string) => {
    const found = stageList.find((s: any) => s.id === stageId);
    return found?.name ?? stageId;
  };

  const facets = candidate?.parsedFacets;
  const extras = facets?.extras
    ? Object.entries(facets.extras).filter(([key]) => !key.startsWith("__promoted__"))
    : [];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-ink-tertiary mb-0.5">Stage</p>
        <span className="text-sm text-ink">{STAGE_LABELS[app.stage] ?? app.stage}</span>
      </div>

      {availableTransitions.length > 0 && (
        <div className="pt-3 border-t border-hairline">
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

      {!candidate ? (
        <div className="p-4 text-center text-sm text-ink-secondary">
          Loading candidate details...
        </div>
      ) : (
        <>
          <ParseStatusPill status={candidate.parseStatus} error={candidate.parseError} />

          {candidate.candidateSummary && (
            <div className="pt-3 border-t border-hairline">
              <p className="text-xs text-ink-tertiary mb-1">Summary</p>
              <p className="text-sm text-ink leading-relaxed">{candidate.candidateSummary}</p>
            </div>
          )}

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

          {facets && (
            <div className="pt-3 border-t border-hairline space-y-3">
              <p className="text-xs text-ink-tertiary uppercase tracking-wide">Parsed from resume</p>
              <FacetSection label="Specializations" values={facets.specializations} />
              <FacetSection label="Grade levels" values={facets.gradeLevels} />
              <FacetSection label="Pedagogical approach" values={facets.pedagogicalApproach} />
              <FacetSection label="Key achievements" values={facets.keyAchievements} />
              <FacetSection label="Leadership" values={facets.leadershipRoles} />
              <FacetSection label="Extracurricular" values={facets.extracurricular} />
              <FacetSection label="Languages" values={facets.languages} />
              <FacetSection label="School types" values={facets.schoolTypes} />
              {facets.redFlags && facets.redFlags.length > 0 && (
                <div>
                  <p className="text-xs text-danger mb-1">Red flags</p>
                  <div className="flex flex-wrap gap-1">
                    {facets.redFlags.map((v, i) => (
                      <span key={i} className="text-xs bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-danger px-2 py-0.5 rounded">
                        <EvidencePopover value={v.value} evidence={v.evidence} />
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {extras.length > 0 && (
                <div className="space-y-2">
                  {extras.map(([key, values]) => (
                    <FacetSection key={key} label={key.replace(/_/g, " ")} values={values} />
                  ))}
                </div>
              )}
            </div>
          )}

          {profileGraph && (
            <div className="pt-3 border-t border-hairline space-y-3">
              <p className="text-xs text-ink-tertiary uppercase tracking-wide">Knowledge graph</p>

              {profileGraph.schools.length > 0 && (
                <div>
                  <p className="text-xs text-ink-tertiary mb-1">Schools taught at</p>
                  <ul className="space-y-1">
                    {profileGraph.schools.map((s: any, i: number) => (
                      <li key={i} className="text-sm text-ink">
                        <span className="font-medium">{s.name}</span>
                        {s.role && <span className="text-ink-secondary"> · {s.role}</span>}
                        {(s.yearStart || s.yearEnd) && (
                          <span className="text-ink-tertiary"> ({s.yearStart ?? "?"}–{s.yearEnd ?? "now"})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {profileGraph.qualifications.length > 0 && (
                <div>
                  <p className="text-xs text-ink-tertiary mb-1">Qualifications</p>
                  <ul className="space-y-1">
                    {profileGraph.qualifications.map((q: any, i: number) => (
                      <li key={i} className="text-sm text-ink">
                        <span className="font-medium">{q.degree}</span>
                        {q.university && <span className="text-ink-secondary"> · {q.university}</span>}
                        {q.yearEnd && <span className="text-ink-tertiary"> ({q.yearEnd})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {profileGraph.cohorts.length > 0 && (
                <div>
                  <p className="text-xs text-ink-tertiary mb-1">Cohorts</p>
                  <div className="flex flex-wrap gap-1">
                    {profileGraph.cohorts.map((c: any, i: number) => (
                      <Badge key={i}>{c.displayName}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {profileGraph.region && (
                <div>
                  <p className="text-xs text-ink-tertiary mb-0.5">Region</p>
                  <p className="text-sm text-ink">{profileGraph.region}</p>
                </div>
              )}

              {profileGraph.referredByName && (
                <div>
                  <p className="text-xs text-ink-tertiary mb-0.5">Referred by</p>
                  <p className="text-sm text-ink">{profileGraph.referredByName}</p>
                </div>
              )}
            </div>
          )}

          {candidate.parsedAt && (
            <p className="text-xs text-ink-tertiary pt-2">
              Last parsed {new Date(candidate.parsedAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TriageTab({
  triageDecision,
  candidateForTriage,
}: {
  triageDecision: any;
  candidateForTriage: any;
}) {
  if (triageDecision === undefined) {
    return <div className="p-4 text-sm text-ink-secondary">Loading…</div>;
  }
  if (!triageDecision) {
    return (
      <div className="p-4 text-sm text-ink-secondary">
        No triage decision for this application.
      </div>
    );
  }
  return (
    <div className="space-y-3 p-4">
      <div>
        <div className="text-sm text-ink-secondary">Outcome</div>
        <div className="font-medium">{triageDecision.outcome}</div>
      </div>
      <div>
        <div className="text-sm text-ink-secondary">Score</div>
        <div className="font-medium">{triageDecision.primaryMatchScore}/100</div>
      </div>
      {triageDecision.hybridWeights && (
        <div>
          <div className="text-sm text-ink-secondary">Hybrid weights</div>
          <div className="text-xs">
            struct={triageDecision.hybridWeights.w_struct}, sem={triageDecision.hybridWeights.w_sem}, rules={triageDecision.hybridWeights.w_rules}
          </div>
        </div>
      )}
      <div>
        <div className="text-sm text-ink-secondary">Reasoning</div>
        <div className="text-sm">{triageDecision.outcomeReasoning}</div>
      </div>
      {triageDecision.primaryMatchReasons && triageDecision.primaryMatchReasons.length > 0 && (
        <div>
          <div className="text-sm text-ink-secondary">Match reasons</div>
          <ul className="list-disc list-inside text-sm">
            {triageDecision.primaryMatchReasons.map((r: string, i: number) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {candidateForTriage?.parsedFacets?.specializations &&
        candidateForTriage.parsedFacets.specializations.length > 0 && (
          <div>
            <div className="text-sm text-ink-secondary">Specializations (click to verify)</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {candidateForTriage.parsedFacets.specializations.map((s: any, i: number) => (
                <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                  <EvidencePopover value={s.value} evidence={s.evidence} />
                </span>
              ))}
            </div>
          </div>
        )}
      {triageDecision.humanOverride && (
        <div className="text-sm bg-amber-50 p-2 rounded ring-1 ring-amber-200">
          Overridden by {triageDecision.humanOverride.overriddenBy} (
          {triageDecision.humanOverride.fromOutcome} →{" "}
          {triageDecision.humanOverride.toOutcome})
        </div>
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
        <div className="px-3 py-2 rounded-md bg-green-50 text-sm text-success">
          Evaluation request created! Share this link with the evaluator:
          <br />
          <code className="text-xs text-ink break-all">{feedbackUrl}</code>
        </div>
      )}
      {result === "error" && (
        <div className="px-3 py-2 rounded-md bg-red-50 text-sm text-danger">
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
