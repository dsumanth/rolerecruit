"use client";

import { useState } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface Props {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  candidatePhone: string;
}

export function DemoScheduler({
  applicationId,
  candidateId,
  candidateName,
  candidatePhone,
}: Props) {
  const scheduleMessage = useAction(api.whatsapp.sendWhatsAppTemplate);
  const moveStage = useMutation(api.applications.moveStage);
  const createEval = useMutation(api.evaluations.create);
  const app = useQuery(api.applications.get, { applicationId: applicationId as any });
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [topic, setTopic] = useState("");
  const [address, setAddress] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [error, setError] = useState("");

  const alreadyScheduled = app?.stage === "demo_scheduled";

  const handleSchedule = async () => {
    if (!date || !time) {
      setError("Date and time are required.");
      return;
    }
    setError("");
    setScheduling(true);
    setResult(null);

    try {
      if (!alreadyScheduled) {
        await moveStage({
          applicationId: applicationId as any,
          newStage: "demo_scheduled",
        });
      }

      await scheduleMessage({
        applicationId: applicationId as any,
        candidateId: candidateId as any,
        templateName: "demo_schedule",
        templateParams: {
          name: candidateName,
          date,
          time,
          topic: topic || "To be announced",
          classLevel: classLevel || "TBD",
          address: address || "School campus",
          school: "Our School",
        },
        phone: candidatePhone,
      });

      await createEval({
        applicationId: applicationId as any,
        evaluatorRole: "principal",
      });

      setResult("success");
    } catch (err: any) {
      setResult("error");
      setError(err.message || "Failed to schedule demo");
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="space-y-4">
      {alreadyScheduled && (
        <div className="px-3 py-2 rounded-apple bg-blue-50 text-sm text-accent">
          Stage already set to Demo Scheduled. Fill in the details below and send the notification.
        </div>
      )}

      <div>
        <label className="block text-xs text-ink-secondary mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink focus:outline-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      </div>

      <div>
        <label className="block text-xs text-ink-secondary mb-1">Time</label>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink focus:outline-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      </div>

      <div>
        <label className="block text-xs text-ink-secondary mb-1">Class Level</label>
        <input
          type="text"
          value={classLevel}
          onChange={(e) => setClassLevel(e.target.value)}
          placeholder="e.g. Class 11"
          className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      </div>

      <div>
        <label className="block text-xs text-ink-secondary mb-1">Topic</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Newton's Laws of Motion"
          className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      </div>

      <div>
        <label className="block text-xs text-ink-secondary mb-1">Address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="School campus address"
          className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      </div>

      {error && (
        <div className="px-3 py-2 rounded-apple bg-red-50 text-sm text-danger">{error}</div>
      )}
      {result === "success" && (
        <div className="px-3 py-2 rounded-apple bg-green-50 text-sm text-success">
          Demo scheduled and candidate notified.
        </div>
      )}

      <button
        type="button"
        onClick={handleSchedule}
        disabled={scheduling || !date || !time}
        className="w-full py-2.5 rounded-apple bg-accent text-white text-sm font-medium hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-50 transition-colors"
      >
        {scheduling ? "Scheduling..." : alreadyScheduled ? "Send Demo Details" : "Schedule Demo & Notify"}
      </button>
    </div>
  );
}
