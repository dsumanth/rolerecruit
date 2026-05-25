"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="bg-surface rounded-apple shadow-elevation-high w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-ink">
            Automation: {fromStageName} → {toStageName}
          </h3>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink text-lg leading-none">&times;</button>
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={messageEnabled}
              onChange={(e) => setMessageEnabled(e.target.checked)}
              className="w-4 h-4 rounded accent-accent"
            />
            <span className="text-sm font-medium text-ink">Send message to candidate</span>
          </label>

          {messageEnabled && (
            <div className="pl-6 space-y-4">
              <div>
                <p className="text-xs text-ink-secondary mb-2">Insert variable:</p>
                <div className="flex flex-wrap gap-2">
                  {["candidate_name", "school_name", "job_title", "booking_link"].map((v) => (
                    <button
                      key={v}
                      onClick={() => insertVariable(v)}
                      className="px-2.5 py-1 rounded-full bg-surface-secondary text-xs text-ink hover:bg-accent hover:text-white transition-colors"
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
                className="w-full px-3 py-2 rounded-apple bg-surface-secondary text-sm text-ink placeholder:text-ink-tertiary border border-surface-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
              />

              <div className="p-3 rounded-apple bg-surface-secondary border border-surface-tertiary">
                <p className="text-xs font-medium text-ink-secondary mb-1">Preview:</p>
                <p className="text-xs text-ink whitespace-pre-wrap">
                  {messageTemplate
                    .replace(/{candidate_name}/g, "Priya Sharma")
                    .replace(/{school_name}/g, "Your School")
                    .replace(/{job_title}/g, "TGT Mathematics")
                    .replace(/{booking_link}/g, "[booking link]")
                    || "(empty template)"}
                </p>
              </div>

              <div>
                <p className="text-xs text-ink-secondary mb-2">Send via:</p>
                <div className="flex gap-2">
                  {(["whatsapp", "email", "both"] as const).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setMessageChannel(ch)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        messageChannel === ch
                          ? "bg-accent text-white"
                          : "bg-surface-secondary text-ink"
                      }`}
                    >
                      {ch === "whatsapp" ? "WhatsApp" : ch === "email" ? "Email" : "Both"}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeBookingLink}
                  onChange={(e) => setIncludeBookingLink(e.target.checked)}
                  className="w-4 h-4 rounded accent-accent"
                />
                <span className="text-sm text-ink">Include a booking link for the candidate</span>
              </label>

              {includeBookingLink && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createCalendarEvent}
                    onChange={(e) => setCreateCalendarEvent(e.target.checked)}
                    className="w-4 h-4 rounded accent-accent"
                  />
                  <span className="text-sm text-ink">Create Google Calendar event after booking</span>
                </label>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-surface-tertiary">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-apple bg-surface-secondary text-ink text-sm font-medium hover:bg-surface-tertiary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-apple bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Automation"}
          </button>
        </div>
      </div>
    </div>
  );
}
