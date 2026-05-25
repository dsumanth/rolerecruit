"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Card, Input } from "@/components/ui";

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
    <div className="space-y-6">
      <Card padding="md" elevation={1}>
        <h2 className="text-body-s font-semibold text-ink mb-1">Google Calendar</h2>
        <p className="text-body-s text-ink-secondary mb-4">
          Sync availability and create calendar events for interviews.
        </p>
        {connectionStatus?.connected ? (
          <div className="flex items-center justify-between rounded-sm bg-surface-canvas px-4 py-3">
            <div>
              <p className="text-body-s font-medium text-ink">Connected</p>
              <p className="text-caption text-ink-secondary">{connectionStatus.email}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => disconnectCalendar({ schoolId })}>
              Disconnect
            </Button>
          </div>
        ) : (
          <Button variant="primary" onClick={handleConnect}>
            Connect Google Calendar
          </Button>
        )}
      </Card>

      <Card padding="md" elevation={1}>
        <h2 className="text-body-s font-semibold text-ink mb-1">Scheduling Preferences</h2>
        <p className="text-body-s text-ink-secondary mb-2">
          Control how far ahead candidates can book and which slots are offered.
        </p>

        <div>
          <div className="grid grid-cols-[1fr_240px] gap-6 py-4 border-b border-hairline items-center">
            <div>
              <div className="text-body-s font-medium text-ink">Advance booking window</div>
              <div className="text-caption text-ink-secondary mt-0.5">Maximum days ahead a candidate can book.</div>
            </div>
            <Input
              type="number"
              min={1}
              max={90}
              value={advanceDays}
              onChange={(e) => setAdvanceDays(Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-[1fr_240px] gap-6 py-4 border-b border-hairline items-center">
            <div>
              <div className="text-body-s font-medium text-ink">Working hours start</div>
              <div className="text-caption text-ink-secondary mt-0.5">Earliest time of day to offer slots.</div>
            </div>
            <Input
              type="time"
              value={workingHoursStart}
              onChange={(e) => setWorkingHoursStart(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-[1fr_240px] gap-6 py-4 border-b border-hairline items-center">
            <div>
              <div className="text-body-s font-medium text-ink">Working hours end</div>
              <div className="text-caption text-ink-secondary mt-0.5">Latest time of day to offer slots.</div>
            </div>
            <Input
              type="time"
              value={workingHoursEnd}
              onChange={(e) => setWorkingHoursEnd(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-[1fr_240px] gap-6 py-4 items-center">
            <div>
              <div className="text-body-s font-medium text-ink">Slot duration</div>
              <div className="text-caption text-ink-secondary mt-0.5">Length of each interview slot.</div>
            </div>
            <div className="flex gap-2">
              {[30, 45, 60].map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant={slotDuration === d ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setSlotDuration(d)}
                >
                  {d} min
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Button variant="primary" onClick={handleSaveSlotConfig} disabled={saving} loading={saving}>
            Save Settings
          </Button>
        </div>
      </Card>
    </div>
  );
}
