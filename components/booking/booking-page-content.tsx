"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BookingView } from "./booking-view";

interface Props {
  token: string;
}

export function BookingPageContent({ token }: Props) {
  const bookingData = useQuery(api.booking.getBookingByToken, { token });

  if (!bookingData) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <p className="text-sm text-ink-secondary">Loading...</p>
      </div>
    );
  }

  if (!bookingData.valid) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <h2 className="text-lg font-semibold text-ink mb-2">
          {bookingData.reason === "expired" ? "Booking Link Expired" :
           bookingData.reason === "used" ? "Already Booked" : "Invalid Link"}
        </h2>
        <p className="text-sm text-ink-secondary">
          {bookingData.reason === "expired" && "This booking link has expired. Please contact the school for a new link."}
          {bookingData.reason === "used" && "You've already booked a slot using this link."}
          {bookingData.reason === "not_found" && "This booking link is invalid."}
        </p>
      </div>
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
