"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui";
import { formatUsd } from "./format";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-secondary">{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  );
}

export function UsageSummary({ schoolId, markupPct }: { schoolId: Id<"schools">; markupPct: number }) {
  const usage = useQuery(api.whatsappUsage.getCurrentUsage, { schoolId });

  return (
    <Card padding="md" elevation={1}>
      <h2 className="text-body-s font-semibold text-ink mb-3">Usage this month</h2>
      {!usage ? (
        <p className="text-body-s text-ink-secondary">No messages sent yet this month.</p>
      ) : (
        <div className="space-y-2 text-body-s">
          <Row label="Messages sent" value={String(usage.messageCount)} />
          <Row label="Meta cost" value={formatUsd(usage.metaCostUsdTotal)} />
          <Row label={`Billable (${markupPct}% markup)`} value={formatUsd(usage.billableUsdTotal)} />
          <div className="pt-2 border-t border-hairline text-caption text-ink-secondary">
            Utility {usage.utilityCount} &middot; Marketing {usage.marketingCount} &middot; Auth {usage.authenticationCount} &middot; Service {usage.serviceCount} (free)
          </div>
        </div>
      )}
      <p className="mt-4 text-caption text-ink-secondary">
        Billing will be available once a payment provider is integrated.
      </p>
    </Card>
  );
}
