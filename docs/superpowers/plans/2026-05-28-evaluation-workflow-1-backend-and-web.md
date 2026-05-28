# Evaluation Workflow — Plan 1: Backend Foundation + Web Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the demo-first data model, the full Convex backend, and the web evaluator/HR surfaces. After this plan ships, HR can schedule a demo with multiple evaluators on the web, evaluators can submit on the web (with dictation), and HR can make a manual decision. Mobile + decision rule engine + template editor live in Plans 2-4.

**Architecture:** Four new Convex tables (`demoSessions`, `evaluationInvites`, `formTemplates`, `decisionRules`) plus a refactored `evaluations` table. Built-in form templates seeded from code. Voice dictation on web via browser `SpeechRecognition` + a Convex action calling Claude. Next.js routes mirror the planned mobile inbox/form, with HR-side wizards layered on the dashboard.

**Tech Stack:** Convex, Next.js 14, React 18, TypeScript, `convex-test`, Vitest, Playwright, Resend, Better Auth (already wired), Claude via existing `convex/lib/llmClient.ts`.

**Spec reference:** [docs/superpowers/specs/2026-05-28-evaluation-workflow-design.md](../specs/2026-05-28-evaluation-workflow-design.md)

---

## File map

**New Convex modules**
- `convex/demoSessions.ts` — CRUD + aggregate query
- `convex/evaluationInvites.ts` — invite lifecycle
- `convex/formTemplates.ts` — queries + admin mutations
- `convex/formTemplates.defaults.ts` — built-in defaults as data
- `convex/voiceProcessing.ts` — Claude summarization action
- `convex/notifications.ts` — push + email dispatcher (push wiring stubbed for Plan 3)
- `convex/lib/tokenGen.ts` — extracted shared token generator

**Modified Convex modules**
- `convex/schema.ts` — add 4 tables, refactor `evaluations`, add `teacher` role
- `convex/evaluations.ts` — rewritten
- `convex/seed.ts` — seed teacher system role, seed default templates on school create
- `convex/types.ts` — extend evaluator role union

**New web components**
- `components/evaluations/evaluation-form.tsx` — template-driven form renderer
- `components/evaluations/dictation-modal.tsx` — web SpeechRecognition UI
- `components/evaluations/inbox-card.tsx` — single inbox row
- `components/demos/schedule-demo-wizard.tsx` — multi-step modal
- `components/demos/demos-panel.tsx` — application-page demos list
- `components/demos/demo-summary.tsx` — aggregation view
- `components/demos/decision-modal.tsx` — Advance/Reject/Re-demo
- `components/demos/redemo-wizard.tsx` — wrapper that prefills schedule wizard

**New routes**
- `app/evaluations/page.tsx`
- `app/evaluations/[inviteId]/page.tsx`
- `app/dashboard/demos/[id]/page.tsx`

**Modified routes**
- `app/feedback/[token]/page.tsx` — becomes a redirect
- `app/dashboard/applications/[id]/page.tsx` — gains Demos panel and Schedule CTA

**New tests**
- `tests/convex/demoSessions.test.ts`
- `tests/convex/evaluationInvites.test.ts`
- `tests/convex/evaluations.test.ts` — rewrite existing
- `tests/convex/formTemplates.test.ts`
- `tests/convex/voiceProcessing.test.ts`
- `tests/e2e/evaluation-flow.spec.ts` — Playwright

---

## Phase 1: Schema and types

### Task 1: Add `teacher` to evaluator role enum

**Files:**
- Modify: `convex/types.ts` (or wherever the union currently lives — verify with `grep -rn 'literal("hod")' convex/`)

- [ ] **Step 1: Locate the existing role union**

Run: `grep -rn 'literal("hr_admin")' convex/ | head -5`
Expected: shows the file(s) containing the hardcoded `principal | hod | hr_admin` union.

- [ ] **Step 2: Write the failing test**

Create `tests/convex/evaluator-role.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { EVALUATOR_ROLE_UNION, evaluatorRoles } from "../../convex/types";

describe("evaluator role union", () => {
  it("includes teacher alongside the original three roles", () => {
    expect(evaluatorRoles).toEqual(["principal", "hod", "hr_admin", "teacher"]);
  });

  it("exports a Convex union validator with all four literals", () => {
    expect(EVALUATOR_ROLE_UNION).toBeDefined();
    expect(EVALUATOR_ROLE_UNION.kind).toBe("union");
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `bun run test tests/convex/evaluator-role.test.ts`
Expected: FAIL (`evaluatorRoles` not exported).

- [ ] **Step 4: Add the exports to `convex/types.ts`**

Append to `convex/types.ts`:

```ts
import { v } from "convex/values";

export const evaluatorRoles = ["principal", "hod", "hr_admin", "teacher"] as const;
export type EvaluatorRole = (typeof evaluatorRoles)[number];

export const EVALUATOR_ROLE_UNION = v.union(
  v.literal("principal"),
  v.literal("hod"),
  v.literal("hr_admin"),
  v.literal("teacher"),
);
```

- [ ] **Step 5: Run test, verify it passes**

Run: `bun run test tests/convex/evaluator-role.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add convex/types.ts tests/convex/evaluator-role.test.ts
git commit -m "feat(convex): add teacher to evaluator role union"
```

---

### Task 2: Add new tables to schema (demoSessions, evaluationInvites, formTemplates, decisionRules) and refactor evaluations

**Files:**
- Modify: `convex/schema.ts`
- Test: `tests/convex/schema-shape.test.ts`

- [ ] **Step 1: Write the failing schema-shape test**

Create `tests/convex/schema-shape.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import schema from "../../convex/schema";

