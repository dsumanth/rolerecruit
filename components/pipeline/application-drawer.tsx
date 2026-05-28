"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { PoolOriginBadge } from "@/components/shared/pool-origin-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UndoToast } from "@/components/ui/undo-toast";
import { useUndoToast } from "@/hooks/use-undo-toast";
import { PreviousOutcomesSection } from "@/components/pipeline/previous-outcomes-section";
import { InfoTab } from "@/components/pipeline/drawer-tabs/info-tab";
import { TriageTab } from "@/components/pipeline/drawer-tabs/triage-tab";
import { OutreachTab } from "@/components/pipeline/drawer-tabs/outreach-tab";
import { DemoTab } from "@/components/pipeline/drawer-tabs/demo-tab";
import { EvaluateTab } from "@/components/pipeline/drawer-tabs/evaluate-tab";
import type { Application, Candidate } from "@/components/pipeline/drawer-tabs/shared";

interface TabItem {
  value: string;
  label: string;
  count?: number;
}

interface Props {
  app: Application;
  schoolName?: string;
  onClose: () => void;
}

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
            <TriageTab applicationId={app._id} candidateId={app.candidateId} />
          )}

          {tab === "outreach" && (
            <OutreachTab
              applicationId={app._id}
              candidateId={app.candidateId}
              candidateName={candidateName}
              candidatePhone={candidatePhone}
              schoolName={schoolName}
            />
          )}

          {tab === "demo" && (
            <DemoTab
              applicationId={app._id}
              candidateId={app.candidateId}
              candidateName={candidateName}
              candidatePhone={candidatePhone}
            />
          )}

          {tab === "evaluate" && <EvaluateTab applicationId={app._id} />}

          {candidate?._id && app._id && (
            <PreviousOutcomesSection
              candidateId={candidate._id}
              currentApplicationId={app._id}
            />
          )}

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
