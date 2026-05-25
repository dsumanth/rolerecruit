export const PIPELINE_STAGES = [
  "sourced",
  "screened",
  "demo_scheduled",
  "demo_completed",
  "offer_sent",
  "hired",
] as const;

export const EXIT_STAGE = "rejected" as const;

export const JOB_STATUSES = [
  "draft",
  "active",
  "paused",
  "filled",
  "closed",
] as const;

export const BOARD_TYPES = [
  "CBSE",
  "ICSE",
  "IB",
  "State",
  "IGCSE",
] as const;

export const TEACHING_LEVELS = ["PRT", "TGT", "PGT", "Other"] as const;

export const VERIFICATION_STATUSES = [
  "verified",
  "flagged",
  "pending",
] as const;

export const SOURCING_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;

export const VALID_TRANSITIONS: Record<string, string[]> = {
  sourced: ["screened", "rejected"],
  screened: ["demo_scheduled", "rejected"],
  demo_scheduled: ["demo_completed", "rejected"],
  demo_completed: ["offer_sent", "rejected"],
  offer_sent: ["hired", "rejected"],
  hired: [],
  rejected: [],
};

export const EVALUATION_DIMENSIONS = [
  "subjectKnowledge",
  "classroomManagement",
  "communication",
  "overallFit",
] as const;

export const EVALUATION_LABELS: Record<string, string> = {
  subjectKnowledge: "Subject Knowledge",
  classroomManagement: "Classroom Management",
  communication: "Communication",
  overallFit: "Overall Fit",
};
