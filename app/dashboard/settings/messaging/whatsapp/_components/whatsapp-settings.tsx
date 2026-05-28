"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui";
import { ConnectButton } from "./connect-button";
import { ConnectedCard } from "./connected-card";
import { UsageSummary } from "./usage-summary";

export function WhatsAppSettings({ schoolId }: { schoolId: Id<"schools"> }) {
  const integration = useQuery(api.whatsappIntegration.getIntegration, { schoolId });
  if (integration === undefined) return null;

  return (
    <div className="space-y-6">
      <Card padding="md" elevation={1}>
        <h2 className="text-body-s font-semibold text-ink mb-1">WhatsApp Business Account</h2>
        <p className="text-body-s text-ink-secondary mb-4">
          Connect your school&apos;s own WhatsApp number to send candidate outreach from your brand.
        </p>
        {integration.status === "active" ? (
          <ConnectedCard schoolId={schoolId} integration={integration} />
        ) : integration.status === "error" ? (
          <div className="space-y-3">
            <p className="text-body-s text-danger">{integration.lastErrorMessage ?? "Connection error"}</p>
            <ConnectButton schoolId={schoolId} label="Reconnect" />
          </div>
        ) : (
          <ConnectButton schoolId={schoolId} label="Connect WhatsApp Business" />
        )}
      </Card>

      {integration.status === "active" && (
        <UsageSummary schoolId={schoolId} markupPct={integration.markupPct} />
      )}
    </div>
  );
}
