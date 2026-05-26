"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { PromotionCard } from "@/components/facets/promotion-card";

type Row = Doc<"facetPromotionCandidates">;
type Status = Row["status"];

const TABS: ReadonlyArray<{ value: Status; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "promoted", label: "Promoted" },
  { value: "dismissed", label: "Dismissed" },
  { value: "demoted", label: "Demoted" },
];

export default function FacetsSettingsPage() {
  const [tab, setTab] = useState<Status>("pending");
  const allRows = useQuery(api.facetPromotion.listAll, { limit: 200 });

  const counts = useMemo(() => {
    if (!allRows) return {} as Record<Status, number>;
    return allRows.reduce<Record<Status, number>>(
      (acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      },
      { pending: 0, promoted: 0, dismissed: 0, demoted: 0 },
    );
  }, [allRows]);

  const rows = useMemo(
    () => (allRows ?? []).filter((r) => r.status === tab),
    [allRows, tab],
  );

  const tabItems = TABS.map((t) => ({
    value: t.value,
    label: t.label,
    count: counts[t.value] ?? 0,
  }));

  return (
    <div className="px-8 py-7 max-w-4xl mx-auto">
      <PageHeader
        title="Facet Promotion"
        subtitle="Auto-discovered facet keys from candidate intakes. Promote keys that cross our threshold to make them first-class typed facets used in matching and search."
      />
      <Tabs
        items={tabItems}
        value={tab}
        onChange={(v) => setTab(v as Status)}
        className="mb-5"
      />
      <div className="space-y-3">
        {allRows === undefined ? (
          <p className="text-body-s text-ink-secondary">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg bg-surface border border-hairline py-10 text-center">
            <p className="text-body-s text-ink-secondary">No facet keys in this state.</p>
          </div>
        ) : (
          rows.map((row) => <PromotionCard key={row._id} row={row} />)
        )}
      </div>
    </div>
  );
}
