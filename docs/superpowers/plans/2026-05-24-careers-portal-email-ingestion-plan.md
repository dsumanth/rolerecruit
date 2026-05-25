# Careers Portal + Email Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public school careers portal (subdomain routing, job listings, application forms, candidate tracking) and email ingestion pipeline (Resend inbound webhook parsing Naukri/Indeed/LinkedIn emails into candidate records).

**Architecture:** Single Next.js app with middleware routing by Host header for subdomain support (slug fallback), Convex backend with DeepSeek V4 Flash for NLP (replacing Claude), Resend for inbound/outbound email, existing Gupshup for WhatsApp tracking links.

**Tech Stack:** Next.js 14 (App Router), Convex (real-time backend), DeepSeek V4 Flash (OpenAI SDK), Resend (email), Gupshup (existing, WhatsApp).

---

## File Plan

**Create:**
- `convex/careers.ts` — Public queries/mutations for careers portal
- `convex/scoring.ts` — Agentic scoring engine + DeepSeek integration
- `convex/tracking.ts` — Candidate tracking queries (token-based)
- `convex/resend.ts` — Resend email actions (magic links)
- `convex/email_ingestion.ts` — Inbound email webhook handler
- `app/middleware.ts` — Subdomain routing middleware
- `app/careers/layout.tsx` — Public portal layout (no auth)
- `app/careers/[slug]/page.tsx` — Job listings page
- `app/careers/[slug]/jobs/[jobId]/page.tsx` — Job detail + apply
- `app/careers/[slug]/apply/page.tsx` — General application
- `app/track/[token]/page.tsx` — Candidate tracking page
- `app/dashboard/jobs/[id]/criteria/page.tsx` — Agentic criteria editor
- `components/careers/SchoolHeader.tsx` — School branding header
- `components/careers/JobListings.tsx` — Job cards list + search
- `components/careers/JobCard.tsx` — Single job card
- `components/careers/ApplicationForm.tsx` — Application form with resume upload
- `components/criteria/ScoringRuleEditor.tsx` — Visual rule editor
- `components/criteria/DimensionSlider.tsx` — Weight slider
- `components/criteria/AISuggestedCriteria.tsx` — AI suggestions UI
- `components/tracking/ApplicationStatus.tsx` — Status display
- `components/dashboard/SuggestedMatches.tsx` — Reverse-match section
- `tests/convex/careers.test.ts` — Careers portal tests
- `tests/convex/scoring.test.ts` — Scoring engine tests
- `tests/convex/tracking.test.ts` — Tracking tests

**Modify:**
- `convex/schema.ts` — Add slug, whatsappEnabled, scoringRules, trackingToken, on_hold stage, indexes
- `convex/ai.ts` — Replace Claude with DeepSeek V4 Flash, add parseProfileFromText
- `convex/applications.ts` — Add getUnmatchedForSchool, suggestMatchesForJob, on_hold transitions
- `convex/jobs.ts` — Add saveScoringRules internal mutation
- `convex/jobs_ai.ts` — Replace Claude with DeepSeek

---

### Task 1: Update Schema

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add new fields and indexes to schema.ts**

In `convex/schema.ts`, add `slug` and `whatsappEnabled` to `schools`, add `scoringRules` to `jobPostings`, add `trackingToken` and `scoringResult` to `applications`, add `on_hold` to the application stage union.

For applications, also add index `by_trackingToken` on `trackingToken` and an index combining `by_schoolId` with `jobPostingId`.

For candidates, add `by_schoolId` index. For schools, add `by_slug` index.

```typescript
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
    whatsappEnabled: v.boolean(),
  })
    .index("by_trust", ["trustId"])
    .index("by_name", ["name"])
    .index("by_slug", ["slug"]),

  trusts: defineTable({
    name: v.string(),
  }),

  userProfiles: defineTable({
    userId: v.string(),
    name: v.string(),
    email: v.string(),
    schoolId: v.id("schools"),
    role: v.union(
      v.literal("hr_admin"),
      v.literal("principal"),
      v.literal("hod"),
      v.literal("viewer")
    ),
  })
    .index("by_userId", ["userId"])
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
  })
    .index("by_schoolId", ["schoolId"]),

  applications: defineTable({
    candidateId: v.id("candidates"),
    jobPostingId: v.id("jobPostings"),
    schoolId: v.id("schools"),
    stage: v.union(
      v.literal("sourced"),
      v.literal("screened"),
      v.literal("demo_scheduled"),
      v.literal("demo_completed"),
      v.literal("offer_sent"),
      v.literal("hired"),
      v.literal("rejected"),
      v.literal("on_hold")
    ),
    aiMatchScore: v.optional(v.number()),
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
});
```

- [ ] **Step 2: Run convex codegen to apply schema**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx convex codegen --typecheck=disable
```

Expected: Schema uploaded to Convex, TypeScript bindings regenerated without errors.

- [ ] **Step 3: Run existing tests to verify**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && bun test
```

Expected: All 35 tests pass. (the convex-test library uses a separate schema copy)

---

### Task 2: Replace Claude with DeepSeek V4 Flash

**Files:**
- Modify: `convex/ai.ts`
- Modify: `convex/jobs_ai.ts`

- [ ] **Step 1: Add DeepSeek utility and parseProfileFromText to ai.ts**

Replace the Claude Anthropic SDK with OpenAI SDK pointed at `https://api.deepseek.com`. Model: `deepseek-v4-flash`. Add `parseProfileFromText` function. Keep existing `parseJobDescription` and `scoreCandidates` but switch them to DeepSeek too.

In `convex/ai.ts`:

```typescript
import OpenAI from "openai";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const INDIAN_EDUCATION_TAXONOMY = `
You are an AI that parses natural language job descriptions for Indian K-12 schools into structured criteria.

Indian education context:
- Boards: CBSE, ICSE, IB, IGCSE, State Board
- Teaching levels: PRT (Primary Teacher, Classes 1-5), TGT (Trained Graduate Teacher, Classes 6-10), PGT (Post Graduate Teacher, Classes 11-12)
- Common qualifications: B.Ed, D.El.Ed, M.Ed, CTET, State TET, NET, Ph.D
- Subjects include: English, Hindi, Mathematics, Physics, Chemistry, Biology, History, Geography, Economics, Computer Science, Sanskrit, Regional Languages

Return a JSON object with this exact structure:
{
  "subjects": string[],
  "board": string,
  "level": string,
  "requiredQualifications": string[],
  "preferredQualifications": string[],
  "minExperience": number | null,
  "skills": string[]
}
`;

function getClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
}

export async function parseJobDescription(
  description: string
): Promise<{
  subjects: string[];
  board: string;
  level: string;
  requiredQualifications: string[];
  preferredQualifications: string[];
  minExperience: number | null;
  skills: string[];
}> {
  const client = getClient();
  if (!client) {
    return {
      subjects: [], board: "", level: "", requiredQualifications: [],
      preferredQualifications: [], minExperience: null, skills: [],
    };
  }

  const response = await client.chat.completions.create({
    model: "deepseek-v4-flash",
    max_tokens: 1024,
    temperature: 0,
    messages: [
      { role: "system", content: INDIAN_EDUCATION_TAXONOMY },
      { role: "user", content: `Parse this job description into structured criteria:\n\n${description}` },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error("No JSON found in response");
  } catch (err) {
    throw new Error(`Failed to parse AI response: ${text.substring(0, 200)}`);
  }
}

const CANDIDATE_SCORING_SYSTEM = `You are an education hiring expert for Indian K-12 schools.

Score each candidate on a 0-100 scale considering:
- Qualification match: How well do their qualifications (B.Ed, D.El.Ed, M.Ed, etc.) match requirements?
- Certification match: CTET, State TET alignment
- Board experience: CBSE/ICSE/State/IB alignment with the job
- Subject expertise: Do they teach the required subjects?
- Years of relevant experience: vs minimum required

