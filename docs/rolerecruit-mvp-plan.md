# RoleRecruit MVP Implementation Plan

## Stack Decisions

| Component | PRD Choice | Decision | Rationale |
|-----------|-----------|----------|-----------|
| Frontend | Next.js 14+ App Router | **Keep** | RSC, SSR for dashboard. Solid choice |
| Backend/DB | Convex | **Keep** | Real-time sync for pipeline board, scheduled functions for agents, avoids Supabase India block |
| Auth | Clerk | **Keep** | Multi-tenant RBAC, org-level permissions |
| AI | Claude API | **Keep** | Core differentiator |
| WhatsApp | Gupshup/Wati | **Keep** | Indian WhatsApp Business API provider |
| Scraping | Apify | **Keep** | Handles rate limiting, proxy rotation |
| Agent Orchestration | Inngest/Trigger.dev | **Defer to v1.1** | Convex scheduled functions + Apify webhooks handle MVP agent workflows. Add Inngest when agent pipelines get complex (multi-step with retries) |
| Mobile | Expo/RN | **Defer to v1.1** | PRD itself puts mobile in v1.1. Web dashboard is sufficient for MVP |
| Payments | Razorpay/Stripe | **Defer to post-MVP** | MVP is free tier + private beta. No payment integration needed |
| Analytics | PostHog | **Defer** | Add when there are users to analyze |
| Error Tracking | Sentry | **Keep** | Low setup cost, high value from day one |
| Testing | (none specified) | **Add Vitest + Playwright** | Per taste: TDD required. Vitest for unit/integration, Playwright for E2E |

## Implementation Phases

### Phase 0: Project Scaffolding
**Goal**: Bootable Next.js + Convex + Clerk app with testing infrastructure.

Files to create:
- `package.json` (Next.js 14+, TypeScript, Tailwind, Convex, Clerk, Vitest, Playwright)
- `convex/schema.ts` (all data models from PRD Appendix 12)
- `convex/auth.config.ts` (Clerk issuer configuration)
- `middleware.ts` (Clerk middleware for route protection)
- `app/layout.tsx`, `app/page.tsx` (shell layout with auth gating)
- `vitest.config.ts`, `playwright.config.ts`
- `.env.local.example` (all required env vars documented)

**DDL first**: Write Convex schema tests before schema implementation.

### Phase 1: Auth & School Onboarding
**Goal**: Users can sign up, create/join a school, and see role-gated navigation.

Key files:
- `convex/schools.ts` (mutations: createSchool, queries: getSchool)
- `convex/users.ts` (mutations: setUserRole, queries: getUserProfile)
- `app/(dashboard)/layout.tsx` (authenticated layout with school context)
- `app/(dashboard)/onboarding/page.tsx` (school creation/join flow)
- `components/auth/role-gate.tsx` (role-based component visibility)

**TDD flow**:
1. Test: `schools.test.ts` — can create school, duplicate name rejected
2. Test: `users.test.ts` — user role assignment, role-based query filtering
3. Implement Convex mutations/queries
4. Test: `onboarding.spec.ts` — Playwright E2E for full signup+onboarding flow
5. Implement UI

### Phase 2: Natural Language Job Intake (P0)
**Goal**: HR describes a role in plain language, Claude parses it into structured job criteria, HR reviews and publishes.

Key files:
- `convex/jobs.ts` (mutations: createJob, parseJobWithAI, publishJob; queries: listJobs, getJob)
- `convex/ai.ts` (shared Claude API wrapper — single responsibility: call Claude, return parsed response)
- `app/(dashboard)/jobs/new/page.tsx` (job creation form)
- `app/(dashboard)/jobs/[id]/page.tsx` (job detail/review page)
- `components/jobs/job-intake-form.tsx` (NL input + parsed criteria editor)

**Claude prompt strategy**: Structured output with strict JSON schema. Prompt includes Indian education taxonomy (board types, PRT/TGT/PGT levels, B.Ed/CTET/D.El.Ed qualifications). If Claude returns invalid JSON, surface parsing error with raw output for debugging.

**TDD flow**:
1. Test: `ai.test.ts` — mock Claude response, verify parsed output matches expected structure
2. Test: `jobs.test.ts` — job creation, AI parsing mutation, status transitions
3. Implement `convex/ai.ts`, then `convex/jobs.ts`
4. Test: `job-intake-form.test.tsx` — form renders, submits, shows parsed criteria
5. Implement UI

