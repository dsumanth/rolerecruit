"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface Props {
  schoolId: Id<"schools">;
}

export function CalendarConfigForm({ schoolId }: Props) {
  const connectionStatus = useQuery(api.calendar.getConnectionStatus, { schoolId });
  const slotConfig = useQuery(api.slot_calculator.getSlotConfig, { schoolId });
  const updateSlotConfig = useMutation(api.slot_calculator.updateSlotConfig);
  const disconnectCalendar = useMutation(api.calendar.disconnectCalendar);

  const [advanceDays, setAdvanceDays] = useState(7);
  const [workingHoursStart, setWorkingHoursStart] = useState("09:00");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("17:00");
  const [slotDuration, setSlotDuration] = useState(45);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (slotConfig) {
      setAdvanceDays(slotConfig.advanceDays);
      setWorkingHoursStart(slotConfig.workingHoursStart);
      setWorkingHoursEnd(slotConfig.workingHoursEnd);
      setSlotDuration(slotConfig.slotDuration);
    }
  }, [slotConfig]);

  const handleConnect = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/api/oauth/google-callback`;
    const scope = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events";
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
  };

  const handleSaveSlotConfig = async () => {
    setSaving(true);
    try {
      await updateSlotConfig({
        schoolId,
        advanceDays,
        workingHoursStart,
        workingHoursEnd,
        slotDuration,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-ink mb-1">Google Calendar</h2>
        {connectionStatus?.connected ? (
          <div className="flex items-center justify-between p-4 rounded-apple bg-surface border border-surface-tertiary">
            <div>
              <p className="text-sm font-medium text-ink">Connected</p>
              <p className="text-xs text-ink-secondary">{connectionStatus.email}</p>
            </div>
            <button
              onClick={() => disconnectCalendar({ schoolId })}
              className="px-3 py-1.5 rounded-apple bg-surface-secondary text-ink text-xs font-medium hover:bg-surface-tertiary transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="w-full py-3 rounded-apple bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Connect Google Calendar
          </button>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-ink mb-4">Scheduling Preferences</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-secondary block mb-1">
              Advance Booking Window (days)
            </label>
            <input
              type="number"
              min={1}
              max={90}
              value={advanceDays}
              onChange={(e) => setAdvanceDays(Number(e.target.value))}
              className="w-24 px-3 py-2 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink"
            />
          </div>

          <div className="flex gap-4">
            <div>
              <label className="text-xs font-medium text-ink-secondary block mb-1">Working Hours Start</label>
              <input
                type="time"
                value={workingHoursStart}
                onChange={(e) => setWorkingHoursStart(e.target.value)}
                className="px-3 py-2 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-secondary block mb-1">Working Hours End</label>
              <input
                type="time"
                value={workingHoursEnd}
                onChange={(e) => setWorkingHoursEnd(e.target.value)}
                className="px-3 py-2 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-ink-secondary block mb-2">Slot Duration</label>
            <div className="flex gap-2">
              {[30, 45, 60].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSlotDuration(d)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    slotDuration === d
                      ? "bg-accent text-white"
                      : "bg-surface-secondary text-ink hover:bg-surface-tertiary"
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveSlotConfig}
          disabled={saving}
          className="mt-6 w-full py-2.5 rounded-apple bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
