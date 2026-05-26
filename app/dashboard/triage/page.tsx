"use client";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { TriageCard } from "@/components/triage/triage-card";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { useMemo, useState } from "react";

const TABS = [
  { value: "human_review", label: "Needs Review" },
  { value: "auto_shortlisted", label: "Auto-Shortlisted" },
  { value: "auto_rejected", label: "Auto-Rejected" },
  { value: "cross_role_suggested", label: "Cross-Role" },
] as const;

export default function TriagePage() {
  const { user } = useUser();
  const userId = user?.id ?? "";
  const profile = useQuery(api.users.getByClerkId, userId ? { userId } : "skip");
  const schoolId = profile?.schoolId;
  const [tab, setTab] = useState<string>("human_review");

  // Fetch everything once so we can show per-tab counts and filter client-side.
  // The queue is naturally bounded (200 apps max in the query) so this is cheap.
  const allItems = useQuery(
    api.triage.queueForSchool,
    schoolId ? { schoolId, limit: 200 } : "skip",
  );

  const counts = useMemo(() => {
    if (!allItems) return {} as Record<string, number>;
    return allItems.reduce<Record<string, number>>((acc, item: any) => {
      const o = item.application?.triageOutcome ?? "human_review";
      acc[o] = (acc[o] ?? 0) + 1;
      return acc;
    }, {});
  }, [allItems]);

  const items = useMemo(
    () => (allItems ?? []).filter((i: any) => i.application?.triageOutcome === tab),
    [allItems, tab],
  );

  const tabItems = TABS.map((t) => ({ value: t.value, label: t.label, count: counts[t.value] ?? 0 }));

  if (!schoolId) {
    return (
      <div className="px-8 py-7 max-w-5xl mx-auto">
        <p className="text-body-s text-ink-secondary">Loading…</p>
      </div>
    );
  }

  return (
    <div className="px-8 py-7 max-w-5xl mx-auto">
      <PageHeader
        title="Triage Queue"
        subtitle="The AI agent's decisions on new applications — approve, override, or send back to review."
      />
      <Tabs items={tabItems} value={tab} onChange={setTab} className="mb-5" />
      <div className="space-y-3">
        {allItems === undefined ? (
          <p className="text-body-s text-ink-secondary">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-lg bg-surface border border-hairline py-10 text-center">
            <p className="text-body-s text-ink-secondary">No items in this queue.</p>
          </div>
        ) : (
          items.map((item: any) => (
            <TriageCard key={item.application._id} item={item} userId={userId} />
          ))
        )}
      </div>
    </div>
  );
}
