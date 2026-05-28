"use client";

import { useState } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

      // Note: evaluations are now created through the new schedule-demo wizard
      // (components/demos/schedule-demo-wizard.tsx + DemosPanel). This outreach
      // path only sends the WhatsApp template and advances the application
      // stage; evaluators are invited separately when HR opens the wizard.

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
        <div className="px-3 py-2 rounded-sm bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-body-s text-accent">
          Stage already set to Demo Scheduled. Fill in the details below and send the notification.
        </div>
      )}

      <div>
        <label className="block text-caption text-ink-secondary mb-1">Date</label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-caption text-ink-secondary mb-1">Time</label>
        <Input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-caption text-ink-secondary mb-1">Class Level</label>
        <Input
          type="text"
          value={classLevel}
          onChange={(e) => setClassLevel(e.target.value)}
          placeholder="e.g. Class 11"
        />
      </div>

      <div>
        <label className="block text-caption text-ink-secondary mb-1">Topic</label>
        <Input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Newton's Laws of Motion"
        />
      </div>

      <div>
        <label className="block text-caption text-ink-secondary mb-1">Address</label>
        <Input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="School campus address"
        />
      </div>

      {error && (
        <div className="px-3 py-2 rounded-sm bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] text-body-s text-danger">{error}</div>
      )}
      {result === "success" && (
        <div className="px-3 py-2 rounded-sm bg-[color-mix(in_srgb,var(--success)_8%,transparent)] text-body-s text-success">
          Demo scheduled and candidate notified.
        </div>
      )}

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={handleSchedule}
        disabled={!date || !time}
        loading={scheduling}
        className="w-full"
      >
        {scheduling ? "Scheduling..." : alreadyScheduled ? "Send Demo Details" : "Schedule Demo & Notify"}
      </Button>
    </div>
  );
}