### Phase 3: Candidate Pipeline Board (P0)
**Goal**: Kanban board showing candidates across pipeline stages. Drag-and-drop stage transitions.

Key files:
- `convex/applications.ts` (mutations: createApplication, moveStage; queries: getPipelineForJob)
- `convex/candidates.ts` (mutations: createCandidate, queries: getCandidate)
- `app/(dashboard)/jobs/[id]/pipeline/page.tsx` (pipeline board page)
- `components/pipeline/kanban-board.tsx` (drag-and-drop columns)
- `components/pipeline/candidate-card.tsx` (candidate info + match score)

**Design**: Use `@hello-pangea/dnd` (maintained fork of react-beautiful-dnd) for drag-and-drop. Convex real-time subscriptions keep the board synced across stakeholders. Each column is a Convex query filtered by `stage`. Moving a card triggers `moveStage` mutation which invalidates both source and destination column queries.

**Stages**: `sourced` → `screened` → `demo_scheduled` → `demo_completed` → `offer_sent` → `hired` | `rejected` (exit at any stage)

**TDD flow**:
1. Test: `applications.test.ts` — stage transitions, invalid transitions rejected, real-time subscriptions
2. Test: `candidates.test.ts` — candidate creation with qualifications
3. Test: `pipeline.spec.ts` — Playwright E2E: drag candidate between columns, verify stage updated
4. Implement Convex layer, then UI
5. Test: `kanban-board.test.tsx` — renders columns, handles drag-and-drop

### Phase 4: Credential-Aware Sourcing Agent (P0)
**Goal**: AI agent scrapes job portals, scores candidates against job criteria, returns ranked list for HR review.

Key files:
- `convex/sourcing.ts` (mutation: startSourcingRun; internal action: processSourcingResults)
- `convex/ai.ts` (add `scoreCandidate` function — Claude scores one candidate against job criteria)
- `app/(dashboard)/jobs/[id]/sourcing/page.tsx` (sourcing results review page)
- `components/sourcing/candidate-review-list.tsx` (ranked candidates with accept/reject)

**Architecture**:
1. HR clicks "Source Candidates" → Convex mutation `startSourcingRun`
2. Mutation calls Apify actor to scrape Naukri/Indeed with job criteria
3. Apify runs async (5-15 min), returns results via webhook to Convex HTTP action
4. Convex HTTP action receives scraped profiles, queues them for Claude scoring
5. For each candidate: Claude scores against job criteria (0-100), extracts structured profile
6. Results stored in `candidates` + `applications` tables with `stage: "sourced"`
7. HR reviews ranked list, accepts/rejects candidates into pipeline

**Apify integration**: Use Apify's REST API (not SDK) — start actor run, poll/webhook for completion. Store Apify run ID on the sourcing run for debugging.

**TDD flow**:
1. Test: `sourcing.test.ts` — sourcing run lifecycle (created → running → complete), webhook parsing
2. Test: `ai.test.ts` — `scoreCandidate` returns expected score structure, handles missing fields
3. Implement `convex/sourcing.ts` webhook handler, then Claude scoring
4. Test: `candidate-review-list.test.tsx` — renders scored candidates, accept/reject actions
5. Implement UI

### Phase 5: WhatsApp Outreach & Demo Scheduling (P0)
**Goal**: One-click WhatsApp outreach with personalized messages. Schedule demo lessons with auto-generated details.

Key files:
- `convex/outreach.ts` (mutations: sendWhatsApp, scheduleDemo; queries: getMessageHistory)
- `convex/whatsapp.ts` (Gupshup API wrapper — single responsibility: send template message)
- `app/(dashboard)/jobs/[id]/pipeline/outreach/page.tsx` (outreach panel on candidate)
- `components/outreach/message-composer.tsx` (preview + edit + send)
- `components/outreach/demo-scheduler.tsx` (date, topic, class level, evaluators picker)

**WhatsApp flow**: Use Gupshup's template messaging API. MVP uses pre-approved template messages (required by WhatsApp Business API). Templates include:
- "Your application for [role] at [school] has been shortlisted"
- "Demo lesson scheduled: [date], [time], Topic: [topic], Class: [class]"
- "Demo lesson feedback requested: [candidate name] for [role]"

