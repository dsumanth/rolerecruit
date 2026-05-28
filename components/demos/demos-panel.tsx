"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { Badge, Button, Card } from "@/components/ui";
import { ScheduleDemoWizard } from "./schedule-demo-wizard";

type Mode = "live" | "post" | "async";
type Format = "classroom" | "mock" | "recorded";
type Status =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";
type StaffRole = "principal" | "hod" | "hr_admin" | "teacher";

const STAFF_ROLES: ReadonlySet<StaffRole> = new Set([
  "principal",
  "hod",
  "hr_admin",
  "teacher",
]);

const MODE_VARIANT: Record<Mode, "danger" | "warning" | "info"> = {
  live: "danger",
  post: "warning",
  async: "info",
};

const STATUS_VARIANT: Record<
  Status,
  "info" | "warning" | "success" | "neutral"
> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "neutral",
};

const FORMAT_VARIANT: Record<Format, "neutral"> = {
  classroom: "neutral",
  mock: "neutral",
  recorded: "neutral",
};

interface DemosPanelProps {
  applicationId: string;
  schoolId: string;
  candidateName: string;
  /**
   * When set, the panel opens the schedule wizard pre-populated with the
   * evaluator list and timing inferred from this demo (the prior demo we're
   * re-running). Call `onPrefillConsumed` once the wizard is open so the
   * parent can clear its source-of-truth.
   */
  prefillFromDemoId?: string;
  onPrefillConsumed?: () => void;
}

const REDEMO_DEFAULT_LEAD_MS = 3 * 86400000; // +3 days

export function DemosPanel({
  applicationId,
  schoolId,
  candidateName,
  prefillFromDemoId,
  onPrefillConsumed,
}: DemosPanelProps) {
  // Mirror useCurrentUser pattern from app/evaluations/page.tsx + settings/team/page.tsx
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const me = useQuery(
    api.users.getByClerkId,
    user?.id ? { userId: user.id } : "skip",
  );

  const demos = useQuery(api.demoSessions.listForCandidate, {
    applicationId: applicationId as Id<"applications">,
  });
  const staff = useQuery(api.users.listSchoolStaff, {
    schoolId: schoolId as Id<"schools">,
  });
  const prefillSource = useQuery(
    api.demoSessions.aggregate,
    prefillFromDemoId
      ? { demoId: prefillFromDemoId as Id<"demoSessions"> }
      : "skip",
  );

  const create = useMutation(api.demoSessions.create);
  const cancel = useMutation(api.demoSessions.cancel);

  const [wizardOpen, setWizardOpen] = useState(false);

  // When a prefill demo arrives, open the wizard and notify parent so it can
  // clear the prefill source (avoids re-opening on subsequent renders).
  useEffect(() => {
    if (prefillFromDemoId && prefillSource && !wizardOpen) {
      setWizardOpen(true);
      onPrefillConsumed?.();
    }
  }, [prefillFromDemoId, prefillSource, wizardOpen, onPrefillConsumed]);

  if (!demos || !me) {
    return (
      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-ink">Demos</h2>
        </header>
        <p className="text-body-s text-ink-secondary">Loading…</p>
      </section>
    );
  }

  const staffDirectory =
    staff
      ?.filter(
        (
          s,
        ): s is (typeof staff)[number] & {
          role: StaffRole;
        } => STAFF_ROLES.has(s.role as StaffRole),
      )
      .map((s) => ({
        _id: s._id as string,
        name: s.name,
        role: s.role as StaffRole,
      })) ?? [];

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-h3 font-semibold text-ink">Demos</h2>
        <Button
          variant="primary"
          size="md"
          onClick={() => setWizardOpen(true)}
        >
          Schedule demo
        </Button>
      </header>

      {demos.length === 0 ? (
        <p className="text-body-s text-ink-secondary">No demos yet.</p>
      ) : (
        <ul className="space-y-2">
          {demos.map((d: (typeof demos)[number]) => {
            const mode = d.mode as Mode;
            const format = d.format as Format;
            const status = d.status as Status;
            return (
              <li key={d._id}>
                <Card surface="card" elevation={1} padding="md" interactive>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/dashboard/demos/${d._id}`}
                        className="block text-body-s font-medium text-ink hover:text-accent transition-colors duration-fast"
                      >
                        {new Date(d.scheduledAt).toLocaleString("en-IN")}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant={MODE_VARIANT[mode]}>{mode}</Badge>
                        <Badge variant={FORMAT_VARIANT[format]}>
                          {format}
                        </Badge>
                        <Badge variant={STATUS_VARIANT[status]}>
                          {status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    {status === "scheduled" && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() =>
                          cancel({
                            demoId: d._id as Id<"demoSessions">,
                            reason: "cancelled by HR",
                          })
                        }
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {wizardOpen && staff && (
        <ScheduleDemoWizard
          open
          onClose={() => setWizardOpen(false)}
          applicationId={applicationId}
          schoolId={schoolId}
          candidateName={candidateName}
          staffDirectory={staffDirectory}
          initialEvaluators={
            prefillSource?.perEvaluator
              .map((p: { invite: { evaluatorUserId: string; evaluatorRole: StaffRole } }) => ({
                userId: p.invite.evaluatorUserId,
                role: p.invite.evaluatorRole,
              }))
          }
          initialScheduledAt={
            prefillSource ? Date.now() + REDEMO_DEFAULT_LEAD_MS : undefined
          }
          parentDemoId={prefillSource ? (prefillSource.demo._id as string) : undefined}
          onConfirm={async (data) => {
            await create({
              applicationId: data.applicationId as Id<"applications">,
              schoolId: data.schoolId as Id<"schools">,
              scheduledAt: data.scheduledAt,
              durationMinutes: data.durationMinutes,
              mode: data.mode,
              format: data.format,
              location: data.location,
              videoUrl: data.videoUrl,
              evaluators: data.evaluators.map((e) => ({
                userId: e.userId as Id<"userProfiles">,
                role: e.role,
              })),
              createdBy: me._id as Id<"userProfiles">,
              parentDemoId: data.parentDemoId
                ? (data.parentDemoId as Id<"demoSessions">)
                : undefined,
            });
            setWizardOpen(false);
          }}
        />
      )}
    </section>
  );
}
