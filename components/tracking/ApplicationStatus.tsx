import { Card, Badge, Icon, type IconName } from "@/components/ui";
import { cn } from "@/lib/utils";
import { nameInitial } from "@/components/ui/avatar";

interface Props {
  stage: string;
  jobTitle?: string;
  candidateName: string;
  schoolName: string;
}

interface StageDef {
  key: string;
  label: string;
  icon: IconName;
}

const TIMELINE: StageDef[] = [
  { key: "sourced",        label: "Application received", icon: "Inbox" },
  { key: "screened",       label: "Under review",          icon: "Search" },
  { key: "demo_scheduled", label: "Demo scheduled",        icon: "Calendar" },
  { key: "demo_completed", label: "Demo completed",        icon: "CheckCircle2" },
  { key: "offer_sent",     label: "Offer sent",            icon: "Mail" },
  { key: "hired",          label: "Hired",                 icon: "Star" },
];

const STAGE_LABELS: Record<string, string> = {
  sourced: "Application received",
  screened: "Under review",
  demo_scheduled: "Demo scheduled",
  demo_completed: "Demo completed",
  offer_sent: "Offer sent",
  hired: "Hired",
  rejected: "Not selected",
  on_hold: "On hold",
};

export function ApplicationStatus({ stage, jobTitle, candidateName, schoolName }: Props) {
  const label = STAGE_LABELS[stage] ?? stage;
  const currentIndex = TIMELINE.findIndex((s) => s.key === stage);

  return (
    <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto">
      <div className="flex items-center gap-2.5 pb-5 mb-5 border-b border-hairline">
        <div className="h-8 w-8 rounded-sm bg-gradient-to-br from-[#1d1d1f] to-[#4a4a52] text-white text-body-s font-bold flex items-center justify-center">
          {nameInitial(schoolName, "·")}
        </div>
        <div className="min-w-0">
          <p className="text-body-s font-medium text-ink truncate">{schoolName}</p>
          {jobTitle && <p className="text-caption text-ink-secondary truncate">{jobTitle}</p>}
        </div>
      </div>

      <h2 className="text-display-s text-ink mb-1">Hi {candidateName}</h2>
      <p className="text-body-s text-ink-secondary mb-5">Here's where your application stands.</p>

      <div className="mb-6">
        {stage === "rejected" ? (
          <Badge dot variant="neutral">Not selected</Badge>
        ) : stage === "on_hold" ? (
          <Badge dot variant="warning">On hold</Badge>
        ) : stage === "hired" ? (
          <Badge dot variant="success">{label}</Badge>
        ) : stage === "offer_sent" ? (
          <Badge dot variant="warning">{label}</Badge>
        ) : (
          <Badge dot variant="info">{label}</Badge>
        )}
      </div>

      {currentIndex >= 0 && (
        <div className="space-y-3">
          {TIMELINE.map((s, i) => {
            const isPast = i < currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div key={s.key} className="flex items-start gap-3">
                <div className={cn(
                  "flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center",
                  isCurrent
                    ? "bg-accent-soft text-accent"
                    : isPast
                      ? "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success"
                      : "bg-hairline text-ink-tertiary",
                )}>
                  <Icon name={isPast ? "Check" : s.icon} size={14} />
                </div>
                <div className={cn(
                  "pt-1 text-body-s",
                  isCurrent ? "text-ink font-medium" : isPast ? "text-ink-secondary" : "text-ink-tertiary",
                )}>
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {stage === "rejected" && (
        <p className="text-body-s text-ink-secondary mt-6 pt-5 border-t border-hairline">
          The position has been filled. We encourage you to apply for other openings.
        </p>
      )}
      {stage === "offer_sent" && (
        <div className="mt-6 pt-5 border-t border-hairline rounded-md bg-[color-mix(in_srgb,var(--success)_8%,transparent)] -mx-2 px-4 py-3">
          <p className="text-body-s text-success font-medium">Congratulations! An offer letter has been sent.</p>
        </div>
      )}
    </Card>
  );
}
