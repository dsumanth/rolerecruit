interface Props {
  stage: string;
  jobTitle?: string;
  candidateName: string;
  schoolName: string;
}

const STAGE_LABELS: Record<string, string> = {
  sourced: "Application Received",
  screened: "Under Review",
  demo_scheduled: "Demo Lesson Scheduled",
  demo_completed: "Demo Completed",
  offer_sent: "Offer Sent",
  hired: "Hired",
  rejected: "Not Selected",
  on_hold: "On Hold",
};

export function ApplicationStatus({ stage, jobTitle, candidateName, schoolName }: Props) {
  const label = STAGE_LABELS[stage] ?? stage;

  return (
    <div className="max-w-lg mx-auto">
      <div className="rounded-apple bg-surface border border-hairline p-8 text-center">
        <div className="text-4xl mb-4">📋</div>
        <h2 className="text-xl font-bold text-ink">Hi {candidateName}</h2>
        <p className="text-sm text-ink-secondary mt-2">
          {jobTitle
            ? `Your application to ${schoolName} for ${jobTitle}`
            : `Your application to ${schoolName}`}
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium">
          <span>{label}</span>
        </div>
        {stage === "demo_scheduled" && (
          <p className="text-sm text-ink-secondary mt-4">Your demo lesson has been scheduled. Check your messages for details.</p>
        )}
        {stage === "offer_sent" && (
          <p className="text-sm text-success mt-4 font-medium">Congratulations! An offer letter has been sent.</p>
        )}
        {stage === "rejected" && (
          <p className="text-sm text-ink-secondary mt-4">The position has been filled. We encourage you to apply for other openings.</p>
        )}
      </div>
    </div>
  );
}
