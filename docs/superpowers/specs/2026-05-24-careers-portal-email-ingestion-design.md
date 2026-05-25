# Careers Portal + Email Ingestion — Design Spec

**Date:** 2026-05-24
**Status:** Approved

---

## Overview

Two features in one spec:
1. **School Careers Portal** — Public-facing job listings + application pages per school, served at custom subdomains (`jobs.harvest.edu`) with slug-based fallback (`rolerecruit.com/careers/harvest`).
2. **Email Ingestion** — Schools forward Naukri/Indeed/LinkedIn notification emails to RoleRecruit, which parses them and creates candidate records automatically.

Also covered: agentic scoring criteria for reverse-matching general applications to new jobs, candidate tracking via WhatsApp/email magic links.

---

## Database Changes

### `schools` — two new fields

| Field | Type | Notes |
|---|---|---|
| `slug` | `v.optional(v.string())` | Unique URL slug, school picks during onboarding. Indexed. |
| `whatsappEnabled` | `v.boolean()` | Whether school pays for WhatsApp messages. Default `false`. |

### `jobPostings` — one new field

| Field | Type | Notes |
|---|---|---|
| `scoringRules` | `v.optional(v.object({...}))` | Agentic scoring configuration (see Section 3 below). |

### `candidates` — one new index

```
.by_schoolId → on schoolId
```

### `applications` — two new fields, one new stage, two new indexes

| Field | Type | Notes |
|---|---|---|
| `trackingToken` | `v.optional(v.string())` | 32-char alphanumeric token for candidate tracking page. Index `.by_trackingToken`. |
| `scoringResult` | `v.optional(v.object({ totalScore: v.number(), dimensionScores: v.array(v.any()), recommendation: v.string() }))` | Cached scoring result when reverse-matched. |

New stage: `on_hold` — added to the stage union and VALID_TRANSITIONS. `sourced → on_hold`, `screened → on_hold`. HR puts candidates on hold when deferring a decision.

New indexes: `.by_trackingToken` (on `trackingToken`), `.by_schoolId_and_jobPostingId` (on `schoolId` + `jobPostingId` — for querying both matched and unmatched applications).

```
.by_schoolId → on schoolId
```

No new tables. General applications use existing `applications` table with `jobPostingId: null`. Reverse-matching queries filter on `schoolId` and `jobPostingId: null`.

---

## Section 1 — URL Routing & Middleware

Single Next.js deployment. Middleware reads `Host` header at every request:

```
Host: jobs.harvest.edu → slug = "harvest"
Host: careers.stxaviers.com → slug = "stxaviers"
Host: rolerecruit.com/careers/{slug} → slug from path
```

School lookup by slug using `getSchoolBySlug` (Convex query). Not found → 404.

**DNS setup per school:** School adds CNAME record pointing `jobs` to `careers.rolerecruit.com`. Slugs are unique, chosen by the school during onboarding. If no CNAME is set, the slug URL (`rolerecruit.com/careers/{slug}`) still works as fallback.

---

## Section 2 — Convex API

### New module: `convex/careers.ts`

| Function | Type | Auth | Purpose |
|---|---|---|---|
| `getSchoolBySlug(slug)` | Public query | None | Lookup school by slug |
| `getOpenJobs(schoolId)` | Public query | None | Active job postings for a school |
| `getJob(jobId)` | Public query | None | Single active job + parsed criteria |
| `submitApplication(schoolId, data, jobId?)` | Public mutation | None | Creates candidate + application |

### New module: `convex/scoring.ts`

| Function | Type | Purpose |
|---|---|---|
| `scoreCandidate(candidate, scoringRules)` | Shared utility | Scores candidate against rules, returns `{ totalScore, dimensionScores[], recommendation }` |
| `generateScoringRules(jobId, nlCriteria)` | Internal action | Phase 1: DeepSeek converts NL criteria → structured scoring rules |
| `suggestCriteria(jobId)` | Internal action | Phase 2: DeepSeek proposes criteria from job title/board/level |
| `tuneWeights(schoolId)` | Internal action | Phase 3: Analyzes hiring outcomes, suggests weight adjustments |
| `reverseMatchJob(jobId)` | Internal action | On job publish: matches unmatched candidates to new job |

