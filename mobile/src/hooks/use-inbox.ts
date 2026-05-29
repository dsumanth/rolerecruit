import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useSession } from "@/hooks/use-session";

export type InboxRow = {
  invite: {
    _id: string;
    status: string;
    evaluatorRole?: string;
    submittedAt?: number;
  };
  demo: {
    _id: string;
    mode: "live" | "post" | "async";
    durationMinutes: number;
    scheduledAt: number;
    createdAt: number;
    formOpenWindowMinutes?: number;
    formCloseDueDays?: number;
  };
  candidate?: { name?: string; subject?: string } | null;
};

const MIN = 60_000;
const DAY = 86_400_000;

function windowFor(demo: InboxRow["demo"]) {
  const dur = demo.durationMinutes * MIN;
  if (demo.mode === "live") return { open: demo.scheduledAt, close: demo.scheduledAt + dur };
  if (demo.mode === "post") {
    const openWin = (demo.formOpenWindowMinutes ?? 60) * MIN;
    return { open: demo.scheduledAt + dur, close: demo.scheduledAt + dur + openWin };
  }
  // async
  const closeDays = demo.formCloseDueDays ?? 3;
  return { open: demo.createdAt, close: demo.scheduledAt + closeDays * DAY };
}

export function splitInvites(
  rows: InboxRow[],
  now: number,
): { openNow: InboxRow[]; upcoming: InboxRow[] } {
  const openNow: InboxRow[] = [];
  const upcoming: InboxRow[] = [];
  for (const row of rows) {
    if (row.invite.status === "submitted" || row.invite.status === "cancelled" || row.invite.status === "declined") {
      continue;
    }
    const { open, close } = windowFor(row.demo);
    if (now >= open && now < close) openNow.push(row);
    else if (now < open) upcoming.push(row);
    // Past close window: silently dropped (out of policy for this hook; web shows them as overdue).
  }
  openNow.sort((a, b) => a.demo.scheduledAt - b.demo.scheduledAt);
  upcoming.sort((a, b) => a.demo.scheduledAt - b.demo.scheduledAt);
  return { openNow, upcoming };
}

export function useInbox() {
  const { signedIn, user } = useSession();
  const profile = useQuery(
    api.users.getProfile,
    signedIn && user?.id ? { userId: user.id } : "skip",
  );
  const list = useQuery(
    api.evaluationInvites.listForUser,
    profile?._id
      ? { userId: profile._id, statusFilter: ["invited", "viewed", "in_progress"] }
      : "skip",
  );
  const rows = (list ?? []) as InboxRow[];
  return {
    loading: !profile || !list,
    ...splitInvites(rows, Date.now()),
  };
}
