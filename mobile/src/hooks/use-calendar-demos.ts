import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useSession } from "@/hooks/use-session";

export type CalendarRow = {
  invite: { _id: string; status: string; evaluatorRole?: string };
  demo: {
    _id: string;
    mode: "live" | "post" | "async";
    scheduledAt: number;
    durationMinutes: number;
  };
  candidate?: { name?: string; subject?: string } | null;
};

function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function groupByDay(rows: CalendarRow[]): Record<string, CalendarRow[]> {
  const groups: Record<string, CalendarRow[]> = {};
  for (const row of rows) {
    const key = dayKey(row.demo.scheduledAt);
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.demo.scheduledAt - b.demo.scheduledAt);
  }
  return groups;
}

export function useCalendarDemos() {
  const { signedIn, user } = useSession();
  const profile = useQuery(
    api.users.getProfile,
    signedIn && user?.id ? { userId: user.id } : "skip",
  );
  const list = useQuery(
    api.evaluationInvites.listForUser,
    profile?._id ? { userId: profile._id, statusFilter: undefined } : "skip",
  );
  const rows = (list ?? []) as CalendarRow[];
  return {
    loading: !profile || !list,
    days: groupByDay(rows),
  };
}
