"use client";
import { useQuery, useMutation } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";

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

  useEffect(() => {
    if (config) {
      setEnabled(config.triageEnabled);
      setShortlistT(config.autoShortlistThreshold);
      setRejectT(config.autoRejectThreshold);
      setDelayH(config.autoSendDelaySec / 3600);
      setRedFlag(config.redFlagOverrideCount);
    }
  }, [config]);

  if (!schoolId || !config) return <div className="p-6">Loading…</div>;

  async function save() {
    await update({
      schoolId: schoolId!,
      triageEnabled: enabled,
      autoShortlistThreshold: shortlistT,
      autoRejectThreshold: rejectT,
      autoSendDelaySec: Math.round(delayH * 3600),
      redFlagOverrideCount: redFlag,
    });
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">Triage Agent Settings</h1>
      <div className="space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>Enable Inbound Triage Agent</span>
        </label>
        <div>
          <label className="block text-sm font-medium">
            Auto-shortlist threshold ({Math.round(shortlistT * 100)}%)
          </label>
          <input
            type="range"
            min={0.5}
            max={1.0}
            step={0.01}
            value={shortlistT}
            onChange={(e) => setShortlistT(+e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">
            Auto-reject threshold ({Math.round(rejectT * 100)}%)
          </label>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={rejectT}
            onChange={(e) => setRejectT(+e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">
            Soft-confirmation window (hours)
          </label>
          <input
            type="number"
            min={0}
            max={24}
            value={delayH}
            onChange={(e) => setDelayH(+e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Red-flag override count</label>
          <input
            type="number"
            min={0}
            max={10}
            value={redFlag}
            onChange={(e) => setRedFlag(+e.target.value)}
            className="border rounded px-2 py-1"
          />
        </div>
        <button
          onClick={save}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}
