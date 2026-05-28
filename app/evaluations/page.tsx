"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { EmptyState, PageHeader } from "@/components/ui";
import { InboxCard } from "@/components/evaluations/inbox-card";
import type { Id } from "@/convex/_generated/dataModel";

type Mode = "live" | "post" | "async";

interface DemoLike {
  scheduledAt: number;
  durationMinutes: number;
  mode: Mode;
  formOpenWindowMinutes?: number;
  formCloseDueDays?: number;
}

interface FormWindow {
  opensAt: number;
  closesAt: number;
}

function formWindow(demo: DemoLike): FormWindow {
  const end = demo.scheduledAt + demo.durationMinutes * 60_000;
  if (demo.mode === "live") {
    return { opensAt: demo.scheduledAt, closesAt: end };
  }
  if (demo.mode === "post") {
    const win = (demo.formOpenWindowMinutes ?? 60) * 60_000;
    return { opensAt: end, closesAt: end + win };
  }
  // async
  const due = (demo.formCloseDueDays ?? 3) * 86_400_000;
  return { opensAt: demo.scheduledAt, closesAt: demo.scheduledAt + due };
}

function InboxRow({
  invite,
  demo,
  window,
}: {
  invite: {
    _id: Id<"evaluationInvites">;
    status: string;
    evaluatorRole: string;
  };
  demo: {
    _id: Id<"demoSessions">;
    applicationId: Id<"applications">;
    scheduledAt: number;
    mode: Mode;
    durationMinutes: number;
    location?: string;
  };
  window: FormWindow;
}) {
  const application = useQuery(api.applications.get, {
    applicationId: demo.applicationId,
  });
  const candidate = useQuery(
    api.candidates.get,
    application?.candidateId ? { candidateId: application.candidateId } : "skip",
  );
  const candidateName = candidate?.name ?? "Candidate";

  return (
    <InboxCard
      invite={{
        _id: invite._id,
        status: invite.status,
        evaluatorRole: invite.evaluatorRole,
      }}
      demo={{
        _id: demo._id,
        scheduledAt: demo.scheduledAt,
        mode: demo.mode,
        durationMinutes: demo.durationMinutes,
        location: demo.location,
      }}
      candidateName={candidateName}
      formOpensAt={window.opensAt}
      formClosesAt={window.closesAt}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-caption font-bold uppercase tracking-wide text-ink-tertiary mb-3">
      {children}
    </h2>
  );
}

export default function EvaluationsInboxPage() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const profile = useQuery(
    api.users.getByClerkId,
    user?.id ? { userId: user.id } : "skip",
  );
  const data = useQuery(
    api.evaluationInvites.listForUser,
    profile?._id
      ? {
          userId: profile._id,
          statusFilter: ["invited", "viewed", "in_progress"],
        }
      : "skip",
  );

  if (!user || !profile) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <PageHeader
          title="Evaluations"
          subtitle="Your pending demo evaluations."
        />
        <p className="text-body-s text-ink-secondary">Loading…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <PageHeader
          title="Evaluations"
          subtitle="Your pending demo evaluations."
        />
        <p className="text-body-s text-ink-secondary">Loading…</p>
      </main>
    );
  }

  const now = Date.now();
  const open: Array<{ row: (typeof data)[number]; window: FormWindow }> = [];
  const upcoming: Array<{ row: (typeof data)[number]; window: FormWindow }> =
    [];
  for (const row of data) {
    const win = formWindow(row.demo);
    if (now >= win.opensAt && now <= win.closesAt) {
      open.push({ row, window: win });
    } else {
      upcoming.push({ row, window: win });
    }
  }

  const isEmpty = open.length === 0 && upcoming.length === 0;

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-8">
      <PageHeader
        title="Evaluations"
        subtitle="Your pending demo evaluations."
      />

      {isEmpty ? (
        <EmptyState
          title="All caught up"
          description="New evaluations will appear here."
        />
      ) : (
        <>
          {open.length > 0 && (
            <section>
              <SectionLabel>Open now · {open.length}</SectionLabel>
              <div className="space-y-3">
                {open.map(({ row, window: win }) => (
                  <InboxRow
                    key={row.invite._id}
                    invite={row.invite}
                    demo={row.demo}
                    window={win}
                  />
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <SectionLabel>Upcoming · {upcoming.length}</SectionLabel>
              <div className="space-y-3">
                {upcoming.map(({ row, window: win }) => (
                  <InboxRow
                    key={row.invite._id}
                    invite={row.invite}
                    demo={row.demo}
                    window={win}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