**TDD flow**:
1. Test: `whatsapp.test.ts` — mock Gupshup API, verify message template formatting
2. Test: `outreach.test.ts` — message send, demo scheduling mutation, message history query
3. Implement `convex/whatsapp.ts`, then `convex/outreach.ts`
4. Test: `message-composer.test.tsx` — renders template, allows edit, shows send status
5. Test: `demo-scheduler.test.tsx` — date picker, evaluator selection, submit
6. Implement UI

### Phase 6: Demo Lesson Feedback Forms (P0)
**Goal**: Evaluators receive WhatsApp link to structured feedback form. Responses appear on candidate card.

Key files:
- `convex/evaluations.ts` (mutations: createEvaluation, submitFeedback; queries: getEvaluationsForApplication)
- `app/feedback/[token]/page.tsx` (public feedback form, no auth required — secured by unique token)
- `components/feedback/feedback-form.tsx` (5-point ratings + comments + recommendation)
- `components/pipeline/evaluation-summary.tsx` (aggregated ratings on candidate card)

**Design**: Each evaluation gets a unique cryptographically random token. The WhatsApp message includes `https://rolerecruit.app/feedback/[token]`. Form is publicly accessible (no auth) but single-use. After submission, token is invalidated.

**Rating dimensions**: Subject Knowledge (1-5), Classroom Management (1-5), Communication (1-5), Overall Fit (1-5), Recommendation (hire/maybe/reject).

**TDD flow**:
1. Test: `evaluations.test.ts` — create evaluation with token, submit feedback, single-use enforcement, query evaluations by application
2. Test: `feedback-form.test.tsx` — renders all rating dimensions, validates required fields, submit flow
3. Implement Convex layer, then form UI
4. Test: `feedback.spec.ts` — Playwright E2E: open feedback link, fill form, submit, verify appears on pipeline
5. Wire up to WhatsApp outreach (from Phase 5)

### Phase 7: Role Dashboard (P0)
**Goal**: Overview of all open positions with pipeline counts, time-to-fill, status indicators. Principal-accessible.

Key files:
- `convex/dashboard.ts` (queries: getDashboardStats, getRoleMetrics)
- `app/(dashboard)/page.tsx` (dashboard home, redirect for principal vs HR)
- `components/dashboard/role-cards.tsx` (grid of open positions with counts)
- `components/dashboard/stats-bar.tsx` (aggregate metrics)

**Metrics displayed**: Open positions count, total candidates in pipeline, average time-to-fill, candidates hired this month, stage breakdown per role.

**TDD flow**:
1. Test: `dashboard.test.ts` — aggregate queries return correct counts, time-to-fill calculation
2. Implement queries
3. Test: `role-cards.test.tsx` — renders job cards with pipeline counts
4. Test: `dashboard.spec.ts` — Playwright E2E: HR sees all roles, principal sees limited view
5. Implement UI

### Phase 8: Integration & Polish
**Goal**: End-to-end flows work, error states handled, responsive design.

- E2E test: Complete hiring flow — create job → source candidates → review → add to pipeline → send WhatsApp → schedule demo → collect feedback → move to offer → hire
- Error boundaries on all pages
- Loading skeletons for slow queries (sourcing, AI parsing)
- Responsive: pipeline board works on tablet (HR coordinators sometimes work from tablets)
- Empty states for new schools with no jobs/candidates
- Claude error handling: rate limits, malformed responses, timeouts

## Directory Structure

