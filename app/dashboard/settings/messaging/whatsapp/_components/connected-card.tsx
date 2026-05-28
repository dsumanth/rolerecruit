"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Input } from "@/components/ui";

interface IntegrationView {
  displayPhoneNumber?: string;
  businessName?: string;
  verifiedName?: string;
  markupPct: number;
  connectedAt?: number;
}

export function ConnectedCard({ schoolId, integration }: { schoolId: Id<"schools">; integration: IntegrationView }) {
  const updateMarkup = useMutation(api.whatsappIntegration.updateMarkup);
  const disconnect = useMutation(api.whatsappIntegration.disconnect);
  const [markup, setMarkup] = useState(integration.markupPct);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-sm bg-surface-canvas px-4 py-3">
        <div>
          <p className="text-body-s font-medium text-ink flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            {integration.businessName ?? integration.verifiedName ?? "Connected"}
          </p>
          <p className="text-caption text-ink-secondary">{integration.displayPhoneNumber}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => disconnect({ schoolId })}>
          Disconnect
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_160px] gap-6 items-center">
        <div>
          <div className="text-body-s font-medium text-ink">Message markup</div>
          <div className="text-caption text-ink-secondary mt-0.5">
            Percentage added on top of Meta&apos;s per-message cost when billing this client.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={500}
            value={markup}
            onChange={(e) => setMarkup(Number(e.target.value))}
            onBlur={() => updateMarkup({ schoolId, markupPct: markup })}
          />
          <span className="text-body-s text-ink-secondary">%</span>
        </div>
      </div>
    </div>
  );
}