### New module: `convex/email_ingestion.ts`

| Function | Type | Purpose |
|---|---|---|
| `receiveEmail` | HTTP action | Resend inbound webhook handler. Parses email body via DeepSeek, extracts candidate fields, creates candidate + application. Sets `sourceChannel: "email_parsed_{platform}"`. |

### New module: `convex/tracking.ts`

| Function | Type | Auth | Purpose |
|---|---|---|---|
| `getApplicationByToken(token)` | Public query | None | Returns application + candidate + job details for tracking page |
| `getSimilarJobs(candidateId, schoolId)` | Public query | None | Jobs matching candidate profile |

### New module: `convex/resend.ts`

| Function | Type | Purpose |
|---|---|---|
| `sendEmail(to, subject, body)` | Internal action | Sends transactional email via Resend |
| `sendMagicLink(candidate, application, school)` | Internal action | Sends tracking link, prefers WhatsApp if school has `whatsappEnabled: true` and candidate has phone, falls back to email |

### Modified: `convex/ai.ts`

Replace Anthropic Claude SDK with OpenAI SDK pointed at `https://api.deepseek.com`. Model: `deepseek-v4-flash`. Env var: `DEEPSEEK_API_KEY`.

New reusable function: `parseProfileFromText(rawText)` — shared by both careers portal (resume parsing) and email ingestion (email body parsing). Returns structured `{ name, email, phone, qualifications[], certifications[], subjects[], boardExperience[], yearsExperience, currentSchool }`.

Cost gating:
- Portal submissions: AI runs only when `qualifications.length === 0 || yearsExperience == null`
- Email ingestion: AI always runs (email bodies are unstructured)
- Cost per parse: ~$0.00036 (2,000 input + 300 output tokens on V4 Flash)

### Modified: `convex/applications.ts`

| Function | Type | Purpose |
|---|---|---|
| `getUnmatchedForSchool(schoolId)` | Public query | Applications with `jobPostingId: null` for reverse-matching |
| `suggestMatchesForJob(jobId)` | Internal query | Candidates matched by `reverseMatchJob` with scores above threshold |

---

## Section 3 — Agentic Scoring Criteria

### `scoringRules` schema (on `jobPostings`)

```typescript
{
  dimensions: Array<{
    name: string,           // "qualifications", "experience", "subjectMatch", "certifications", "location"
    weight: number,         // 0.0 - 1.0, all dimensions sum to 1.0
    config: object          // dimension-specific configuration
  }>,
  minimumScore: number,     // threshold for auto-recommend (0-100), default 60
  autoRejectScore: number,  // skip candidates below this (0-100), default 30
  generatedBy: "agent" | "manual" | "agent_reviewed",
  version: number
}
```

### Phase 1: NL → Rules (implemented now)

HR writes criteria in natural language (e.g., "Need B.Ed and CTET certified, 5+ years in CBSE, Physics + Math preferred"). DeepSeek converts it to structured `scoringRules` via a system prompt enforcing the JSON schema. HR sees a visual UI with dimension cards and weight sliders. HR can edit, reorder, add/remove dimensions before saving.

UI component: `ScoringRuleEditor` — shows generated dimensions as cards with sliders, add/remove buttons, and a "regenerate" button.

### Phase 2: Agent Proposes (implemented now)

When HR navigates to the criteria tab for a new job, DeepSeek pre-fills suggestions based on:
- Job title (PGT Physics → M.Sc + B.Ed)
- School board (CBSE → CTET preference)
- Level (PGT → 5+ years experience)
- School's past scoring rules for similar jobs

HR can accept all, reject all, or modify per dimension.

UI component: `AISuggestedCriteria` — shows pre-filled dimension cards with "Accept All" / "Customize" buttons.

### Phase 3: Outcome Tuning (implemented now)