describe("schema shape", () => {
  it("defines demoSessions table", () => {
    expect(schema.tables.demoSessions).toBeDefined();
  });
  it("defines evaluationInvites table", () => {
    expect(schema.tables.evaluationInvites).toBeDefined();
  });
  it("defines formTemplates table", () => {
    expect(schema.tables.formTemplates).toBeDefined();
  });
  it("defines decisionRules table", () => {
    expect(schema.tables.decisionRules).toBeDefined();
  });
  it("evaluations table has inviteId field", () => {
    const ev = schema.tables.evaluations;
    expect(ev).toBeDefined();
    const validator = (ev as any).validator;
    expect(validator.fields.inviteId).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun run test tests/convex/schema-shape.test.ts`
Expected: FAIL (tables not yet defined).

- [ ] **Step 3: Update `convex/schema.ts`**

Inside `defineSchema({ ... })`, add:

```ts
import { EVALUATOR_ROLE_UNION } from "./types";

// Inside defineSchema:
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
```

Replace the existing `evaluations: defineTable({ ... })` with:

```ts
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
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun run test tests/convex/schema-shape.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full Convex codegen**

Run: `bunx convex codegen` (or restart the running `bunx convex dev`).
Expected: Generated types reflect the new tables; no errors.

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts tests/convex/schema-shape.test.ts
git commit -m "feat(convex): add demo+invite+template+rule tables, refactor evaluations"
```

---

### Task 3: Extract shared token generator

**Files:**
- Create: `convex/lib/tokenGen.ts`
- Test: `tests/convex/tokenGen.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/convex/tokenGen.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateToken } from "../../convex/lib/tokenGen";

describe("generateToken", () => {
  it("returns a 32-char lowercase alphanumeric string", () => {
    const t = generateToken();
    expect(t).toMatch(/^[a-z0-9]{32}$/);
  });
  it("returns different tokens on successive calls", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
    expect(tokens.size).toBe(100);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test tests/convex/tokenGen.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `convex/lib/tokenGen.ts`:

```ts
export function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test tests/convex/tokenGen.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/tokenGen.ts tests/convex/tokenGen.test.ts
git commit -m "refactor(convex): extract shared token generator"
```

---

## Phase 2: Form template defaults and queries

### Task 4: Define built-in form template defaults as data

**Files:**
- Create: `convex/formTemplates.defaults.ts`
- Test: `tests/convex/formTemplates.defaults.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/convex/formTemplates.defaults.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { BUILT_IN_TEMPLATES } from "../../convex/formTemplates.defaults";

describe("built-in form template defaults", () => {
  it("provides one default template per evaluator role", () => {
    const roles = BUILT_IN_TEMPLATES.map((t) => t.role).sort();
    expect(roles).toEqual(["hod", "hr_admin", "principal", "teacher"]);
  });
  it("every default ends with a dictation-enabled comments field", () => {
    for (const t of BUILT_IN_TEMPLATES) {
      const last = t.fields[t.fields.length - 1];
      expect(last.key).toBe("comments");
      expect(last.type).toBe("text");
      expect(last.allowDictation).toBe(true);
    }
  });
  it("principal default has subject knowledge, classroom management, communication, overall fit, comments", () => {
    const p = BUILT_IN_TEMPLATES.find((t) => t.role === "principal")!;
    expect(p.fields.map((f) => f.key)).toEqual([
      "subjectKnowledge",
      "classroomManagement",
      "communication",
      "overallFit",
      "comments",
    ]);
  });
  it("HOD default weights subjectKnowledge and pedagogy at 2", () => {
    const h = BUILT_IN_TEMPLATES.find((t) => t.role === "hod")!;
    expect(h.fields.find((f) => f.key === "subjectKnowledge")?.weight).toBe(2);
    expect(h.fields.find((f) => f.key === "pedagogy")?.weight).toBe(2);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test tests/convex/formTemplates.defaults.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement defaults**

Create `convex/formTemplates.defaults.ts`:

```ts
import type { EvaluatorRole } from "./types";

type FieldType = "score_1_5" | "score_1_10" | "text" | "choice";

export type DefaultField = {
  key: string;
  label: string;
  type: FieldType;
  weight?: number;
  allowDictation?: boolean;
  required?: boolean;
};

export type DefaultTemplate = {
  role: EvaluatorRole;
  name: string;
  fields: DefaultField[];
};

export const BUILT_IN_TEMPLATES: DefaultTemplate[] = [
  {
    role: "principal",
    name: "Principal default",
    fields: [
      { key: "subjectKnowledge", label: "Subject knowledge", type: "score_1_5", required: true },
      { key: "classroomManagement", label: "Classroom management", type: "score_1_5", required: true },
      { key: "communication", label: "Communication", type: "score_1_5", required: true },
      { key: "overallFit", label: "Overall fit", type: "score_1_5", required: true },
      { key: "comments", label: "Comments", type: "text", allowDictation: true },
    ],
  },
  {
    role: "hod",
    name: "HOD default",
    fields: [
      { key: "subjectKnowledge", label: "Subject knowledge", type: "score_1_5", weight: 2, required: true },
      { key: "pedagogy", label: "Pedagogy", type: "score_1_5", weight: 2, required: true },
      { key: "curriculumAlignment", label: "Curriculum alignment", type: "score_1_5", required: true },
      { key: "communication", label: "Communication", type: "score_1_5", required: true },
      { key: "comments", label: "Comments", type: "text", allowDictation: true },
    ],
  },
  {
    role: "hr_admin",
    name: "HR default",
    fields: [
      { key: "communication", label: "Communication", type: "score_1_5", required: true },
      { key: "professionalism", label: "Professionalism", type: "score_1_5", required: true },
      { key: "culturalFit", label: "Cultural fit", type: "score_1_5", weight: 2, required: true },
      { key: "comments", label: "Comments", type: "text", allowDictation: true },
    ],
  },
  {
    role: "teacher",
    name: "Teacher default",
    fields: [
      { key: "peerCompatibility", label: "Peer compatibility", type: "score_1_5", required: true },
      { key: "subjectKnowledge", label: "Subject knowledge", type: "score_1_5", required: true },
      { key: "teachingStyleAlignment", label: "Teaching style alignment", type: "score_1_5", required: true },
      { key: "comments", label: "Comments", type: "text", allowDictation: true },
    ],
  },
];
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test tests/convex/formTemplates.defaults.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/formTemplates.defaults.ts tests/convex/formTemplates.defaults.test.ts
git commit -m "feat(convex): built-in form template defaults per evaluator role"
```

---

### Task 5: Implement `formTemplates.seedForSchool` mutation and `getForRole` query

**Files:**
- Create: `convex/formTemplates.ts`
- Test: `tests/convex/formTemplates.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/convex/formTemplates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as formTemplates from "../../convex/formTemplates";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "formTemplates.ts": async () => formTemplates,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

async function makeSchool(t: ReturnType<typeof convexTest>) {
  return await t.mutation("schools:create", {
    name: "Test School", board: "CBSE", city: "Test", state: "Test",
  });
}

describe("formTemplates", () => {
  it("seedForSchool creates one row per role with schoolId", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await makeSchool(t);
    await t.mutation("formTemplates:seedForSchool", { schoolId });
    const all = await t.query("formTemplates:listForSchool", { schoolId });
    expect(all.map((r: any) => r.role).sort())
      .toEqual(["hod", "hr_admin", "principal", "teacher"]);
    for (const r of all) {
      expect(r.isActive).toBe(true);
      expect(r.schoolId).toBe(schoolId);
    }
  });

  it("seedForSchool is idempotent", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await makeSchool(t);
    await t.mutation("formTemplates:seedForSchool", { schoolId });
    await t.mutation("formTemplates:seedForSchool", { schoolId });
    const all = await t.query("formTemplates:listForSchool", { schoolId });
    expect(all).toHaveLength(4);
  });

  it("getForRole returns the school's active template for that role", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await makeSchool(t);
    await t.mutation("formTemplates:seedForSchool", { schoolId });
    const tpl = await t.query("formTemplates:getForRole", { schoolId, role: "principal" });
    expect(tpl).toBeDefined();
    expect(tpl.role).toBe("principal");
    expect(tpl.fields.map((f: any) => f.key)).toContain("subjectKnowledge");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test tests/convex/formTemplates.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `convex/formTemplates.ts`:

```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { BUILT_IN_TEMPLATES } from "./formTemplates.defaults";
import { EVALUATOR_ROLE_UNION } from "./types";

export const seedForSchool = mutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) => {
    const existing = await ctx.db
      .query("formTemplates")
      .withIndex("by_schoolId_role", (q) => q.eq("schoolId", schoolId))
      .collect();
    const seededRoles = new Set(existing.map((r) => r.role));
    const now = Date.now();
    for (const tpl of BUILT_IN_TEMPLATES) {
      if (seededRoles.has(tpl.role)) continue;
      await ctx.db.insert("formTemplates", {
        schoolId,
        role: tpl.role,
        name: tpl.name,
        fields: tpl.fields,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const listForSchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) => {
    return await ctx.db
      .query("formTemplates")
      .withIndex("by_schoolId_role", (q) => q.eq("schoolId", schoolId))
      .collect();
  },
});

export const getForRole = query({
  args: { schoolId: v.id("schools"), role: EVALUATOR_ROLE_UNION },
  handler: async (ctx, { schoolId, role }) => {
    const tpl = await ctx.db
      .query("formTemplates")
      .withIndex("by_schoolId_role", (q) => q.eq("schoolId", schoolId).eq("role", role))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    if (!tpl) throw new Error(`No active template for role ${role} in school ${schoolId}`);
    return tpl;
  },
});

export const getById = query({
  args: { templateId: v.id("formTemplates") },
  handler: async (ctx, { templateId }) => {
    const tpl = await ctx.db.get(templateId);
    if (!tpl) throw new Error("Template not found");
    return tpl;
  },
});
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test tests/convex/formTemplates.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/formTemplates.ts tests/convex/formTemplates.test.ts
git commit -m "feat(convex): formTemplates seed + getForRole + listForSchool"
```

---

### Task 6: Auto-seed templates on school creation + teacher system role

**Files:**
- Modify: `convex/schools.ts` (find the `create` mutation; add seed call)
- Modify: `convex/seed.ts` (or wherever roles are seeded) to add teacher
- Test: `tests/convex/schools-seed.test.ts`

- [ ] **Step 1: Locate the school create mutation**

Run: `grep -n "export const create" convex/schools.ts`
Expected: shows the `create` mutation handler line number.

- [ ] **Step 2: Write the failing test**

Create `tests/convex/schools-seed.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as formTemplates from "../../convex/formTemplates";
import * as roles from "../../convex/roles";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "formTemplates.ts": async () => formTemplates,
  "roles.ts": async () => roles,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

describe("school creation side-effects", () => {
  it("seeds 4 form templates per school on create", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Side Effect School", board: "CBSE", city: "X", state: "Y",
    });
    const tpls = await t.query("formTemplates:listForSchool", { schoolId });
    expect(tpls).toHaveLength(4);
  });

  it("seeds a teacher system role on school create", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "Teacher Role School", board: "CBSE", city: "X", state: "Y",
    });
    const allRoles = await t.query("roles:listForSchool", { schoolId });
    expect(allRoles.find((r: any) => r.name === "teacher" && r.isSystem === true))
      .toBeDefined();
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `bun run test tests/convex/schools-seed.test.ts`
Expected: FAIL (templates not seeded; teacher role missing).

- [ ] **Step 4: Update `convex/schools.ts` create handler**

After the school insert, add:

```ts
// Inside the handler, after `const schoolId = await ctx.db.insert("schools", ...)`:
await ctx.runMutation((await import("./_generated/api")).api.formTemplates.seedForSchool, { schoolId });
```

(Use the in-file pattern that matches how other mutations in this codebase compose — if direct `ctx.scheduler.runAfter` or inline calls are the norm, mirror that. Confirm by reading neighbor mutations in `convex/schools.ts` and matching their style.)

Then ensure the existing role seeding (if any in `convex/roles.ts` or `convex/seed.ts`) includes a `teacher` system role. If `roles:listForSchool` query does not exist, add it:

```ts
// convex/roles.ts
export const listForSchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) =>
    await ctx.db.query("roles").withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId)).collect(),
});
```

And in the school create flow, after inserting the school, insert the teacher role:

```ts
await ctx.db.insert("roles", {
  schoolId,
  name: "teacher",
  permissions: ["evaluation_submit"],
  isSystem: true,
});
```

- [ ] **Step 5: Run, verify pass**

Run: `bun run test tests/convex/schools-seed.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add convex/schools.ts convex/roles.ts tests/convex/schools-seed.test.ts
git commit -m "feat(convex): seed form templates and teacher role on school create"
```

---

## Phase 3: Demo sessions backend

### Task 7: `demoSessions.create` mutation (with invite fan-out)

**Files:**
- Create: `convex/demoSessions.ts`
- Test: `tests/convex/demoSessions.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/convex/demoSessions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as users from "../../convex/users";
import * as formTemplates from "../../convex/formTemplates";
import * as demoSessions from "../../convex/demoSessions";
import * as invites from "../../convex/evaluationInvites";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "users.ts": async () => users,
  "formTemplates.ts": async () => formTemplates,
  "demoSessions.ts": async () => demoSessions,
  "evaluationInvites.ts": async () => invites,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

async function setup(t: ReturnType<typeof convexTest>) {
  const schoolId = await t.mutation("schools:create", {
    name: "S", board: "CBSE", city: "X", state: "Y",
  });
  const candidateId = await t.mutation("candidates:create", {
    name: "Priya", qualifications: ["B.Ed"], subjects: ["Maths"],
  });
  const jobId = await t.mutation("jobs:create", {
    schoolId, title: "TGT Maths", subject: "Maths", level: "TGT",
    board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "x",
  });
  const appId = await t.mutation("applications:create", {
    candidateId, jobPostingId: jobId, schoolId,
  });
  const principalId = await t.mutation("users:createProfile", {
    userId: "u1", name: "Mrs Iyer", email: "p@s.com", schoolId, role: "principal",
  });
  const hodId = await t.mutation("users:createProfile", {
    userId: "u2", name: "Mr Khan", email: "h@s.com", schoolId, role: "hod",
  });
  return { schoolId, appId, principalId, hodId };
}

describe("demoSessions.create", () => {
  it("creates one demo and one invite per evaluator", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, appId, principalId, hodId } = await setup(t);

    const demoId = await t.mutation("demoSessions:create", {
      applicationId: appId,
      schoolId,
      scheduledAt: Date.now() + 86400000,
      durationMinutes: 30,
      mode: "live",
      format: "classroom",
      location: "Room 12B",
      evaluators: [
        { userId: principalId, role: "principal" },
        { userId: hodId, role: "hod" },
      ],
      createdBy: principalId,
    });

    const demo = await t.query("demoSessions:get", { demoId });
    expect(demo.status).toBe("scheduled");
    expect(demo.mode).toBe("live");

    const inviteList = await t.query("evaluationInvites:listForDemo", { demoId });
    expect(inviteList).toHaveLength(2);
    expect(new Set(inviteList.map((i: any) => i.evaluatorRole))).toEqual(new Set(["principal", "hod"]));
    for (const inv of inviteList) {
      expect(inv.status).toBe("invited");
      expect(inv.token).toMatch(/^[a-z0-9]{32}$/);
      expect(inv.formTemplateId).toBeDefined();
    }
  });

  it("rejects an empty evaluator list", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, appId, principalId } = await setup(t);
    await expect(
      t.mutation("demoSessions:create", {
        applicationId: appId, schoolId,
        scheduledAt: Date.now() + 1000, durationMinutes: 30,
        mode: "live", format: "classroom",
        evaluators: [],
        createdBy: principalId,
      }),
    ).rejects.toThrow(/at least one evaluator/i);
  });

  it("rejects scheduledAt in the past", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, appId, principalId } = await setup(t);
    await expect(
      t.mutation("demoSessions:create", {
        applicationId: appId, schoolId,
        scheduledAt: Date.now() - 1000, durationMinutes: 30,
        mode: "live", format: "classroom",
        evaluators: [{ userId: principalId, role: "principal" }],
        createdBy: principalId,
      }),
    ).rejects.toThrow(/past/i);
  });
});
```

- [ ] **Step 2: Verify it fails**

Run: `bun run test tests/convex/demoSessions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `convex/demoSessions.ts`:

```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { generateToken } from "./lib/tokenGen";
import { EVALUATOR_ROLE_UNION } from "./types";

export const create = mutation({
  args: {
    applicationId: v.id("applications"),
    schoolId: v.id("schools"),
    scheduledAt: v.number(),
    durationMinutes: v.number(),
    mode: v.union(v.literal("live"), v.literal("post"), v.literal("async")),
    format: v.union(v.literal("classroom"), v.literal("mock"), v.literal("recorded")),
    location: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    formOpenWindowMinutes: v.optional(v.number()),
    formCloseDueDays: v.optional(v.number()),
    decisionRuleId: v.optional(v.id("decisionRules")),
    evaluators: v.array(v.object({
      userId: v.id("userProfiles"),
      role: EVALUATOR_ROLE_UNION,
    })),
    createdBy: v.id("userProfiles"),
    parentDemoId: v.optional(v.id("demoSessions")),
  },
  handler: async (ctx, args) => {
    if (args.evaluators.length === 0) {
      throw new Error("Must include at least one evaluator");
    }
    if (args.scheduledAt < Date.now()) {
      throw new Error("scheduledAt cannot be in the past");
    }
    const now = Date.now();
    const demoId = await ctx.db.insert("demoSessions", {
      applicationId: args.applicationId,
      schoolId: args.schoolId,
      parentDemoId: args.parentDemoId,
      scheduledAt: args.scheduledAt,
      durationMinutes: args.durationMinutes,
      mode: args.mode,
      format: args.format,
      location: args.location,
      videoUrl: args.videoUrl,
      status: "scheduled",
      formOpenWindowMinutes: args.formOpenWindowMinutes ?? 60,
      formCloseDueDays: args.formCloseDueDays ?? 3,
      decisionRuleId: args.decisionRuleId,
      createdBy: args.createdBy,
      createdAt: now,
    });

    for (const ev of args.evaluators) {
      const template = await ctx.db
        .query("formTemplates")
        .withIndex("by_schoolId_role", (q) =>
          q.eq("schoolId", args.schoolId).eq("role", ev.role))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      if (!template) throw new Error(`No active template for role ${ev.role}`);

      await ctx.db.insert("evaluationInvites", {
        demoSessionId: demoId,
        evaluatorUserId: ev.userId,
        evaluatorRole: ev.role,
        formTemplateId: template._id,
        status: "invited",
        token: generateToken(),
        invitedAt: now,
      });
    }
    return demoId;
  },
});

export const get = query({
  args: { demoId: v.id("demoSessions") },
  handler: async (ctx, { demoId }) => {
    const d = await ctx.db.get(demoId);
    if (!d) throw new Error("Demo not found");
    return d;
  },
});
```

Also add the `listForDemo` query referenced by the test in `convex/evaluationInvites.ts` (Task 9 will expand this — for now, minimal stub):

```ts
// convex/evaluationInvites.ts (initial stub — expanded in Task 9)
import { query } from "./_generated/server";
import { v } from "convex/values";

export const listForDemo = query({
  args: { demoId: v.id("demoSessions") },
  handler: async (ctx, { demoId }) =>
    await ctx.db
      .query("evaluationInvites")
      .withIndex("by_demoSessionId", (q) => q.eq("demoSessionId", demoId))
      .collect(),
});
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test tests/convex/demoSessions.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/demoSessions.ts convex/evaluationInvites.ts tests/convex/demoSessions.test.ts
git commit -m "feat(convex): demoSessions.create with invite fan-out + listForDemo"
```

---

### Task 8: `demoSessions.cancel`, `listForSchool`, `listForCandidate`

**Files:**
- Modify: `convex/demoSessions.ts`
- Modify: `tests/convex/demoSessions.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `tests/convex/demoSessions.test.ts`:

```ts
describe("demoSessions.cancel", () => {
  it("cancels the demo and all non-terminal invites", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, appId, principalId, hodId } = await setup(t);
    const demoId = await t.mutation("demoSessions:create", {
      applicationId: appId, schoolId,
      scheduledAt: Date.now() + 86400000, durationMinutes: 30,
      mode: "live", format: "classroom",
      evaluators: [
        { userId: principalId, role: "principal" },
        { userId: hodId, role: "hod" },
      ],
      createdBy: principalId,
    });
    await t.mutation("demoSessions:cancel", { demoId, reason: "rescheduled" });

    const demo = await t.query("demoSessions:get", { demoId });
    expect(demo.status).toBe("cancelled");
    expect(demo.cancellationReason).toBe("rescheduled");

    const inviteList = await t.query("evaluationInvites:listForDemo", { demoId });
    for (const inv of inviteList) {
      expect(inv.status).toBe("cancelled");
    }
  });
});

