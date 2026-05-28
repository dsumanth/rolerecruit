"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Avatar, Badge, Card } from "@/components/ui";
import { AppliedDecisionBanner } from "./applied-decision-banner";

const SECTION_LABEL = "text-caption font-semibold uppercase tracking-wide text-ink-tertiary mb-3";

type Recommendation = "hire" | "maybe" | "reject";

function recommendationVariant(rec: Recommendation | string | undefined): "success" | "warning" | "danger" | "neutral" {
  if (rec === "hire") return "success";
  if (rec === "maybe") return "warning";
  if (rec === "reject") return "danger";
  return "neutral";
}

function statusVariant(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "completed") return "success";
  if (status === "in_progress") return "info";
  if (status === "cancelled") return "danger";
  if (status === "scheduled") return "warning";
  return "neutral";
}

interface DemoSummaryProps {
  demoId: string;
  onOverrideDecision?: () => void;
  onConfirmRedemo?: () => void;
}

export function DemoSummary({ demoId, onOverrideDecision, onConfirmRedemo }: DemoSummaryProps) {
  const data = useQuery(api.demoSessions.aggregate, { demoId: demoId as Id<"demoSessions"> });

  if (!data) {
    return (
      <Card surface="card" elevation={1} padding="md">
        <p className="text-body-s text-ink-secondary">Loading demo summary...</p>
      </Card>
    );
  }

  const { demo, invitesByStatus, recommendationTally, dimensionAverages, perEvaluator } = data;

  return (
    <section className="space-y-5">
      {demo.appliedDecision && (
        <AppliedDecisionBanner
          applied={demo.appliedDecision}
          onOverride={onOverrideDecision ?? (() => {})}
          onConfirmRedemo={onConfirmRedemo ?? (() => {})}
        />
      )}
      <Card surface="card" elevation={1} padding="md">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className={SECTION_LABEL}>Demo</div>
            <p className="text-body text-ink">
              {new Date(demo.scheduledAt).toLocaleString("en-IN")}
            </p>
            <p className="text-caption text-ink-secondary mt-1">
              {demo.mode} / {demo.format} / {demo.durationMinutes} min
            </p>
          </div>
          <Badge dot variant={statusVariant(demo.status)}>{demo.status.replace(/_/g, " ")}</Badge>
        </div>
      </Card>

      <Card surface="card" elevation={1} padding="md">
        <div className={SECTION_LABEL}>Invites</div>
        <ul className="list-disc pl-5 text-body-s text-ink-secondary">
          {Object.entries(invitesByStatus)
            .filter(([, n]) => (n as number) > 0)
            .map(([status, n]) => (
              <li key={status}>
                <span className="text-ink">{n as number}</span> {status.replace(/_/g, " ")}
              </li>
            ))}
          {Object.values(invitesByStatus).every((n) => (n as number) === 0) && (
            <li>No invites issued.</li>
          )}
        </ul>
      </Card>

      <Card surface="card" elevation={1} padding="md">
        <div className={SECTION_LABEL}>Recommendation tally</div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">Hire: {recommendationTally.hire}</Badge>
          <Badge variant="warning">Maybe: {recommendationTally.maybe}</Badge>
          <Badge variant="danger">Reject: {recommendationTally.reject}</Badge>
        </div>
      </Card>

      <Card surface="card" elevation={1} padding="md">
        <div className={SECTION_LABEL}>Dimension averages</div>
        {Object.keys(dimensionAverages).length === 0 ? (
          <p className="text-body-s text-ink-secondary">No scored dimensions yet.</p>
        ) : (
          <ul className="list-disc pl-5 text-body-s text-ink-secondary">
            {Object.entries(dimensionAverages).map(([key, val]) => (
              <li key={key}>
                {key}: <span className="text-ink font-medium">{(val as number).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div>
        <div className={SECTION_LABEL}>Per evaluator</div>
        {perEvaluator.length === 0 ? (
          <Card surface="card" elevation={1} padding="md">
            <p className="text-body-s text-ink-secondary">No submissions yet.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {perEvaluator.map((p: any) => (
              <Card key={p.invite._id} surface="card" elevation={1} padding="md">
                <div className="flex items-start gap-3">
                  <Avatar name={p.evaluatorName} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-body-s font-medium text-ink truncate">{p.evaluatorName}</p>
                      <Badge variant="neutral">{p.evaluatorRole}</Badge>
                      {p.evaluation.recommendation && (
                        <Badge variant={recommendationVariant(p.evaluation.recommendation)}>
                          {p.evaluation.recommendation}
                        </Badge>
                      )}
                    </div>
                    {p.evaluation.voiceInputs?.length ? (
                      <div className="mt-3 space-y-2">
                        {p.evaluation.voiceInputs.map((v: any) => (
                          <div key={v.fieldKey}>
                            <p className="text-caption text-ink-tertiary mb-1">{v.fieldKey}</p>
                            <ul className="list-disc pl-5 text-body-s text-ink-secondary">
                              {v.summaryPoints.map((b: string, i: number) => (
                                <li key={i}>{b}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
