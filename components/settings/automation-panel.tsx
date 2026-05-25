"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Dialog, Toggle } from "@/components/ui";

interface Props {
  schoolId: Id<"schools">;
  fromStageId: string;
  fromStageName: string;
  toStageId: string;
  toStageName: string;
  onClose: () => void;
}

export function AutomationPanel({
  schoolId,
  fromStageId,
  fromStageName,
  toStageId,
  toStageName,
  onClose,
}: Props) {
  const existingAutomation = useQuery(api.pipeline_config.getAutomation, {
    schoolId,
    fromStageId,
    toStageId,
  });
  const saveAutomation = useMutation(api.pipeline_config.saveAutomation);

  const [messageEnabled, setMessageEnabled] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [messageChannel, setMessageChannel] = useState<"whatsapp" | "email" | "both">("both");
  const [includeBookingLink, setIncludeBookingLink] = useState(false);
  const [createCalendarEvent, setCreateCalendarEvent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existingAutomation) {
      setMessageEnabled(!!existingAutomation.messageTemplate);
      setMessageTemplate(existingAutomation.messageTemplate ?? "");
      setMessageChannel(existingAutomation.messageChannel ?? "both");
      setIncludeBookingLink(existingAutomation.includeBookingLink ?? false);
      setCreateCalendarEvent(existingAutomation.createCalendarEvent ?? false);
    }
  }, [existingAutomation]);

  const insertVariable = (variable: string) => {
    setMessageTemplate(prev => prev + `{${variable}}`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAutomation({
        schoolId,
        fromStageId,
        toStageId,
        messageTemplate: messageEnabled ? messageTemplate : undefined,
        messageChannel: messageEnabled ? messageChannel : undefined,
        includeBookingLink: messageEnabled ? includeBookingLink : undefined,
        createCalendarEvent: messageEnabled ? createCalendarEvent : undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={`Automation: ${fromStageName} → ${toStageName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving} loading={saving}>
            Save Automation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-body-s font-medium text-ink">Send message to candidate</span>
          <Toggle
            checked={messageEnabled}
            onCheckedChange={setMessageEnabled}
            label="Send message to candidate"
          />
        </div>

        {messageEnabled && (
          <div className="space-y-4 pt-2 border-t border-hairline">
            <div>
              <p className="text-caption text-ink-secondary mb-2">Insert variable:</p>
              <div className="flex flex-wrap gap-2">
                {["candidate_name", "school_name", "job_title", "booking_link"].map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v)}
                    className="px-2.5 py-1 rounded-full bg-accent-soft text-caption text-accent hover:bg-accent hover:text-white transition-colors duration-fast"
                  >
                    {"{" + v + "}"}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={5}
              placeholder={`Dear {candidate_name},\n\nYour application has been moved to ${toStageName}...`}
              className="w-full px-3 py-2 rounded-sm bg-surface border border-hairline-strong text-body-s text-ink placeholder:text-ink-tertiary outline-none transition-all duration-fast ease-apple-out focus:border-accent focus:ring-2 focus:ring-accent-soft resize-none"
            />

            <div className="p-3 rounded-sm bg-surface-canvas border border-hairline">
              <p className="text-caption font-medium text-ink-secondary mb-1">Preview:</p>
              <p className="text-caption text-ink whitespace-pre-wrap">
                {messageTemplate
                  .replace(/{candidate_name}/g, "Priya Sharma")
                  .replace(/{school_name}/g, "Your School")
                  .replace(/{job_title}/g, "TGT Mathematics")
                  .replace(/{booking_link}/g, "[booking link]")
                  || "(empty template)"}
              </p>
            </div>

            <div>
              <p className="text-caption text-ink-secondary mb-2">Send via:</p>
              <div className="flex gap-2">
                {(["whatsapp", "email", "both"] as const).map((ch) => (
                  <Button
                    key={ch}
                    type="button"
                    variant={messageChannel === ch ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setMessageChannel(ch)}
                  >
                    {ch === "whatsapp" ? "WhatsApp" : ch === "email" ? "Email" : "Both"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-body-s text-ink">Include a booking link for the candidate</span>
              <Toggle
                checked={includeBookingLink}
                onCheckedChange={setIncludeBookingLink}
                label="Include a booking link for the candidate"
              />
            </div>

            {includeBookingLink && (
              <div className="flex items-center justify-between">
                <span className="text-body-s text-ink">Create Google Calendar event after booking</span>
                <Toggle
                  checked={createCalendarEvent}
                  onCheckedChange={setCreateCalendarEvent}
                  label="Create Google Calendar event after booking"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
