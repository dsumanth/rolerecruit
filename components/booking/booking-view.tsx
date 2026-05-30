"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, Button } from "@/components/ui";
import { nameInitial } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Slot {
  start: string;
  end: string;
  startMs: number;
  endMs: number;
}

interface Props {
  token: string;
  schoolId: Id<"schools">;
  jobTitle: string;
  schoolName: string;
}

export function BookingView({ token, schoolId, jobTitle, schoolName }: Props) {
  const getSlots = useAction(api.slot_calculator.getAvailableSlotsForDate);
  const confirmBooking = useAction(api.booking.confirmBooking);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }

  const handleDateSelect = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setError(null);
    setLoading(true);
    try {
      const result = await getSlots({ schoolId, date: dateStr });
      setSlots(Array.isArray(result) ? result : []);
    } catch {
      setError("Could not load available slots. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setLoading(true);
    setError(null);
    try {
      await confirmBooking({ token, startMs: selectedSlot.startMs, endMs: selectedSlot.endMs });
      setConfirmed(true);
    } catch (e: any) {
      setError(e.message ?? "Booking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (confirmed) {
    return (
      <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success mb-4 text-2xl">✓</div>
        <h2 className="text-title-l text-ink mb-2">Booking confirmed</h2>
        <p className="text-body-s text-ink-secondary mb-1">
          Demo lesson at <span className="text-ink font-medium">{schoolName}</span>
        </p>
        <p className="text-body-s text-ink-secondary">
          {selectedDate} · {selectedSlot?.start}
        </p>
        <p className="text-caption text-ink-tertiary mt-4">
          You will receive a calendar invitation shortly.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="lg" elevation={1} className="max-w-[480px] mx-auto">
      <div className="flex items-center gap-2.5 pb-5 mb-5 border-b border-hairline">
        <div className="h-8 w-8 rounded-sm bg-gradient-to-br from-[#1d1d1f] to-[#4a4a52] text-white text-body-s font-bold flex items-center justify-center">
          {nameInitial(schoolName, "·")}
        </div>
        <div className="min-w-0">
          <p className="text-body-s font-medium text-ink truncate">{schoolName}</p>
          <p className="text-caption text-ink-secondary truncate">{jobTitle}</p>
        </div>
      </div>

      <h2 className="text-display-s text-ink mb-1">Book your demo lesson</h2>
      <p className="text-body-s text-ink-secondary mb-6">Pick a date and time that works for you.</p>

      <div className="mb-6">
        <p className="text-micro text-ink-secondary uppercase tracking-[0.06em] mb-3">Select a date</p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {dates.map((d) => {
            const dateStr = d.toISOString().split("T")[0];
            const isSelected = dateStr === selectedDate;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => handleDateSelect(dateStr)}
                disabled={isWeekend}
                className={cn(
                  "flex-shrink-0 rounded-md text-center min-w-[64px] py-2 transition-colors duration-fast",
                  isSelected
                    ? "bg-accent-soft border border-accent/30 text-accent"
                    : isWeekend
                      ? "bg-surface-canvas text-ink-tertiary opacity-40 cursor-not-allowed border border-hairline"
                      : "bg-surface border border-hairline text-ink hover:bg-accent-soft",
                )}
              >
                <div className="text-caption">{d.toLocaleDateString("en", { weekday: "short" })}</div>
                <div className="text-title-m font-semibold tabular-nums">{d.getDate()}</div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="mb-6">
          <p className="text-micro text-ink-secondary uppercase tracking-[0.06em] mb-3">Available times</p>
          {loading ? (
            <p className="text-body-s text-ink-secondary">Loading slots...</p>
          ) : slots.length === 0 ? (
            <p className="text-body-s text-ink-secondary">No available slots for this date.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    "px-4 py-2 rounded-md text-body-s font-medium transition-colors duration-fast border",
                    selectedSlot?.startMs === slot.startMs
                      ? "bg-accent-soft border-accent/30 text-accent"
                      : "bg-surface border-hairline text-ink hover:border-accent",
                  )}
                >
                  {slot.start}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger mb-4">
          {error}
        </div>
      )}

      <Button
        variant="gradient"
        size="lg"
        loading={loading}
        disabled={!selectedSlot}
        onClick={handleConfirm}
        className="w-full"
      >
        Confirm booking
      </Button>
    </Card>
  );
}
