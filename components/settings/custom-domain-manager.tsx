"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Card, Input } from "@/components/ui";

interface CustomDomainFields {
  customDomain?: string | null;
  customDomainStatus?: "pending_dns" | "verifying_ssl" | "verified" | "failed" | null;
  customDomainError?: string | null;
}

interface Props {
  schoolId: Id<"schools">;
  school: CustomDomainFields;
}

export function CustomDomainManager({ schoolId, school }: Props) {
  const requestCustomDomain = useMutation(api.schools.requestCustomDomain);
  const removeCustomDomain = useMutation(api.schools.removeCustomDomain);

  const [domainInput, setDomainInput] = useState("");
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);

  const handleAddCustomDomain = async () => {
    if (!domainInput.trim()) return;
    setDomainSaving(true);
    setDomainError(null);
    try {
      await requestCustomDomain({ schoolId, domain: domainInput.trim() });
      setDomainInput("");
    } catch (err: any) {
      setDomainError(err.message ?? "Failed to add domain");
    } finally {
      setDomainSaving(false);
    }
  };

  const handleRemoveCustomDomain = async () => {
    setDomainError(null);
    try {
      await removeCustomDomain({ schoolId });
    } catch (err: any) {
      setDomainError(err.message ?? "Failed to remove domain");
    }
  };

  return (
    <Card padding="md" elevation={1}>
      <h2 className="text-body-s font-semibold text-ink mb-1">Custom domain</h2>
      <p className="text-body-s text-ink-secondary mb-4">
        Host your careers portal on your school's own domain, like <span className="font-mono">careers.yourschool.com</span>.
      </p>

      {domainError && (
        <div className="mb-3 rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger">
          {domainError}
        </div>
      )}

      {!school.customDomain && (
        <div className="space-y-3">
          <Input
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="careers.yourschool.com"
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleAddCustomDomain}
            disabled={domainSaving || !domainInput.trim()}
            loading={domainSaving}
          >
            Add custom domain
          </Button>
        </div>
      )}

      {school.customDomain && school.customDomainStatus === "pending_dns" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-warning animate-pulse" />
            <span className="text-body-s text-ink">Waiting for DNS — <span className="font-mono">{school.customDomain}</span></span>
          </div>
          <div className="rounded-xs bg-surface-canvas border border-hairline p-4 space-y-2">
            <p className="text-body-s font-medium text-ink">Add this DNS record at your domain provider:</p>
            <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1 text-caption font-mono">
              <span className="text-ink-tertiary">Type</span><span className="text-ink">CNAME</span>
              <span className="text-ink-tertiary">Name</span><span className="text-ink">{school.customDomain.split(".")[0]}</span>
              <span className="text-ink-tertiary">Value</span><span className="text-ink">cname.vercel-dns.com</span>
            </div>
            <p className="text-caption text-ink-tertiary pt-2">
              We check every 2 minutes — usually live within 5 min after you save the DNS record. You can close this page.
            </p>
          </div>
          {school.customDomainError && (
            <p className="text-caption text-warning">{school.customDomainError}</p>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={handleRemoveCustomDomain}>Remove</Button>
        </div>
      )}

      {school.customDomain && school.customDomainStatus === "verifying_ssl" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span className="text-body-s text-ink">DNS resolved. Issuing SSL certificate… (~1 min)</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleRemoveCustomDomain}>Remove</Button>
        </div>
      )}

      {school.customDomain && school.customDomainStatus === "verified" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            <a href={`https://${school.customDomain}`} target="_blank" rel="noopener" className="text-body-s text-accent hover:underline">
              https://{school.customDomain}
            </a>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleRemoveCustomDomain}>Remove</Button>
        </div>
      )}

      {school.customDomain && school.customDomainStatus === "failed" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-danger" />
            <span className="text-body-s text-ink">Failed — <span className="font-mono">{school.customDomain}</span></span>
          </div>
          {school.customDomainError && (
            <p className="text-caption text-danger">{school.customDomainError}</p>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={handleRemoveCustomDomain}>Remove and try again</Button>
        </div>
      )}
    </Card>
  );
}
