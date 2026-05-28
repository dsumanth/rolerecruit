export interface RescheduleInput {
  candidateName: string;
  bookingUrl: string;
  schoolName: string;
  rejected: boolean;
}

export function buildRescheduleReply(input: RescheduleInput): string {
  if (input.rejected) {
    return `Hi ${input.candidateName}, thanks for reaching out. Unfortunately this role at ${input.schoolName} is currently closed for new bookings. We'll keep your details on file for future openings.`;
  }
  return `Hi ${input.candidateName}, sure, please pick a new slot here: ${input.bookingUrl}. Looking forward to meeting you.`;
}
