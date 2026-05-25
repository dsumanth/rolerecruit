"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";

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

  if (school && !loaded) {
    setSlug(school.slug ?? "");
    setWhatsappEnabled(school.whatsappEnabled ?? false);
    setLoaded(true);
  }

  const handleSave = async () => {
    if (!profile?.schoolId) return;
    setSaving(true);
    try {
      await updateSettings({
        schoolId: profile.schoolId,
        slug: slug || undefined,
        whatsappEnabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      alert(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!school || !profile) {
    return <div className="text-ink-secondary text-sm">Loading...</div>;
  }

  const subdomainUrl = school.slug
    ? `https://${school.slug}.rolerecruit.com`
    : null;

  const fallbackUrl = school.slug
    ? `https://rolerecruit.com/careers/${school.slug}`
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">General</h1>

      {/* Careers Portal */}
      <div className="rounded-apple bg-surface border border-surface-tertiary p-5">
        <h2 className="text-sm font-semibold text-ink mb-1">Careers Portal</h2>
        <p className="text-sm text-ink-secondary mb-4">Your school's public careers page. Candidates apply here and receive tracking links.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Subdomain</label>
            <p className="text-xs text-ink-tertiary mb-2">
              Pick your school's careers portal URL. The slug uses lowercase letters, numbers, and hyphens.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-tertiary">https://</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 50))}
                className="flex-1 px-3 py-2 rounded-apple bg-surface-secondary border border-surface-tertiary text-sm"
                placeholder="harvest-international"
              />
              <span className="text-sm text-ink-tertiary">.rolerecruit.com</span>
            </div>
          </div>

          {subdomainUrl && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-secondary">Your portal:</span>
              <a href={subdomainUrl} target="_blank" rel="noopener" className="text-sm text-accent hover:underline">
                {subdomainUrl}
              </a>
            </div>
          )}

          {fallbackUrl && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-secondary">Fallback:</span>
              <a href={fallbackUrl} target="_blank" rel="noopener" className="text-sm text-accent hover:underline">
                {fallbackUrl}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Settings */}
      <div className="rounded-apple bg-surface border border-surface-tertiary p-5">
        <h2 className="text-sm font-semibold text-ink mb-1">Candidate Notifications</h2>
        <p className="text-sm text-ink-secondary mb-4">
          How candidates receive application tracking links and updates.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">WhatsApp Notifications</p>
              <p className="text-xs text-ink-tertiary">Auto-fallback to email when disabled or when candidate has no phone</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="text-xs text-ink-secondary">{whatsappEnabled ? "On" : "Off"}</span>
              <button
                type="button"
                role="switch"
                aria-checked={whatsappEnabled}
                onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative ${whatsappEnabled ? "bg-[#34c759]" : "bg-[#e8e8ed]"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-surface shadow transition-transform ${whatsappEnabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </button>
            </label>
          </div>

          <div className="border-t border-surface-tertiary pt-4">
            <p className="text-sm font-medium text-ink mb-2">WhatsApp Business API Configuration</p>
            <p className="text-xs text-ink-secondary mb-3">
              Powered by Gupshup. Add these environment variables to your deployment. Contact support to configure your WhatsApp Business number.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5 px-3 rounded bg-surface-secondary">
                <span className="text-xs font-mono text-ink">GUPSHUP_API_KEY</span>
                <span className="text-xs text-ink-secondary">Set in deployment</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-3 rounded bg-surface-secondary">
                <span className="text-xs font-mono text-ink">GUPSHUP_APP_NAME</span>
                <span className="text-xs text-ink-secondary">Required</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-3 rounded bg-surface-secondary">
                <span className="text-xs font-mono text-ink">GUPSHUP_SOURCE_NUMBER</span>
                <span className="text-xs text-ink-secondary">Required</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-3 rounded bg-surface-secondary">
                <span className="text-xs font-mono text-ink">DEEPSEEK_API_KEY</span>
                <span className="text-xs text-ink-secondary">Set in deployment</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-3 rounded bg-surface-secondary">
                <span className="text-xs font-mono text-ink">RESEND_API_KEY</span>
                <span className="text-xs text-ink-secondary">Set in deployment</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Ingestion Setup */}
      <div className="rounded-apple bg-surface border border-surface-tertiary p-5">
        <h2 className="text-sm font-semibold text-ink mb-1">Email Ingestion</h2>
        <p className="text-sm text-ink-secondary mb-4">
          Forward Naukri/Indeed/LinkedIn notification emails to automatically parse and add candidates.
        </p>
        {slug ? (
          <div className="p-3 rounded bg-surface-secondary text-sm font-mono text-ink border border-surface-tertiary">
            {slug}@inbound.rolerecruit.com
          </div>
        ) : (
          <p className="text-sm text-[#ff9500]">Set a subdomain slug first to get your inbound email address.</p>
        )}
        <p className="text-xs text-ink-tertiary mt-2">
          Configure Resend inbound webhook to point to <code className="text-ink">/api/email-ingestion</code>
        </p>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className={`py-2.5 px-5 rounded-apple text-sm font-medium transition-colors ${
          saved
            ? "bg-[#34c759] text-white"
            : saving
            ? "bg-[#aeaeb2] text-white cursor-not-allowed"
            : "bg-[#0071e3] text-white hover:bg-[#0077ed]"
        }`}
      >
        {saving ? "Saving..." : saved ? "Saved" : "Save Settings"}
      </button>
    </div>
  );
}
