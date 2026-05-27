"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Button, Card, Input, Toggle } from "@/components/ui";
import { SchoolLogo } from "@/components/careers/SchoolLogo";
import { CareersProfileEditor } from "@/components/dashboard/CareersProfileEditor";

export default function SettingsPage() {
  const { user } = useUser();
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");
  const school = useQuery(api.schools.get, profile?.schoolId ? { schoolId: profile.schoolId } : "skip");
  const updateSettings = useMutation(api.schools.updateSettings);
  const generateLogoUploadUrl = useMutation(api.schools.generateLogoUploadUrl);
  const setLogo = useMutation(api.schools.setLogo);
  const clearLogo = useMutation(api.schools.clearLogo);
  const requestCustomDomain = useMutation(api.schools.requestCustomDomain);
  const removeCustomDomain = useMutation(api.schools.removeCustomDomain);

  const [slug, setSlug] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);

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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.schoolId) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Please upload an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Logo must be under 2 MB.");
      return;
    }
    setLogoError(null);
    setUploading(true);
    try {
      const uploadUrl = await generateLogoUploadUrl({});
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Upload failed");
      const { storageId } = await result.json();
      await setLogo({ schoolId: profile.schoolId, storageId });
    } catch (err: any) {
      setLogoError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleLogoClear = async () => {
    if (!profile?.schoolId) return;
    setLogoError(null);
    try {
      await clearLogo({ schoolId: profile.schoolId });
    } catch (err: any) {
      setLogoError(err.message ?? "Failed to remove logo");
    }
  };

  const handleAddCustomDomain = async () => {
    if (!profile?.schoolId || !domainInput.trim()) return;
    setDomainSaving(true);
    setDomainError(null);
    try {
      await requestCustomDomain({ schoolId: profile.schoolId, domain: domainInput.trim() });
      setDomainInput("");
    } catch (err: any) {
      setDomainError(err.message ?? "Failed to add domain");
    } finally {
      setDomainSaving(false);
    }
  };

  const handleRemoveCustomDomain = async () => {
    if (!profile?.schoolId) return;
    setDomainError(null);
    try {
      await removeCustomDomain({ schoolId: profile.schoolId });
    } catch (err: any) {
      setDomainError(err.message ?? "Failed to remove domain");
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

      {/* School Logo */}
      <Card padding="md" elevation={1}>
        <h2 className="text-title-m text-ink mb-1">School logo</h2>
        <p className="text-body-s text-ink-secondary mb-4">Shown on your public careers portal.</p>
        <div className="flex items-center gap-5">
          <SchoolLogo name={school.name} logoUrl={school.logoUrl} size="hero" />
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center justify-center rounded-full bg-ink text-surface-canvas px-3.5 py-1.5 text-body-s font-medium hover:opacity-90 transition-opacity cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploading}
                className="sr-only"
              />
              {uploading ? "Uploading..." : school.logoUrl ? "Replace" : "Upload logo"}
            </label>
            {school.logoUrl && (
              <Button variant="ghost" size="sm" onClick={handleLogoClear}>Remove</Button>
            )}
          </div>
        </div>
        {logoError && (
          <div className="mt-4 rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger">
            {logoError}
          </div>
        )}
        <p className="text-caption text-ink-tertiary mt-3">PNG or SVG recommended · max 2 MB</p>
      </Card>

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

      {/* Custom domain */}
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

      <CareersProfileEditor school={school} />

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
