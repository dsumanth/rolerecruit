"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Dialog } from "@/components/ui";

type DecisionAction = "advance" | "reject" | "redemo" | "manual";

interface DecisionModalProps {
  open: boolean;
  onClose: () => void;
  demoId: string;
  applicationId: string;
  onDecided: () => void;
}

export function DecisionModal({ open, onClose, demoId, applicationId, onDecided }: DecisionModalProps) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<DecisionAction | null>(null);
  const apply = useMutation(api.demoSessions.applyDecision);

  // applicationId is used by the caller / future re-demo prefill (Task 21).
  void applicationId;

  const decide = async (action: DecisionAction) => {
    setBusy(action);
    try {
      await apply({
        demoId: demoId as Id<"demoSessions">,
        action,
        note: note.trim() ? note.trim() : undefined,
      });
      onDecided();
      setNote("");
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()} title="Make decision" description="Choose an outcome for this demo. Notes are recorded in the audit log.">
      <div className="space-y-4">
        <div>
          <label htmlFor="decision-note" className="block text-body-s font-medium text-ink mb-1.5">
            Notes
          </label>
          <textarea
            id="decision-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notes for the audit log"
            rows={4}
            className="w-full rounded-apple bg-surface border border-hairline-strong px-3 py-2 text-body-s text-ink placeholder:text-ink-tertiary outline-none transition-all duration-fast focus:border-accent focus:ring-2 focus:ring-accent-soft resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={() => decide("advance")}
            loading={busy === "advance"}
            disabled={busy !== null && busy !== "advance"}
          >
            Advance
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={() => decide("reject")}
            loading={busy === "reject"}
            disabled={busy !== null && busy !== "reject"}
          >
            Reject
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => decide("redemo")}
            loading={busy === "redemo"}
            disabled={busy !== null && busy !== "redemo"}
          >
            Re-demo
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={() => decide("manual")}
            loading={busy === "manual"}
            disabled={busy !== null && busy !== "manual"}
          >
            Just record
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