Return ONLY a JSON array (no markdown, no explanation):
[{"candidateIndex": 0, "score": 85, "reasoning": "Strong match: B.Ed qualified, CTET certified, 5 years CBSE Physics experience"}]`;

export const scoreCandidates = action({
  args: {
    parsedCriteria: v.any(),
    candidates: v.array(
      v.object({
        _id: v.id("candidates"),
        qualifications: v.array(v.string()),
        certifications: v.array(v.string()),
        boardExperience: v.array(v.string()),
        subjects: v.array(v.string()),
        yearsExperience: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const client = getClient();
    if (!client) {
      return args.candidates.map((c) => ({
        candidateId: c._id,
        score: 50,
        reasoning: "AI scoring not configured (DEEPSEEK_API_KEY missing)",
      }));
    }

    const candidateProfiles = args.candidates.map((c, i) =>
      `[${i}] ${c.qualifications.join(", ")}, ${c.certifications.join(", ")}, Board: ${c.boardExperience.join(", ")}, Subjects: ${c.subjects.join(", ")}, Experience: ${c.yearsExperience ?? "unknown"} years`
    ).join("\n");

    try {
      const response = await client.chat.completions.create({
        model: "deepseek-v4-flash",
        max_tokens: 4096,
        temperature: 0,
        messages: [
          { role: "system", content: CANDIDATE_SCORING_SYSTEM },
          { role: "user", content: `Job criteria: ${JSON.stringify(args.parsedCriteria)}\n\nCandidates:\n${candidateProfiles}` },
        ],
      });

      const text = response.choices[0]?.message?.content ?? "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array found in response");

      const scores = JSON.parse(jsonMatch[0]);
      const results = [];
      for (const s of scores) {
        const candidate = args.candidates[s.candidateIndex];
        if (candidate) {
          await ctx.runMutation(internal.candidates.updateScore as any, {
            candidateId: candidate._id,
            score: typeof s.score === "number" ? s.score : 50,
            reasoning: typeof s.reasoning === "string" ? s.reasoning : "",
          });
          results.push({ candidateId: candidate._id, score: s.score, reasoning: s.reasoning });
        }
      }
      return results;
    } catch (err: any) {
      return args.candidates.map((c) => ({
        candidateId: c._id,
        score: 50,
        reasoning: `Scoring failed: ${err.message?.substring(0, 200)}`,
      }));
    }
  },
});

const PROFILE_PARSING_SYSTEM = `You are an AI that extracts structured information from resumes, profiles, and email notifications about Indian K-12 teacher candidates.

Extract the following fields where available. Use null or empty arrays for missing data. Return ONLY a JSON object (no markdown, no explanation):

{
  "name": string | null,
  "email": string | null,
  "phone": string | null,
  "location": string | null,
  "qualifications": string[],
  "certifications": string[],
  "boardExperience": string[],
  "subjects": string[],
  "yearsExperience": number | null,
  "currentSchool": string | null
}

Qualification examples: B.Ed, D.El.Ed, M.Ed, M.Sc, B.Sc, Ph.D
Certification examples: CTET, State TET, NET, UGC-NET
Board examples: CBSE, ICSE, IB, IGCSE, State Board
Subject examples: English, Hindi, Mathematics, Physics, Chemistry, Biology, History, Geography, Economics, Computer Science, Sanskrit`;

export const parseProfileFromText = action({
  args: {
    text: v.string(),
  },
  handler: async (_ctx, args) => {
    const client = getClient();
    if (!client) {
      return {
        name: null, email: null, phone: null, location: null,
        qualifications: [], certifications: [], boardExperience: [],
        subjects: [], yearsExperience: null, currentSchool: null,
      };
    }

    const response = await client.chat.completions.create({
      model: "deepseek-v4-flash",
      max_tokens: 512,
      temperature: 0,
      messages: [
        { role: "system", content: PROFILE_PARSING_SYSTEM },
        { role: "user", content: args.text.substring(0, 4000) },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error("No JSON found");
    } catch {
      return {
        name: null, email: null, phone: null, location: null,
        qualifications: [], certifications: [], boardExperience: [],
        subjects: [], yearsExperience: null, currentSchool: null,
      };
    }
  },
});
```

- [ ] **Step 2: Update jobs_ai.ts to use DeepSeek**

In `convex/jobs_ai.ts`, replace the Anthropic import and client with OpenAI + DeepSeek:

```typescript
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are an AI that parses natural language job descriptions for Indian K-12 schools into structured criteria.

Indian education context:
- Boards: CBSE, ICSE, IB, IGCSE, State Board
- Teaching levels: PRT (Primary Teacher, Classes 1-5), TGT (Trained Graduate Teacher, Classes 6-10), PGT (Post Graduate Teacher, Classes 11-12)
- Common qualifications: B.Ed, D.El.Ed, M.Ed, CTET, State TET, NET, Ph.D
- Subjects include: English, Hindi, Mathematics, Physics, Chemistry, Biology, History, Geography, Economics, Computer Science, Sanskrit, Regional Languages

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "subjects": string[],
  "board": string,
  "level": string,
  "requiredQualifications": string[],
  "preferredQualifications": string[],
  "minExperience": number | null,
  "skills": string[]
}`;

