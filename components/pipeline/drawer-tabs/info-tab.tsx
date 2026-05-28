"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { EvidencePopover } from "@/components/shared/evidence-popover";
import type { Application, Candidate, FacetValue } from "./shared";

const STAGE_LABELS: Record<string, string> = {
  sourced: "Sourced",
  screened: "Screened",
  demo_scheduled: "Demo Scheduled",
  demo_completed: "Demo Completed",
  offer_sent: "Offer Sent",
  hired: "Hired",
  rejected: "Rejected",
};

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

export function InfoTab({
  app,
  candidate,
  onSwitchTab,
}: {
  app: Application;
  candidate: Candidate | null | undefined;
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
  const profileGraph = useQuery(
    api.graph.profileGraphForCandidate,
    candidate?._id ? { candidateId: candidate._id as any } : "skip",
  );

  const reparseCandidate = useAction(api.candidates.reparse);
  const [reparseState, setReparseState] = useState<"idle" | "running" | "error">("idle");
  const [reparseError, setReparseError] = useState<string | null>(null);
  const handleReparse = async () => {
    if (!candidate?._id) return;
    setReparseState("running");
    setReparseError(null);
    try {
      const result = await reparseCandidate({ candidateId: candidate._id as any });
      if (!result.ok) {
        setReparseState("error");
        setReparseError(result.reason ?? "Reparse failed");
        return;
      }
      setReparseState("idle");
    } catch (err: any) {
      setReparseState("error");
      setReparseError(err?.message ?? String(err));
    }
  };

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

          {/* Reparse is intentionally hidden behind a `<details>` toggle: a
              destructive-ish action (overwrites parsed fields) shouldn't be a
              one-misclick away. Only rendered when the candidate has an actual
              file on storage — text-only candidates have nothing to reparse. */}
          {candidate.resumeStorageId && (
            <details className="group pt-1">
              <summary
                aria-label="Show advanced actions"
                className="text-xs text-ink-tertiary/40 hover:text-ink-tertiary cursor-pointer list-none select-none w-fit transition-colors"
              >
                <span aria-hidden="true">⋯</span>
              </summary>
              <div className="mt-2 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleReparse}
                  disabled={reparseState === "running" || candidate.parseStatus === "pending"}
                  data-testid="reparse-button"
                  className="text-xs px-2 py-1 rounded bg-surface-canvas text-ink hover:bg-accent hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-fit"
                >
                  {reparseState === "running" || candidate.parseStatus === "pending"
                    ? "Reparsing…"
                    : "Reparse resume"}
                </button>
                {reparseError && (
                  <p className="text-xs text-danger">{reparseError}</p>
                )}
                <p className="text-xs text-ink-tertiary">
                  Re-runs extraction + LLM parsing using the stored resume file.
                </p>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
