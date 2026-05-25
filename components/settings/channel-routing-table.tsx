"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type ChannelPref = "whatsapp" | "email" | "both" | "none";

const MESSAGE_TYPES: { key: "shortlist" | "demo_schedule" | "feedback_request" | "offer" | "rejection" | "custom"; label: string }[] = [
  { key: "shortlist", label: "Shortlist" },
  { key: "demo_schedule", label: "Demo Schedule" },
  { key: "feedback_request", label: "Feedback Request" },
  { key: "offer", label: "Offer" },
  { key: "rejection", label: "Rejection" },
  { key: "custom", label: "Custom" },
];

interface Props {
  schoolId: Id<"schools">;
}

export function ChannelRoutingTable({ schoolId }: Props) {
  const school = useQuery(api.schools.get, { schoolId });
  const updateSettings = useMutation(api.schools.updateSettings);

  const prefs = school?.messageChannelPrefs ?? {
    shortlist: "both" as ChannelPref,
    demo_schedule: "both" as ChannelPref,
    feedback_request: "both" as ChannelPref,
    offer: "both" as ChannelPref,
    rejection: "both" as ChannelPref,
    custom: "both" as ChannelPref,
  };

  const handleToggle = (type: string, channel: "whatsapp" | "email") => {
    const current = prefs[type as keyof typeof prefs] ?? "both";
    const hasWhatsapp = current === "whatsapp" || current === "both";
    const hasEmail = current === "email" || current === "both";

    const newWhatsapp = channel === "whatsapp" ? !hasWhatsapp : hasWhatsapp;
    const newEmail = channel === "email" ? !hasEmail : hasEmail;

    let newPref: ChannelPref;
    if (newWhatsapp && newEmail) newPref = "both";
    else if (newWhatsapp) newPref = "whatsapp";
    else if (newEmail) newPref = "email";
    else newPref = "none";

    const newPrefs = { ...prefs, [type]: newPref };
    updateSettings({ schoolId, messageChannelPrefs: newPrefs });
  };

  const hasChannel = (pref: ChannelPref, channel: "whatsapp" | "email"): boolean => {
    return pref === channel || pref === "both";
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-1">Message Channel Preferences</h2>
      <p className="text-xs text-ink-secondary mb-6">
        Choose which channels to use for each message type. When both are enabled, WhatsApp is tried first, falling back to email if the candidate has no WhatsApp number.
      </p>

      <div className="rounded-apple border border-surface-tertiary overflow-hidden">
        <div className="flex px-4 py-2.5 bg-surface-secondary text-xs font-medium uppercase tracking-wider text-ink-secondary">
          <div className="flex-[2]">Message Type</div>
          <div className="flex-1 text-center">WhatsApp</div>
          <div className="flex-1 text-center">Email</div>
        </div>
        {MESSAGE_TYPES.map(({ key, label }, i) => (
          <div
            key={key}
            className={`flex px-4 py-3 border-t border-surface-tertiary items-center ${
              i % 2 === 1 ? "bg-surface-secondary/50" : ""
            }`}
          >
            <div className="flex-[2] text-sm font-medium text-ink">{label}</div>
            <div className="flex-1 flex justify-center">
              <input
                type="checkbox"
                checked={hasChannel(prefs[key] ?? "both", "whatsapp")}
                onChange={() => handleToggle(key, "whatsapp")}
                className="w-4 h-4 rounded accent-accent"
              />
            </div>
            <div className="flex-1 flex justify-center">
              <input
                type="checkbox"
                checked={hasChannel(prefs[key] ?? "both", "email")}
                onChange={() => handleToggle(key, "email")}
                className="w-4 h-4 rounded accent-accent"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