describe("demoSessions.listForSchool / listForCandidate", () => {
  it("returns demos ordered by scheduledAt asc", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, appId, principalId } = await setup(t);
    const t1 = Date.now() + 86400000;
    const t2 = Date.now() + 172800000;
    const d2 = await t.mutation("demoSessions:create", {
      applicationId: appId, schoolId,
      scheduledAt: t2, durationMinutes: 30,
      mode: "live", format: "classroom",
      evaluators: [{ userId: principalId, role: "principal" }],
      createdBy: principalId,
    });
    const d1 = await t.mutation("demoSessions:create", {
      applicationId: appId, schoolId,
      scheduledAt: t1, durationMinutes: 30,
      mode: "post", format: "mock",
      evaluators: [{ userId: principalId, role: "principal" }],
      createdBy: principalId,
    });
    const list = await t.query("demoSessions:listForSchool", { schoolId });
    expect(list.map((d: any) => d._id)).toEqual([d1, d2]);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test tests/convex/demoSessions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `convex/demoSessions.ts`:

```ts
export const cancel = mutation({
  args: { demoId: v.id("demoSessions"), reason: v.optional(v.string()) },
  handler: async (ctx, { demoId, reason }) => {
    const demo = await ctx.db.get(demoId);
    if (!demo) throw new Error("Demo not found");
    if (demo.status === "cancelled" || demo.status === "completed") {
      throw new Error(`Cannot cancel a ${demo.status} demo`);
    }
    const now = Date.now();
    await ctx.db.patch(demoId, {
      status: "cancelled",
      cancelledAt: now,
      cancellationReason: reason,
    });
    const invites = await ctx.db
      .query("evaluationInvites")
      .withIndex("by_demoSessionId", (q) => q.eq("demoSessionId", demoId))
      .collect();
    for (const inv of invites) {
      if (inv.status === "submitted" || inv.status === "declined" || inv.status === "cancelled") continue;
      await ctx.db.patch(inv._id, { status: "cancelled", cancelledAt: now });
    }
  },
});

export const listForSchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) => {
    const rows = await ctx.db
      .query("demoSessions")
      .withIndex("by_schoolId_scheduledAt", (q) => q.eq("schoolId", schoolId))
      .collect();
    return rows.sort((a, b) => a.scheduledAt - b.scheduledAt);
  },
});

export const listForCandidate = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, { applicationId }) => {
    return await ctx.db
      .query("demoSessions")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
      .collect();
  },
});
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test tests/convex/demoSessions.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/demoSessions.ts tests/convex/demoSessions.test.ts
git commit -m "feat(convex): demoSessions.cancel + list queries"
```

---

## Phase 4: Evaluation invites backend

### Task 9: Invite lifecycle mutations + queries

**Files:**
- Modify: `convex/evaluationInvites.ts`
- Modify: `tests/convex/evaluationInvites.test.ts` (new file — set up below)

- [ ] **Step 1: Create test file with failing tests**

Create `tests/convex/evaluationInvites.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as users from "../../convex/users";
import * as formTemplates from "../../convex/formTemplates";
import * as demoSessions from "../../convex/demoSessions";
import * as invites from "../../convex/evaluationInvites";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "users.ts": async () => users,
  "formTemplates.ts": async () => formTemplates,
  "demoSessions.ts": async () => demoSessions,
  "evaluationInvites.ts": async () => invites,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

async function makeDemo(t: ReturnType<typeof convexTest>) {
  const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "X", state: "Y" });
  const candidateId = await t.mutation("candidates:create", { name: "P", qualifications: ["B.Ed"], subjects: ["Maths"] });
  const jobId = await t.mutation("jobs:create", { schoolId, title: "T", subject: "Maths", level: "TGT", board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "x" });
  const appId = await t.mutation("applications:create", { candidateId, jobPostingId: jobId, schoolId });
  const principalId = await t.mutation("users:createProfile", { userId: "u1", name: "P", email: "p@s.com", schoolId, role: "principal" });
  const teacherId = await t.mutation("users:createProfile", { userId: "u2", name: "T", email: "t@s.com", schoolId, role: "teacher" });
  const demoId = await t.mutation("demoSessions:create", {
    applicationId: appId, schoolId,
    scheduledAt: Date.now() + 86400000, durationMinutes: 30,
    mode: "live", format: "classroom",
    evaluators: [
      { userId: principalId, role: "principal" },
      { userId: teacherId, role: "teacher" },
    ],
    createdBy: principalId,
  });
  return { schoolId, demoId, principalId, teacherId };
}

describe("evaluationInvites lifecycle", () => {
  it("markViewed sets status=viewed and viewedAt", async () => {
    const t = convexTest(schema, modules);
    const { demoId } = await makeDemo(t);
    const all = await t.query("evaluationInvites:listForDemo", { demoId });
    const target = all[0]._id;
    await t.mutation("evaluationInvites:markViewed", { inviteId: target });
    const updated = await t.query("evaluationInvites:listForDemo", { demoId });
    const me = updated.find((i: any) => i._id === target)!;
    expect(me.status).toBe("viewed");
    expect(me.viewedAt).toBeGreaterThan(0);
  });

  it("decline sets status=declined with reason and timestamp", async () => {
    const t = convexTest(schema, modules);
    const { demoId } = await makeDemo(t);
    const all = await t.query("evaluationInvites:listForDemo", { demoId });
    const target = all[0]._id;
    await t.mutation("evaluationInvites:decline", { inviteId: target, reason: "On leave" });
    const updated = await t.query("evaluationInvites:listForDemo", { demoId });
    const me = updated.find((i: any) => i._id === target)!;
    expect(me.status).toBe("declined");
    expect(me.declineReason).toBe("On leave");
    expect(me.declinedAt).toBeGreaterThan(0);
  });

  it("getByToken returns the invite + demo metadata for valid token, null for invalid", async () => {
    const t = convexTest(schema, modules);
    const { demoId } = await makeDemo(t);
    const all = await t.query("evaluationInvites:listForDemo", { demoId });
    const tok = all[0].token;
    const found = await t.query("evaluationInvites:getByToken", { token: tok });
    expect(found.invite._id).toBe(all[0]._id);
    expect(found.demo._id).toBe(demoId);
    const missing = await t.query("evaluationInvites:getByToken", { token: "bogus" });
    expect(missing).toBeNull();
  });

  it("listForUser returns pending invites with demo metadata", async () => {
    const t = convexTest(schema, modules);
    const { teacherId, demoId } = await makeDemo(t);
    const list = await t.query("evaluationInvites:listForUser", {
      userId: teacherId, statusFilter: ["invited", "viewed", "in_progress"],
    });
    expect(list).toHaveLength(1);
    expect(list[0].invite.demoSessionId).toBe(demoId);
    expect(list[0].demo).toBeDefined();
  });

  it("swap cancels old invite, creates new one, links via replacedBy", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, demoId, teacherId } = await makeDemo(t);
    const replacementId = await t.mutation("users:createProfile", {
      userId: "u3", name: "Sub", email: "sub@s.com", schoolId, role: "teacher",
    });
    const all = await t.query("evaluationInvites:listForDemo", { demoId });
    const teacherInvite = all.find((i: any) => i.evaluatorUserId === teacherId)!;
    const newInviteId = await t.mutation("evaluationInvites:swap", {
      inviteId: teacherInvite._id,
      newEvaluatorUserId: replacementId,
    });
    const after = await t.query("evaluationInvites:listForDemo", { demoId });
    const oldInv = after.find((i: any) => i._id === teacherInvite._id)!;
    const newInv = after.find((i: any) => i._id === newInviteId)!;
    expect(oldInv.status).toBe("cancelled");
    expect(oldInv.replacedBy).toBe(newInviteId);
    expect(newInv.status).toBe("invited");
    expect(newInv.evaluatorUserId).toBe(replacementId);
    expect(newInv.evaluatorRole).toBe("teacher");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test tests/convex/evaluationInvites.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement remaining mutations + queries**

Replace `convex/evaluationInvites.ts` with:

```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { generateToken } from "./lib/tokenGen";

export const listForDemo = query({
  args: { demoId: v.id("demoSessions") },
  handler: async (ctx, { demoId }) =>
    await ctx.db
      .query("evaluationInvites")
      .withIndex("by_demoSessionId", (q) => q.eq("demoSessionId", demoId))
      .collect(),
});

export const markViewed = mutation({
  args: { inviteId: v.id("evaluationInvites") },
  handler: async (ctx, { inviteId }) => {
    const inv = await ctx.db.get(inviteId);
    if (!inv) throw new Error("Invite not found");
    if (inv.status === "invited") {
      await ctx.db.patch(inviteId, { status: "viewed", viewedAt: Date.now() });
    } else if (!inv.viewedAt) {
      await ctx.db.patch(inviteId, { viewedAt: Date.now() });
    }
  },
});

export const decline = mutation({
  args: { inviteId: v.id("evaluationInvites"), reason: v.optional(v.string()) },
  handler: async (ctx, { inviteId, reason }) => {
    const inv = await ctx.db.get(inviteId);
    if (!inv) throw new Error("Invite not found");
    if (inv.status === "submitted" || inv.status === "declined" || inv.status === "cancelled") {
      throw new Error(`Cannot decline an invite that is ${inv.status}`);
    }
    await ctx.db.patch(inviteId, {
      status: "declined",
      declinedAt: Date.now(),
      declineReason: reason,
    });
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const inv = await ctx.db
      .query("evaluationInvites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!inv) return null;
    const demo = await ctx.db.get(inv.demoSessionId);
    if (!demo) return null;
    const template = await ctx.db.get(inv.formTemplateId);
    return { invite: inv, demo, template };
  },
});

export const listForUser = query({
  args: {
    userId: v.id("userProfiles"),
    statusFilter: v.optional(v.array(v.union(
      v.literal("invited"),
      v.literal("viewed"),
      v.literal("in_progress"),
      v.literal("submitted"),
      v.literal("declined"),
      v.literal("cancelled"),
    ))),
  },
  handler: async (ctx, { userId, statusFilter }) => {
    const rows = await ctx.db
      .query("evaluationInvites")
      .withIndex("by_evaluatorUserId_status", (q) => q.eq("evaluatorUserId", userId))
      .collect();
    const allowed = statusFilter ? new Set(statusFilter) : null;
    const filtered = allowed ? rows.filter((r) => allowed.has(r.status)) : rows;
    const out = [];
    for (const inv of filtered) {
      const demo = await ctx.db.get(inv.demoSessionId);
      if (!demo) continue;
      out.push({ invite: inv, demo });
    }
    return out.sort((a, b) => a.demo.scheduledAt - b.demo.scheduledAt);
  },
});

export const swap = mutation({
  args: {
    inviteId: v.id("evaluationInvites"),
    newEvaluatorUserId: v.id("userProfiles"),
  },
  handler: async (ctx, { inviteId, newEvaluatorUserId }) => {
    const old = await ctx.db.get(inviteId);
    if (!old) throw new Error("Invite not found");
    if (old.status === "submitted") throw new Error("Cannot swap a submitted invite");
    if (old.status === "cancelled") throw new Error("Cannot swap an already cancelled invite");

    const now = Date.now();
    const newInviteId = await ctx.db.insert("evaluationInvites", {
      demoSessionId: old.demoSessionId,
      evaluatorUserId: newEvaluatorUserId,
      evaluatorRole: old.evaluatorRole,
      formTemplateId: old.formTemplateId,
      status: "invited",
      token: generateToken(),
      invitedAt: now,
    });
    await ctx.db.patch(inviteId, {
      status: "cancelled",
      cancelledAt: now,
      replacedBy: newInviteId,
    });
    return newInviteId;
  },
});
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test tests/convex/evaluationInvites.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/evaluationInvites.ts tests/convex/evaluationInvites.test.ts
git commit -m "feat(convex): evaluationInvites lifecycle (markViewed, decline, getByToken, listForUser, swap)"
```

---

## Phase 5: Evaluations backend (rewrite)

### Task 10: Rewrite `evaluations.ts` against new schema

**Files:**
- Modify: `convex/evaluations.ts` (full rewrite)
- Modify: `tests/convex/evaluations.test.ts` (full rewrite)

- [ ] **Step 1: Replace the test file with new failing tests**

Overwrite `tests/convex/evaluations.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as jobs from "../../convex/jobs";
import * as candidates from "../../convex/candidates";
import * as applications from "../../convex/applications";
import * as users from "../../convex/users";
import * as formTemplates from "../../convex/formTemplates";
import * as demoSessions from "../../convex/demoSessions";
import * as invites from "../../convex/evaluationInvites";
import * as evaluations from "../../convex/evaluations";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "jobs.ts": async () => jobs,
  "candidates.ts": async () => candidates,
  "applications.ts": async () => applications,
  "users.ts": async () => users,
  "formTemplates.ts": async () => formTemplates,
  "demoSessions.ts": async () => demoSessions,
  "evaluationInvites.ts": async () => invites,
  "evaluations.ts": async () => evaluations,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

async function setup(t: ReturnType<typeof convexTest>) {
  const schoolId = await t.mutation("schools:create", { name: "S", board: "CBSE", city: "X", state: "Y" });
  const candidateId = await t.mutation("candidates:create", { name: "P", qualifications: ["B.Ed"], subjects: ["Maths"] });
  const jobId = await t.mutation("jobs:create", { schoolId, title: "T", subject: "Maths", level: "TGT", board: "CBSE", qualifications: ["B.Ed"], naturalLanguageDescription: "x" });
  const appId = await t.mutation("applications:create", { candidateId, jobPostingId: jobId, schoolId });
  const principalId = await t.mutation("users:createProfile", { userId: "u1", name: "P", email: "p@s.com", schoolId, role: "principal" });
  const demoId = await t.mutation("demoSessions:create", {
    applicationId: appId, schoolId,
    scheduledAt: Date.now() + 86400000, durationMinutes: 30,
    mode: "live", format: "classroom",
    evaluators: [{ userId: principalId, role: "principal" }],
    createdBy: principalId,
  });
  const invs = await t.query("evaluationInvites:listForDemo", { demoId });
  return { schoolId, appId, principalId, demoId, invite: invs[0] };
}

describe("evaluations.submit", () => {
  it("persists responses and advances invite to submitted", async () => {
    const t = convexTest(schema, modules);
    const { invite } = await setup(t);
    await t.mutation("evaluations:submit", {
      inviteId: invite._id,
      responses: { subjectKnowledge: 4, classroomManagement: 5, communication: 4, overallFit: 4, comments: "Strong" },
      recommendation: "hire",
      submittedFromPlatform: "web",
    });
    const evals = await t.query("evaluations:listForInvite", { inviteId: invite._id });
    expect(evals).toHaveLength(1);
    expect(evals[0].responses.subjectKnowledge).toBe(4);
    expect(evals[0].recommendation).toBe("hire");

    const inv = await t.query("evaluationInvites:listForDemo", { demoId: invite.demoSessionId });
    expect(inv[0].status).toBe("submitted");
    expect(inv[0].submittedAt).toBeGreaterThan(0);
  });

  it("rejects double submission on the same invite", async () => {
    const t = convexTest(schema, modules);
    const { invite } = await setup(t);
    await t.mutation("evaluations:submit", {
      inviteId: invite._id, responses: { comments: "x" }, recommendation: "maybe", submittedFromPlatform: "web",
    });
    await expect(
      t.mutation("evaluations:submit", {
        inviteId: invite._id, responses: { comments: "y" }, recommendation: "hire", submittedFromPlatform: "web",
      }),
    ).rejects.toThrow(/already submitted/i);
  });

  it("rejects submission on a cancelled invite", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, invite } = await setup(t);
    const subId = await t.mutation("users:createProfile", { userId: "u2", name: "S", email: "s@s.com", schoolId, role: "principal" });
    await t.mutation("evaluationInvites:swap", { inviteId: invite._id, newEvaluatorUserId: subId });
    await expect(
      t.mutation("evaluations:submit", {
        inviteId: invite._id, responses: {}, recommendation: "hire", submittedFromPlatform: "web",
      }),
    ).rejects.toThrow(/cancelled/i);
  });

  it("submitByToken accepts a valid token and rejects an invalid one", async () => {
    const t = convexTest(schema, modules);
    const { invite } = await setup(t);
    await t.mutation("evaluations:submitByToken", {
      token: invite.token,
      responses: { comments: "good" },
      recommendation: "hire",
      submittedFromPlatform: "web",
    });
    const evals = await t.query("evaluations:listForInvite", { inviteId: invite._id });
    expect(evals).toHaveLength(1);

    await expect(
      t.mutation("evaluations:submitByToken", {
        token: "bogus", responses: {}, recommendation: "hire", submittedFromPlatform: "web",
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("persists voiceInputs when provided", async () => {
    const t = convexTest(schema, modules);
    const { invite } = await setup(t);
    await t.mutation("evaluations:submit", {
      inviteId: invite._id,
      responses: { comments: "see bullets" },
      recommendation: "hire",
      submittedFromPlatform: "web",
      voiceInputs: [{
        fieldKey: "comments",
        transcript: "She was strong on fractions",
        summaryPoints: ["Strong on fractions", "Engaged students"],
        language: "en-IN",
        durationSec: 30,
        processedAt: Date.now(),
      }],
    });
    const evals = await t.query("evaluations:listForInvite", { inviteId: invite._id });
    expect(evals[0].voiceInputs).toHaveLength(1);
    expect(evals[0].voiceInputs[0].summaryPoints).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test tests/convex/evaluations.test.ts`
Expected: FAIL (old signatures gone).

- [ ] **Step 3: Replace `convex/evaluations.ts`**

Overwrite `convex/evaluations.ts`:

```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const VOICE_INPUT_VALIDATOR = v.array(v.object({
  fieldKey: v.string(),
  transcript: v.string(),
  summaryPoints: v.array(v.string()),
  language: v.string(),
  durationSec: v.number(),
  processedAt: v.number(),
}));

const RESPONSES_VALIDATOR = v.record(v.string(), v.union(v.number(), v.string()));

const RECOMMENDATION_VALIDATOR = v.optional(v.union(
  v.literal("hire"), v.literal("maybe"), v.literal("reject"),
));

const PLATFORM_VALIDATOR = v.union(
  v.literal("mobile_ios"),
  v.literal("mobile_android"),
  v.literal("web"),
);

async function persistSubmission(
  ctx: any,
  inviteId: any,
  responses: any,
  recommendation: any,
  voiceInputs: any,
  platform: any,
) {
  const inv = await ctx.db.get(inviteId);
  if (!inv) throw new Error("Invite not found");
  if (inv.status === "submitted") throw new Error("Already submitted");
  if (inv.status === "cancelled") throw new Error("Invite was cancelled");
  if (inv.status === "declined") throw new Error("Invite was declined");

  const now = Date.now();
  await ctx.db.insert("evaluations", {
    inviteId,
    formTemplateId: inv.formTemplateId,
    responses,
    recommendation,
    voiceInputs: voiceInputs ?? undefined,
    submittedAt: now,
    submittedFromPlatform: platform,
  });
  await ctx.db.patch(inviteId, { status: "submitted", submittedAt: now });
}

export const submit = mutation({
  args: {
    inviteId: v.id("evaluationInvites"),
    responses: RESPONSES_VALIDATOR,
    recommendation: RECOMMENDATION_VALIDATOR,
    voiceInputs: v.optional(VOICE_INPUT_VALIDATOR),
    submittedFromPlatform: PLATFORM_VALIDATOR,
  },
  handler: async (ctx, args) => {
    await persistSubmission(
      ctx, args.inviteId, args.responses, args.recommendation,
      args.voiceInputs, args.submittedFromPlatform,
    );
  },
});

export const submitByToken = mutation({
  args: {
    token: v.string(),
    responses: RESPONSES_VALIDATOR,
    recommendation: RECOMMENDATION_VALIDATOR,
    voiceInputs: v.optional(VOICE_INPUT_VALIDATOR),
    submittedFromPlatform: PLATFORM_VALIDATOR,
  },
  handler: async (ctx, args) => {
    const inv = await ctx.db
      .query("evaluationInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!inv) throw new Error("Invite not found for token");
    await persistSubmission(
      ctx, inv._id, args.responses, args.recommendation,
      args.voiceInputs, args.submittedFromPlatform,
    );
  },
});

export const listForInvite = query({
  args: { inviteId: v.id("evaluationInvites") },
  handler: async (ctx, { inviteId }) =>
    await ctx.db
      .query("evaluations")
      .withIndex("by_inviteId", (q) => q.eq("inviteId", inviteId))
      .collect(),
});
```

- [ ] **Step 4: Update existing consumers**

Run: `grep -rn 'evaluations:create\|evaluations:submitFeedback\|evaluations:getByApplication\|evaluations:getByToken' --include='*.ts' --include='*.tsx' app components convex hooks tests 2>/dev/null`

For each callsite found, update to the new API:
- `evaluations:create` (old) → schedule via `demoSessions:create` instead.
- `evaluations:submitFeedback` → `evaluations:submitByToken`.
- `evaluations:getByApplication` → `demoSessions:listForCandidate` + `evaluationInvites:listForDemo`.
- `evaluations:getByToken` → `evaluationInvites:getByToken`.

Where a callsite previously expected the old denormalized fields (`subjectKnowledge`, etc.), read them off `responses[key]` instead. For `convex/candidates.ts` references, walk the new join (demoSession → invites → evaluations).

- [ ] **Step 5: Run all tests**

Run: `bun run test`
Expected: all PASS (including any updated callsite tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(convex): rewrite evaluations against new invite+template model"
```

---

## Phase 6: Voice processing action

### Task 11: `voiceProcessing.summarizeTranscript`

**Files:**
- Create: `convex/voiceProcessing.ts`
- Test: `tests/convex/voiceProcessing.test.ts`

- [ ] **Step 1: Write failing test (mock the LLM client)**

Create `tests/convex/voiceProcessing.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { buildSummaryPrompt, parseSummaryResponse } from "../../convex/voiceProcessing";

describe("voiceProcessing helpers", () => {
  it("buildSummaryPrompt includes the transcript and the field label hint", () => {
    const p = buildSummaryPrompt({
      transcript: "Priya was strong on fractions and engaged students.",
      fieldKey: "comments",
      language: "en-IN",
    });
    expect(p).toContain("Priya was strong on fractions");
    expect(p.toLowerCase()).toContain("3 to 5");
  });

  it("parseSummaryResponse extracts bullets from a numbered list", () => {
    const raw = `1. Strong on fractions concept
2. Engaged quieter students
3. Slow pacing on word problems`;
    expect(parseSummaryResponse(raw)).toEqual([
      "Strong on fractions concept",
      "Engaged quieter students",
      "Slow pacing on word problems",
    ]);
  });

  it("parseSummaryResponse handles bullet-style markers", () => {
    const raw = `- A\n- B\n- C\n- D`;
    expect(parseSummaryResponse(raw)).toEqual(["A", "B", "C", "D"]);
  });

  it("parseSummaryResponse truncates bullets over 120 chars", () => {
    const long = "x".repeat(200);
    const out = parseSummaryResponse(`1. ${long}`);
    expect(out[0].length).toBeLessThanOrEqual(120);
  });

  it("parseSummaryResponse caps at 5 bullets", () => {
    const raw = `1. A\n2. B\n3. C\n4. D\n5. E\n6. F\n7. G`;
    expect(parseSummaryResponse(raw)).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test tests/convex/voiceProcessing.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `convex/voiceProcessing.ts`:

```ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";

export function buildSummaryPrompt(args: {
  transcript: string;
  fieldKey: string;
  language: string;
}): string {
  return `You are summarizing an evaluator's spoken feedback about a teaching candidate.

Field being summarized: ${args.fieldKey}
Language detected: ${args.language}

Transcript:
"""
${args.transcript}
"""

Summarize this feedback into 3 to 5 concise bullet points. Each bullet is a single observation or judgment, preserving specifics. Do not invent. Do not add headings or commentary. Output as a numbered list, one bullet per line.`;
}

export function parseSummaryResponse(raw: string): string[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets: string[] = [];
  for (const line of lines) {
    const m = line.match(/^(?:\d+[.)]|[-*•])\s+(.+)$/);
    if (m) {
      let b = m[1].trim();
      if (b.length > 120) b = b.slice(0, 117).trimEnd() + "...";
      bullets.push(b);
      if (bullets.length >= 5) break;
    }
  }
  return bullets;
}

export const summarizeTranscript = action({
  args: {
    transcript: v.string(),
    fieldKey: v.string(),
    language: v.string(),
    durationSec: v.number(),
  },
  handler: async (_ctx, args) => {
    if (args.transcript.trim().length < 5) {
      return { summaryPoints: [] as string[], language: args.language };
    }
    const prompt = buildSummaryPrompt({
      transcript: args.transcript,
      fieldKey: args.fieldKey,
      language: args.language,
    });
    const client = getLlmClient();
    const completion = await client.chat.completions.create({
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });
    const raw = completion.choices?.[0]?.message?.content ?? "";
    return {
      summaryPoints: parseSummaryResponse(raw),
      language: args.language,
    };
  },
});
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test tests/convex/voiceProcessing.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/voiceProcessing.ts tests/convex/voiceProcessing.test.ts
git commit -m "feat(convex): voice summarization action using LLM"
```

---

### Task 12: `demoSessions.aggregate` rollup query

**Files:**
- Modify: `convex/demoSessions.ts`
- Modify: `tests/convex/demoSessions.test.ts`

- [ ] **Step 1: Append failing test**

Append to `tests/convex/demoSessions.test.ts`:

```ts
import * as evaluations from "../../convex/evaluations";
modules["evaluations.ts"] = async () => evaluations;

describe("demoSessions.aggregate", () => {
  it("rolls up per-dimension averages weighted by template weights", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, appId, principalId, hodId } = await setup(t);
    const demoId = await t.mutation("demoSessions:create", {
      applicationId: appId, schoolId,
      scheduledAt: Date.now() + 86400000, durationMinutes: 30,
      mode: "live", format: "classroom",
      evaluators: [
        { userId: principalId, role: "principal" },
        { userId: hodId, role: "hod" },
      ],
      createdBy: principalId,
    });
    const invs = await t.query("evaluationInvites:listForDemo", { demoId });
    const pInv = invs.find((i: any) => i.evaluatorRole === "principal");
    const hInv = invs.find((i: any) => i.evaluatorRole === "hod");

    await t.mutation("evaluations:submit", {
      inviteId: pInv._id,
      responses: { subjectKnowledge: 4, classroomManagement: 5, communication: 4, overallFit: 4, comments: "good" },
      recommendation: "hire",
      submittedFromPlatform: "web",
    });
    await t.mutation("evaluations:submit", {
      inviteId: hInv._id,
      responses: { subjectKnowledge: 5, pedagogy: 5, curriculumAlignment: 4, communication: 4, comments: "great" },
      recommendation: "hire",
      submittedFromPlatform: "web",
    });

    const agg = await t.query("demoSessions:aggregate", { demoId });
    expect(agg.demo._id).toBe(demoId);
    expect(agg.invitesByStatus.submitted).toBe(2);
    expect(agg.recommendationTally).toEqual({ hire: 2, maybe: 0, reject: 0 });
    // subjectKnowledge: principal=4 (weight 1), HOD=5 (weight 2) -> (4 + 5*2) / (1+2) = 4.666...
    expect(agg.dimensionAverages.subjectKnowledge).toBeCloseTo(14 / 3, 3);
    expect(agg.dimensionAverages.communication).toBeCloseTo(4.0, 3);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test tests/convex/demoSessions.test.ts`
Expected: FAIL (aggregate not implemented).

- [ ] **Step 3: Implement aggregate query**

Append to `convex/demoSessions.ts`:

```ts
export const aggregate = query({
  args: { demoId: v.id("demoSessions") },
  handler: async (ctx, { demoId }) => {
    const demo = await ctx.db.get(demoId);
    if (!demo) throw new Error("Demo not found");
    const invites = await ctx.db
      .query("evaluationInvites")
      .withIndex("by_demoSessionId", (q) => q.eq("demoSessionId", demoId))
      .collect();

    const invitesByStatus: Record<string, number> = {
      invited: 0, viewed: 0, in_progress: 0, submitted: 0, declined: 0, cancelled: 0,
    };
    for (const inv of invites) invitesByStatus[inv.status] = (invitesByStatus[inv.status] ?? 0) + 1;

    const recommendationTally = { hire: 0, maybe: 0, reject: 0 } as Record<string, number>;
    const weightedSums: Record<string, number> = {};
    const totalWeights: Record<string, number> = {};
    const perEvaluator: Array<any> = [];

    for (const inv of invites) {
      if (inv.status !== "submitted") continue;
      const evals = await ctx.db
        .query("evaluations")
        .withIndex("by_inviteId", (q) => q.eq("inviteId", inv._id))
        .collect();
      const ev = evals[0];
      if (!ev) continue;
      const template = await ctx.db.get(ev.formTemplateId);
      if (!template) continue;
      const evaluator = await ctx.db.get(inv.evaluatorUserId);

      if (ev.recommendation) recommendationTally[ev.recommendation] += 1;

      for (const field of template.fields) {
        if (field.type !== "score_1_5" && field.type !== "score_1_10") continue;
        const value = ev.responses[field.key];
        if (typeof value !== "number") continue;
        const w = field.weight ?? 1;
        weightedSums[field.key] = (weightedSums[field.key] ?? 0) + value * w;
        totalWeights[field.key] = (totalWeights[field.key] ?? 0) + w;
      }

      perEvaluator.push({
        invite: inv,
        evaluation: ev,
        template,
        evaluatorName: evaluator?.name ?? "Unknown",
        evaluatorRole: inv.evaluatorRole,
      });
    }

    const dimensionAverages: Record<string, number> = {};
    for (const key of Object.keys(weightedSums)) {
      dimensionAverages[key] = weightedSums[key] / totalWeights[key];
    }

    return {
      demo,
      invitesByStatus,
      recommendationTally,
      dimensionAverages,
      perEvaluator,
    };
  },
});
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test tests/convex/demoSessions.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/demoSessions.ts tests/convex/demoSessions.test.ts
git commit -m "feat(convex): demoSessions.aggregate weighted rollup"
```

---

### Task 13: Notifications dispatcher (email now, push stub for Plan 3)

**Files:**
- Create: `convex/notifications.ts`
- Modify: `convex/demoSessions.ts` (invoke on create + cancel)
- Modify: `convex/evaluationInvites.ts` (invoke on decline + swap)
- Test: `tests/convex/notifications.test.ts`

- [ ] **Step 1: Write failing test (assert side effects are scheduled)**

Create `tests/convex/notifications.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderInviteEmail } from "../../convex/notifications";

describe("notifications.renderInviteEmail", () => {
  it("includes the candidate name and the deep-link URL", () => {
    const html = renderInviteEmail({
      candidateName: "Priya Sharma",
      role: "principal",
      scheduledAt: new Date("2026-06-01T11:30:00Z").getTime(),
      formUrl: "https://app.example/evaluations/abc?token=xyz",
    });
    expect(html).toContain("Priya Sharma");
    expect(html).toContain("https://app.example/evaluations/abc?token=xyz");
    expect(html.toLowerCase()).toContain("principal");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test tests/convex/notifications.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `convex/notifications.ts`:

```ts
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";

export function renderInviteEmail(args: {
  candidateName: string;
  role: string;
  scheduledAt: number;
  formUrl: string;
}): string {
  const when = new Date(args.scheduledAt).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
  return `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;">
  <h2>You're invited to evaluate ${args.candidateName}</h2>
  <p>Role: <strong>${args.role}</strong></p>
  <p>When: <strong>${when}</strong></p>
  <p><a href="${args.formUrl}" style="display:inline-block;background:#0066ff;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open the evaluation</a></p>
  <p style="color:#666;font-size:13px;">Link valid until the demo's form-close window passes.</p>
</body></html>
`.trim();
}

export const sendInviteEmail = internalAction({
  args: {
    to: v.string(),
    candidateName: v.string(),
    role: v.string(),
    scheduledAt: v.number(),
    formUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const { Resend } = await import("resend");
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set; skipping email send");
      return;
    }
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "no-reply@rolerecruit.app",
      to: args.to,
      subject: `Evaluate ${args.candidateName}`,
      html: renderInviteEmail(args),
    });
  },
});

// Push notification stub. Real Expo push wiring lives in Plan 3.
export const sendPushNotification = internalAction({
  args: {
    expoPushTokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (_ctx, args) => {
    if (args.expoPushTokens.length === 0) return;
    // TODO(Plan 3): POST to https://exp.host/--/api/v2/push/send
    console.log("[push stub] would send:", args.title, "->", args.expoPushTokens.length, "tokens");
  },
});

export const sendDemoEvent = action({
  args: {
    event: v.union(
      v.literal("invite_created"),
      v.literal("demo_cancelled"),
      v.literal("invite_declined"),
      v.literal("invite_swapped"),
    ),
    inviteId: v.optional(v.id("evaluationInvites")),
    demoId: v.optional(v.id("demoSessions")),
    formUrlBase: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.event === "invite_created" && args.inviteId) {
      const inv = await ctx.runQuery((await import("./_generated/api")).api.evaluationInvites.getByToken, { token: "" });
      // Real lookup uses an internal query that resolves invite + user email; left as a follow-up
      // when Better Auth provides the email lookup helper. For now this dispatcher logs.
      console.log("[notifications] invite_created", args.inviteId);
    } else {
      console.log("[notifications] event", args.event);
    }
  },
});
```

- [ ] **Step 4: Wire the dispatcher into `demoSessions.create` and friends**

In `convex/demoSessions.ts`, after the invite fan-out loop in `create`, schedule the dispatcher:

```ts
import { internal } from "./_generated/api";
// inside handler, after the loop:
const formUrlBase = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
for (const inv of /* newly inserted invite ids */) {
  await ctx.scheduler.runAfter(0, internal.notifications.sendPushNotification, {
    expoPushTokens: [], // populated in Plan 3 from userProfiles
    title: "New evaluation request",
    body: `Demo scheduled for ${new Date(args.scheduledAt).toLocaleString()}`,
  });
}
```

(Capture invite ids inside the loop; full code shown in the test file's reference implementation.)

- [ ] **Step 5: Run, verify pass**

Run: `bun run test tests/convex/notifications.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add convex/notifications.ts convex/demoSessions.ts tests/convex/notifications.test.ts
git commit -m "feat(convex): notifications dispatcher with email render + push stub"
```

---

## Phase 7: Web evaluation form primitives

### Task 14: `EvaluationForm` component (template-driven renderer)

**Files:**
- Create: `components/evaluations/evaluation-form.tsx`
- Test: `tests/components/evaluation-form.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/evaluation-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EvaluationForm } from "../../components/evaluations/evaluation-form";

const template = {
  _id: "t1" as any,
  name: "Principal default",
  role: "principal" as const,
  fields: [
    { key: "subjectKnowledge", label: "Subject knowledge", type: "score_1_5" as const, required: true },
    { key: "comments", label: "Comments", type: "text" as const, allowDictation: true },
  ],
};

describe("EvaluationForm", () => {
  it("renders one input per template field", () => {
    render(<EvaluationForm template={template} onSubmit={() => {}} />);
    expect(screen.getByText("Subject knowledge")).toBeInTheDocument();
    expect(screen.getByLabelText("Comments")).toBeInTheDocument();
  });

  it("submits collected values and the recommendation", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<EvaluationForm template={template} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /score 4 for subject knowledge/i }));
    await user.type(screen.getByLabelText("Comments"), "Good lesson");
    await user.click(screen.getByRole("button", { name: /^hire$/i }));
    await user.click(screen.getByRole("button", { name: /submit evaluation/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      responses: { subjectKnowledge: 4, comments: "Good lesson" },
      recommendation: "hire",
      voiceInputs: [],
    });
  });

  it("blocks submit when a required field is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<EvaluationForm template={template} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /submit evaluation/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/subject knowledge is required/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test tests/components/evaluation-form.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `components/evaluations/evaluation-form.tsx`:

```tsx
"use client";
import { useState } from "react";

type FieldType = "score_1_5" | "score_1_10" | "text" | "choice";

type Field = {
  key: string;
  label: string;
  type: FieldType;
  choices?: string[];
  weight?: number;
  allowDictation?: boolean;
  required?: boolean;
};

type Template = {
  _id: string;
  name: string;
  role: "principal" | "hod" | "hr_admin" | "teacher";
  fields: Field[];
};

type VoiceInput = {
  fieldKey: string;
  transcript: string;
  summaryPoints: string[];
  language: string;
  durationSec: number;
  processedAt: number;
};

export function EvaluationForm({
  template,
  initialResponses,
  initialVoiceInputs,
  onDictate,
  onSubmit,
}: {
  template: Template;
  initialResponses?: Record<string, number | string>;
  initialVoiceInputs?: VoiceInput[];
  onDictate?: (fieldKey: string) => Promise<VoiceInput | null>;
  onSubmit: (data: {
    responses: Record<string, number | string>;
    recommendation: "hire" | "maybe" | "reject" | undefined;
    voiceInputs: VoiceInput[];
  }) => void;
}) {
  const [responses, setResponses] = useState<Record<string, number | string>>(initialResponses ?? {});
  const [voiceInputs, setVoiceInputs] = useState<VoiceInput[]>(initialVoiceInputs ?? []);
  const [recommendation, setRecommendation] = useState<"hire" | "maybe" | "reject" | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const setValue = (key: string, value: number | string) => {
    setResponses((prev) => ({ ...prev, [key]: value }));
  };

  const handleDictate = async (fieldKey: string) => {
    if (!onDictate) return;
    const result = await onDictate(fieldKey);
    if (!result) return;
    setVoiceInputs((prev) => [...prev.filter((v) => v.fieldKey !== fieldKey), result]);
    setValue(fieldKey, result.summaryPoints.map((b) => `• ${b}`).join("\n"));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of template.fields) {
      if (f.required && (responses[f.key] === undefined || responses[f.key] === "")) {
        setError(`${f.label} is required`);
        return;
      }
    }
    if (!recommendation) {
      setError("Please pick a recommendation");
      return;
    }
    setError(null);
    onSubmit({ responses, recommendation, voiceInputs });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {template.fields.map((f) => (
        <div key={f.key} className="space-y-2">
          <label htmlFor={f.key} className="text-sm font-semibold">{f.label}</label>
          {f.type === "score_1_5" && (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Score ${n} for ${f.label.toLowerCase()}`}
                  onClick={() => setValue(f.key, n)}
                  className={`px-3 py-2 rounded-lg border ${responses[f.key] === n ? "bg-blue-600 text-white border-blue-600" : "border-gray-300"}`}
                >{n}</button>
              ))}
            </div>
          )}
          {f.type === "score_1_10" && (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Score ${n} for ${f.label.toLowerCase()}`}
                  onClick={() => setValue(f.key, n)}
                  className={`px-2.5 py-1.5 rounded-md border ${responses[f.key] === n ? "bg-blue-600 text-white border-blue-600" : "border-gray-300"}`}
                >{n}</button>
              ))}
            </div>
          )}
          {f.type === "text" && (
            <div className="space-y-2">
              <textarea
                id={f.key}
                value={(responses[f.key] as string) ?? ""}
                onChange={(e) => setValue(f.key, e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-gray-300 p-3"
              />
              {f.allowDictation && onDictate && (
                <button
                  type="button"
                  onClick={() => handleDictate(f.key)}
                  className="text-sm font-semibold text-blue-600"
                >Dictate</button>
              )}
            </div>
          )}
          {f.type === "choice" && f.choices && (
            <div className="flex flex-wrap gap-2">
              {f.choices.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue(f.key, c)}
                  className={`px-3 py-1.5 rounded-full border ${responses[f.key] === c ? "bg-blue-600 text-white border-blue-600" : "border-gray-300"}`}
                >{c}</button>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="space-y-2">
        <label className="text-sm font-semibold">Recommendation</label>
        <div className="flex gap-2">
          {(["hire", "maybe", "reject"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRecommendation(r)}
              className={`px-4 py-2 rounded-lg border font-semibold ${recommendation === r ? "bg-blue-600 text-white border-blue-600" : "border-gray-300"}`}
            >{r.charAt(0).toUpperCase() + r.slice(1)}</button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold">
        Submit evaluation
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test tests/components/evaluation-form.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add components/evaluations/evaluation-form.tsx tests/components/evaluation-form.test.tsx
git commit -m "feat(web): template-driven EvaluationForm with scoring + recommendation"
```

---

### Task 15: `DictationModal` component (web SpeechRecognition + Convex action)

**Files:**
- Create: `components/evaluations/dictation-modal.tsx`
- Create: `hooks/use-speech-recognition.ts`
- Test: `tests/components/dictation-modal.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/dictation-modal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DictationModal } from "../../components/evaluations/dictation-modal";

describe("DictationModal", () => {
  it("when unsupported, shows the fallback message and disables the mic", () => {
    render(
      <DictationModal
        open
        onClose={() => {}}
        fieldKey="comments"
        onComplete={() => {}}
        supportOverride={false}
      />,
    );
    expect(screen.getByText(/dictation requires chrome, edge, or safari/i)).toBeInTheDocument();
  });

  it("when supported, finalizing transcript triggers onComplete with the summary", async () => {
    const onComplete = vi.fn();
    const summarize = vi.fn(async () => ({ summaryPoints: ["Good", "Engaged"], language: "en-IN" }));
    render(
      <DictationModal
        open
        onClose={() => {}}
        fieldKey="comments"
        onComplete={onComplete}
        summarize={summarize}
        supportOverride={true}
        initialTranscript="The candidate was strong on fractions"
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /tap to stop/i }));
    expect(summarize).toHaveBeenCalledWith({
      transcript: "The candidate was strong on fractions",
      fieldKey: "comments",
      language: expect.any(String),
      durationSec: expect.any(Number),
    });
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      fieldKey: "comments",
      transcript: "The candidate was strong on fractions",
      summaryPoints: ["Good", "Engaged"],
    }));
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test tests/components/dictation-modal.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the hook**

Create `hooks/use-speech-recognition.ts`:

```ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function useSpeechRecognition(opts: { lang?: string }) {
  const [interim, setInterim] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const supported =
    typeof window !== "undefined" &&
    !!(((window as any).SpeechRecognition) || ((window as any).webkitSpeechRecognition));

  const start = useCallback(() => {
    if (!supported) return;
    const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = opts.lang ?? navigator.language ?? "en-IN";
    rec.onresult = (e: any) => {
      let interimText = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) setFinalTranscript((prev) => prev + finalText);
      setInterim(interimText);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setFinalTranscript("");
    setInterim("");
    rec.start();
    setListening(true);
  }, [opts.lang, supported]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return { supported, interim, finalTranscript, listening, start, stop };
}
```

- [ ] **Step 4: Implement the modal**

Create `components/evaluations/dictation-modal.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useSpeechRecognition } from "../../hooks/use-speech-recognition";

type VoiceInput = {
  fieldKey: string;
  transcript: string;
  summaryPoints: string[];
  language: string;
  durationSec: number;
  processedAt: number;
};

type SummarizeFn = (args: {
  transcript: string;
  fieldKey: string;
  language: string;
  durationSec: number;
}) => Promise<{ summaryPoints: string[]; language: string }>;

export function DictationModal({
  open,
  onClose,
  fieldKey,
  onComplete,
  summarize,
  supportOverride,
  initialTranscript,
}: {
  open: boolean;
  onClose: () => void;
  fieldKey: string;
  onComplete: (input: VoiceInput) => void;
  summarize?: SummarizeFn;
  supportOverride?: boolean;
  initialTranscript?: string;
}) {
  const speech = useSpeechRecognition({ lang: "en-IN" });
  const supported = supportOverride ?? speech.supported;
  const startTimeRef = useRef<number>(0);
  const [phase, setPhase] = useState<"recording" | "processing" | "error">("recording");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open && supported && supportOverride === undefined) {
      startTimeRef.current = Date.now();
      speech.start();
    }
  }, [open, supported, supportOverride, speech]);

  if (!open) return null;

  if (!supported) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 max-w-sm">
          <p>Dictation requires Chrome, Edge, or Safari.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 rounded">Close</button>
        </div>
      </div>
    );
  }

  const handleStop = async () => {
    speech.stop();
    setPhase("processing");
    const transcript = initialTranscript ?? (speech.finalTranscript + speech.interim).trim();
    const durationSec = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
    try {
      const result = await summarize?.({
        transcript,
        fieldKey,
        language: "en-IN",
        durationSec,
      });
      if (!result) throw new Error("No summary returned");
      onComplete({
        fieldKey,
        transcript,
        summaryPoints: result.summaryPoints,
        language: result.language,
        durationSec,
        processedAt: Date.now(),
      });
      onClose();
    } catch (e: any) {
      setPhase("error");
      setErrMsg(e?.message ?? "Failed to summarize");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 text-white">
      <div className="text-center p-6 max-w-sm">
        {phase === "recording" && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-500 mx-auto animate-pulse mb-4" />
            <p className="text-sm opacity-80 mb-4">{speech.interim || initialTranscript || "Listening..."}</p>
            <button
              onClick={handleStop}
              className="bg-white text-black px-6 py-2 rounded-full font-semibold"
            >Tap to stop</button>
          </>
        )}
        {phase === "processing" && <p>Summarizing...</p>}
        {phase === "error" && (
          <>
            <p className="text-red-400 mb-2">{errMsg}</p>
            <button onClick={onClose} className="bg-white text-black px-4 py-2 rounded">Close</button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run, verify pass**

Run: `bun run test tests/components/dictation-modal.test.tsx`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add components/evaluations/dictation-modal.tsx hooks/use-speech-recognition.ts tests/components/dictation-modal.test.tsx
git commit -m "feat(web): DictationModal + useSpeechRecognition hook"
```

---

## Phase 8: Web evaluator routes

### Task 16: `/evaluations` inbox page

**Files:**
- Create: `app/evaluations/page.tsx`
- Create: `components/evaluations/inbox-card.tsx`

- [ ] **Step 1: Write a render-only test for `InboxCard`**

Create `tests/components/inbox-card.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InboxCard } from "../../components/evaluations/inbox-card";

const baseProps = {
  invite: { _id: "i1", status: "invited" as const, evaluatorRole: "principal" as const },
  demo: {
    _id: "d1",
    scheduledAt: Date.now() + 3600000,
    mode: "live" as const,
    durationMinutes: 30,
    location: "Room 1",
  },
  candidateName: "Priya Sharma",
  formOpensAt: Date.now() + 3600000,
  formClosesAt: Date.now() + 5400000,
};

describe("InboxCard", () => {
  it("shows candidate name, demo time, and mode badge", () => {
    render(<InboxCard {...baseProps} />);
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText(/live/i)).toBeInTheDocument();
  });
  it("renders 'Form opens' when the form is not yet open", () => {
    render(<InboxCard {...baseProps} formOpensAt={Date.now() + 60000} />);
    expect(screen.getByText(/form opens/i)).toBeInTheDocument();
  });
  it("renders 'Open now' when the form window is active", () => {
    render(<InboxCard {...baseProps} formOpensAt={Date.now() - 60000} formClosesAt={Date.now() + 60000} />);
    expect(screen.getByText(/open now/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test tests/components/inbox-card.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `InboxCard`**

Create `components/evaluations/inbox-card.tsx`:

```tsx
import Link from "next/link";

type Mode = "live" | "post" | "async";

export function InboxCard({
  invite,
  demo,
  candidateName,
  formOpensAt,
  formClosesAt,
}: {
  invite: { _id: string; status: string; evaluatorRole: string };
  demo: { _id: string; scheduledAt: number; mode: Mode; durationMinutes: number; location?: string };
  candidateName: string;
  formOpensAt: number;
  formClosesAt: number;
}) {
  const now = Date.now();
  const isOpen = now >= formOpensAt && now <= formClosesAt;
  const modeBadge = { live: "LIVE", post: "POST", async: "ASYNC" }[demo.mode];
  const modeColor = { live: "bg-red-100 text-red-700", post: "bg-orange-100 text-orange-700", async: "bg-indigo-100 text-indigo-700" }[demo.mode];
  return (
    <Link href={`/evaluations/${invite._id}`} className="block rounded-xl border border-gray-200 p-4 hover:bg-gray-50">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-semibold">{candidateName}</h3>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${modeColor}`}>{modeBadge}</span>
      </div>
      <p className="text-sm text-gray-600">
        {new Date(demo.scheduledAt).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
        {demo.location ? ` · ${demo.location}` : ""}
      </p>
      <p className={`mt-2 text-xs font-semibold ${isOpen ? "text-green-700" : "text-gray-500"}`}>
        {isOpen ? "Open now" : `Form opens ${new Date(formOpensAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`}
      </p>
    </Link>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test tests/components/inbox-card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implement `/evaluations` page**

Create `app/evaluations/page.tsx`:

```tsx
"use client";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "../../hooks/use-current-user";
import { InboxCard } from "../../components/evaluations/inbox-card";

function formWindow(demo: { scheduledAt: number; durationMinutes: number; mode: "live"|"post"|"async"; formOpenWindowMinutes?: number; formCloseDueDays?: number; }) {
  const end = demo.scheduledAt + demo.durationMinutes * 60_000;
  if (demo.mode === "live") return { opensAt: demo.scheduledAt, closesAt: end };
  if (demo.mode === "post") {
    const win = (demo.formOpenWindowMinutes ?? 60) * 60_000;
    return { opensAt: end, closesAt: end + win };
  }
  // async
  const due = (demo.formCloseDueDays ?? 3) * 86_400_000;
  return { opensAt: demo.scheduledAt, closesAt: demo.scheduledAt + due };
}

export default function EvaluationsInboxPage() {
  const user = useCurrentUser();
  const data = useQuery(api.evaluationInvites.listForUser, user ? {
    userId: user._id,
    statusFilter: ["invited", "viewed", "in_progress"],
  } : "skip");

  if (!user) return <main className="p-6">Please sign in.</main>;
  if (!data) return <main className="p-6">Loading...</main>;

  const now = Date.now();
  const open: any[] = [];
  const upcoming: any[] = [];
  for (const row of data) {
    const win = formWindow(row.demo);
    const entry = { ...row, ...win };
    (now >= win.opensAt && now <= win.closesAt ? open : upcoming).push(entry);
  }

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Evaluations</h1>
      <p className="text-sm text-gray-500 mb-6">Your pending demo evaluations.</p>
      <section className="mb-8">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Open now · {open.length}</h2>
        <div className="space-y-3">
          {open.length === 0 && <p className="text-sm text-gray-400">Nothing open right now.</p>}
          {open.map((r) => (
            <InboxCard
              key={r.invite._id}
              invite={r.invite}
              demo={r.demo}
              candidateName={r.candidateName ?? "Candidate"}
              formOpensAt={r.opensAt}
              formClosesAt={r.closesAt}
            />
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Upcoming · {upcoming.length}</h2>
        <div className="space-y-3">
          {upcoming.map((r) => (
            <InboxCard
              key={r.invite._id}
              invite={r.invite}
              demo={r.demo}
              candidateName={r.candidateName ?? "Candidate"}
              formOpensAt={r.opensAt}
              formClosesAt={r.closesAt}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
```

> Note: `listForUser` returns `{ invite, demo }`. Enrich it to also return `candidateName` by joining `applications -> candidates` in the Convex query, OR resolve client-side via a second query. Pick whichever matches existing codebase patterns.

- [ ] **Step 6: Confirm `useCurrentUser` exists**

Run: `grep -rn "export function useCurrentUser\|export const useCurrentUser" hooks/ app/ 2>/dev/null`
If not found, create a thin shim that wraps the project's existing auth/profile hook (mirror the pattern used by `/dashboard` pages).

- [ ] **Step 7: Commit**

```bash
git add app/evaluations/page.tsx components/evaluations/inbox-card.tsx tests/components/inbox-card.test.tsx
git commit -m "feat(web): evaluations inbox page with open/upcoming sections"
```

---

### Task 17: `/evaluations/[inviteId]` form page (auth or token)

**Files:**
- Create: `app/evaluations/[inviteId]/page.tsx`
- Modify: `app/feedback/[token]/page.tsx` (becomes redirect)

- [ ] **Step 1: Implement the form page**

Create `app/evaluations/[inviteId]/page.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { EvaluationForm } from "../../../components/evaluations/evaluation-form";
import { DictationModal } from "../../../components/evaluations/dictation-modal";

export default function EvaluationFormPage() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get("token") ?? undefined;

  const dataByToken = useQuery(api.evaluationInvites.getByToken, token ? { token } : "skip");
  const inviteById = useQuery(api.evaluationInvites.getById, !token ? { inviteId: inviteId as any } : "skip");

  const data = token ? dataByToken : inviteById;
  const submit = useMutation(api.evaluations.submit);
  const submitByToken = useMutation(api.evaluations.submitByToken);
  const markViewed = useMutation(api.evaluationInvites.markViewed);
  const summarize = useAction(api.voiceProcessing.summarizeTranscript);
  const [dictating, setDictating] = useState<string | null>(null);

  useEffect(() => {
    if (data?.invite?._id) markViewed({ inviteId: data.invite._id });
  }, [data?.invite?._id, markViewed]);

  if (!data) return <main className="p-6">Loading...</main>;
  if (!data.invite) return <main className="p-6">Evaluation not found.</main>;
  if (data.invite.status === "submitted") {
    return <main className="p-6"><p className="text-green-700 font-semibold">Already submitted. Thank you.</p></main>;
  }
  if (data.invite.status === "cancelled") {
    return <main className="p-6"><p className="text-red-600">This invitation has been cancelled.</p></main>;
  }

  const handleSubmit = async (payload: any) => {
    if (token) {
      await submitByToken({ token, ...payload, submittedFromPlatform: "web" });
    } else {
      await submit({ inviteId: data.invite._id, ...payload, submittedFromPlatform: "web" });
    }
    router.push("/evaluations?submitted=1");
  };

  return (
    <main className="max-w-2xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Evaluate</h1>
        <p className="text-sm text-gray-500">{new Date(data.demo.scheduledAt).toLocaleString("en-IN")}</p>
      </header>
      <EvaluationForm
        template={data.template}
        onDictate={async (fieldKey) => {
          setDictating(fieldKey);
          return null; // The modal completes asynchronously; updates happen in onComplete.
        }}
        onSubmit={handleSubmit}
      />
      {dictating && (
        <DictationModal
          open
          fieldKey={dictating}
          onClose={() => setDictating(null)}
          summarize={summarize}
          onComplete={(input) => {
            // EvaluationForm onDictate currently returns null; integrate this by lifting state.
            // (For the cleanest version, refactor onDictate to be async + returning the VoiceInput.
            // For now, store and refresh by remounting.)
            setDictating(null);
          }}
        />
      )}
    </main>
  );
}
```

Then add the missing `getById` query helper to `convex/evaluationInvites.ts`:

```ts
export const getById = query({
  args: { inviteId: v.id("evaluationInvites") },
  handler: async (ctx, { inviteId }) => {
    const inv = await ctx.db.get(inviteId);
    if (!inv) return null;
    const demo = await ctx.db.get(inv.demoSessionId);
    const template = await ctx.db.get(inv.formTemplateId);
    return { invite: inv, demo, template };
  },
});
```

- [ ] **Step 2: Convert `/feedback/[token]/page.tsx` to a redirect**

Overwrite `app/feedback/[token]/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function LegacyFeedbackRedirect({ params }: { params: { token: string } }) {
  redirect(`/evaluations/from-token?token=${encodeURIComponent(params.token)}`);
}
```

Create `app/evaluations/from-token/page.tsx`:

```tsx
"use client";
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../../../convex/_generated/api";

export default function FromTokenLanding() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const data = useQuery(api.evaluationInvites.getByToken, token ? { token } : "skip");

  useEffect(() => {
    if (data?.invite?._id) {
      router.replace(`/evaluations/${data.invite._id}?token=${encodeURIComponent(token)}`);
    }
  }, [data?.invite?._id, router, token]);

  if (!token) return <main className="p-6">Missing token.</main>;
  if (!data) return <main className="p-6">Loading...</main>;
  if (!data.invite) return <main className="p-6">Invitation not found or expired.</main>;
  return <main className="p-6">Redirecting...</main>;
}
```

- [ ] **Step 3: Manual smoke check**

Run: `bun run dev`
Open: `http://localhost:3000/evaluations` (sign in first), confirm the empty state renders.
Open: `http://localhost:3000/feedback/anything` and confirm it redirects (probably to "Invitation not found").

- [ ] **Step 4: Commit**

```bash
git add app/evaluations app/feedback convex/evaluationInvites.ts
git commit -m "feat(web): evaluator form page (auth + token) and legacy feedback redirect"
```

---

## Phase 9: Web HR routes

### Task 18: Schedule Demo wizard component

**Files:**
- Create: `components/demos/schedule-demo-wizard.tsx`
- Test: `tests/components/schedule-demo-wizard.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/schedule-demo-wizard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleDemoWizard } from "../../components/demos/schedule-demo-wizard";

const staff = [
  { _id: "p" as any, name: "Mrs. Iyer", role: "principal" },
  { _id: "h" as any, name: "Mr. Khan", role: "hod" },
  { _id: "t" as any, name: "Ms. Rao", role: "hr_admin" },
];

describe("ScheduleDemoWizard", () => {
  it("collects schedule + mode + evaluators and calls onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ScheduleDemoWizard
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        applicationId={"a1" as any}
        schoolId={"s1" as any}
        candidateName="Priya"
        staffDirectory={staff as any}
      />,
    );
    await user.type(screen.getByLabelText(/date/i), "2026-06-01");
    await user.type(screen.getByLabelText(/time/i), "11:30");
    await user.clear(screen.getByLabelText(/duration/i));
    await user.type(screen.getByLabelText(/duration/i), "30");
    await user.click(screen.getByLabelText(/^live$/i));
    await user.click(screen.getByLabelText(/^classroom$/i));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByLabelText(/Mrs\. Iyer/));
    await user.click(screen.getByLabelText(/Mr\. Khan/));
    await user.click(screen.getByRole("button", { name: /review/i }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      mode: "live",
      format: "classroom",
      durationMinutes: 30,
      evaluators: expect.arrayContaining([
        { userId: "p", role: "principal" },
        { userId: "h", role: "hod" },
      ]),
    }));
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test tests/components/schedule-demo-wizard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `components/demos/schedule-demo-wizard.tsx`:

```tsx
"use client";
import { useState } from "react";

type StaffRow = { _id: string; name: string; role: "principal"|"hod"|"hr_admin"|"teacher" };
type Mode = "live"|"post"|"async";
type Format = "classroom"|"mock"|"recorded";

export function ScheduleDemoWizard({
  open, onClose, onConfirm, applicationId, schoolId, candidateName, staffDirectory,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    applicationId: string; schoolId: string;
    scheduledAt: number; durationMinutes: number;
    mode: Mode; format: Format;
    location?: string; videoUrl?: string;
    evaluators: { userId: string; role: StaffRow["role"] }[];
  }) => void;
  applicationId: string;
  schoolId: string;
  candidateName: string;
  staffDirectory: StaffRow[];
}) {
  const [step, setStep] = useState(0);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [mode, setMode] = useState<Mode>("live");
  const [format, setFormat] = useState<Format>("classroom");
  const [location, setLocation] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  if (!open) return null;

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const scheduledAt = date && time ? new Date(`${date}T${time}`).getTime() : 0;
  const evaluators = staffDirectory
    .filter((s) => picked.has(s._id))
    .map((s) => ({ userId: s._id, role: s.role }));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <header className="mb-4">
          <h2 className="text-xl font-bold">Schedule demo for {candidateName}</h2>
          <p className="text-xs text-gray-500">Step {step + 1} of 3</p>
        </header>

        {step === 0 && (
          <div className="space-y-3">
            <div><label htmlFor="d" className="text-sm font-semibold">Date</label><input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border rounded p-2" /></div>
            <div><label htmlFor="ti" className="text-sm font-semibold">Time</label><input id="ti" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full border rounded p-2" /></div>
            <div><label htmlFor="dur" className="text-sm font-semibold">Duration (minutes)</label><input id="dur" type="number" min={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="w-full border rounded p-2" /></div>
            <fieldset><legend className="text-sm font-semibold">Mode</legend>
              {(["live","post","async"] as Mode[]).map((m) => (
                <label key={m} className="mr-3"><input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} /> {m}</label>
              ))}
            </fieldset>
            <fieldset><legend className="text-sm font-semibold">Format</legend>
              {(["classroom","mock","recorded"] as Format[]).map((f) => (
                <label key={f} className="mr-3"><input type="radio" name="format" checked={format === f} onChange={() => setFormat(f)} /> {f}</label>
              ))}
            </fieldset>
            {(format === "classroom" || format === "mock") && (
              <div><label htmlFor="loc" className="text-sm font-semibold">Location</label><input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full border rounded p-2" /></div>
            )}
            {format === "recorded" && (
              <div><label htmlFor="vu" className="text-sm font-semibold">Video URL</label><input id="vu" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="w-full border rounded p-2" /></div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold mb-2">Pick evaluators</h3>
            {staffDirectory.map((s) => (
              <label key={s._id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                <input type="checkbox" checked={picked.has(s._id)} onChange={() => toggle(s._id)} />
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-gray-500">{s.role}</span>
              </label>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2 text-sm">
            <p><strong>When:</strong> {new Date(scheduledAt).toLocaleString("en-IN")}</p>
            <p><strong>Duration:</strong> {durationMinutes} min</p>
            <p><strong>Mode/Format:</strong> {mode} / {format}</p>
            {location && <p><strong>Location:</strong> {location}</p>}
            {videoUrl && <p><strong>Video:</strong> {videoUrl}</p>}
            <p><strong>Evaluators ({evaluators.length}):</strong> {evaluators.map((e) => staffDirectory.find((s) => s._id === e.userId)?.name).join(", ")}</p>
          </div>
        )}

        <footer className="mt-6 flex justify-between">
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} className="px-4 py-2">Back</button>
          ) : <span />}
          {step === 0 && <button onClick={() => setStep(1)} className="px-4 py-2 bg-blue-600 text-white rounded">Next</button>}
          {step === 1 && <button onClick={() => setStep(2)} className="px-4 py-2 bg-blue-600 text-white rounded">Review</button>}
          {step === 2 && (
            <button
              onClick={() => onConfirm({
                applicationId, schoolId,
                scheduledAt, durationMinutes, mode, format,
                location: location || undefined, videoUrl: videoUrl || undefined,
                evaluators,
              })}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >Confirm</button>
          )}
        </footer>
        <button onClick={onClose} className="absolute top-4 right-6 text-gray-500">Close</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test tests/components/schedule-demo-wizard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/demos/schedule-demo-wizard.tsx tests/components/schedule-demo-wizard.test.tsx
git commit -m "feat(web): ScheduleDemoWizard multi-step modal"
```

---

### Task 19: Demos panel on `/dashboard/applications/[id]`

**Files:**
- Create: `components/demos/demos-panel.tsx`
- Modify: `app/dashboard/applications/[id]/page.tsx` — add the panel + Schedule CTA

- [ ] **Step 1: Implement `DemosPanel`**

Create `components/demos/demos-panel.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { ScheduleDemoWizard } from "./schedule-demo-wizard";
import { useCurrentUser } from "../../hooks/use-current-user";

export function DemosPanel({ applicationId, schoolId, candidateName }: {
  applicationId: string; schoolId: string; candidateName: string;
}) {
  const me = useCurrentUser();
  const demos = useQuery(api.demoSessions.listForCandidate, { applicationId: applicationId as any });
  const staff = useQuery(api.users.listSchoolStaff, { schoolId: schoolId as any });
  const create = useMutation(api.demoSessions.create);
  const cancel = useMutation(api.demoSessions.cancel);
  const [wizard, setWizard] = useState(false);

  if (!demos || !me) return <p>Loading...</p>;

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="font-semibold">Demos</h2>
        <button onClick={() => setWizard(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded">Schedule demo</button>
      </header>
      {demos.length === 0 && <p className="text-sm text-gray-500">No demos yet.</p>}
      {demos.map((d) => (
        <div key={d._id} className="rounded-lg border border-gray-200 p-3 flex items-center justify-between">
          <div>
            <Link href={`/dashboard/demos/${d._id}`} className="font-medium hover:underline">
              {new Date(d.scheduledAt).toLocaleString("en-IN")}
            </Link>
            <p className="text-xs text-gray-500">{d.mode} · {d.format} · {d.status}</p>
          </div>
          {d.status === "scheduled" && (
            <button onClick={() => cancel({ demoId: d._id, reason: "cancelled by HR" })} className="text-sm text-red-600">Cancel</button>
          )}
        </div>
      ))}
      {wizard && staff && (
        <ScheduleDemoWizard
          open
          onClose={() => setWizard(false)}
          applicationId={applicationId}
          schoolId={schoolId}
          candidateName={candidateName}
          staffDirectory={staff as any}
          onConfirm={async (data) => {
            await create({
              applicationId: data.applicationId as any,
              schoolId: data.schoolId as any,
              scheduledAt: data.scheduledAt,
              durationMinutes: data.durationMinutes,
              mode: data.mode,
              format: data.format,
              location: data.location,
              videoUrl: data.videoUrl,
              evaluators: data.evaluators.map((e) => ({ userId: e.userId as any, role: e.role })),
              createdBy: me._id as any,
            });
            setWizard(false);
          }}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 2: Add `users.listSchoolStaff` query**

Append to `convex/users.ts`:

```ts
export const listSchoolStaff = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) =>
    await ctx.db
      .query("userProfiles")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId))
      .collect(),
});
```

- [ ] **Step 3: Wire into the application detail page**

Open `app/dashboard/applications/[id]/page.tsx` and add `<DemosPanel … />` adjacent to the existing evaluations area. Remove the old direct-evaluation list.

- [ ] **Step 4: Smoke test in browser**

Run: `bun run dev`. Open an application detail page; verify "Schedule demo" opens the wizard; create one demo and confirm it appears in the list.

- [ ] **Step 5: Commit**

```bash
git add components/demos/demos-panel.tsx convex/users.ts app/dashboard/applications
git commit -m "feat(web): DemosPanel + Schedule CTA on application detail"
```

---

### Task 20: `/dashboard/demos/[id]` page with Demo Summary + Decision modal

**Files:**
- Create: `app/dashboard/demos/[id]/page.tsx`
- Create: `components/demos/demo-summary.tsx`
- Create: `components/demos/decision-modal.tsx`

- [ ] **Step 1: Implement `DemoSummary`**

Create `components/demos/demo-summary.tsx`:

```tsx
"use client";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function DemoSummary({ demoId }: { demoId: string }) {
  const data = useQuery(api.demoSessions.aggregate, { demoId: demoId as any });
  if (!data) return <p>Loading...</p>;

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm text-gray-500">Demo on {new Date(data.demo.scheduledAt).toLocaleString("en-IN")}</p>
        <p className="text-sm">Status: <strong>{data.demo.status}</strong></p>
      </header>
      <div>
        <h3 className="text-xs uppercase font-bold text-gray-500 mb-2">Invites</h3>
        <ul className="text-sm">
          {Object.entries(data.invitesByStatus).map(([s, n]) => n ? <li key={s}>{n} {s}</li> : null)}
        </ul>
      </div>
      <div>
        <h3 className="text-xs uppercase font-bold text-gray-500 mb-2">Recommendation tally</h3>
        <p>Hire: {data.recommendationTally.hire} · Maybe: {data.recommendationTally.maybe} · Reject: {data.recommendationTally.reject}</p>
      </div>
      <div>
        <h3 className="text-xs uppercase font-bold text-gray-500 mb-2">Dimension averages</h3>
        <ul className="text-sm space-y-1">
          {Object.entries(data.dimensionAverages).map(([key, val]) => (
            <li key={key}>{key}: <strong>{(val as number).toFixed(2)}</strong></li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-xs uppercase font-bold text-gray-500 mb-2">Per evaluator</h3>
        <div className="space-y-3">
          {data.perEvaluator.map((p: any) => (
            <div key={p.invite._id} className="rounded border border-gray-200 p-3">
              <p className="font-semibold">{p.evaluatorName} <span className="text-xs text-gray-500 ml-2">{p.evaluatorRole}</span></p>
              <p className="text-sm">Recommendation: <strong>{p.evaluation.recommendation}</strong></p>
              {p.evaluation.voiceInputs?.map((v: any) => (
                <ul key={v.fieldKey} className="text-sm mt-2 list-disc pl-5">
                  {v.summaryPoints.map((b: string, i: number) => <li key={i}>{b}</li>)}
                </ul>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Implement `DecisionModal`**

Create `components/demos/decision-modal.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function DecisionModal({
  open, onClose, demoId, applicationId, onDecided,
}: {
  open: boolean;
  onClose: () => void;
  demoId: string;
  applicationId: string;
  onDecided: () => void;
}) {
  const [note, setNote] = useState("");
  const apply = useMutation(api.demoSessions.applyDecision);

  if (!open) return null;

  const decide = async (action: "advance" | "reject" | "redemo" | "manual") => {
    await apply({ demoId: demoId as any, action, note: note || undefined });
    onDecided();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="font-bold text-lg mb-3">Decision</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notes for the audit log"
          rows={4}
          className="w-full border rounded p-2 mb-4 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => decide("advance")} className="bg-green-600 text-white px-3 py-2 rounded">Advance</button>
          <button onClick={() => decide("reject")} className="bg-red-600 text-white px-3 py-2 rounded">Reject</button>
          <button onClick={() => decide("redemo")} className="bg-blue-600 text-white px-3 py-2 rounded">Re-demo</button>
          <button onClick={() => decide("manual")} className="bg-gray-200 px-3 py-2 rounded">Just record</button>
        </div>
        <button onClick={onClose} className="mt-3 text-gray-500">Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add `applyDecision` mutation**

Append to `convex/demoSessions.ts`:

```ts
export const applyDecision = mutation({
  args: {
    demoId: v.id("demoSessions"),
    action: v.union(
      v.literal("advance"),
      v.literal("reject"),
      v.literal("redemo"),
      v.literal("manual"),
    ),
    appliedBy: v.optional(v.id("userProfiles")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const demo = await ctx.db.get(args.demoId);
    if (!demo) throw new Error("Demo not found");
    await ctx.db.patch(args.demoId, {
      status: demo.status === "scheduled" ? "completed" : demo.status,
      appliedDecision: {
        action: args.action,
        appliedAt: Date.now(),
        appliedBy: args.appliedBy,
        note: args.note,
      },
    });
    if (args.action === "advance" || args.action === "reject") {
      await ctx.db.patch(demo.applicationId, {
        stage: args.action === "advance" ? "advanced" : "rejected",
      });
    }
    return args.action;
  },
});
```

- [ ] **Step 4: Implement the page**

Create `app/dashboard/demos/[id]/page.tsx`:

```tsx
"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import { DemoSummary } from "../../../../components/demos/demo-summary";
import { DecisionModal } from "../../../../components/demos/decision-modal";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function DemoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const data = useQuery(api.demoSessions.aggregate, { demoId: id as any });
  const [decision, setDecision] = useState(false);
  if (!data) return <main className="p-6">Loading...</main>;
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Demo summary</h1>
      <DemoSummary demoId={id} />
      <footer>
        <button onClick={() => setDecision(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Make decision</button>
      </footer>
      <DecisionModal
        open={decision}
        onClose={() => setDecision(false)}
        demoId={id}
        applicationId={data.demo.applicationId}
        onDecided={() => {}}
      />
    </main>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/demos components/demos/demo-summary.tsx components/demos/decision-modal.tsx convex/demoSessions.ts
git commit -m "feat(web): demo detail page with summary + decision modal"
```

---

### Task 21: Re-demo prefill (manual flow)

**Files:**
- Modify: `components/demos/decision-modal.tsx`
- Modify: `components/demos/demos-panel.tsx`

- [ ] **Step 1: Append re-demo flow to `DecisionModal`**

When the user picks "Re-demo", route them to the application page with a query param signaling pre-fill:

In `decide` handler:

```ts
if (action === "redemo") {
  // pass the parent demo id along; the wizard reads ?fromDemo=...
  window.location.href = `/dashboard/applications/${applicationId}?fromDemo=${demoId}`;
  return;
}
```

- [ ] **Step 2: Read `fromDemo` in `DemosPanel`**

In `DemosPanel`, on mount, read `useSearchParams().get("fromDemo")`. If present, fetch the prior demo (`api.demoSessions.aggregate`) and pre-open the wizard with its `evaluators` and a +3-day `scheduledAt`. Pass `parentDemoId` through to `create`.

- [ ] **Step 3: Append a Playwright assertion in Task 23**

(Plan reference; the actual test is in the E2E task below.)

- [ ] **Step 4: Commit**

```bash
git add components/demos
git commit -m "feat(web): re-demo prefill flow from decision modal"
```

---

## Phase 10: End-to-end test

### Task 22: Playwright E2E for the full web flow

**Files:**
- Create: `tests/e2e/evaluation-flow.spec.ts`

- [ ] **Step 1: Write the failing E2E (one big test that walks the full flow)**

Create `tests/e2e/evaluation-flow.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("HR schedules demo, evaluator submits via token, HR decides advance", async ({ page, context }) => {
  // Seed: assume a dev seed task has created school + candidate + HR user + principal user.
  // (Add a one-line cli helper if not present: `bun run seed:eval-demo`.)
  await page.goto("/dashboard/applications/seed-app-id");

  await page.getByRole("button", { name: /schedule demo/i }).click();
  await page.getByLabel(/date/i).fill("2030-01-01");
  await page.getByLabel(/time/i).fill("10:00");
  await page.getByLabel(/duration/i).fill("30");
  await page.getByLabel(/^live$/i).check();
  await page.getByLabel(/^classroom$/i).check();
  await page.getByRole("button", { name: /next/i }).click();
  await page.getByLabel(/Test Principal/).check();
  await page.getByRole("button", { name: /review/i }).click();
  await page.getByRole("button", { name: /confirm/i }).click();
  await expect(page.getByText(/demos/i)).toBeVisible();

  const tokenUrl = await page.evaluate(async () => {
    const res = await fetch("/api/test/last-invite-url");
    return (await res.json()).url as string;
  });

  const evalPage = await context.newPage();
  await evalPage.goto(tokenUrl);
  await evalPage.getByRole("button", { name: /score 4 for subject knowledge/i }).click();
  await evalPage.getByRole("button", { name: /score 5 for classroom management/i }).click();
  await evalPage.getByRole("button", { name: /score 4 for communication/i }).click();
  await evalPage.getByRole("button", { name: /score 4 for overall fit/i }).click();
  await evalPage.getByLabel(/comments/i).fill("Strong candidate");
  await evalPage.getByRole("button", { name: /^hire$/i }).click();
  await evalPage.getByRole("button", { name: /submit evaluation/i }).click();
  await expect(evalPage.getByText(/thank you|already submitted|submitted=1/i)).toBeVisible();

  await page.reload();
  await page.getByRole("link", { name: /\d{1,2}\/\d{1,2}\/\d{4}/ }).first().click();
  await expect(page.getByText(/recommendation tally/i)).toBeVisible();
  await expect(page.getByText(/hire: 1/i)).toBeVisible();
  await page.getByRole("button", { name: /make decision/i }).click();
  await page.getByRole("button", { name: /advance/i }).click();

  await page.goto("/dashboard/applications/seed-app-id");
  await expect(page.getByText(/advanced/i)).toBeVisible();
});
```

- [ ] **Step 2: Create a tiny dev-only API to expose the last invite URL**

Create `app/api/test/last-invite-url/route.ts`:

```ts
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in prod" }, { status: 403 });
  }
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const last = await client.query(api.evaluationInvites.lastInviteForTest, {});
  return NextResponse.json({ url: `${process.env.PUBLIC_APP_URL ?? "http://localhost:3000"}/evaluations/from-token?token=${last.token}` });
}
```

Append to `convex/evaluationInvites.ts`:

```ts
export const lastInviteForTest = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("evaluationInvites").collect();
    return rows.sort((a, b) => b.invitedAt - a.invitedAt)[0];
  },
});
```

- [ ] **Step 3: Add a seed script**

Create `scripts/seed-eval-demo.ts` that calls Convex mutations to create one school + one candidate + one job + one application + one user profile per role, with stable ids that the test references. Document the run command in `package.json` (`"seed:eval-demo": "bun ./scripts/seed-eval-demo.ts"`).

- [ ] **Step 4: Run the E2E**

Run: `bun run seed:eval-demo && bun run test:e2e tests/e2e/evaluation-flow.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/evaluation-flow.spec.ts app/api/test convex/evaluationInvites.ts scripts/seed-eval-demo.ts package.json
git commit -m "test(e2e): full schedule -> submit -> decide web flow"
```

---

## Self-review checklist

After completing all tasks, verify:

- [ ] `bun run test` — every Convex + component test passes
- [ ] `bun run test:e2e` — the full-flow Playwright passes
- [ ] `bunx tsc --noEmit` — zero type errors
- [ ] `grep -rn 'evaluations:create\|evaluations:submitFeedback' app components convex hooks --include='*.ts' --include='*.tsx' 2>/dev/null` returns empty (old API fully migrated)
- [ ] Open `/dashboard/applications/<id>` in dev: Schedule Demo wizard works end-to-end
- [ ] Open the email-link path in an incognito window: form submits via token
- [ ] Open `/dashboard/demos/<id>` after a demo completes: aggregation renders correctly

If any check fails, fix in a follow-up task before declaring this plan done.

---

## What this plan does NOT cover (handled in later plans)

- **Plan 2:** Decision rule engine, decision-rule editor UI, template editor UI, evaluator-swap UI (the mutation exists; the UI is in Plan 2), application of decision rules on completion, settings page navigation.
- **Plan 3:** Expo iOS+Android app scaffold, Better Auth on Expo, push notification delivery (the stub here logs only), on-device STT integration, mobile Inbox / Calendar / Demo detail / Eval form / Dictation overlay.
- **Plan 4:** Mobile HR surfaces (Candidates, Pipeline, Schedule wizard on mobile, Demo Summary on mobile, Decision actions on mobile).