```
rolerecruit/
├── app/
│   ├── layout.tsx                  # Root layout (Clerk provider)
│   ├── page.tsx                    # Landing/marketing (public)
│   ├── (auth)/                     # Clerk auth pages (sign-in, sign-up)
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Authenticated layout (sidebar, school context)
│   │   ├── page.tsx                # Dashboard home
│   │   ├── onboarding/
│   │   │   └── page.tsx            # School creation/join
│   │   └── jobs/
│   │       ├── page.tsx            # All jobs list
│   │       ├── new/
│   │       │   └── page.tsx        # Job intake form
│   │       └── [id]/
│   │           ├── page.tsx        # Job detail
│   │           ├── pipeline/
│   │           │   └── page.tsx    # Pipeline board
│   │           └── outreach/
│   │               └── page.tsx    # WhatsApp outreach panel
│   └── feedback/
│       └── [token]/
│           └── page.tsx            # Public feedback form
├── components/
│   ├── ui/                         # shadcn/ui primitives (button, card, input, etc.)
│   ├── auth/
│   │   └── role-gate.tsx           # Role-based visibility
│   ├── jobs/
│   │   └── job-intake-form.tsx
│   ├── pipeline/
│   │   ├── kanban-board.tsx
│   │   ├── candidate-card.tsx
│   │   └── evaluation-summary.tsx
│   ├── sourcing/
│   │   └── candidate-review-list.tsx
│   ├── outreach/
│   │   ├── message-composer.tsx
│   │   └── demo-scheduler.tsx
│   ├── feedback/
│   │   └── feedback-form.tsx
│   └── dashboard/
│       ├── role-cards.tsx
│       └── stats-bar.tsx
├── convex/
│   ├── schema.ts                   # All data models
│   ├── auth.config.ts              # Clerk integration
│   ├── schools.ts                  # School CRUD
│   ├── users.ts                    # User profiles + roles
│   ├── jobs.ts                     # Job postings + AI parsing
│   ├── candidates.ts               # Candidate profiles
│   ├── applications.ts             # Pipeline stages
│   ├── evaluations.ts              # Feedback forms
│   ├── sourcing.ts                 # Sourcing agent + Apify webhook
│   ├── outreach.ts                 # WhatsApp messages + demo scheduling
│   ├── whatsapp.ts                 # Gupshup API wrapper
│   ├── dashboard.ts                # Aggregate queries
│   └── ai.ts                       # Claude API wrapper (parse job, score candidate, summarize feedback)
├── tests/
│   ├── convex/                     # Convex unit tests (mirrors convex/ structure)
│   │   ├── schools.test.ts
│   │   ├── users.test.ts
│   │   ├── jobs.test.ts
│   │   ├── candidates.test.ts
│   │   ├── applications.test.ts
│   │   ├── evaluations.test.ts
│   │   ├── sourcing.test.ts
│   │   ├── outreach.test.ts
│   │   ├── whatsapp.test.ts
│   │   ├── dashboard.test.ts
│   │   └── ai.test.ts
│   ├── components/                 # React component tests
│   │   ├── job-intake-form.test.tsx
│   │   ├── kanban-board.test.tsx
│   │   ├── candidate-review-list.test.tsx
│   │   ├── message-composer.test.tsx
│   │   ├── demo-scheduler.test.tsx
│   │   ├── feedback-form.test.tsx
│   │   ├── role-cards.test.tsx
│   │   └── stats-bar.test.tsx
│   └── e2e/
│       ├── onboarding.spec.ts
│       ├── pipeline.spec.ts
│       ├── feedback.spec.ts
│       └── dashboard.spec.ts
├── lib/
│   ├── constants.ts                # Board types, qualification enums, stage definitions
│   └── utils.ts                    # Date formatting, token generation, etc.
├── public/                         # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── convex.config.ts
└── .env.local.example
```

## Verification

After each phase, verify:

1. **Phase 0**: `bun dev` boots without errors, Convex dev deployment connects, Clerk auth redirects work
2. **Phase 1**: Can sign up → create school → see role-gated dashboard. Tests pass.
3. **Phase 2**: Can create job with NL input → Claude parses → review and publish. Agent accuracy >60% (PRD target).
4. **Phase 3**: Pipeline board shows sourced candidates, drag-and-drop moves stages, real-time sync works across two browser tabs.
5. **Phase 4**: Click "Source" → Apify runs → candidates appear with scores after ~5-15 min. HR can accept/reject.
6. **Phase 5**: WhatsApp messages send (use Gupshup sandbox), demo scheduling creates evaluation tokens.
7. **Phase 6**: Open feedback link → submit ratings → data appears on candidate card. Token single-use enforced.
8. **Phase 7**: Dashboard shows correct counts for all roles. Principal sees school-wide view.
9. **Phase 8**: Full E2E test passes. All error states handled. Responsive on tablet viewport.

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Apify scraping blocked by Naukri/Indeed | Start with Naukri RSS feed + Indeed API before scraping. Fallback: manual CSV upload. |
| Gupshup WhatsApp template approval takes weeks | Pre-submit templates early. Use WhatsApp Web QR-based automation as fallback for beta. |
| Claude API costs spike with many candidates | Batch scoring calls, cache similar candidate profiles, set monthly API spend limits. |
| Convex cold starts or rate limits | Monitor Convex dashboard. MVP scale (tens of schools) is well within free tier. |
| Clerk org management complexity for school trusts | MVP only needs single-school. Defer multi-tenant (trust) to v1.1. |
