"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

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
  const confirmBooking = useMutation(api.booking.confirmBooking);
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
      await confirmBooking({
        token,
        startMs: selectedSlot.startMs,
        endMs: selectedSlot.endMs,
      });
      setConfirmed(true);
    } catch (e: any) {
      setError(e.message ?? "Booking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (confirmed) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <h2 className="text-lg font-semibold text-ink mb-2">Booking Confirmed!</h2>
        <p className="text-sm text-ink-secondary mb-4">
          Your demo lesson at {schoolName} has been scheduled for{" "}
          {selectedDate} at {selectedSlot?.start}.
        </p>
        <p className="text-xs text-ink-tertiary">
          You will receive a calendar invitation shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="text-center mb-8">
        <h2 className="text-lg font-semibold text-ink">Book Your Demo Lesson</h2>
        <p className="text-sm text-ink-secondary mt-1">
          {schoolName} — {jobTitle}
        </p>
      </div>

      <div className="mb-6">
        <p className="text-xs font-semibold text-ink mb-2">Select a Date</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dates.map((d) => {
            const dateStr = d.toISOString().split("T")[0];
            const isSelected = dateStr === selectedDate;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <button
                key={dateStr}
                onClick={() => handleDateSelect(dateStr)}
                disabled={isWeekend}
                className={`flex-shrink-0 px-3 py-2 rounded-apple text-center min-w-[64px] transition-colors ${
                  isSelected
                    ? "bg-accent text-white"
                    : isWeekend
                    ? "bg-surface-secondary text-ink-tertiary opacity-40 cursor-not-allowed"
                    : "bg-surface-secondary text-ink hover:bg-surface-tertiary"
                }`}
              >
                <div className="text-xs">{d.toLocaleDateString("en", { weekday: "short" })}</div>
                <div className="text-lg font-semibold">{d.getDate()}</div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-ink mb-2">Available Times</p>
          {loading ? (
            <p className="text-sm text-ink-secondary">Loading slots...</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-ink-secondary">No available slots for this date.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedSlot(slot)}
                  className={`px-4 py-2 rounded-apple text-sm font-medium transition-colors ${
                    selectedSlot?.startMs === slot.startMs
                      ? "bg-accent text-white"
                      : "bg-surface border border-surface-tertiary text-ink hover:border-accent"
                  }`}
                >
                  {slot.start}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-danger mb-4">{error}</p>
      )}

      <button
        onClick={handleConfirm}
        disabled={!selectedSlot || loading}
        className="w-full py-2.5 rounded-apple bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
      >
        {loading ? "Processing..." : "Confirm Booking"}
      </button>
    </div>
  );
}
