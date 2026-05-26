"use client";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { TriageCard } from "@/components/triage/triage-card";
import { useState } from "react";

const TABS = [
  { key: "human_review", label: "Needs Review" },
  { key: "auto_shortlisted", label: "Auto-Shortlisted" },
  { key: "auto_rejected", label: "Auto-Rejected" },
  { key: "cross_role_suggested", label: "Cross-Role" },
];

export default function TriagePage() {
  const { user } = useUser();
  const userId = user?.id ?? "";
  const profile = useQuery(api.users.getByClerkId, userId ? { userId } : "skip");
  const schoolId = profile?.schoolId;
  const [tab, setTab] = useState<string>("human_review");

  const queue = useQuery(
    api.triage.queueForSchool,
    schoolId ? { schoolId, outcomes: [tab], limit: 100 } : "skip",
  );

  if (!schoolId) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Triage Queue</h1>
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm border-b-2 ${
              tab === t.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {queue === undefined ? (
          <div className="text-gray-500">Loading…</div>
        ) : queue.length === 0 ? (
          <div className="text-gray-500 py-8 text-center">No items in this queue.</div>
        ) : (
          queue.map((item: any) => (
            <TriageCard key={item.application._id} item={item} userId={userId} />
          ))
        )}
      </div>
    </div>
  );
}