export const parseJobWithAI = action({
  args: {
    jobId: v.id("jobPostings"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(api.jobs.get as any, { jobId: args.jobId });
    if (!job) throw new Error("Job not found");

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

    const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });

    const response = await client.chat.completions.create({
      model: "deepseek-v4-flash",
      max_tokens: 1024,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Parse this job description:\n\n${job.naturalLanguageDescription}` },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      throw new Error(`Failed to parse AI response: ${text.substring(0, 300)}`);
    }

    await ctx.runMutation(internal.jobs.saveParsedCriteria as any, {
      jobId: args.jobId,
      parsedCriteria: {
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
        board: typeof parsed.board === "string" ? parsed.board : "",
        level: typeof parsed.level === "string" ? parsed.level : "",
        requiredQualifications: Array.isArray(parsed.requiredQualifications) ? parsed.requiredQualifications : [],
        preferredQualifications: Array.isArray(parsed.preferredQualifications) ? parsed.preferredQualifications : [],
        minExperience: typeof parsed.minExperience === "number" ? parsed.minExperience : null,
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      },
    });

    return { parsedCriteria: parsed };
  },
});
```

- [ ] **Step 3: Install dependencies**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && bun add openai && bun remove @anthropic-ai/sdk
```

Expected: Packages installed/removed.

- [ ] **Step 4: Run codegen and tests**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx convex codegen --typecheck=disable && bun test
```

Expected: Codegen succeeds, all 35 existing tests pass.

---

### Task 3: Careers API (convex/careers.ts)

**Files:**
- Create: `convex/careers.ts`
- Create: `tests/convex/careers.test.ts`

- [ ] **Step 1: Write failing test for careers**

Create `tests/convex/careers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as careers from "../../convex/careers";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";
import * as jobs_ai from "../../convex/jobs_ai";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "careers.ts": async () => careers,
  "jobs_ai.ts": async () => jobs_ai,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

async function setupSchool(t: ReturnType<typeof convexTest>) {
  const schoolId = await t.mutation("schools:create", {
    name: "DPS Bangalore",
    board: "CBSE",
    city: "Bangalore",
    state: "Karnataka",
  });
  return schoolId;
}

describe("careers", () => {
  it("gets a school by slug", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);

    // temporarily patch slug — we'll test the actual query once created
    const school = await t.query("careers:getSchoolBySlug", { slug: "dps-bangalore" });
    // school may be null if slug not set, test that query runs without error
    expect(school === null || school?._id).toBeDefined();
  });
});
```

Run: `bun test tests/convex/careers.test.ts`
Expected: Fails with "careers module not found" or similar.

- [ ] **Step 2: Implement careers.ts**

Create `convex/careers.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getSchoolBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("schools")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const getOpenJobs = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobPostings")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});

export const getJob = query({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const submitApplication = mutation({
  args: {
    schoolId: v.id("schools"),
    jobId: v.optional(v.id("jobPostings")),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    qualifications: v.array(v.string()),
    certifications: v.optional(v.array(v.string())),
    boardExperience: v.optional(v.array(v.string())),
    subjects: v.array(v.string()),
    yearsExperience: v.optional(v.number()),
    currentSchool: v.optional(v.string()),
    resumeUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.phone && !args.email) {
      throw new Error("Either phone or email is required");
    }
    if (args.phone && !/^\d{10,12}$/.test(args.phone)) {
      throw new Error("Invalid phone number");
    }

    const candidateId = await ctx.db.insert("candidates", {
      name: args.name,
      phone: args.phone,
      email: args.email,
      qualifications: args.qualifications,
      certifications: args.certifications ?? [],
      boardExperience: args.boardExperience ?? [],
      subjects: args.subjects,
      yearsExperience: args.yearsExperience,
      currentSchool: args.currentSchool,
      resumeUrl: args.resumeUrl,
      sourceChannel: "careers_portal",
      talentBankFlag: false,
    });

    const trackingToken = generateTrackingToken();

    const appId = await ctx.db.insert("applications", {
      candidateId,
      jobPostingId: args.jobId ?? ("" as any),
      schoolId: args.schoolId,
      stage: "sourced",
      trackingToken,
      createdAt: Date.now(),
    });

    return { candidateId, applicationId: appId, trackingToken };
  },
});

function generateTrackingToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}
```

- [ ] **Step 3: Update test and run**

Update `tests/convex/careers.test.ts` with proper tests:

```typescript
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as careers from "../../convex/careers";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";
import * as jobs_ai from "../../convex/jobs_ai";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "careers.ts": async () => careers,
  "jobs_ai.ts": async () => jobs_ai,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

async function setupSchool(t: ReturnType<typeof convexTest>) {
  const schoolId = await t.mutation("schools:create", {
    name: "DPS Bangalore",
    board: "CBSE",
    city: "Bangalore",
    state: "Karnataka",
  });
  return schoolId;
}

describe("careers", () => {
  it("submits a job-specific application", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);

    const jobId = await t.mutation("jobs:create", {
      schoolId,
      title: "PGT Physics",
      subject: "Physics",
      level: "PGT",
      board: "CBSE",
      qualifications: ["B.Ed", "M.Sc"],
      naturalLanguageDescription: "Need a Physics teacher",
    });
    await t.mutation("jobs:publish", { jobId });

    const result = await t.mutation("careers:submitApplication", {
      schoolId,
      jobId,
      name: "Rajesh Kumar",
      phone: "919876543210",
      email: "rajesh@email.com",
      qualifications: ["B.Ed", "M.Sc"],
      subjects: ["Physics"],
    });

    expect(result.candidateId).toBeDefined();
    expect(result.applicationId).toBeDefined();
    expect(result.trackingToken).toHaveLength(32);
  });

  it("submits a general application (no jobId)", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);

    const result = await t.mutation("careers:submitApplication", {
      schoolId,
      name: "Priya Patel",
      email: "priya@email.com",
      qualifications: ["B.Ed"],
      subjects: ["Science", "Physics"],
    });

    expect(result.candidateId).toBeDefined();
    expect(result.applicationId).toBeDefined();
  });

  it("rejects application without phone or email", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);

    await expect(
      t.mutation("careers:submitApplication", {
        schoolId,
        name: "No Contact",
        qualifications: ["B.Ed"],
        subjects: ["Math"],
      })
    ).rejects.toThrow();
  });

  it("gets open jobs for a school", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await setupSchool(t);

    const jobId = await t.mutation("jobs:create", {
      schoolId,
      title: "TGT Math",
      subject: "Mathematics",
      level: "TGT",
      board: "CBSE",
      qualifications: ["B.Ed"],
      naturalLanguageDescription: "desc",
    });
    await t.mutation("jobs:publish", { jobId });

    const jobs = await t.query("careers:getOpenJobs", { schoolId });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("TGT Math");
  });
});
```

Run: `bun test tests/convex/careers.test.ts`
Expected: All 4 tests pass.

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && bun test
```

---

### Task 4: Update applications.ts for on_hold and unmatched query

**Files:**
- Modify: `convex/applications.ts`

- [ ] **Step 1: Update VALID_TRANSITIONS and add getUnmatchedForSchool**

In `convex/applications.ts`, add `on_hold` to the stage union args, add valid transitions, and add the new query.

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const VALID_TRANSITIONS: Record<string, string[]> = {
  sourced: ["screened", "rejected", "on_hold"],
  screened: ["demo_scheduled", "rejected", "on_hold"],
  demo_scheduled: ["demo_completed", "rejected"],
  demo_completed: ["offer_sent", "rejected"],
  offer_sent: ["hired", "rejected"],
  hired: [],
  rejected: [],
  on_hold: ["screened", "rejected"],
};

const PIPELINE_STAGES = [
  "sourced",
  "screened",
  "demo_scheduled",
  "demo_completed",
  "offer_sent",
  "hired",
] as const;

export const create = mutation({
  args: {
    candidateId: v.id("candidates"),
    jobPostingId: v.id("jobPostings"),
    schoolId: v.id("schools"),
    aiMatchScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("applications", {
      candidateId: args.candidateId,
      jobPostingId: args.jobPostingId,
      schoolId: args.schoolId,
      stage: "sourced",
      aiMatchScore: args.aiMatchScore,
      createdAt: Date.now(),
    });
  },
});

export const get = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.applicationId);
  },
});

export const moveStage = mutation({
  args: {
    applicationId: v.id("applications"),
    newStage: v.union(
      v.literal("sourced"),
      v.literal("screened"),
      v.literal("demo_scheduled"),
      v.literal("demo_completed"),
      v.literal("offer_sent"),
      v.literal("hired"),
      v.literal("rejected"),
      v.literal("on_hold")
    ),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    const allowedTransitions = VALID_TRANSITIONS[app.stage] ?? [];
    if (!allowedTransitions.includes(args.newStage)) {
      throw new Error(
        `Cannot move from ${app.stage} to ${args.newStage}. Allowed: ${allowedTransitions.join(", ")}`
      );
    }

    return await ctx.db.patch(args.applicationId, { stage: args.newStage });
  },
});

export const getPipelineForJob = query({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_jobPostingId", (q) => q.eq("jobPostingId", args.jobId))
      .collect();

    const result: Record<string, any[]> = {};
    for (const stage of PIPELINE_STAGES) {
      result[stage] = [];
    }

    for (const app of apps) {
      if (result[app.stage]) {
        const candidate = await ctx.db.get(app.candidateId);
        result[app.stage].push({
          ...app,
          candidate: candidate ?? null,
        });
      }
    }

    return result;
  },
});

export const getUnmatchedForSchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    const candidateMap = new Map<string, any>();
    for (const app of apps) {
      if (app.stage === "rejected" || app.stage === "on_hold") continue;
      if (!candidateMap.has(app.candidateId)) {
        const candidate = await ctx.db.get(app.candidateId);
        if (candidate) {
          candidateMap.set(app.candidateId, { ...app, candidate });
        }
      }
    }

    return Array.from(candidateMap.values());
  },
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && bun test
```

---

### Task 5: Tracking API (convex/tracking.ts)

**Files:**
- Create: `convex/tracking.ts`
- Create: `tests/convex/tracking.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/convex/tracking.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as careers from "../../convex/careers";
import * as tracking from "../../convex/tracking";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "careers.ts": async () => careers,
  "tracking.ts": async () => tracking,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("tracking", () => {
  it("returns application by tracking token with candidate info", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Test",
      board: "CBSE",
      city: "Test",
      state: "Test",
    });

    const { trackingToken } = await t.mutation("careers:submitApplication", {
      schoolId,
      name: "Test Candidate",
      email: "test@email.com",
      qualifications: ["B.Ed"],
      subjects: ["Math"],
    });

    const app = await t.query("tracking:getByToken", { token: trackingToken });
    expect(app).not.toBeNull();
    expect(app?.candidate?.name).toBe("Test Candidate");
    expect(app?.stage).toBe("sourced");
  });
});
```

Run: `bun test tests/convex/tracking.test.ts`
Expected: Fails.

- [ ] **Step 2: Implement tracking.ts**

Create `convex/tracking.ts`:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("applications")
      .withIndex("by_trackingToken", (q) => q.eq("trackingToken", args.token))
      .first();

    if (!app) return null;

    const candidate = await ctx.db.get(app.candidateId);
    const job = await ctx.db.get(app.jobPostingId);
    const school = await ctx.db.get(app.schoolId);

    return {
      ...app,
      candidate: candidate ?? null,
      job: job ?? null,
      school: school ?? null,
    };
  },
});
```

Run: `bun test tests/convex/tracking.test.ts`
Expected: Pass.

---

### Task 6: Scoring Engine (convex/scoring.ts)

**Files:**
- Create: `convex/scoring.ts`
- Create: `tests/convex/scoring.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/convex/scoring.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as scoring from "../../convex/scoring";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";
import * as ai from "../../convex/ai";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "scoring.ts": async () => scoring,
  "ai.ts": async () => ai,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

describe("scoring", () => {
  it("scores a candidate against rules", async () => {
    const t = convexTest(schema, modules);
    const result = await t.action("scoring:testScoreCandidate", {
      candidate: {
        qualifications: ["B.Ed", "M.Sc"],
        certifications: ["CTET"],
        boardExperience: ["CBSE"],
        subjects: ["Physics"],
        yearsExperience: 6,
      },
      rules: {
        dimensions: [
          { name: "qualifications", weight: 0.4, config: { required: ["B.Ed"], preferred: ["M.Sc"] } },
          { name: "experience", weight: 0.3, config: { minYears: 5 } },
          { name: "certifications", weight: 0.2, config: { required: ["CTET"] } },
          { name: "subjectMatch", weight: 0.1, config: { subjects: ["Physics"] } },
        ],
        minimumScore: 60,
        autoRejectScore: 30,
        generatedBy: "manual" as const,
        version: 1,
      },
    });

    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.dimensionScores).toHaveLength(4);
    expect(result.recommendation).toBeDefined();
  });
});
```

Run: `bun test tests/convex/scoring.test.ts`
Expected: Fails.

- [ ] **Step 2: Implement scoring.ts**

Create `convex/scoring.ts`:

```typescript
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import OpenAI from "openai";

function getClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
}

interface ScoringRules {
  dimensions: Array<{ name: string; weight: number; config: any }>;
  minimumScore: number;
  autoRejectScore: number;
  generatedBy: "agent" | "manual" | "agent_reviewed";
  version: number;
}

interface CandidateProfile {
  qualifications: string[];
  certifications: string[];
  boardExperience: string[];
  subjects: string[];
  yearsExperience?: number;
}

function scoreDimension(name: string, config: any, candidate: CandidateProfile): number {
  switch (name) {
    case "qualifications": {
      const required = (config.required as string[]) ?? [];
      const preferred = (config.preferred as string[]) ?? [];
      if (required.length === 0) return 100;
      let score = 0;
      for (const q of required) {
        if (candidate.qualifications.some((cq) => cq.toLowerCase().includes(q.toLowerCase()))) {
          score += 50 / required.length;
        }
      }
      for (const p of preferred) {
        if (candidate.qualifications.some((cq) => cq.toLowerCase().includes(p.toLowerCase()))) {
          score += 50 / Math.max(preferred.length, 1);
        }
      }
      return Math.min(100, Math.round(score));
    }
    case "experience": {
      const minYears = (config.minYears as number) ?? 0;
      const idealYears = (config.idealYears as number) ?? minYears;
      const yrs = candidate.yearsExperience ?? 0;
      if (yrs < minYears) return 0;
      if (yrs >= idealYears) return 100;
      return Math.round(((yrs - minYears) / (idealYears - minYears)) * 100);
    }
    case "certifications": {
      const required = (config.required as string[]) ?? [];
      if (required.length === 0) return 100;
      let score = 0;
      for (const c of required) {
        if (candidate.certifications.some((cc) => cc.toLowerCase().includes(c.toLowerCase()))) {
          score += 100 / required.length;
        }
      }
      return Math.round(score);
    }
    case "subjectMatch": {
      const subjects = (config.subjects as string[]) ?? [];
      if (subjects.length === 0) return 100;
      let matches = 0;
      for (const s of subjects) {
        if (candidate.subjects.some((cs) => cs.toLowerCase().includes(s.toLowerCase()))) {
          matches++;
        }
      }
      return Math.round((matches / subjects.length) * 100);
    }
    case "location": {
      const preferLocal = config.preferLocal as boolean;
      return preferLocal && candidate.boardExperience.length > 0 ? 50 : 100;
    }
    default:
      return 100;
  }
}

function getRecommendation(totalScore: number, minimumScore: number, autoRejectScore: number): string {
  if (totalScore < autoRejectScore) return "skip";
  if (totalScore >= 85) return "strong";
  if (totalScore >= minimumScore) return "good";
  return "weak";
}

export const testScoreCandidate = action({
  args: {
    candidate: v.object({
      qualifications: v.array(v.string()),
      certifications: v.array(v.string()),
      boardExperience: v.array(v.string()),
      subjects: v.array(v.string()),
      yearsExperience: v.optional(v.number()),
    }),
    rules: v.any(),
  },
  handler: async (_ctx, args) => {
    const rules = args.rules as ScoringRules;
    const candidate = args.candidate;
    const dimensionScores = rules.dimensions.map((dim) => ({
      name: dim.name,
      score: scoreDimension(dim.name, dim.config, candidate),
      weight: dim.weight,
      reason: `${dim.name} match score`,
    }));

    const totalScore = dimensionScores.reduce((sum, d) => sum + (d.score * d.weight), 0);
    const recommendation = getRecommendation(totalScore, rules.minimumScore, rules.autoRejectScore);

    return { totalScore: Math.round(totalScore), dimensionScores, recommendation };
  },
});

const SCORING_RULES_SYSTEM = `You are an expert in Indian K-12 teacher recruitment. Generate structured scoring rules from natural language criteria.

Rules should include dimensions with weights (summing to 1.0) and configuration. Common dimensions:
- qualifications: required[], preferred[] arrays
- experience: minYears, idealYears numbers
- certifications: required[] array
- subjectMatch: subjects[] array
- location: preferLocal boolean

Return ONLY a JSON object (no markdown, no explanation):
{
  "dimensions": [{"name": "string", "weight": number, "config": {}}],
  "minimumScore": number,
  "autoRejectScore": number
}`;