After a hire, the agent compares the hired candidate's profile against rejected candidates for the same job. If patterns emerge (e.g., hired candidates consistently had CTET, rejected ones didn't), the agent bumps relevant dimension weights and notifies HR: "Based on 12 hires, CTET certification correlates with strong demo performance. Increase weight from 0.10 → 0.15? [Accept] [Ignore]." Requires at least 5 hires with completed demo feedback before making suggestions.

Runs nightly as a scheduled Convex cron action.

### Scoring Engine (`scoreCandidate`)

Pure utility function — no AI involved:
1. Iterates each dimension in `scoringRules.dimensions`
2. Computes a dimension score (0-100) based on match logic (exact match for qualifications, threshold-based for experience, intersection-based for subjects, etc.)
3. Multiplies by weight, sums to total score (0-100)
4. Returns `{ totalScore, dimensionScores: [{ name, score, weight, reason }], recommendation: "strong" | "good" | "weak" | "skip" }`

### Reverse-Matching on Job Publish

When HR publishes a job:
1. If `scoringRules` is not set, Phase 2 agent runs automatically to suggest criteria, then proceeds with scoring
2. Fetch all candidate applications with `jobPostingId: null` for this school
3. Filter out candidates with any application in "rejected" or "on_hold" status
4. Score each candidate against the new job's `scoringRules` via `scoreCandidate`
5. Candidates scoring below `autoRejectScore` (default 30) are silently skipped
6. Candidates scoring above `minimumScore` (default 60) are shown as "Suggested Matches" on job detail page — ranked in descending score order
7. Candidates between `autoRejectScore` and `minimumScore` are stored but not shown by default (HR can toggle "show all scored")
8. HR clicks "Move to Pipeline" to create a real application linking the candidate to this job

---

## Section 4 — Portal UI Pages

Separate layout from internal dashboard — no sidebar, no auth, full-width public design.

### Job Listings (`/careers/[slug]` or subdomain root)

- School name + board badge + city at top (SchoolHeader component)
- Search bar with subject/keyword filter
- Job cards: title, subject, level, experience range, qualifications, board
- "Apply" button per card → job detail
- Prominent "General Application" CTA banner below job list

### Job Detail + Apply (`/careers/[slug]/jobs/[jobId]`)

- Full JD display: title, subject, board, level, qualifications, experience range, salary range, natural language description
- Application form: name, phone (10-digit validation), email, qualifications (multi-select tags), certifications, subjects, board experience, years experience, current school, resume upload (PDF/DOCX)
- Validation: requires at least (name + phone) OR (name + email)
- Submit → redirect to confirmation page with "Application received" message

### General Application (`/careers/[slug]/apply`)

- Same form as above, no job attached
- Candidate selects subjects they're interested in teaching
- Application stored with `jobPostingId: null` — reverse-matched on new job publish

---

## Section 5 — Candidate Tracking

### Magic Link Delivery

After application submission, `sendMagicLink` determines channel:
- School has `whatsappEnabled: true` AND candidate has phone → send WhatsApp via Gupshup with tracking URL
- Otherwise → send email via Resend with tracking URL

Tracking URL format: `rolerecruit.com/track/{32-char-alphanumeric-token}`

The tracking token is generated during `submitApplication` — a random 32-char string stored on the application's `trackingToken` field. Token generation uses `crypto.randomBytes(32).toString("base64url")`. Uniqueness is enforced by the index and retry-on-collision.

### Tracking Page (`/track/[token]`)

- No auth required — token-based access
- Shows: application status (current pipeline stage), job details (if specific job), evaluation feedback summary (once demo is complete), "similar openings" section for general applicants (jobs matching their profile)
- CTA: "Apply to this opening" for suggested similar jobs

### WhatsApp Fallback

If Gupshup send fails for any reason, silently fall back to email without showing an error to the candidate. The application is still valid — tracking link delivery is best-effort.

---

## Section 6 — Email Ingestion

### Setup per School

