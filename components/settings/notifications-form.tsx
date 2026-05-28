"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, Button, Toggle } from "@/components/ui";

interface Props {
  schoolId: Id<"schools">;
}

export function NotificationsForm({ schoolId }: Props) {
  const school = useQuery(api.schools.get, { schoolId });
  const users = useQuery(api.users.getBySchool, { schoolId });
  const update = useMutation(api.schools.updateBriefSettings);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (school) {
      setSelected(new Set(school.morningBriefRecipientUserIds ?? []));
      setEnabled(school.morningBriefEnabled === true);
    }
  }, [school]);

  if (!school || !users) {
    return (
      <Card padding="lg">
        <div className="text-body-s text-ink-secondary">Loading...</div>
      </Card>
    );
  }

  function toggleUser(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await update({
        schoolId,
        recipientUserIds: Array.from(selected),
        enabled,
      });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-title-l text-ink mb-1">Daily hiring brief</h2>
        <p className="text-body-s text-ink-secondary">
          A morning summary of new applications, strong candidates, stalled threads, and demos for
          today. Sent at 8am IST to the recipients you choose below.
        </p>
      </div>

      <Card padding="lg" elevation={1}>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-body-s font-medium text-ink">Send daily email</div>
              <div className="text-caption text-ink-secondary">
                Turn off to pause sending. The widget on the dashboard stays visible either way.
              </div>
            </div>
            <Toggle
              checked={enabled}
              onCheckedChange={setEnabled}
              label="Enable daily morning brief email"
            />
          </div>

          <div className="pt-5 border-t border-hairline">
            <div className="text-body-s font-medium text-ink mb-3">Recipients</div>
            {users.length === 0 ? (
              <div className="text-body-s text-ink-secondary">
                No users in this school yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {users.map((u) => (
                  <li key={u.userId}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(u.userId)}
                        onChange={() => toggleUser(u.userId)}
                        className="w-4 h-4 rounded accent-[var(--accent)]"
                      />
                      <span className="text-body-s text-ink">{u.name}</span>
                      <span className="text-caption text-ink-tertiary">{u.email}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button variant="ink" size="md" onClick={save} loading={saving}>
          Save
        </Button>
        {savedAt && !saving && (
          <span className="text-caption text-ink-tertiary">Saved</span>
        )}
      </div>
    </div>
  );
}
