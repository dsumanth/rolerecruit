import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  schools: defineTable({
    name: v.string(),
    board: v.union(
      v.literal("CBSE"),
      v.literal("ICSE"),
      v.literal("IB"),
      v.literal("State"),
      v.literal("IGCSE")
    ),
    city: v.string(),
    state: v.string(),
    trustId: v.optional(v.id("trusts")),
    planTier: v.union(v.literal("free"), v.literal("pro"), v.literal("trust")),
    slug: v.optional(v.string()),
    customDomain: v.optional(v.string()),
    whatsappEnabled: v.optional(v.boolean()),
    googleCalendarConnected: v.optional(v.boolean()),
    messageChannelPrefs: v.optional(v.object({
      shortlist: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      demo_schedule: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      feedback_request: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      offer: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      rejection: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      custom: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
    })),
  })
    .index("by_trust", ["trustId"])
    .index("by_name", ["name"])
    .index("by_slug", ["slug"])
    .index("by_customDomain", ["customDomain"]),

  trusts: defineTable({
    name: v.string(),
  }),

  userProfiles: defineTable({
    userId: v.string(),
    name: v.string(),
    email: v.string(),
    schoolId: v.id("schools"),
    role: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_schoolId", ["schoolId"]),

  invitations: defineTable({
    token: v.string(),
    email: v.string(),
    role: v.string(),
    schoolId: v.id("schools"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("revoked")
    ),
    createdBy: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    acceptedBy: v.optional(v.string()),
  })
    .index("by_token", ["token"])
    .index("by_schoolId_status", ["schoolId", "status"])
    .index("by_email", ["email"]),

  roles: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    permissions: v.array(v.string()),
    isSystem: v.boolean(),
  })
    .index("by_schoolId", ["schoolId"]),

  jobPostings: defineTable({
    schoolId: v.id("schools"),
    title: v.string(),
    subject: v.string(),
    level: v.union(
      v.literal("PRT"),
      v.literal("TGT"),
      v.literal("PGT"),
      v.literal("Other")
    ),
    board: v.string(),
    qualifications: v.array(v.string()),
    minExperience: v.optional(v.number()),
    maxExperience: v.optional(v.number()),
    salaryRange: v.optional(v.string()),
    naturalLanguageDescription: v.string(),
    parsedCriteria: v.optional(
      v.object({
        subjects: v.array(v.string()),
        board: v.string(),
        level: v.string(),
        requiredQualifications: v.array(v.string()),
        preferredQualifications: v.array(v.string()),
        minExperience: v.optional(v.number()),
        skills: v.array(v.string()),
      })
    ),
    scoringRules: v.optional(
      v.object({
        dimensions: v.array(
          v.object({
            name: v.string(),
            weight: v.number(),
            config: v.any(),
          })
        ),
        minimumScore: v.number(),
        autoRejectScore: v.number(),
        generatedBy: v.union(
          v.literal("agent"),
          v.literal("manual"),
          v.literal("agent_reviewed")
        ),
        version: v.number(),
      })
    ),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("filled"),
      v.literal("closed")
    ),
    createdAt: v.number(),
    filledAt: v.optional(v.number()),
  })
    .index("by_schoolId", ["schoolId"])
    .index("by_status", ["status"]),

  candidates: defineTable({
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    location: v.optional(v.string()),
    qualifications: v.array(v.string()),
    certifications: v.array(v.string()),
    boardExperience: v.array(v.string()),
    subjects: v.array(v.string()),
    yearsExperience: v.optional(v.number()),
    currentSchool: v.optional(v.string()),
    resumeUrl: v.optional(v.string()),
    sourceChannel: v.optional(v.string()),
    credentialVerificationStatus: v.optional(
      v.union(v.literal("verified"), v.literal("flagged"), v.literal("pending"))
    ),
    talentBankFlag: v.boolean(),
    poolIds: v.optional(v.array(v.id("pools"))),
  }),

  applications: defineTable({
    candidateId: v.id("candidates"),
    jobPostingId: v.optional(v.id("jobPostings")),
    schoolId: v.id("schools"),
    stage: v.string(),
    aiMatchScore: v.optional(v.number()),
    globalScore: v.optional(v.number()),
    trackingToken: v.optional(v.string()),
    scoringResult: v.optional(
      v.object({
        totalScore: v.number(),
        dimensionScores: v.array(v.any()),
        recommendation: v.string(),
      })
    ),
    createdAt: v.number(),
  })
    .index("by_jobPostingId", ["jobPostingId"])
    .index("by_candidateId", ["candidateId"])
    .index("by_schoolId", ["schoolId"])
    .index("by_stage", ["stage"])
    .index("by_trackingToken", ["trackingToken"]),

  evaluations: defineTable({
    applicationId: v.id("applications"),
    evaluatorUserId: v.string(),
    evaluatorRole: v.union(
      v.literal("principal"),
      v.literal("hod"),
      v.literal("hr_admin")
    ),
    token: v.string(),
    submitted: v.boolean(),
    subjectKnowledge: v.optional(v.number()),
    classroomManagement: v.optional(v.number()),
    communication: v.optional(v.number()),
    overallFit: v.optional(v.number()),
    comments: v.optional(v.string()),
    recommendation: v.optional(
      v.union(v.literal("hire"), v.literal("maybe"), v.literal("reject"))
    ),
    submittedAt: v.optional(v.number()),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_token", ["token"]),

  outreachMessages: defineTable({
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    type: v.union(
      v.literal("shortlist"),
      v.literal("demo_schedule"),
      v.literal("feedback_request"),
      v.literal("offer"),
      v.literal("rejection"),
      v.literal("custom")
    ),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    body: v.string(),
    sentAt: v.number(),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("failed")
    ),
    externalId: v.optional(v.string()),
  })
    .index("by_applicationId", ["applicationId"]),

  sourcingRuns: defineTable({
    jobPostingId: v.id("jobPostings"),
    schoolId: v.id("schools"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    apifyRunId: v.optional(v.string()),
    candidatesFound: v.optional(v.number()),
    candidatesScored: v.optional(v.number()),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_jobPostingId", ["jobPostingId"]),

  pipelineConfigs: defineTable({
    schoolId: v.id("schools"),
    stages: v.array(v.object({
      id: v.string(),
      name: v.string(),
      order: v.number(),
      isTerminal: v.optional(v.boolean()),
      color: v.optional(v.string()),
    })),
    transitions: v.array(v.object({
      fromStageId: v.string(),
      toStageId: v.string(),
    })),
    version: v.number(),
  }).index("by_schoolId", ["schoolId"]),

  pipelineAutomations: defineTable({
    schoolId: v.id("schools"),
    fromStageId: v.string(),
    toStageId: v.string(),
    messageTemplate: v.optional(v.string()),
    messageChannel: v.optional(v.union(
      v.literal("whatsapp"), v.literal("email"), v.literal("both")
    )),
    includeBookingLink: v.optional(v.boolean()),
    createCalendarEvent: v.optional(v.boolean()),
  }).index("by_schoolId", ["schoolId"]),

  bookingTokens: defineTable({
    token: v.string(),
    applicationId: v.id("applications"),
    schoolId: v.id("schools"),
    expiresAt: v.number(),
    used: v.boolean(),
  }).index("by_token", ["token"]),

  calendarEvents: defineTable({
    applicationId: v.id("applications"),
    schoolId: v.id("schools"),
    googleEventId: v.string(),
    summary: v.string(),
    start: v.number(),
    end: v.number(),
    attendees: v.array(v.string()),
    meetLink: v.optional(v.string()),
  }).index("by_applicationId", ["applicationId"]),

  slotConfigs: defineTable({
    schoolId: v.id("schools"),
    advanceDays: v.number(),
    workingHoursStart: v.string(),
    workingHoursEnd: v.string(),
    slotDuration: v.number(),
  }).index("by_schoolId", ["schoolId"]),

  interviewerCalendars: defineTable({
    userId: v.string(),
    schoolId: v.id("schools"),
    googleTokens: v.object({
      access_token: v.string(),
      refresh_token: v.string(),
      expiry: v.number(),
    }),
    googleEmail: v.string(),
    calendarId: v.string(),
  }).index("by_userId", ["userId"])
    .index("by_schoolId", ["schoolId"]),

  pools: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    createdBy: v.union(v.literal("ai"), v.literal("admin")),
    tags: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_schoolId", ["schoolId"]),

  candidatePools: defineTable({
    candidateId: v.id("candidates"),
    poolId: v.id("pools"),
    confidence: v.number(),
    createdAt: v.number(),
  })
    .index("by_candidateId", ["candidateId"])
    .index("by_poolId", ["poolId"]),

  globalCriteria: defineTable({
    schoolId: v.id("schools"),
    scoringRules: v.object({
      dimensions: v.array(v.object({
        name: v.string(),
        weight: v.number(),
        config: v.any(),
      })),
      minimumScore: v.number(),
      autoRejectScore: v.number(),
      generatedBy: v.union(
        v.literal("agent"),
        v.literal("manual"),
        v.literal("agent_reviewed")
      ),
      version: v.number(),
    }),
    updatedAt: v.number(),
  }).index("by_schoolId", ["schoolId"]),
});
