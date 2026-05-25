"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Button, Card, Input, Toggle } from "@/components/ui";

export default function SettingsPage() {
  const { user } = useUser();
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");
  const school = useQuery(api.schools.get, profile?.schoolId ? { schoolId: profile.schoolId } : "skip");
  const updateSettings = useMutation(api.schools.updateSettings);

  const [slug, setSlug] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (school && !loaded) {
    setSlug(school.slug ?? "");
    setWhatsappEnabled(school.whatsappEnabled ?? false);
    setLoaded(true);
  }

  const handleSave = async () => {
    if (!profile?.schoolId) return;
    setSaving(true);
    setError(null);
    try {
      await updateSettings({
        schoolId: profile.schoolId,
        slug: slug || undefined,
        whatsappEnabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!school || !profile) {
    return <div className="text-ink-secondary text-body-s">Loading...</div>;
  }

  const subdomainUrl = school.slug
    ? `https://${school.slug}.rolerecruit.com`
    : null;

  const fallbackUrl = school.slug
    ? `https://rolerecruit.com/careers/${school.slug}`
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger">
          {error}
        </div>
      )}

      {/* Careers Portal */}
      <Card padding="md" elevation={1}>
        <h2 className="text-body-s font-semibold text-ink mb-1">Careers Portal</h2>
        <p className="text-body-s text-ink-secondary mb-4">Your school's public careers page. Candidates apply here and receive tracking links.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-body-s font-medium text-ink mb-1">Subdomain</label>
            <p className="text-caption text-ink-tertiary mb-2">
              Pick your school's careers portal URL. The slug uses lowercase letters, numbers, and hyphens.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-body-s text-ink-tertiary">https://</span>
              <Input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 50))}
                className="flex-1"
                placeholder="harvest-international"
              />
              <span className="text-body-s text-ink-tertiary">.rolerecruit.com</span>
            </div>
          </div>

          {subdomainUrl && (
            <div className="flex items-center gap-3">
              <span className="text-body-s text-ink-secondary">Your portal:</span>
              <a href={subdomainUrl} target="_blank" rel="noopener" className="text-body-s text-accent hover:underline">
                {subdomainUrl}
              </a>
            </div>
          )}

          {fallbackUrl && (
            <div className="flex items-center gap-3">
              <span className="text-body-s text-ink-secondary">Fallback:</span>
              <a href={fallbackUrl} target="_blank" rel="noopener" className="text-body-s text-accent hover:underline">
                {fallbackUrl}
              </a>
            </div>
          )}
        </div>
      </Card>

      {/* WhatsApp Settings */}
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
                onCheckedChange={setWhatsappEnabled}
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
                <span className="text-caption font-mono text-ink">DEEPSEEK_API_KEY</span>
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

      {/* Email Ingestion Setup */}
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

      <Button
        type="button"
        onClick={handleSave}
        disabled={saving}
        loading={saving}
        variant="primary"
      >
        {saved ? "Saved" : "Save Settings"}
      </Button>
    </div>
  );
}
