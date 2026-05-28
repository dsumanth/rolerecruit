"use client";

import { Card } from "@/components/ui";

interface Props {
  slug: string;
}

export function EmailIngestionSetup({ slug }: Props) {
  return (
    <Card padding="md" elevation={1}>
      <h2 className="text-body-s font-semibold text-ink mb-1">Email Ingestion</h2>
      <p className="text-body-s text-ink-secondary mb-4">
        Forward Naukri/Indeed/LinkedIn notification emails to automatically parse and add candidates.
      </p>
      {slug ? (
        <div className="p-3 rounded-xs bg-surface-canvas text-body-s font-mono text-ink border border-hairline">
          {slug}@inbound.rolerecruit.com
        </div>
      ) : (
        <p className="text-body-s text-warning">Set a subdomain slug first to get your inbound email address.</p>
      )}
      <p className="text-caption text-ink-tertiary mt-2">
        Configure Resend inbound webhook to point to <code className="text-ink">/api/email-ingestion</code>
      </p>
    </Card>
  );
}
