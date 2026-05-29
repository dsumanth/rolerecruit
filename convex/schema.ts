import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { EVALUATOR_ROLE_UNION } from "./types";

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

    faqContent: v.optional(v.string()),
    morningBriefRecipientUserIds: v.optional(v.array(v.string())),
    conversationAgentEnabled: v.optional(v.boolean()),
    morningBriefEnabled: v.optional(v.boolean()),
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
    expoPushTokens: v.optional(v.array(v.string())),
  })
    .index("by_userId", ["userId"])
    .index("by_schoolId", ["schoolId"]),

  whatsappIntegrations: defineTable({
    schoolId: v.id("schools"),
    status: v.union(
      v.literal("not_connected"),
      v.literal("pending"),
      v.literal("active"),
      v.literal("disconnected"),
      v.literal("error"),
    ),
    wabaId: v.optional(v.string()),
    phoneNumberId: v.optional(v.string()),
    displayPhoneNumber: v.optional(v.string()),
    businessName: v.optional(v.string()),
    verifiedName: v.optional(v.string()),
    accessTokenCipher: v.optional(v.string()),
    accessTokenIv: v.optional(v.string()),
    connectedAt: v.optional(v.number()),
    disconnectedAt: v.optional(v.number()),
    lastErrorAt: v.optional(v.number()),
    lastErrorMessage: v.optional(v.string()),
    markupPct: v.number(),
  })
    .index("by_schoolId", ["schoolId"])
    .index("by_phoneNumberId", ["phoneNumberId"])
    .index("by_wabaId", ["wabaId"]),

  whatsappUsage: defineTable({
    schoolId: v.id("schools"),
    periodStart: v.number(),
    messageCount: v.number(),
    utilityCount: v.number(),
    marketingCount: v.number(),
    authenticationCount: v.number(),
    serviceCount: v.number(),
    metaCostUsdTotal: v.number(),
    billableUsdTotal: v.number(),
    updatedAt: v.number(),
  })
    .index("by_schoolId_periodStart", ["schoolId", "periodStart"]),

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
    // Editable natural-language criteria — fluid, can be updated post-publish.
    // Seeded from naturalLanguageDescription on first create; surfaced on the
    // job's Criteria page so recruiters can refine "what we're looking for"
    // without losing the original description.
    criteria: v.optional(v.string()),
    // Headcount for this role. When the number of `hired`-stage applications
    // for this job reaches `positions`, the job auto-closes (status="filled").
    positions: v.optional(v.number()),
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
    pendingDeleteAt: v.optional(v.number()),
    pendingDeleteBatchId: v.optional(v.string()),
  })
    .index("by_schoolId", ["schoolId"])
    .index("by_status", ["status"])
    .index("by_schoolId_title", ["schoolId", "title"]),

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
    resumeStorageId: v.optional(v.id("_storage")),
    resumeOriginalName: v.optional(v.string()),
    resumeExtractionMethod: v.optional(v.union(
      v.literal("pdf-parse"),
      v.literal("openai-vision"),
      v.literal("gemini-vision"),
      v.literal("mammoth"),
      v.literal("plain-text"),
    )),
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
    graphVersion: v.optional(v.string()),

    // NEW: parsing notes — flags when evidence validation didn't fully pass on retry
    parsingNotes: v.optional(v.string()),

    // Surface resume parsing lifecycle so silent failures (missing GOOGLE_API_KEY,
    // OCR errors, etc.) are visible in the UI instead of looking like "the parser
    // didn't run." Set "pending" on upload, transitioned by extractTextFromResume.
    parseStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("done"),
      v.literal("failed"),
    )),
    parseError: v.optional(v.string()),
    pendingDeleteAt: v.optional(v.number()),
    pendingDeleteBatchId: v.optional(v.string()),
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
    pendingDeleteAt: v.optional(v.number()),
    pendingDeleteBatchId: v.optional(v.string()),
  })
    .index("by_jobPostingId", ["jobPostingId"])
    .index("by_candidateId", ["candidateId"])
    .index("by_schoolId", ["schoolId"])
    .index("by_stage", ["stage"])
    .index("by_trackingToken", ["trackingToken"])
    .index("by_schoolId_triageOutcome", ["schoolId", "triageOutcome"])
    .index("by_source", ["source"])
    .index("by_schoolId_aiMatchScore", ["schoolId", "aiMatchScore"])
    .index("by_jobPostingId_aiMatchScore", ["jobPostingId", "aiMatchScore"]),

  demoSessions: defineTable({
    applicationId: v.id("applications"),
    schoolId: v.id("schools"),
    parentDemoId: v.optional(v.id("demoSessions")),
    scheduledAt: v.number(),
    durationMinutes: v.number(),
    mode: v.union(v.literal("live"), v.literal("post"), v.literal("async")),
    format: v.union(v.literal("classroom"), v.literal("mock"), v.literal("recorded")),
    location: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    status: v.union(
      v.literal("scheduled"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    formOpenWindowMinutes: v.optional(v.number()),
    formCloseDueDays: v.optional(v.number()),
    decisionRuleId: v.optional(v.id("decisionRules")),
    appliedDecision: v.optional(v.object({
      action: v.union(
        v.literal("advance"),
        v.literal("reject"),
        v.literal("redemo"),
        v.literal("manual"),
      ),
      appliedAt: v.number(),
      appliedBy: v.optional(v.id("userProfiles")),
      note: v.optional(v.string()),
    })),
    createdBy: v.id("userProfiles"),
    createdAt: v.number(),
    cancelledAt: v.optional(v.number()),
    cancellationReason: v.optional(v.string()),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_schoolId_scheduledAt", ["schoolId", "scheduledAt"])
    .index("by_status_scheduledAt", ["status", "scheduledAt"]),

  evaluationInvites: defineTable({
    demoSessionId: v.id("demoSessions"),
    evaluatorUserId: v.id("userProfiles"),
    evaluatorRole: EVALUATOR_ROLE_UNION,
    formTemplateId: v.id("formTemplates"),
    status: v.union(
      v.literal("invited"),
      v.literal("viewed"),
      v.literal("in_progress"),
      v.literal("submitted"),
      v.literal("declined"),
      v.literal("cancelled"),
    ),
    token: v.string(),
    invitedAt: v.number(),
    viewedAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    declinedAt: v.optional(v.number()),
    declineReason: v.optional(v.string()),
    cancelledAt: v.optional(v.number()),
    replacedBy: v.optional(v.id("evaluationInvites")),
  })
    .index("by_demoSessionId", ["demoSessionId"])
    .index("by_evaluatorUserId_status", ["evaluatorUserId", "status"])
    .index("by_token", ["token"]),

  formTemplates: defineTable({
    schoolId: v.optional(v.id("schools")),
    role: EVALUATOR_ROLE_UNION,
    name: v.string(),
    fields: v.array(v.object({
      key: v.string(),
      label: v.string(),
      type: v.union(
        v.literal("score_1_5"),
        v.literal("score_1_10"),
        v.literal("text"),
        v.literal("choice"),
      ),
      choices: v.optional(v.array(v.string())),
      weight: v.optional(v.number()),
      allowDictation: v.optional(v.boolean()),
      required: v.optional(v.boolean()),
    })),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_schoolId_role", ["schoolId", "role"])
    .index("by_isActive", ["isActive"]),

  decisionRules: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    branches: v.array(v.object({
      condition: v.object({
        minHire: v.optional(v.number()),
        maxReject: v.optional(v.number()),
        minAverage: v.optional(v.object({
          fieldKey: v.string(),
          minValue: v.number(),
        })),
        requiredRoles: v.optional(v.array(v.string())),
      }),
      action: v.union(
        v.literal("advance"),
        v.literal("reject"),
        v.literal("redemo"),
        v.literal("manual"),
      ),
    })),
    fallback: v.union(
      v.literal("advance"),
      v.literal("reject"),
      v.literal("redemo"),
      v.literal("manual"),
    ),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_schoolId", ["schoolId"]),

  evaluations: defineTable({
    inviteId: v.id("evaluationInvites"),
    formTemplateId: v.id("formTemplates"),
    responses: v.record(v.string(), v.union(v.number(), v.string())),
    recommendation: v.optional(v.union(
      v.literal("hire"),
      v.literal("maybe"),
      v.literal("reject"),
    )),
    voiceInputs: v.optional(v.array(v.object({
      fieldKey: v.string(),
      transcript: v.string(),
      summaryPoints: v.array(v.string()),
      language: v.string(),
      durationSec: v.number(),
      processedAt: v.number(),
    }))),
    submittedAt: v.number(),
    submittedFromPlatform: v.union(
      v.literal("mobile_ios"),
      v.literal("mobile_android"),
      v.literal("web"),
    ),
  })
    .index("by_inviteId", ["inviteId"]),

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
      v.literal("candidate_reply"),
      v.literal("agent_reply"),
    ),
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    body: v.string(),
    sentAt: v.optional(v.number()),
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
      v.literal("conversation_agent"),
      v.literal("manual"),
    )),
    scheduledSendAt: v.optional(v.number()),
    externalId: v.optional(v.string()),
    direction: v.optional(v.union(v.literal("outbound"), v.literal("inbound"))),
    schoolId: v.optional(v.id("schools")),
    replyToken: v.optional(v.string()),
    inReplyToMessageId: v.optional(v.id("outreachMessages")),
    intent: v.optional(v.union(
      v.literal("faq"),
      v.literal("reschedule"),
      v.literal("negotiation"),
      v.literal("unclear"),
    )),
    confidence: v.optional(v.number()),
    escalated: v.optional(v.boolean()),
    escalationReason: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    processedAt: v.optional(v.number()),
    metaMessageId: v.optional(v.string()),
    metaConversationId: v.optional(v.string()),
    metaCategory: v.optional(v.union(
      v.literal("utility"),
      v.literal("marketing"),
      v.literal("authentication"),
      v.literal("service"),
    )),
    metaPricingModel: v.optional(v.string()),
    metaCostUsd: v.optional(v.number()),
    markupPct: v.optional(v.number()),
    billableUsd: v.optional(v.number()),
    costCurrency: v.optional(v.string()),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_status_scheduledSendAt", ["status", "scheduledSendAt"])
    .index("by_replyToken", ["replyToken"])
    .index("by_schoolId_escalated", ["schoolId", "escalated"])
    .index("by_metaMessageId", ["metaMessageId"])
    .index("by_schoolId_sentAt", ["schoolId", "sentAt"]),

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
  }).index("by_token", ["token"])
    .index("by_applicationId", ["applicationId"]),

  calendarEvents: defineTable({
    applicationId: v.id("applications"),
    schoolId: v.id("schools"),
    googleEventId: v.string(),
    summary: v.string(),
    start: v.number(),
    end: v.number(),
    attendees: v.array(v.string()),
    meetLink: v.optional(v.string()),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_schoolId_start", ["schoolId", "start"]),

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

  nodes: defineTable({
    type: v.union(
      v.literal("Candidate"),
      v.literal("School"),
      v.literal("University"),
      v.literal("Subject"),
      v.literal("Board"),
      v.literal("Certification"),
      v.literal("Qualification"),
      v.literal("Region"),
      v.literal("Cohort"),
    ),
    externalId: v.string(),       // canonical id: normalized name, or Candidate's Id, or Cohort composite key
    displayName: v.string(),       // human-readable label
    attributes: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_type_externalId", ["type", "externalId"])
    .index("by_type", ["type"]),

  edges: defineTable({
    fromId: v.id("nodes"),
    toId: v.id("nodes"),
    type: v.union(
      v.literal("TAUGHT_AT"),
      v.literal("HOLDS"),
      v.literal("FROM"),
      v.literal("CERTIFIED_IN"),
      v.literal("SPECIALIZES_IN"),
      v.literal("REFERRED_BY"),
      v.literal("TEACHES"),
      v.literal("BELONGS_TO"),
      v.literal("LOCATED_IN"),
      v.literal("APPLIED_TO"),
    ),
    attributes: v.optional(v.any()),
    weight: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_from_type", ["fromId", "type"])
    .index("by_to_type", ["toId", "type"])
    .index("by_type", ["type"]),
});