export const generateScoringRules = internalAction({
  args: {
    jobId: v.id("jobPostings"),
    nlCriteria: v.string(),
  },
  handler: async (ctx, args) => {
    const client = getClient();
    if (!client) throw new Error("DEEPSEEK_API_KEY not configured");

    const response = await client.chat.completions.create({
      model: "deepseek-v4-flash",
      max_tokens: 1024,
      temperature: 0,
      messages: [
        { role: "system", content: SCORING_RULES_SYSTEM },
        { role: "user", content: args.nlCriteria },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in scoring rules response");
    const parsed = JSON.parse(jsonMatch[0]);

    const rules = {
      dimensions: parsed.dimensions ?? [],
      minimumScore: parsed.minimumScore ?? 60,
      autoRejectScore: parsed.autoRejectScore ?? 30,
      generatedBy: "agent" as const,
      version: 1,
    };

    await ctx.runMutation(internal.jobs.saveScoringRules as any, {
      jobId: args.jobId,
      scoringRules: rules,
    });

    return rules;
  },
});

export const suggestCriteria = internalAction({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args) => {
    const client = getClient();
    if (!client) throw new Error("DEEPSEEK_API_KEY not configured");

    const job = await ctx.runQuery(internal.sourcing.getJob as any, { jobId: args.jobId });
    if (!job) throw new Error("Job not found");

    const response = await client.chat.completions.create({
      model: "deepseek-v4-flash",
      max_tokens: 1024,
      temperature: 0,
      messages: [
        { role: "system", content: SCORING_RULES_SYSTEM },
        { role: "user", content: `Suggest scoring criteria for: ${job.title}, ${job.subject}, ${job.board} board, ${job.level} level. Required: ${job.qualifications.join(", ")}. Description: ${job.naturalLanguageDescription}` },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      dimensions: parsed.dimensions ?? [],
      minimumScore: parsed.minimumScore ?? 60,
      autoRejectScore: parsed.autoRejectScore ?? 30,
    };
  },
});
```

With `convex/sourcing.ts` getJob query exported, we use that for internal lookups. Actually, we need to import from a shared module. Let's use `internal.jobs.get` field — wait, `jobs.ts` has `get` as a public query but `parseJobWithAI` uses `api.jobs.get`. The `suggestCriteria` needs to use the `public` api path. Let me adjust:

Change `suggestCriteria` to use `internal.sourcing.getJob` — but sourcing.ts no longer has `getJob`. Need to inline it. Let me just use `api.jobs.get` cast as `any`:

In `suggestCriteria`:
```typescript
const job = await ctx.runQuery(internal.jobs.get as any, { jobId: args.jobId });
```

Wait, `internal.jobs.get` would work since `get` is just a query — it doesn't need to be internal. Actually the api path for non-internal functions from inside an internalAction is different. The correct approach is to cast as `any` since the circular type error is just a codegen issue — let me keep it simple.

- [ ] **Step 3: Run tests**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && bun test tests/convex/scoring.test.ts
```

---

### Task 7: Resend Email Integration (convex/resend.ts)

**Files:**
- Create: `convex/resend.ts`

- [ ] **Step 1: Implement resend.ts**

Create `convex/resend.ts`:

```typescript
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export const sendMagicLink = internalAction({
  args: {
    candidateName: v.string(),
    candidateEmail: v.optional(v.string()),
    candidatePhone: v.optional(v.string()),
    trackingToken: v.string(),
    schoolName: v.string(),
    jobTitle: v.optional(v.string()),
    whatsappEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/track/${args.trackingToken}`;
    const messageBody = args.jobTitle
      ? `Your application to ${args.schoolName} for ${args.jobTitle} has been received. Track your status: ${trackingUrl}`
      : `Your application to ${args.schoolName} has been received. Track your status: ${trackingUrl}`;

    if (args.whatsappEnabled && args.candidatePhone) {
      try {
        await ctx.runAction(internal.whatsapp.sendWhatsAppMessage as any, {
          applicationId: "" as any,
          candidateId: "" as any,
          body: messageBody,
        });
        return { channel: "whatsapp" as const, success: true };
      } catch {
        // fall through to email
      }
    }

    if (args.candidateEmail) {
      const resend = getResend();
      if (!resend) return { channel: "none" as const, success: false };

      await resend.emails.send({
        from: "RoleRecruit <noreply@rolerecruit.com>",
        to: args.candidateEmail,
        subject: args.jobTitle
          ? `Application Received — ${args.schoolName} — ${args.jobTitle}`
          : `Application Received — ${args.schoolName}`,
        text: messageBody,
      });

      return { channel: "email" as const, success: true };
    }

    return { channel: "none" as const, success: false };
  },
});
```

- [ ] **Step 2: Install resend package**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && bun add resend
```

---

### Task 8: Email Ingestion (convex/email_ingestion.ts)

**Files:**
- Create: `convex/email_ingestion.ts`

- [ ] **Step 1: Implement email ingestion**

Create `convex/email_ingestion.ts`:

```typescript
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const receiveEmail = httpAction(async (ctx, request) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const toAddress = body.to ?? "";
  const slug = toAddress.split("@")[0]?.trim() ?? "";
  if (!slug) {
    return new Response(JSON.stringify({ error: "No slug found" }), { status: 400 });
  }

  const school = await ctx.runQuery(internal.careers.getSchoolBySlugForIngestion as any, { slug });
  if (!school) {
    return new Response(JSON.stringify({ error: "School not found" }), { status: 404 });
  }

  const emailText = `${body.from ?? ""} - ${body.subject ?? ""}\n\n${body.text ?? body.html ?? ""}`;

  let parsed;
  try {
    parsed = await ctx.runAction(internal.ai.parseProfileFromText as any, { text: emailText.substring(0, 4000) });
  } catch {
    parsed = {
      name: null, email: null, phone: null, location: null,
      qualifications: [], certifications: [], boardExperience: [],
      subjects: [], yearsExperience: null, currentSchool: null,
    };
  }

  const candidateName = parsed.name ?? "Unknown Candidate";
  const candidateEmail = parsed.email ?? body.from ?? "";

  const candidateId = await ctx.runMutation(internal.candidates.create as any, {
    name: candidateName,
    phone: parsed.phone,
    email: candidateEmail,
    location: parsed.location,
    qualifications: parsed.qualifications ?? [],
    certifications: parsed.certifications ?? [],
    boardExperience: parsed.boardExperience ?? [],
    subjects: parsed.subjects ?? [],
    yearsExperience: parsed.yearsExperience,
    currentSchool: parsed.currentSchool,
    sourceChannel: "email_parsed",
  });

  const trackingToken = generateTrackingToken();

  await ctx.runMutation(internal.applications.create as any, {
    candidateId,
    jobPostingId: "" as any,
    schoolId: school._id,
  });

  return new Response(JSON.stringify({ success: true, candidateId }), { status: 200 });
});

function generateTrackingToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}
```

- [ ] **Step 2: Add internal careers query for ingestion**

Add to `convex/careers.ts`:

```typescript
export const getSchoolBySlugForIngestion = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("schools")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});
```

---

### Task 9: Job mutations - add saveScoringRules and update publish for reverse-matching

**Files:**
- Modify: `convex/jobs.ts`

- [ ] **Step 1: Add saveScoringRules and update publish**

Add to `convex/jobs.ts`:

```typescript
export const saveScoringRules = internalMutation({
  args: {
    jobId: v.id("jobPostings"),
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.jobId, {
      scoringRules: args.scoringRules,
    });
  },
});
```

Update the `publish` mutation to trigger reverse-matching (via scoring action):

TODO: The publish mutation doesn't directly call actions (it's a mutation), so we use a pattern where the frontend calls publish then separately calls reverseMatchJob.

Actually, let me add this as a separate task where the criteria page handles triggering reverse-matching after saving.

- [ ] **Step 2: Run tests**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && bun test
```

---

### Task 10: Middleware — Subdomain Routing

**Files:**
- Create: `app/middleware.ts`

- [ ] **Step 1: Implement middleware**

Create `app/middleware.ts`:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function extractSlug(host: string): string | null {
  const parts = host.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();
    if (subdomain !== "www" && subdomain !== "rolerecruit") {
      return subdomain;
    }
  }
  return null;
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const slug = extractSlug(host);

  if (slug && !request.nextUrl.pathname.startsWith("/careers")) {
    return NextResponse.rewrite(
      new URL(`/careers/${slug}${request.nextUrl.pathname}`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|_static|_vercel|favicon.ico|feedback|dashboard|onboarding|sign-in|sign-up).*)"],
};
```

