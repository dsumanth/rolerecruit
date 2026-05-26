"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BookingView } from "./booking-view";
import { Card } from "@/components/ui";

interface Props {
  token: string;
}

export function BookingPageContent({ token }: Props) {
  const bookingData = useQuery(api.booking.getBookingByToken, { token });

  if (!bookingData) {
    return (
      <Card padding="lg" elevation={1} className="max-w-md mx-auto text-center">
        <p className="text-body-s text-ink-secondary">Loading...</p>
      </Card>
    );
  }

  if (!bookingData.valid) {
    return (
      <Card padding="lg" elevation={1} className="max-w-md mx-auto text-center">
        <h2 className="text-title-m text-ink mb-2">
          {bookingData.reason === "expired" ? "Booking link expired" :
           bookingData.reason === "used" ? "Already booked" : "Invalid link"}
        </h2>
        <p className="text-body-s text-ink-secondary">
          {bookingData.reason === "expired" && "This booking link has expired. Please contact the school for a new link."}
          {bookingData.reason === "used" && "You've already booked a slot using this link."}
          {bookingData.reason === "not_found" && "This booking link is invalid."}
        </p>
      </Card>
    );
  }

  return (
    <BookingView
      token={token}
      schoolId={bookingData.schoolId}
      jobTitle={bookingData.jobTitle}
      schoolName={bookingData.schoolName}
    />
  );
}
