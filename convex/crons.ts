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

crons.daily(
  "backfill-graph",
  { hourUTC: 4, minuteUTC: 0 },
  internal.backfill.backfillGraph,
  {},
);

crons.interval(
  "poll-pending-custom-domains",
  { minutes: 2 },
  internal.vercelDomains.pollPendingDomains,
);

crons.daily(
  "morning-brief",
  { hourUTC: 2, minuteUTC: 30 },
  internal.morningBrief.sendAllSchools,
  {},
);

export default crons;
