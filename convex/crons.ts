import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "dispatch-scheduled-outreach",
  { minutes: 1 },
  internal.outreach.dispatchScheduledOutreach,
);

export default crons;
