"use client";
import { useQuery, useMutation } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Button, Card, Input, Toggle } from "@/components/ui";

export default function TriageSettingsPage() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const profile = useQuery(
    api.users.getByClerkId,
    user?.id ? { userId: user.id } : "skip",
  );
  const schoolId = profile?.schoolId;
  const config = useQuery(
    api.schools.getTriageConfig,
    schoolId ? { schoolId } : "skip",
  );
  const update = useMutation(api.schools.updateTriageConfig);

  const [enabled, setEnabled] = useState(false);
  const [shortlistT, setShortlistT] = useState(0.85);
  const [rejectT, setRejectT] = useState(0.30);
  const [delayH, setDelayH] = useState(4);
  const [redFlag, setRedFlag] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setEnabled(config.triageEnabled);
      setShortlistT(config.autoShortlistThreshold);
      setRejectT(config.autoRejectThreshold);
      setDelayH(config.autoSendDelaySec / 3600);
      setRedFlag(config.redFlagOverrideCount);
    }
  }, [config]);

  if (!schoolId || !config) {
    return <div className="text-ink-secondary text-body-s">Loading...</div>;
  }

  async function save() {
    if (!schoolId) return;
    setSaving(true);
    try {
      await update({
        schoolId,
        triageEnabled: enabled,
        autoShortlistThreshold: shortlistT,
        autoRejectThreshold: rejectT,
        autoSendDelaySec: Math.round(delayH * 3600),
        redFlagOverrideCount: redFlag,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card padding="md" elevation={1}>
        <h2 className="text-body-s font-semibold text-ink mb-1">Inbound Triage Agent</h2>
        <p className="text-body-s text-ink-secondary mb-4">
          Automatically score new applications, shortlist strong fits, and reject weak ones. When off, every application waits in Needs Review.
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-body-s font-medium text-ink">Enable agent</p>
            <p className="text-caption text-ink-tertiary mt-0.5">
              Runs on every new application from the careers portal, email, or talent bank.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-caption text-ink-secondary">{enabled ? "On" : "Off"}</span>
            <Toggle
              checked={enabled}
              onCheckedChange={setEnabled}
              label="Enable Inbound Triage Agent"
            />
          </div>
        </div>
      </Card>

      <Card padding="md" elevation={1}>
        <h2 className="text-body-s font-semibold text-ink mb-1">Decision thresholds</h2>
        <p className="text-body-s text-ink-secondary mb-2">
          Match scores are 0–100. Scores between the two thresholds go to Needs Review.
        </p>

        <div className="grid grid-cols-[1fr_280px] gap-6 py-4 border-b border-hairline items-center">
          <div>
            <div className="text-body-s font-medium text-ink">Auto-shortlist at</div>
            <div className="text-caption text-ink-secondary mt-0.5">
              Above this score, the agent queues an outreach draft for approval.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.5}
              max={1.0}
              step={0.01}
              value={shortlistT}
              onChange={(e) => setShortlistT(+e.target.value)}
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="text-body-s text-ink tabular-nums w-10 text-right">
              {Math.round(shortlistT * 100)}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_280px] gap-6 py-4 items-center">
          <div>
            <div className="text-body-s font-medium text-ink">Auto-reject at</div>
            <div className="text-caption text-ink-secondary mt-0.5">
              At or below this score, the agent rejects without human review.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={rejectT}
              onChange={(e) => setRejectT(+e.target.value)}
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="text-body-s text-ink tabular-nums w-10 text-right">
              {Math.round(rejectT * 100)}%
            </span>
          </div>
        </div>
      </Card>

      <Card padding="md" elevation={1}>
        <h2 className="text-body-s font-semibold text-ink mb-1">Send behavior & safeguards</h2>
        <p className="text-body-s text-ink-secondary mb-2">
          Give yourself a window to cancel auto-sends, and let red flags pull strong fits back to review.
        </p>

        <div className="grid grid-cols-[1fr_280px] gap-6 py-4 border-b border-hairline items-center">
          <div>
            <div className="text-body-s font-medium text-ink">Soft-confirmation window</div>
            <div className="text-caption text-ink-secondary mt-0.5">
              Hours to wait before auto-sending shortlist or rejection messages.
            </div>
          </div>
          <Input
            type="number"
            min={0}
            max={24}
            value={delayH}
            onChange={(e) => setDelayH(+e.target.value)}
          />
        </div>

        <div className="grid grid-cols-[1fr_280px] gap-6 py-4 items-center">
          <div>
            <div className="text-body-s font-medium text-ink">Red-flag override count</div>
            <div className="text-caption text-ink-secondary mt-0.5">
              Number of red flags on a profile that blocks auto-shortlist, even with a high score.
            </div>
          </div>
          <Input
            type="number"
            min={0}
            max={10}
            value={redFlag}
            onChange={(e) => setRedFlag(+e.target.value)}
          />
        </div>
      </Card>

      <Button
        type="button"
        onClick={save}
        disabled={saving}
        loading={saving}
        variant="primary"
      >
        {saved ? "Saved" : "Save Settings"}
      </Button>
    </div>
  );
}
