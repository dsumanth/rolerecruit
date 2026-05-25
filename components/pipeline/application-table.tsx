"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { InlineExpansion } from "@/components/pipeline/inline-expansion";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

const STAGE_VARIANT: Record<string, BadgeVariant> = {
  sourced: "neutral",
  screened: "neutral",
  demo_scheduled: "info",
  demo_completed: "info",
  offer_sent: "warning",
  hired: "success",
  rejected: "danger",
};

interface Application {
  _id: string;
  candidateId: string;
  stage: string;
  aiMatchScore?: number;
  globalScore?: number;
  poolNames?: string[];
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

interface ApplicationTableProps {
  applications: Application[];
  sortBy: "newest" | "score" | "name";
  onSortChange: (sort: "newest" | "score" | "name") => void;
  showScoreAs?: "match" | "global";
  showPoolBadges?: boolean;
  onRowClick?: (app: Application) => void;
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

function matchScoreVariant(score: number): BadgeVariant {
  if (score >= 85) return "success";
  if (score >= 60) return "warning";
  return "neutral";
}

export function ApplicationTable({
  applications,
  sortBy,
  onSortChange,
  showScoreAs = "match",
  showPoolBadges = false,
  onRowClick,
}: ApplicationTableProps) {
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => {
    const apps = [...applications];
    switch (sortBy) {
      case "score":
        return apps.sort((a, b) => {
          const scoreA = showScoreAs === "global" ? (a.globalScore ?? 0) : (a.aiMatchScore ?? 0);
          const scoreB = showScoreAs === "global" ? (b.globalScore ?? 0) : (b.aiMatchScore ?? 0);
          return scoreB - scoreA;
        });
      case "name":
        return apps.sort((a, b) =>
          (a.candidate?.name ?? "").localeCompare(b.candidate?.name ?? ""),
        );
      case "newest":
      default:
        return apps;
    }
  }, [applications, sortBy, showScoreAs]);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    measureElement: useCallback((element: Element) => {
      return element.getBoundingClientRect().height;
    }, []),
    overscan: 10,
  });

  const toggleExpand = (appId: string) => {
    if (onRowClick) return;
    setExpandedAppId((prev) => (prev === appId ? null : appId));
  };

  return (
    <Card padding="none" elevation={1} className="overflow-hidden">
      <div className="grid grid-cols-[1fr_80px_140px_1fr_80px_120px] gap-4 px-5 py-2.5 border-b border-hairline bg-surface-canvas text-micro font-medium text-ink-secondary uppercase tracking-wider">
        <button
          onClick={() => onSortChange("name")}
          className={cn("text-left hover:text-ink transition-colors duration-fast", sortBy === "name" && "text-accent")}
        >
          Candidate
        </button>
        <button
          onClick={() => onSortChange("score")}
          className={cn("text-center hover:text-ink transition-colors duration-fast", sortBy === "score" && "text-accent")}
        >
          {showScoreAs === "global" ? "Global Score" : "Match Score"}
        </button>
        <span>Stage</span>
        <span>Subjects</span>
        <span>Experience</span>
        <span>Location</span>
      </div>

      <div ref={parentRef} className="max-h-[calc(100vh-320px)] overflow-y-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const app = sorted[virtualItem.index];
            const isExpanded = expandedAppId === app._id;

            return (
              <div
                key={app._id}
                ref={(node) => {
                  if (node) virtualizer.measureElement(node);
                }}
                data-index={virtualItem.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (onRowClick) {
                      onRowClick(app);
                    } else {
                      toggleExpand(app._id);
                    }
                  }}
                  className={cn(
                    "w-full grid grid-cols-[1fr_80px_140px_1fr_80px_120px] gap-4 px-5 py-3 text-body-s text-left border-b border-hairline transition-colors duration-fast hover:bg-accent-soft",
                    isExpanded && "bg-accent-soft border-l-2 border-l-accent",
                  )}
                >
                  <div>
                    <p className="font-medium text-ink">
                      {app.candidate?.name ?? "Unknown"}
                    </p>
                    {showPoolBadges && app.poolNames && app.poolNames.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {app.poolNames.map((poolName) => (
                          <Badge key={poolName} variant="neutral" className="text-[10px] px-1.5 py-0">
                            {poolName}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    {(showScoreAs === "global" ? app.globalScore != null : app.aiMatchScore != null) && (
                      <Badge
                        variant={matchScoreVariant(
                          showScoreAs === "global" ? (app.globalScore ?? 0) : (app.aiMatchScore ?? 0)
                        )}
                      >
                        {showScoreAs === "global" ? app.globalScore : app.aiMatchScore}%
                      </Badge>
                    )}
                    {showScoreAs === "global" && app.globalScore == null && (
                      <span className="text-xs text-ink-tertiary">—</span>
                    )}
                  </div>
                  <div>
                    <Badge dot variant={STAGE_VARIANT[app.stage] ?? "neutral"}>
                      {STAGE_LABELS[app.stage] ?? app.stage}
                    </Badge>
                  </div>
                  <div className="text-ink-secondary truncate">
                    {app.candidate?.subjects?.join(", ")}
                  </div>
                  <div className="text-ink-secondary tabular-nums">
                    {app.candidate?.yearsExperience != null
                      ? `${app.candidate.yearsExperience}y`
                      : "—"}
                  </div>
                  <div className="text-ink-secondary truncate">
                    {app.candidate?.location ?? "—"}
                  </div>
                </button>

                {isExpanded && <InlineExpansion app={app} />}
              </div>
            );
          })}
        </div>
      </div>

      {sorted.length === 0 && (
        <div className="py-12 text-center text-body-s text-ink-secondary">
          No applications match your filters
        </div>
      )}
    </Card>
  );
}

export type { Application };
