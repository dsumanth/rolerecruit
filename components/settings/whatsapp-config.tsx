"use client";

import { Card, Toggle } from "@/components/ui";

interface Props {
  whatsappEnabled: boolean;
  onWhatsappEnabledChange: (value: boolean) => void;
}

export function WhatsappConfig({ whatsappEnabled, onWhatsappEnabledChange }: Props) {
  return (
    <Card padding="md" elevation={1}>
      <h2 className="text-body-s font-semibold text-ink mb-1">Candidate Notifications</h2>
      <p className="text-body-s text-ink-secondary mb-4">
        How candidates receive application tracking links and updates.
      </p>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-body-s font-medium text-ink">WhatsApp Notifications</p>
            <p className="text-caption text-ink-tertiary">Auto-fallback to email when disabled or when candidate has no phone</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-caption text-ink-secondary">{whatsappEnabled ? "On" : "Off"}</span>
            <Toggle
              checked={whatsappEnabled}
              onCheckedChange={onWhatsappEnabledChange}
              label="WhatsApp Notifications"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