- [ ] **Step 2: Run build to verify**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && bun --bun run build 2>&1 | grep -i "error\|fail"
```

---

### Task 11: Careers Portal UI — Layout + Job Listings

**Files:**
- Create: `app/careers/layout.tsx`
- Create: `app/careers/[slug]/page.tsx`
- Create: `components/careers/SchoolHeader.tsx`
- Create: `components/careers/JobListings.tsx`
- Create: `components/careers/JobCard.tsx`

- [ ] **Step 1: Create portal layout**

Create `app/careers/layout.tsx`:

```typescript
import { ConvexClientProvider } from "@/components/ConvexClientProvider";

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexClientProvider>
      <div className="min-h-screen bg-[#f5f5f7]">
        {children}
      </div>
    </ConvexClientProvider>
  );
}
```

- [ ] **Step 2: Create SchoolHeader component**

Create `components/careers/SchoolHeader.tsx`:

```typescript
interface Props {
  name: string;
  board: string;
  city: string;
}

export function SchoolHeader({ name, board, city }: Props) {
  return (
    <div className="bg-white border-b border-[#e8e8ed]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">{name}</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#f5f5f7] text-[#86868b] font-medium">{board}</span>
          <span className="text-sm text-[#86868b]">{city}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create JobCard component**

Create `components/careers/JobCard.tsx`:

```typescript
import Link from "next/link";

interface Props {
  jobId: string;
  title: string;
  subject: string;
  level: string;
  qualifications: string[];
  minExperience?: number;
  slug: string;
}

export function JobCard({ jobId, title, subject, level, qualifications, minExperience, slug }: Props) {
  return (
    <Link
      href={`/careers/${slug}/jobs/${jobId}`}
      className="block rounded-apple bg-white border border-[#e8e8ed] p-5 hover:shadow-md transition-shadow"
    >
      <h2 className="text-lg font-semibold text-[#1d1d1f]">{title}</h2>
      <div className="flex flex-wrap gap-2 mt-2">
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#f0f7ff] text-[#0071e3]">{subject}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b]">{level}</span>
      </div>
      <div className="mt-3 text-sm text-[#86868b]">
        <span>Qualifications: {qualifications.join(", ")}</span>
        {minExperience != null && <span className="ml-4">Exp: {minExperience}+ years</span>}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Create JobListings component**

Create `components/careers/JobListings.tsx`:

```typescript
"use client";

import { useState } from "react";
import { JobCard } from "./JobCard";

interface Job {
  _id: string;
  title: string;
  subject: string;
  level: string;
  qualifications: string[];
  minExperience?: number;
}

interface Props {
  jobs: Job[];
  slug: string;
}

export function JobListings({ jobs, slug }: Props) {
  const [search, setSearch] = useState("");

  const filtered = jobs.filter((job) =>
    !search ||
    job.title.toLowerCase().includes(search.toLowerCase()) ||
    job.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by title or subject..."
        className="w-full max-w-md px-4 py-2.5 rounded-apple bg-white border border-[#e8e8ed] text-sm text-[#1d1d1f] placeholder:text-[#aeaeb2] focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
      />
      {filtered.length === 0 ? (
        <p className="text-[#86868b] text-sm py-8 text-center">No open positions {search ? "matching your search" : "at this time"}.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((job) => (
            <JobCard key={job._id} jobId={job._id} slug={slug} {...job} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create job listings page**

Create `app/careers/[slug]/page.tsx`:

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { SchoolHeader } from "@/components/careers/SchoolHeader";
import { JobListings } from "@/components/careers/JobListings";
import Link from "next/link";

export default function CareersPage() {
  const { slug } = useParams<{ slug: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });
  const jobs = useQuery(api.careers.getOpenJobs, school ? { schoolId: school._id } : "skip");

  if (!school) return <div className="max-w-4xl mx-auto px-6 py-20 text-center"><p className="text-[#86868b]">School not found</p></div>;

  return (
    <div>
      <SchoolHeader name={school.name} board={school.board} city={school.city} />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[#1d1d1f]">Open Positions</h2>
        </div>
        <JobListings jobs={jobs ?? []} slug={slug} />
        <div className="mt-8 p-6 rounded-apple bg-white border border-[#e8e8ed] text-center">
          <p className="text-[#1d1d1f] font-medium mb-1">Don't see the right role?</p>
          <p className="text-sm text-[#86868b] mb-4">Submit a general application and we'll contact you when a matching position opens.</p>
          <Link
            href={`/careers/${slug}/apply`}
            className="inline-block py-2.5 px-5 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] transition-colors"
          >
            General Application
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 12: Job Detail + Apply Page

**Files:**
- Create: `app/careers/[slug]/jobs/[jobId]/page.tsx`
- Create: `components/careers/ApplicationForm.tsx`

- [ ] **Step 1: Create ApplicationForm component**

Create `components/careers/ApplicationForm.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

interface Props {
  schoolId: string;
  jobId?: string;
  slug: string;
}

export function ApplicationForm({ schoolId, jobId, slug }: Props) {
  const submitApplication = useAction(api.careers.submitApplication as any);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    qualifications: "",
    certifications: "",
    boardExperience: "",
    subjects: "",
    yearsExperience: "",
    currentSchool: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || (!form.phone && !form.email)) {
      setError("Please provide your name and either phone or email.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await submitApplication({
        schoolId,
        jobId: jobId ?? undefined,
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        qualifications: form.qualifications.split(",").map((s) => s.trim()).filter(Boolean),
        certifications: form.certifications.split(",").map((s) => s.trim()).filter(Boolean),
        boardExperience: form.boardExperience.split(",").map((s) => s.trim()).filter(Boolean),
        subjects: form.subjects.split(",").map((s) => s.trim()).filter(Boolean),
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : undefined,
        currentSchool: form.currentSchool || undefined,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-apple bg-white border border-[#e8e8ed] p-8 text-center">
        <div className="text-4xl mb-4">✓</div>
        <h3 className="text-lg font-semibold text-[#1d1d1f] mb-2">Application Submitted!</h3>
        <p className="text-sm text-[#86868b]">You'll receive a tracking link on your phone or email shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#1d1d1f] mb-1">Full Name *</label>
        <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-white border border-[#e8e8ed] text-sm" placeholder="Rajesh Kumar" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#1d1d1f] mb-1">Phone</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-white border border-[#e8e8ed] text-sm" placeholder="9876543210" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1d1d1f] mb-1">Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-white border border-[#e8e8ed] text-sm" placeholder="rajesh@email.com" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#1d1d1f] mb-1">Qualifications (comma-separated)</label>
        <input type="text" value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-white border border-[#e8e8ed] text-sm" placeholder="B.Ed, M.Sc Physics" />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#1d1d1f] mb-1">Certifications (comma-separated)</label>
        <input type="text" value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-white border border-[#e8e8ed] text-sm" placeholder="CTET, NET" />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#1d1d1f] mb-1">Subjects You Teach (comma-separated)</label>
        <input type="text" value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-white border border-[#e8e8ed] text-sm" placeholder="Physics, Mathematics" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#1d1d1f] mb-1">Years Experience</label>
          <input type="number" value={form.yearsExperience} onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-white border border-[#e8e8ed] text-sm" placeholder="5" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1d1d1f] mb-1">Current School</label>
          <input type="text" value={form.currentSchool} onChange={(e) => setForm({ ...form, currentSchool: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-white border border-[#e8e8ed] text-sm" placeholder="Delhi Public School" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#1d1d1f] mb-1">Board Experience (comma-separated)</label>
        <input type="text" value={form.boardExperience} onChange={(e) => setForm({ ...form, boardExperience: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-white border border-[#e8e8ed] text-sm" placeholder="CBSE, ICSE" />
      </div>

      {error && <div className="px-4 py-3 rounded-apple bg-[#fff2f0] text-sm text-[#ff3b30]">{error}</div>}

      <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] disabled:opacity-50 transition-colors">
        {submitting ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create job detail + apply page**

Create `app/careers/[slug]/jobs/[jobId]/page.tsx`:

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { SchoolHeader } from "@/components/careers/SchoolHeader";
import { ApplicationForm } from "@/components/careers/ApplicationForm";
import Link from "next/link";

export default function JobDetailPage() {
  const { slug, jobId } = useParams<{ slug: string; jobId: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });
  const job = useQuery(api.careers.getJob, jobId ? { jobId: jobId as any } : "skip");

  if (!school) return <div className="max-w-4xl mx-auto px-6 py-20"><p className="text-[#86868b]">School not found</p></div>;
  if (!job) return <div className="max-w-4xl mx-auto px-6 py-20"><p className="text-[#86868b]">Loading...</p></div>;

  return (
    <div>
      <SchoolHeader name={school.name} board={school.board} city={school.city} />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href={`/careers/${slug}`} className="text-sm text-[#0071e3] hover:underline mb-4 inline-block">← Back to all jobs</Link>
        <div className="rounded-apple bg-white border border-[#e8e8ed] p-6 mb-8">
          <h1 className="text-xl font-bold text-[#1d1d1f]">{job.title}</h1>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#f0f7ff] text-[#0071e3]">{job.subject}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b]">{job.level}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b]">{job.board}</span>
          </div>
          <div className="mt-4 text-sm text-[#1d1d1f] space-y-2">
            <p><span className="font-medium">Qualifications:</span> {job.qualifications?.join(", ")}</p>
            {job.minExperience != null && <p><span className="font-medium">Min Experience:</span> {job.minExperience} years</p>}
            {job.salaryRange && <p><span className="font-medium">Salary:</span> {job.salaryRange}</p>}
          </div>
          {job.naturalLanguageDescription && (
            <div className="mt-4 text-sm text-[#86868b] leading-relaxed">
              <p>{job.naturalLanguageDescription}</p>
            </div>
          )}
        </div>

        <div className="rounded-apple bg-white border border-[#e8e8ed] p-6">
          <h2 className="text-lg font-semibold text-[#1d1d1f] mb-4">Apply for this position</h2>
          <ApplicationForm schoolId={school._id} jobId={jobId} slug={slug} />
        </div>
      </div>
    </div>
  );
}
```

---

### Task 13: General Application Page

**Files:**
- Create: `app/careers/[slug]/apply/page.tsx`

- [ ] **Step 1: Create general application page**

Create `app/careers/[slug]/apply/page.tsx`:

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { SchoolHeader } from "@/components/careers/SchoolHeader";
import { ApplicationForm } from "@/components/careers/ApplicationForm";
import Link from "next/link";

export default function ApplyPage() {
  const { slug } = useParams<{ slug: string }>();
  const school = useQuery(api.careers.getSchoolBySlug, { slug });

  if (!school) return <div className="max-w-4xl mx-auto px-6 py-20"><p className="text-[#86868b]">School not found</p></div>;

  return (
    <div>
      <SchoolHeader name={school.name} board={school.board} city={school.city} />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href={`/careers/${slug}`} className="text-sm text-[#0071e3] hover:underline mb-4 inline-block">← Back to jobs</Link>
        <div className="rounded-apple bg-white border border-[#e8e8ed] p-6">
          <h2 className="text-lg font-semibold text-[#1d1d1f] mb-2">General Application</h2>
          <p className="text-sm text-[#86868b] mb-6">Submit your profile and we'll match you with future openings at {school.name}.</p>
          <ApplicationForm schoolId={school._id} slug={slug} />
        </div>
      </div>
    </div>
  );
}
```

---

### Task 14: Candidate Tracking Page

**Files:**
- Create: `app/track/[token]/page.tsx`
- Create: `components/tracking/ApplicationStatus.tsx`

- [ ] **Step 1: Create tracking components**

Create `components/tracking/ApplicationStatus.tsx`:

```typescript
interface Props {
  stage: string;
  jobTitle?: string;
  candidateName: string;
  schoolName: string;
}

const STAGE_LABELS: Record<string, string> = {
  sourced: "Application Received",
  screened: "Under Review",
  demo_scheduled: "Demo Lesson Scheduled",
  demo_completed: "Demo Completed",
  offer_sent: "Offer Sent",
  hired: "Hired",
  rejected: "Not Selected",
  on_hold: "On Hold",
};

export function ApplicationStatus({ stage, jobTitle, candidateName, schoolName }: Props) {
  const label = STAGE_LABELS[stage] ?? stage;

  return (
    <div className="max-w-lg mx-auto">
      <div className="rounded-apple bg-white border border-[#e8e8ed] p-8 text-center">
        <div className="text-4xl mb-4">📋</div>
        <h2 className="text-xl font-bold text-[#1d1d1f]">Hi {candidateName}</h2>
        <p className="text-sm text-[#86868b] mt-2">
          {jobTitle
            ? `Your application to ${schoolName} for ${jobTitle}`
            : `Your application to ${schoolName}`}
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f0f7ff] text-[#0071e3] text-sm font-medium">
          <span>{label}</span>
        </div>
        {stage === "demo_scheduled" && (
          <p className="text-sm text-[#86868b] mt-4">Your demo lesson has been scheduled. Check your messages for details.</p>
        )}
        {stage === "offer_sent" && (
          <p className="text-sm text-[#34c759] mt-4 font-medium">Congratulations! An offer letter has been sent.</p>
        )}
        {stage === "rejected" && (
          <p className="text-sm text-[#86868b] mt-4">The position has been filled. We encourage you to apply for other openings.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create tracking page**

Create `app/track/[token]/page.tsx`:

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { ApplicationStatus } from "@/components/tracking/ApplicationStatus";

export default function TrackPage() {
  const { token } = useParams<{ token: string }>();
  const app = useQuery(api.tracking.getByToken, token ? { token } : "skip");

  if (app === undefined) {
    return <div className="max-w-lg mx-auto px-6 py-20"><p className="text-[#86868b] text-center">Loading...</p></div>;
  }

  if (!app) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20">
        <div className="rounded-apple bg-white border border-[#e8e8ed] p-8 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-[#1d1d1f]">Application Not Found</h2>
          <p className="text-sm text-[#86868b] mt-2">This tracking link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] py-20 px-6">
      <ApplicationStatus
        stage={app.stage}
        jobTitle={app.job?.title}
        candidateName={app.candidate?.name ?? "Candidate"}
        schoolName={app.school?.name ?? ""}
      />
    </div>
  );
}
```

---

### Task 15: Agentic Criteria Editor (Dashboard)

**Files:**
- Create: `app/dashboard/jobs/[id]/criteria/page.tsx`
- Create: `components/criteria/ScoringRuleEditor.tsx`
- Create: `components/criteria/DimensionSlider.tsx`
- Create: `components/criteria/AISuggestedCriteria.tsx`

- [ ] **Step 1: Create DimensionSlider**

Create `components/criteria/DimensionSlider.tsx`:

```typescript
interface Props {
  name: string;
  weight: number;
  config: Record<string, any>;
  onWeightChange: (name: string, weight: number) => void;
  onRemove: (name: string) => void;
}

export function DimensionSlider({ name, weight, config, onWeightChange, onRemove }: Props) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-apple bg-[#f5f5f7]">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-[#1d1d1f]">{name}</span>
          <button onClick={() => onRemove(name)} className="text-xs text-[#ff3b30] hover:underline">Remove</button>
        </div>
        <pre className="text-xs text-[#aeaeb2] truncate">{JSON.stringify(config)}</pre>
      </div>
      <div className="w-32">
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(weight * 100)}
          onChange={(e) => onWeightChange(name, parseInt(e.target.value) / 100)}
          className="w-full"
        />
        <p className="text-xs text-center text-[#86868b]">{Math.round(weight * 100)}%</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AISuggestedCriteria**

Create `components/criteria/AISuggestedCriteria.tsx`:

```typescript
interface SuggestedDimension {
  name: string;
  weight: number;
  config: Record<string, any>;
}

interface Props {
  suggested: {
    dimensions: SuggestedDimension[];
    minimumScore: number;
    autoRejectScore: number;
  } | null;
  loading: boolean;
  onAccept: () => void;
  onGenerate: () => void;
}

export function AISuggestedCriteria({ suggested, loading, onAccept, onGenerate }: Props) {
  return (
    <div className="rounded-apple bg-white border border-[#e8e8ed] p-5 mb-6">
      <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3">AI Suggested Criteria</h3>
      {loading ? (
        <p className="text-sm text-[#86868b]">Generating suggestions...</p>
      ) : suggested ? (
        <>
          <div className="space-y-2 mb-4">
            {suggested.dimensions.map((d) => (
              <div key={d.name} className="flex justify-between text-sm">
                <span className="text-[#1d1d1f]">{d.name}</span>
                <span className="text-[#86868b]">{(d.weight * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onAccept} className="py-2 px-4 rounded-apple bg-[#0071e3] text-white text-xs font-medium hover:bg-[#0077ed]">Accept All</button>
            <button onClick={onGenerate} className="py-2 px-4 rounded-apple bg-[#f5f5f7] text-xs text-[#1d1d1f]">Regenerate</button>
          </div>
        </>
      ) : (
        <button onClick={onGenerate} className="py-2 px-4 rounded-apple bg-[#f0f7ff] text-[#0071e3] text-sm font-medium hover:bg-[#e8f0fe]">
          Generate AI Suggestions
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create ScoringRuleEditor**

Create `components/criteria/ScoringRuleEditor.tsx`:

```typescript
"use client";

import { useState } from "react";
import { DimensionSlider } from "./DimensionSlider";

interface Dimension {
  name: string;
  weight: number;
  config: Record<string, any>;
}

interface Props {
  initialDimensions?: Dimension[];
  onSave: (dimensions: Dimension[], minimumScore: number, autoRejectScore: number) => void;
  saving: boolean;
}

export function ScoringRuleEditor({ initialDimensions = [], onSave, saving }: Props) {
  const [dimensions, setDimensions] = useState<Dimension[]>(initialDimensions);
  const [minimumScore, setMinimumScore] = useState(60);
  const [autoRejectScore, setAutoRejectScore] = useState(30);

  const handleWeightChange = (name: string, newWeight: number) => {
    setDimensions((prev) =>
      prev.map((d) => (d.name === name ? { ...d, weight: newWeight } : d))
    );
  };

  const handleRemove = (name: string) => {
    setDimensions((prev) => prev.filter((d) => d.name !== name));
  };

  return (
    <div className="space-y-4">
      {dimensions.length === 0 ? (
        <p className="text-sm text-[#86868b] py-4 text-center">No criteria configured. Use AI suggestions to get started.</p>
      ) : (
        dimensions.map((d) => (
          <DimensionSlider key={d.name} {...d} onWeightChange={handleWeightChange} onRemove={handleRemove} />
        ))
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#1d1d1f] mb-1">Minimum Score</label>
          <input type="number" value={minimumScore} onChange={(e) => setMinimumScore(parseInt(e.target.value))} className="w-full px-4 py-2 rounded-apple bg-white border border-[#e8e8ed] text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1d1d1f] mb-1">Auto-Reject Below</label>
          <input type="number" value={autoRejectScore} onChange={(e) => setAutoRejectScore(parseInt(e.target.value))} className="w-full px-4 py-2 rounded-apple bg-white border border-[#e8e8ed] text-sm" />
        </div>
      </div>
      <button onClick={() => onSave(dimensions, minimumScore, autoRejectScore)} disabled={saving} className="py-2.5 px-5 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] disabled:opacity-50">
        {saving ? "Saving..." : "Save Criteria"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create criteria dashboard page**

Create `app/dashboard/jobs/[id]/criteria/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AISuggestedCriteria } from "@/components/criteria/AISuggestedCriteria";
import { ScoringRuleEditor } from "@/components/criteria/ScoringRuleEditor";

export default function CriteriaPage() {
  const { id } = useParams<{ id: string }>();
  const job = useQuery(api.jobs.get, { jobId: id as any });
  const [saving, setSaving] = useState(false);
  const [suggested, setSuggested] = useState<any>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const handleGenerateSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      // This would call the scoring action - placeholder for now
      setSuggested({
        dimensions: [
          { name: "qualifications", weight: 0.4, config: { required: job?.qualifications ?? [] } },
          { name: "experience", weight: 0.3, config: { minYears: job?.minExperience ?? 0 } },
          { name: "subjectMatch", weight: 0.2, config: { subjects: [job?.subject ?? ""] } },
          { name: "certifications", weight: 0.1, config: { required: [] } },
        ],
        minimumScore: 60,
        autoRejectScore: 30,
      });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAcceptSuggestions = () => {
    if (suggested) {
      // auto-fill editor with suggested dimensions
      setLoadingSuggestions(false);
    }
  };

  const handleSave = (dimensions: any[], minimumScore: number, autoRejectScore: number) => {
    // save scoring rules mutation
    setSaving(true);
    setTimeout(() => setSaving(false), 500);
  };

  if (!job) return <div className="p-8 text-[#86868b]">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] mb-2">Scoring Criteria</h1>
      <p className="text-sm text-[#86868b] mb-6">{job.title} — {job.subject} {job.level}</p>

      <AISuggestedCriteria
        suggested={suggested}
        loading={loadingSuggestions}
        onAccept={handleAcceptSuggestions}
        onGenerate={handleGenerateSuggestions}
      />

      <div className="rounded-apple bg-white border border-[#e8e8ed] p-5">
        <h3 className="text-sm font-semibold text-[#1d1d1f] mb-4">Current Rules</h3>
        <ScoringRuleEditor
          initialDimensions={suggested?.dimensions ?? []}
          onSave={handleSave}
          saving={saving}
        />
      </div>
    </div>
  );
}
```

---

### Task 16: Run Full Test Suite + Build

- [ ] **Step 1: Run codegen**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx convex codegen --typecheck=disable
```

- [ ] **Step 2: Run all tests**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && bun test
```

Expected: All existing + new tests pass.

- [ ] **Step 3: Production build**

```bash
cd /Users/sumanthdaggubati/Dev/Rolerecruit && bun --bun run build
```

Expected: Build succeeds with no errors.

---

### Task 17: Verify Against Spec

- [ ] **Database changes:** `schools.slug`, `schools.whatsappEnabled`, `jobPostings.scoringRules`, `applications.trackingToken`, `applications.scoringResult`, `applications` new stage `on_hold`, indexes for `by_slug`, `by_trackingToken`, `by_schoolId` on candidates.
- [ ] **Middleware:** Subdomain extraction + rewrite to `/careers/{slug}`.
- [ ] **Careers API:** `getSchoolBySlug`, `getOpenJobs`, `getJob`, `submitApplication` — all implemented and tested.
- [ ] **Scoring API:** `scoreCandidate`, `generateScoringRules`, `suggestCriteria` — implemented. Phase 1 and 2 logic in `scoring.ts`.
- [ ] **Tracking:** `getByToken` query with candidate + job + school info. Tracking page renders status.
- [ ] **Email ingestion:** `receiveEmail` HTTP action parses email body via DeepSeek, creates candidate.
- [ ] **Portal UI:** 3 pages (listings, job detail + apply, general application). SchoolHeader, JobListings, JobCard, ApplicationForm components.
- [ ] **Criteria dashboard:** Criteria editor page with AI suggestions UI.
- [ ] **DeepSeek migration:** All AI calls use DeepSeek V4 Flash via OpenAI SDK. `@anthropic-ai/sdk` removed.
- [ ] **Resend:** Magic link delivery (WhatsApp first, email fallback).
