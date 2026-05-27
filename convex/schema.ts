import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const evidenceValidator = v.object({
  quote: v.string(),
  offset: v.number(),
  context: v.string(),
});

const facetValueValidator = v.object({
  value: v.string(),
  evidence: evidenceValidator,
});

const facetArrayValidator = v.array(facetValueValidator);

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
    customDomainStatus: v.optional(v.union(
      v.literal("pending_dns"),
      v.literal("verifying_ssl"),
      v.literal("verified"),
      v.literal("failed"),
    )),
    customDomainVerifiedAt: v.optional(v.number()),
    customDomainError: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
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
    triageEnabled: v.optional(v.boolean()),
    autoShortlistThreshold: v.optional(v.number()),
    autoRejectThreshold: v.optional(v.number()),
    autoSendDelaySec: v.optional(v.number()),
    redFlagOverrideCount: v.optional(v.number()),

    // Careers-page profile (public)
    tagline: v.optional(v.string()),
    heroImageStorageId: v.optional(v.id("_storage")),
    about: v.optional(v.string()),
    foundedYear: v.optional(v.number()),
    studentCount: v.optional(v.number()),
    facultyCount: v.optional(v.number()),
    perks: v.optional(v.array(v.object({
      label: v.string(),
      description: v.string(),
    }))),
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

    // NEW: role embeddings — mirror candidate.facetEmbeddings for Stage 2 cosine math
    roleEmbeddings: v.optional(v.object({
      overall: v.array(v.float64()),
      experience: v.array(v.float64()),
      pedagogy: v.array(v.float64()),
      achievements: v.array(v.float64()),
      leadership: v.array(v.float64()),
    })),
    roleEmbeddingVersion: v.optional(v.string()),
  })
    .index("by_schoolId", ["schoolId"])
    .index("by_status", ["status"]),

  candidates: defineTable({
    // existing fields
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

    // NEW: provenance (orthogonal to sourceChannel)
    origin: v.optional(v.union(
      v.literal("fresh_application"),
      v.literal("talent_pool"),
      v.literal("agent_sourced"),
      v.literal("referral"),
      v.literal("manual_import"),
    )),

    // NEW: facets with evidence spans
    parsedFacets: v.optional(v.object({
      specializations: facetArrayValidator,
      gradeLevels: facetArrayValidator,
      pedagogicalApproach: facetArrayValidator,
      leadershipRoles: facetArrayValidator,
      extracurricular: facetArrayValidator,
      languages: facetArrayValidator,
      schoolTypes: facetArrayValidator,
      keyAchievements: facetArrayValidator,
      redFlags: facetArrayValidator,
      extras: v.record(v.string(), facetArrayValidator),
    })),

    // NEW: 1-paragraph job-agnostic summary
    candidateSummary: v.optional(v.string()),

    // NEW: raw chunks — source of truth for evidence validation + future re-extraction
    rawChunks: v.optional(v.array(v.object({
      text: v.string(),
      section: v.union(
        v.literal("header"),
        v.literal("experience"),
        v.literal("pedagogy"),
        v.literal("achievements"),
        v.literal("leadership"),
        v.literal("other"),
      ),
      offset: v.number(),
    }))),

    // NEW: five facet embeddings (1536 dims each)
    facetEmbeddings: v.optional(v.object({
      overall: v.array(v.float64()),
      experience: v.array(v.float64()),
      pedagogy: v.array(v.float64()),
      achievements: v.array(v.float64()),
      leadership: v.array(v.float64()),
    })),

    // NEW: version stamps
    parsedVersion: v.optional(v.string()),
    embeddingVersion: v.optional(v.string()),
    parsedAt: v.optional(v.number()),

    // NEW: parsing notes — flags when evidence validation didn't fully pass on retry
    parsingNotes: v.optional(v.string()),
  })
    .index("by_origin", ["origin"])
    .index("by_parsedVersion", ["parsedVersion"])
    .index("by_embeddingVersion", ["embeddingVersion"])
    .vectorIndex("by_overall_embedding", {
      vectorField: "facetEmbeddings.overall",
      dimensions: 1536,
      filterFields: ["subjects", "origin"],
    })
    .vectorIndex("by_experience_embedding", {
      vectorField: "facetEmbeddings.experience",
      dimensions: 1536,
      filterFields: ["subjects", "origin"],
    })
    .vectorIndex("by_pedagogy_embedding", {
      vectorField: "facetEmbeddings.pedagogy",
      dimensions: 1536,
      filterFields: ["subjects", "origin"],
    })
    .vectorIndex("by_achievements_embedding", {
      vectorField: "facetEmbeddings.achievements",
      dimensions: 1536,
      filterFields: ["subjects", "origin"],
    })
    .vectorIndex("by_leadership_embedding", {
      vectorField: "facetEmbeddings.leadership",
      dimensions: 1536,
      filterFields: ["subjects", "origin"],
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

    // NEW
    source: v.optional(v.union(
      v.literal("careers_site"),
      v.literal("talent_pool_match"),
      v.literal("agent_sourced"),
      v.literal("triage_cross_match"),
      v.literal("manual"),
    )),
    matchedFromPoolId: v.optional(v.id("pools")),
    matchedAt: v.optional(v.number()),
    triageOutcome: v.optional(v.union(
      v.literal("auto_shortlisted"),
      v.literal("auto_rejected"),
      v.literal("human_review"),
      v.literal("cross_role_suggested"),
    )),
    triageDecisionId: v.optional(v.id("triageDecisions")),
    matchReasons: v.optional(v.array(v.string())),
  })
    .index("by_jobPostingId", ["jobPostingId"])
    .index("by_candidateId", ["candidateId"])
    .index("by_schoolId", ["schoolId"])
    .index("by_stage", ["stage"])
    .index("by_trackingToken", ["trackingToken"])
    .index("by_schoolId_triageOutcome", ["schoolId", "triageOutcome"])
    .index("by_source", ["source"]),

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
      v.literal("custom"),
      v.literal("cross_role_suggestion"),
    ),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    body: v.string(),
    sentAt: v.optional(v.number()),  // optional — drafts have none yet
    status: v.union(
      v.literal("draft_pending_approval"),
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("failed"),
    ),
    draftedBy: v.optional(v.union(
      v.literal("triage_agent"),
      v.literal("reverse_match_agent"),
      v.literal("manual"),
    )),
    scheduledSendAt: v.optional(v.number()),
    externalId: v.optional(v.string()),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_status_scheduledSendAt", ["status", "scheduledSendAt"]),

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

  triageDecisions: defineTable({
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    schoolId: v.id("schools"),
    primaryRoleId: v.optional(v.id("jobPostings")),
    primaryMatchScore: v.number(),
    primaryMatchReasons: v.array(v.string()),
    crossRoleMatches: v.array(v.object({
      roleId: v.id("jobPostings"),
      score: v.number(),
      reasons: v.array(v.string()),
    })),
    outcome: v.union(
      v.literal("auto_shortlisted"),
      v.literal("auto_rejected"),
      v.literal("human_review"),
      v.literal("cross_role_suggested"),
    ),
    outcomeReasoning: v.string(),
    outreachDraftId: v.optional(v.id("outreachMessages")),
    humanOverride: v.optional(v.object({
      overriddenAt: v.number(),
      overriddenBy: v.string(),
      fromOutcome: v.string(),
      toOutcome: v.string(),
      note: v.optional(v.string()),
    })),
    hybridWeights: v.object({
      w_struct: v.number(),
      w_sem: v.number(),
      w_rules: v.number(),
      w_graph: v.optional(v.number()),
      facetWeights: v.object({
        overall: v.number(),
        experience: v.number(),
        pedagogy: v.number(),
        achievements: v.number(),
        leadership: v.number(),
      }),
    }),
    createdAt: v.number(),
    triagePromptVersion: v.string(),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_schoolId_outcome", ["schoolId", "outcome"])
    .index("by_candidateId", ["candidateId"]),

  facetPromotionCandidates: defineTable({
    key: v.string(),                 // snake_case extras key, e.g. "AI_curriculum_design"
    occurrenceCount: v.number(),     // candidates carrying this key
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    sampleEvidence: v.array(v.object({
      candidateId: v.id("candidates"),
      quote: v.string(),
      offset: v.number(),
      context: v.string(),
    })),                              // up to 5 distinct samples
    status: v.union(
      v.literal("pending"),
      v.literal("promoted"),
      v.literal("dismissed"),
      v.literal("demoted"),
    ),
    promotedAt: v.optional(v.number()),
    dismissedAt: v.optional(v.number()),
    demotedAt: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_status", ["status"])
    .index("by_status_occurrenceCount", ["status", "occurrenceCount"]),
});
