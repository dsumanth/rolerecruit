"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Card } from "@/components/ui";

interface Slot {
  start: string;
  end: string;
  startMs: number;
  endMs: number;
}

interface Props {
  schoolId: Id<"schools">;
  date: string;
  onSlotSelect: (slot: Slot) => void;
  selectedSlotMs?: number;
}

export function AvailabilityOverlay({ schoolId, date, onSlotSelect, selectedSlotMs }: Props) {
  const getSlots = useAction(api.slot_calculator.getAvailableSlotsForDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    getSlots({ schoolId, date }).then((result) => {
      setSlots(Array.isArray(result) ? result : []);
      setLoading(false);
    }).catch(() => {
      setSlots([]);
      setLoading(false);
    });
  }, [date, schoolId, getSlots]);

  if (!date) return null;

  return (
    <Card padding="sm">
      <p className="text-xs font-medium text-ink-secondary mb-2">Available Times</p>
      {loading ? (
        <p className="text-xs text-ink-tertiary">Loading...</p>
      ) : slots.length === 0 ? (
        <p className="text-xs text-ink-tertiary">No slots available on this date.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {slots.map((slot) => (
            <Button
              key={slot.startMs}
              size="sm"
              variant={selectedSlotMs === slot.startMs ? "primary" : "secondary"}
              onClick={() => onSlotSelect(slot)}
            >
              {slot.start}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}
