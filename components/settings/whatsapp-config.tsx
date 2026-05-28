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

        <div className="border-t border-hairline pt-4">
          <p className="text-body-s font-medium text-ink mb-2">WhatsApp Business API Configuration</p>
          <p className="text-caption text-ink-secondary mb-3">
            Powered by Gupshup. Add these environment variables to your deployment. Contact support to configure your WhatsApp Business number.
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1.5 px-3 rounded-xs bg-surface-canvas">
              <span className="text-caption font-mono text-ink">GUPSHUP_API_KEY</span>
              <span className="text-caption text-ink-secondary">Set in deployment</span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-3 rounded-xs bg-surface-canvas">
              <span className="text-caption font-mono text-ink">GUPSHUP_APP_NAME</span>
              <span className="text-caption text-ink-secondary">Required</span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-3 rounded-xs bg-surface-canvas">
              <span className="text-caption font-mono text-ink">GUPSHUP_SOURCE_NUMBER</span>
              <span className="text-caption text-ink-secondary">Required</span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-3 rounded-xs bg-surface-canvas">
              <span className="text-caption font-mono text-ink">GOOGLE_API_KEY</span>
              <span className="text-caption text-ink-secondary">Set in deployment</span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-3 rounded-xs bg-surface-canvas">
              <span className="text-caption font-mono text-ink">RESEND_API_KEY</span>
              <span className="text-caption text-ink-secondary">Set in deployment</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
