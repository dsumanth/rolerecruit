import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "dispatch-scheduled-outreach",
  { minutes: 1 },
  internal.outreach.dispatchScheduledOutreach,
);

crons.daily(
  "track-extras-frequency",
  { hourUTC: 3, minuteUTC: 0 }, // 03:00 UTC nightly
  internal.facetPromotion.trackExtrasFrequency,
  {},
);

export default crons;