School creates a forwarding rule in their email provider (Gmail/Zoho):
- All Naukri/Indeed/LinkedIn notification emails → forward to `{slug}@inbound.rolerecruit.com`

### Receive Email (`receiveEmail` HTTP action)

Resend inbound webhook → Convex HTTP action:

1. Parse the `To` address to extract slug
2. Look up school by slug
3. Parse email body for candidate details using DeepSeek V4 (same `parseProfileFromText` as resume parsing)
4. Create candidate record with `sourceChannel: "email_parsed_{platform}"` (platform detected from sender domain or email content)
5. Create application linked to the candidate + school
6. Store raw email body + profile link for HR reference
7. Return 200 OK

### Limitations

- No CV download — HR must manually download resumes from Naukri/Indeed dashboards
- Email parsing extracts whatever data the notification email contains (varies by platform)
- LinkedIn: "Apply Externally" button pointed at careers portal for primary application; email parsing is fallback only

---

## Section 7 — File Structure

```
New routes:
  app/careers/[slug]/page.tsx                   → Job listings
  app/careers/[slug]/jobs/[jobId]/page.tsx       → Job detail + apply
  app/careers/[slug]/apply/page.tsx              → General application
  app/careers/layout.tsx                         → Public portal layout (ConvexProvider, no auth)
  app/track/[token]/page.tsx                     → Candidate tracking

Dashboard routes (new/modified):
  app/dashboard/jobs/[id]/criteria/page.tsx      → Agentic criteria editor

New Convex modules:
  convex/careers.ts
  convex/scoring.ts
  convex/email_ingestion.ts
  convex/tracking.ts
  convex/resend.ts

Modified Convex modules:
  convex/schema.ts
  convex/ai.ts
  convex/applications.ts

New components:
  components/careers/SchoolHeader.tsx
  components/careers/JobListings.tsx
  components/careers/JobCard.tsx
  components/careers/ApplicationForm.tsx
  components/criteria/ScoringRuleEditor.tsx
  components/criteria/DimensionSlider.tsx
  components/criteria/AISuggestedCriteria.tsx
  components/tracking/ApplicationStatus.tsx
  components/dashboard/SuggestedMatches.tsx

New env vars:
  DEEPSEEK_API_KEY
  RESEND_API_KEY

Modified env vars (existing, unchanged):
  GUPSHUP_API_KEY
  GUPSHUP_APP_NAME
  GUPSHUP_SOURCE_NUMBER
```

---

## Section 8 — Pricing Summary

| Component | Cost |
|---|---|
| DeepSeek V4 Flash (resume/email parse) | $0.00036 per parse |
| DeepSeek V4 Flash (scoring rules generation) | $0.00036 per criteria generation |
| DeepSeek V4 Flash (reverse-matching per candidate) | ~$0.00010 per candidate scored |
| Resend inbound email | $10/mo for 100 schools (wildcard catch-all) |
| Resend outbound (tracking emails) | Free tier: 100/day |
| Gupshup WhatsApp (tracking links) | ~₹0.20/message |

**Monthly estimate for 1 school, 50 applications, 3 jobs:** < $1.00

---

## Section 9 — Future: Chrome Extension (not in this spec)

A separate spec covers the Chrome extension for one-click candidate import from Naukri/Indeed/LinkedIn profile pages. This extension detects when HR is on a candidate profile, scrapes visible data, and sends it to the RoleRecruit API. Documented here as a dependency but scoped separately.

---

## Implementation Phases (in this spec)

1. **Schema + DeepSeek migration** — Add new fields, indexes, replace Claude with DeepSeek, add `parseProfileFromText`
2. **Careers API** — `convex/careers.ts`, `convex/tracking.ts`, `convex/resend.ts`
3. **Careers portal UI** — Public pages, application form, tracking page
4. **Agentic scoring** — `convex/scoring.ts`, criteria editor UI, reverse-matching on job publish
5. **Email ingestion** — `convex/email_ingestion.ts`, Resend inbound setup
6. **Integration + testing** — Wire subdomain middleware, integration tests, verify end-to-end
