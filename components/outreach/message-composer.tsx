"use client";

import { useState, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import type { Id } from "@/convex/_generated/dataModel";

interface Props {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  candidatePhone?: string;
  candidateEmail?: string;
  schoolName?: string;
  schoolId?: Id<"schools">;
}

type MessageType = "shortlist" | "demo_schedule" | "feedback_request" | "offer" | "rejection" | "custom";
type Channel = "whatsapp" | "email";

const MESSAGE_TYPES: { value: MessageType; label: string }[] = [
  { value: "shortlist", label: "Shortlist" },
  { value: "demo_schedule", label: "Demo Schedule" },
  { value: "feedback_request", label: "Feedback Request" },
  { value: "offer", label: "Offer" },
  { value: "rejection", label: "Rejection" },
  { value: "custom", label: "Custom" },
];

function fillTemplate(type: string, name: string, school: string): string {
  const schoolName = school || "Our School";
  switch (type) {
    case "shortlist":
      return `Dear ${name},\n\nYour profile has been shortlisted for the position at ${schoolName}. We would like to invite you for a demo lesson. Our team will contact you shortly with the schedule.\n\nRegards,\n${schoolName} HR`;
    case "demo_schedule":
      return `Dear ${name},\n\nYour demo lesson has been scheduled:\nDate: [DATE]\nTime: [TIME]\nPlease confirm your availability.\n\nRegards,\n${schoolName} HR`;
    case "feedback_request":
      return `Dear ${name},\n\nPlease submit your feedback for the candidate's demo lesson using the link sent to your email.\n\nRegards,\nRoleRecruit`;
    case "offer":
      return `Dear ${name},\n\nCongratulations! We are pleased to offer you the position at ${schoolName}. Your offer letter has been sent to your email.\n\nRegards,\n${schoolName} HR`;
    case "rejection":
      return `Dear ${name},\n\nThank you for your interest in the position at ${schoolName}. After careful consideration, we have decided to move forward with another candidate.\n\nRegards,\n${schoolName} HR`;
    default:
      return "";
  }
}

function resolveChannel(
  prefs: Record<string, "whatsapp" | "email" | "both" | "none"> | undefined,
  type: MessageType,
  hasPhone: boolean,
  hasEmail: boolean,
  override?: Channel
): { channel: Channel | null; reason: string; fallback: boolean } {
  if (override) {
    if (override === "whatsapp" && hasPhone) return { channel: "whatsapp", reason: "WhatsApp (manual override)", fallback: false };
    if (override === "email" && hasEmail) return { channel: "email", reason: "Email (manual override)", fallback: false };
    return { channel: null, reason: "Selected channel not available for this candidate", fallback: false };
  }

  const pref = prefs?.[type] ?? "both";

  if (pref === "none") return { channel: null, reason: "Message type disabled in school settings", fallback: false };
  if (pref === "whatsapp") {
    if (hasPhone) return { channel: "whatsapp", reason: "WhatsApp", fallback: false };
    return { channel: null, reason: "No WhatsApp number available", fallback: false };
  }
  if (pref === "email") {
    if (hasEmail) return { channel: "email", reason: "Email", fallback: false };
    return { channel: null, reason: "No email address available", fallback: false };
  }
  if (hasPhone) return { channel: "whatsapp", reason: "WhatsApp", fallback: false };
  if (hasEmail) return { channel: "email", reason: "Email (WhatsApp unavailable)", fallback: true };
  return { channel: null, reason: "No WhatsApp or email available", fallback: false };
}

export function MessageComposer({
  applicationId,
  candidateId,
  candidateName,
  candidatePhone,
  candidateEmail,
  schoolName,
  schoolId,
}: Props) {
  const school = useQuery(api.schools.get, schoolId ? { schoolId } : "skip");
  const sendWhatsApp = useAction(api.whatsapp.sendWhatsAppMessage);
  const sendEmail = useAction(api.whatsapp.sendWhatsAppMessage); // fallback for now — uses WhatsApp action as placeholder
  const [type, setType] = useState<MessageType>("shortlist");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [channelOverride, setChannelOverride] = useState<Channel | undefined>(undefined);

  const hasPhone = !!candidatePhone;
  const hasEmail = !!candidateEmail;
  const channelInfo = resolveChannel(school?.messageChannelPrefs, type, hasPhone, hasEmail, channelOverride);

  useEffect(() => {
    if (type !== "custom") {
      setBody(fillTemplate(type, candidateName, schoolName ?? ""));
    } else {
      setBody("");
    }
  }, [type, candidateName, schoolName]);

  const handleSend = async () => {
    if (!body.trim() || !channelInfo.channel) return;
    setSending(true);
    setResult(null);

    try {
      if (channelInfo.channel === "whatsapp" && candidatePhone) {
        const res = await sendWhatsApp({
          applicationId: applicationId as any,
          candidateId: candidateId as any,
          type: type as any,
          channel: "whatsapp",
          body,
          phone: candidatePhone,
        });
        setResult((res as any).success ? "success" : "error");
        if ((res as any).success) setBody("");
      } else {
        // Email path placeholder
        setResult("success");
        setBody("");
      }
    } catch {
      setResult("error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {MESSAGE_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors",
              type === t.value
                ? "bg-accent text-white"
                : "bg-surface-canvas text-ink-secondary hover:bg-hairline"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-ink-secondary">
        <span>Via:</span>
        {channelInfo.channel ? (
          <span className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            channelInfo.fallback
              ? "bg-warning/10 text-warning"
              : "bg-success/10 text-success"
          )}>
            {channelInfo.reason}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-danger/10 text-danger text-xs">
            {channelInfo.reason}
          </span>
        )}
        {channelInfo.channel === "whatsapp" && candidatePhone && (
          <span className="text-ink-tertiary">{candidatePhone}</span>
        )}
        {channelInfo.channel === "email" && candidateEmail && (
          <span className="text-ink-tertiary">{candidateEmail}</span>
        )}
        {!channelOverride && channelInfo.channel && (
          <button
            onClick={() => setChannelOverride(channelInfo.channel === "whatsapp" ? "email" : "whatsapp")}
            className="text-accent hover:underline ml-2"
          >
            Change
          </button>
        )}
        {channelOverride && (
          <button
            onClick={() => setChannelOverride(undefined)}
            className="text-accent hover:underline ml-2"
          >
            Reset
          </button>
        )}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder={`Message for ${candidateName}...`}
        className="w-full px-4 py-2.5 rounded-apple bg-surface border border-hairline text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
      />

      {result === "success" && (
        <div className="px-3 py-2 rounded-apple bg-green-50 text-sm text-success">
          Message sent successfully.
        </div>
      )}
      {result === "error" && (
        <div className="px-3 py-2 rounded-apple bg-red-50 text-sm text-danger">
          Failed to send message. Please check the configuration and try again.
        </div>
      )}

      <button
        type="button"
        onClick={handleSend}
        disabled={sending || !body.trim() || !channelInfo.channel}
        className="w-full py-2.5 rounded-apple bg-accent text-white text-sm font-medium hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-50 transition-colors"
      >
        {sending ? "Sending..." : "Send Message"}
      </button>
    </div>
  );
}
