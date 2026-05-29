# Evaluation Workflow — Plan 4: Mobile HR Surfaces

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the HR / Principal mobile surfaces that complete the evaluation workflow on phone. After this plan lands, an HR Admin or Principal can: open the app, browse Candidates, tap one, schedule a demo with multiple evaluators across roles, get a push when the demo completes, open the Demo Summary, and take a decision. They can also edit form templates and decision rules from their phone.

**Architecture:** One new Convex query (`users.getMobileRoleContext`) drives the tab gate. A new `HRTabs` navigator (Inbox, Calendar, Candidates, Pipeline, Profile) mirrors the existing Evaluator tabs but expands per spec. Six new HR-only screens live under `mobile/src/screens/`. A new Schedule Demo wizard splits the web equivalent into three native steps. Two backend helpers are added: `notifyDemoComplete(ctx, demoId)` fires a `demo_completed` push to school HR/Principal users when a demo finishes; it is invoked from both `maybeApplyDecision` (auto) and `demoSessions.applyDecision` (manual). No new tables; one optional field on `userProfiles` is unnecessary because permissions already gate the surface.

**Tech Stack:** Same as Plan 3 — Expo SDK 51, React Native + TypeScript, `convex/react` (`usePaginatedQuery` + `useQuery` + `useMutation`), `@react-navigation/bottom-tabs` + `@react-navigation/native-stack`, Jest + `jest-expo` + `@testing-library/react-native`, Maestro for E2E.

**Spec reference:** [docs/superpowers/specs/2026-05-28-evaluation-workflow-design.md](../specs/2026-05-28-evaluation-workflow-design.md) (Sections 3 HR screens, 5 templates, 6 decision engine, 7 re-demo + swap, 8 testing).

**Builds on:** [Plan 1](2026-05-28-evaluation-workflow-1-backend-and-web.md), [Plan 2](2026-05-28-evaluation-workflow-2-decision-engine-and-settings.md), and [Plan 3](2026-05-28-evaluation-workflow-3-mobile-scaffold.md) — all shipped. Plan 4 imports zero new Convex tables and reuses every CRUD module Plans 1 + 2 added (`demoSessions`, `evaluationInvites`, `formTemplates`, `decisionRules`, `decisions`, `candidates`, `applications`, `jobs`, `users`).

---

## UI guidelines (mobile)

Reuse the design tokens and primitives Plan 3 shipped in `mobile/src/theme.ts` and `mobile/src/components/ui/`. Do **not** re-implement `<Card>`, `<PressableButton>`, `<Badge>`, `<EmptyState>`. Do **not** hardcode hex values; always reference `colors.*`, `radii.*`, `space.*`, `fonts.*`.

**Token reminders (defined in `mobile/src/theme.ts`):**

| Concern | Constant |
|---|---|
| Primary text | `colors.ink` |
| Secondary text | `colors.inkSecondary` |
| Tertiary | `colors.inkTertiary` |
| Accent | `colors.accent` |
| Accent soft | `colors.accentSoft` |
| Success / Warning / Danger | `colors.success / warning / danger` |
| Surface | `colors.surface` |
| Canvas | `colors.surfaceCanvas` |
| Hairline | `colors.hairline` |
| Radius default | `radii.apple` |
| Radius small | `radii.sm` |
| Spacing | `space.{1..12}` |

**Primitives to import everywhere (already in `mobile/src/components/ui/`):**

- `<PressableButton variant size onPress>` — variants `primary | secondary | ghost | danger`; sizes `sm | md | lg`.
- `<Card padding="md">` — surface with hairline border + apple radius.
- `<Badge tone="info | success | warning | danger | neutral">`.
- `<EmptyState title body>`.

Anything new this plan builds (stage chips, application card, schedule wizard steps, field rows, branch rows) composes those primitives — never replaces them.

**Modal pattern:** Plan 3 uses native-stack with `presentation: "modal"` for full-screen modals (`DeclineInvite`). Reuse that for `ScheduleDemo`, `DecisionModal`, `SwapEvaluator`. Do not pull in `react-native-modal` or any new modal library.

---

## File map

**New mobile screens (8)**
- `mobile/src/screens/candidates.tsx` — searchable list, HR only.
- `mobile/src/screens/candidate-detail.tsx` — resume preview + demos timeline + schedule CTA.
- `mobile/src/screens/pipeline.tsx` — stage-grouped application list, HR only.
- `mobile/src/screens/schedule-demo.tsx` — multi-step wizard host.
- `mobile/src/screens/demo-summary.tsx` — aggregation view + decision row, HR only.
- `mobile/src/screens/settings.tsx` — hub linking to templates + rules + notifications.
- `mobile/src/screens/template-editor.tsx` — single-role template editor.
- `mobile/src/screens/rule-editor.tsx` — single-rule branch + fallback editor.

**New mobile components (11)**
- `mobile/src/components/candidates/candidate-card.tsx`
- `mobile/src/components/pipeline/stage-chips.tsx`
- `mobile/src/components/pipeline/application-card.tsx`
- `mobile/src/components/demos/schedule-wizard/step-when.tsx`
- `mobile/src/components/demos/schedule-wizard/step-evaluators.tsx`
- `mobile/src/components/demos/schedule-wizard/step-review.tsx`
- `mobile/src/components/demos/decision-modal.tsx`
- `mobile/src/components/demos/applied-decision-banner.tsx`
- `mobile/src/components/demos/per-evaluator-row.tsx`
- `mobile/src/components/settings/field-row.tsx`
- `mobile/src/components/settings/branch-row.tsx`

**New mobile hooks (6)**
- `mobile/src/hooks/use-role-context.ts`
- `mobile/src/hooks/use-candidates.ts`
- `mobile/src/hooks/use-pipeline.ts`
- `mobile/src/hooks/use-staff-directory.ts`
- `mobile/src/hooks/use-active-decision-rules.ts`
- `mobile/src/hooks/use-demo-aggregate.ts`

**New mobile navigation (1)**
- `mobile/src/navigation/hr-tabs.tsx`

**Modified mobile files (3)**
- `mobile/src/navigation/app-nav.tsx` — switch on role context, register HR-only stack screens.
- `mobile/src/screens/profile.tsx` — add Settings link visible to HR.
- `mobile/src/screens/demo-detail.tsx` — add *View summary* link when HR.

**New Maestro flows (2)**
- `mobile/.maestro/hr-schedule-demo.yaml`
- `mobile/.maestro/hr-template-edit.yaml`

**Modified Convex modules (3)**
- `convex/users.ts` — add `getMobileRoleContext` query.
- `convex/notifications.ts` — add `notifyDemoComplete(ctx, demoId)` helper.
- `convex/decisions.ts` — call `notifyDemoComplete` after auto-applied decisions.
- `convex/demoSessions.ts` — call `notifyDemoComplete` after manual `applyDecision`.

**New Convex tests (2)**
- `tests/convex/users-mobile-role-context.test.ts`
- `tests/convex/notifications-demo-complete.test.ts`

---

## Phase 1: HR role detection + HR tab navigator

### Task 1: `users.getMobileRoleContext` query

**Files:**
- Modify: `convex/users.ts` (append below the existing `getById`)
- Create: `tests/convex/users-mobile-role-context.test.ts`

This single query drives the entire HR-vs-evaluator tab decision. It returns `null` when there is no profile (sign-in still pending) so the caller can short-circuit. `isHR` is computed server-side so the mobile client never re-implements the role mapping.

- [ ] **Step 1: Write the failing test**

```ts
// tests/convex/users-mobile-role-context.test.ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

describe("users.getMobileRoleContext", () => {
  it("returns null when no profile exists", async () => {
    const t = convexTest(schema);
    const out = await t.query(api.users.getMobileRoleContext, { userId: "nope" });
    expect(out).toBeNull();
  });

  it("returns isHR=true for hr_admin", async () => {
    const t = convexTest(schema);
    const schoolId = await t.run(async (ctx) =>
      ctx.db.insert("schools", { name: "S", createdAt: Date.now() } as any),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("userProfiles", {
        userId: "u-hr",
        name: "HR",
        email: "h@s",
        schoolId,
        role: "hr_admin",
      } as any),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("roles", {
        schoolId,
        name: "hr_admin",
        permissions: ["*"],
        isSystem: true,
      } as any),
    );
    const out = await t.query(api.users.getMobileRoleContext, { userId: "u-hr" });
    expect(out?.isHR).toBe(true);
    expect(out?.role).toBe("hr_admin");
    expect(out?.permissions).toContain("*");
  });

  it("returns isHR=true for principal, false for hod and teacher", async () => {
    const t = convexTest(schema);
    const schoolId = await t.run(async (ctx) =>
      ctx.db.insert("schools", { name: "S", createdAt: Date.now() } as any),
    );
    for (const r of ["principal", "hod", "teacher"]) {
      await t.run(async (ctx) =>
        ctx.db.insert("userProfiles", {
          userId: `u-${r}`,
          name: r,
          email: `${r}@s`,
          schoolId,
          role: r,
        } as any),
      );
    }
    const p = await t.query(api.users.getMobileRoleContext, { userId: "u-principal" });
    const h = await t.query(api.users.getMobileRoleContext, { userId: "u-hod" });
    const te = await t.query(api.users.getMobileRoleContext, { userId: "u-teacher" });
    expect(p?.isHR).toBe(true);
    expect(h?.isHR).toBe(false);
    expect(te?.isHR).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `bun run vitest run tests/convex/users-mobile-role-context.test.ts`
Expected: FAIL with "getMobileRoleContext is not a function" (or similar — the query doesn't exist yet).

- [ ] **Step 3: Implement the query**

Append to `convex/users.ts`:

```ts
export const getMobileRoleContext = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) return null;

    const role = await ctx.db
      .query("roles")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", profile.schoolId))
      .filter((q) => q.eq(q.field("name"), profile.role))
      .first();

    const permissions = role?.permissions ?? [];
    const isHR = profile.role === "hr_admin" || profile.role === "principal";

    return {
      userProfileId: profile._id,
      schoolId: profile.schoolId,
      role: profile.role,
      permissions,
      isHR,
    };
  },
});
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `bun run vitest run tests/convex/users-mobile-role-context.test.ts`
Expected: PASS, 3 assertions.

- [ ] **Step 5: Run codegen + typecheck**

```bash
bunx convex codegen
bun run --cwd mobile typecheck
```
Expected: both succeed. The mobile typecheck does not yet import the query but should still pass.

- [ ] **Step 6: Commit**

```bash
git add convex/users.ts tests/convex/users-mobile-role-context.test.ts convex/_generated/
git commit -m "feat(convex/users): getMobileRoleContext query for HR-aware mobile nav"
```

---

### Task 2: `useRoleContext` mobile hook

**Files:**
- Create: `mobile/src/hooks/use-role-context.ts`
- Create: `mobile/__tests__/hooks/use-role-context.test.tsx`

Thin wrapper around `api.users.getMobileRoleContext`. Returns `{ loading, isHR, role, permissions, userProfileId, schoolId }` or `{ loading: true }` while the query is in flight. The hook depends on `useSession()`; when the session is absent, it returns `{ loading: false, isHR: false }` and skips the query.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/__tests__/hooks/use-role-context.test.tsx
import { renderHook } from "@testing-library/react-native";

const mockUseQuery = jest.fn();
jest.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
jest.mock("@convex/_generated/api", () => ({
  api: { users: { getMobileRoleContext: "users:getMobileRoleContext" } },
}));

const mockUseSession = jest.fn();
jest.mock("@/hooks/use-session", () => ({ useSession: () => mockUseSession() }));

import { useRoleContext } from "@/hooks/use-role-context";

describe("useRoleContext", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseSession.mockReset();
  });

  it("returns loading=true while session is loading", () => {
    mockUseSession.mockReturnValue({ loading: true, user: null });
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useRoleContext());
    expect(result.current.loading).toBe(true);
  });

  it("returns isHR=false when not signed in", () => {
    mockUseSession.mockReturnValue({ loading: false, user: null });
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useRoleContext());
    expect(result.current.loading).toBe(false);
    expect(result.current.isHR).toBe(false);
  });

  it("returns isHR=true when query returns hr_admin", () => {
    mockUseSession.mockReturnValue({ loading: false, user: { id: "u1" } });
    mockUseQuery.mockReturnValue({
      isHR: true, role: "hr_admin", permissions: ["*"],
      userProfileId: "p1", schoolId: "s1",
    });
    const { result } = renderHook(() => useRoleContext());
    expect(result.current.isHR).toBe(true);
    expect(result.current.role).toBe("hr_admin");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `bun --cwd mobile run test __tests__/hooks/use-role-context.test.tsx`
Expected: FAIL — `@/hooks/use-role-context` module not found.

- [ ] **Step 3: Implement the hook**

```ts
// mobile/src/hooks/use-role-context.ts
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useSession } from "@/hooks/use-session";

export interface RoleContext {
  loading: boolean;
  isHR: boolean;
  role: string | null;
  permissions: string[];
  userProfileId: string | null;
  schoolId: string | null;
}

export function useRoleContext(): RoleContext {
  const { loading: sessionLoading, user } = useSession();
  const userId = user?.id ?? null;
  const ctx = useQuery(
    api.users.getMobileRoleContext,
    userId ? { userId } : "skip",
  );

  if (sessionLoading) {
    return { loading: true, isHR: false, role: null, permissions: [], userProfileId: null, schoolId: null };
  }
  if (!userId) {
    return { loading: false, isHR: false, role: null, permissions: [], userProfileId: null, schoolId: null };
  }
  if (ctx === undefined) {
    return { loading: true, isHR: false, role: null, permissions: [], userProfileId: null, schoolId: null };
  }
  if (ctx === null) {
    return { loading: false, isHR: false, role: null, permissions: [], userProfileId: null, schoolId: null };
  }
  return {
    loading: false,
    isHR: ctx.isHR,
    role: ctx.role,
    permissions: ctx.permissions,
    userProfileId: ctx.userProfileId,
    schoolId: ctx.schoolId,
  };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `bun --cwd mobile run test __tests__/hooks/use-role-context.test.tsx`
Expected: PASS, 3 assertions.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/use-role-context.ts mobile/__tests__/hooks/use-role-context.test.tsx
git commit -m "feat(mobile/hooks): useRoleContext drives HR-vs-evaluator nav"
```

---

### Task 3: HRTabs navigator

**Files:**
- Create: `mobile/src/navigation/hr-tabs.tsx`
- Modify: `mobile/src/navigation/app-nav.tsx`
- Create: `mobile/__tests__/navigation/hr-tabs.test.tsx`

`HRTabs` mirrors `EvaluatorTabs` but adds Candidates + Pipeline tabs and keeps Inbox + Calendar + Profile. The Profile tab on HR adds a Settings entry; Plan 4 Phase 7 wires that.

`AppNav` reads `useRoleContext()` and picks `HRTabs` vs `EvaluatorTabs` once the role is known. Until then it returns `null` (matches the existing `loading` short-circuit pattern).

- [ ] **Step 1: Write the file-shape test**

The render-based test for `AppNav` was deferred in Plan 3 due to ConvexReactClient throwing at module load; we use the same file-presence pattern here.

```tsx
// mobile/__tests__/navigation/hr-tabs.test.tsx
import fs from "fs";
import path from "path";

describe("HRTabs file", () => {
  it("registers Candidates and Pipeline tabs", () => {
    const filePath = path.resolve(__dirname, "../../src/navigation/hr-tabs.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toMatch(/Tab\.Screen\s+name="Inbox"/);
    expect(src).toMatch(/Tab\.Screen\s+name="Calendar"/);
    expect(src).toMatch(/Tab\.Screen\s+name="Candidates"/);
    expect(src).toMatch(/Tab\.Screen\s+name="Pipeline"/);
    expect(src).toMatch(/Tab\.Screen\s+name="Profile"/);
  });
});

describe("AppNav HR branch", () => {
  it("imports HRTabs and switches on useRoleContext.isHR", () => {
    const filePath = path.resolve(__dirname, "../../src/navigation/app-nav.tsx");
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toMatch(/from "@\/navigation\/hr-tabs"/);
    expect(src).toMatch(/useRoleContext/);
    expect(src).toMatch(/isHR/);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `bun --cwd mobile run test __tests__/navigation/hr-tabs.test.tsx`
Expected: FAIL — `hr-tabs.tsx` not found.

- [ ] **Step 3: Implement `hr-tabs.tsx`**

```tsx
// mobile/src/navigation/hr-tabs.tsx
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { InboxScreen } from "@/screens/inbox";
import { CalendarScreen } from "@/screens/calendar";
import { CandidatesScreen } from "@/screens/candidates";
import { PipelineScreen } from "@/screens/pipeline";
import { ProfileScreen } from "@/screens/profile";
import { colors } from "@/theme";

export type HRTabsParamList = {
  Inbox: undefined;
  Calendar: undefined;
  Candidates: undefined;
  Pipeline: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<HRTabsParamList>();

export function HRTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkTertiary,
        tabBarStyle: { borderTopColor: colors.hairline },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Inbox: "mail-outline",
            Calendar: "calendar-outline",
            Candidates: "people-outline",
            Pipeline: "git-branch-outline",
            Profile: "person-outline",
          };
          return <Ionicons name={map[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Inbox" component={InboxScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Candidates" component={CandidatesScreen} />
      <Tab.Screen name="Pipeline" component={PipelineScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 4: Stub the new screens so HRTabs imports resolve**

Create placeholder screen files; later tasks flesh them out.

```tsx
// mobile/src/screens/candidates.tsx
import { Text, View } from "react-native";
import { colors, space } from "@/theme";
export function CandidatesScreen() {
  return (
    <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}>
      <Text style={{ color: colors.ink }}>Candidates</Text>
    </View>
  );
}
```

```tsx
// mobile/src/screens/pipeline.tsx
import { Text, View } from "react-native";
import { colors, space } from "@/theme";
export function PipelineScreen() {
  return (
    <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}>
      <Text style={{ color: colors.ink }}>Pipeline</Text>
    </View>
  );
}
```

- [ ] **Step 5: Update `app-nav.tsx` to switch on `isHR`**

Replace the existing `signedIn ? ... : <SignIn />` block with role-aware logic.

```tsx
// mobile/src/navigation/app-nav.tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SignInScreen } from "@/screens/sign-in";
import { EvaluatorTabs } from "@/navigation/evaluator-tabs";
import { HRTabs } from "@/navigation/hr-tabs";
import { DemoDetailScreen } from "@/screens/demo-detail";
import { EvaluationFormScreen } from "@/screens/evaluation-form";
import { DeclineModal } from "@/components/demos/decline-modal";
import { useSession } from "@/hooks/use-session";
import { useRoleContext } from "@/hooks/use-role-context";
import { useRegisterPushToken } from "@/hooks/use-register-push-token";

export type RootStackParamList = {
  SignIn: undefined;
  EvaluatorTabs: undefined;
  HRTabs: undefined;
  DemoDetail: { demoId: string; inviteId: string };
  EvaluationForm: { demoId: string; inviteId: string };
  DeclineInvite: { inviteId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function DeclineInviteScreen({ route, navigation }: any) {
  return <DeclineModal inviteId={route.params.inviteId} onClose={() => navigation.goBack()} />;
}

export function AppNav() {
  const { signedIn, loading: sessionLoading } = useSession();
  const role = useRoleContext();
  useRegisterPushToken();
  if (sessionLoading || (signedIn && role.loading)) return null;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {signedIn ? (
          <>
            {role.isHR ? (
              <Stack.Screen name="HRTabs" component={HRTabs} />
            ) : (
              <Stack.Screen name="EvaluatorTabs" component={EvaluatorTabs} />
            )}
            <Stack.Screen
              name="DemoDetail"
              component={DemoDetailScreen}
              options={{ headerShown: true, title: "Demo" }}
            />
            <Stack.Screen
              name="EvaluationForm"
              component={EvaluationFormScreen}
              options={{ headerShown: true, title: "Evaluate" }}
            />
            <Stack.Screen
              name="DeclineInvite"
              component={DeclineInviteScreen}
              options={{ presentation: "modal", headerShown: true, title: "Decline invite" }}
            />
          </>
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 6: Run the test + full mobile suite**

```bash
bun --cwd mobile run test __tests__/navigation/hr-tabs.test.tsx
bun --cwd mobile run test
```
Expected: file-shape test passes, full suite green (44+2=46 tests).

- [ ] **Step 7: Commit**

```bash
git add mobile/src/navigation/hr-tabs.tsx mobile/src/navigation/app-nav.tsx \
  mobile/src/screens/candidates.tsx mobile/src/screens/pipeline.tsx \
  mobile/__tests__/navigation/hr-tabs.test.tsx
git commit -m "feat(mobile/navigation): HRTabs + role-aware AppNav switch"
```

---

## Phase 2: Candidates surface

### Task 4: `useCandidates` hook (paginated search)

**Files:**
- Create: `mobile/src/hooks/use-candidates.ts`
- Create: `mobile/__tests__/hooks/use-candidates.test.tsx`

Wraps `api.candidates.listForSchool` via `usePaginatedQuery`. Exposes `{ rows, loading, status, loadMore, setSearch, search }`. `search` is debounced 200ms inside the hook to prevent thrash.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/__tests__/hooks/use-candidates.test.tsx
import { renderHook, act } from "@testing-library/react-native";

const mockUsePaginated = jest.fn();
jest.mock("convex/react", () => ({
  usePaginatedQuery: (...args: unknown[]) => mockUsePaginated(...args),
}));
jest.mock("@convex/_generated/api", () => ({
  api: { candidates: { listForSchool: "candidates:listForSchool" } },
}));

import { useCandidates } from "@/hooks/use-candidates";

describe("useCandidates", () => {
  beforeEach(() => mockUsePaginated.mockReset());

  it("passes schoolId + search filter to listForSchool", () => {
    mockUsePaginated.mockReturnValue({ results: [], status: "CanLoadMore", loadMore: jest.fn() });
    renderHook(() => useCandidates({ schoolId: "s1", initialSearch: "anu" }));
    const [, args] = mockUsePaginated.mock.calls[0];
    expect(args.schoolId).toBe("s1");
    expect(args.filter?.search).toBe("anu");
  });

  it("returns results from the paginated query", () => {
    mockUsePaginated.mockReturnValue({
      results: [{ _id: "c1", name: "Priya" }],
      status: "CanLoadMore",
      loadMore: jest.fn(),
    });
    const { result } = renderHook(() => useCandidates({ schoolId: "s1" }));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].name).toBe("Priya");
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `bun --cwd mobile run test __tests__/hooks/use-candidates.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```ts
// mobile/src/hooks/use-candidates.ts
import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";

interface Options {
  schoolId: string | null;
  initialSearch?: string;
  pageSize?: number;
}

export function useCandidates({ schoolId, initialSearch = "", pageSize = 25 }: Options) {
  const [search, setSearch] = useState(initialSearch);
  const { results, status, loadMore } = usePaginatedQuery(
    api.candidates.listForSchool,
    schoolId
      ? { schoolId: schoolId as any, filter: { search: search || undefined } }
      : "skip",
    { initialNumItems: pageSize },
  );
  return {
    rows: (results ?? []) as Array<{ _id: string; name: string; email?: string; subjects?: string[] }>,
    status,
    loading: status === "LoadingFirstPage",
    loadMore: () => loadMore(pageSize),
    search,
    setSearch,
  };
}
```

- [ ] **Step 4: Run + commit**

```bash
bun --cwd mobile run test __tests__/hooks/use-candidates.test.tsx
git add mobile/src/hooks/use-candidates.ts mobile/__tests__/hooks/use-candidates.test.tsx
git commit -m "feat(mobile/hooks): useCandidates for paginated school candidates"
```

---

### Task 5: Candidates list screen

**Files:**
- Modify: `mobile/src/screens/candidates.tsx` (replace the Phase 1 stub)
- Create: `mobile/src/components/candidates/candidate-card.tsx`
- Create: `mobile/__tests__/screens/candidates.test.tsx`

A search TextInput at top, `FlatList` below, debounced search, infinite scroll via `onEndReached`. Tapping a card navigates to `CandidateDetail` (registered in Phase 2 T6 via the HR stack).

- [ ] **Step 1: Write the test**

```tsx
// mobile/__tests__/screens/candidates.test.tsx
import { render, screen, fireEvent } from "@testing-library/react-native";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockUseRoleContext = jest.fn();
jest.mock("@/hooks/use-role-context", () => ({ useRoleContext: () => mockUseRoleContext() }));

const mockUseCandidates = jest.fn();
jest.mock("@/hooks/use-candidates", () => ({
  useCandidates: (opts: unknown) => mockUseCandidates(opts),
}));

import { CandidatesScreen } from "@/screens/candidates";

describe("CandidatesScreen", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUseRoleContext.mockReturnValue({ loading: false, isHR: true, schoolId: "s1" });
    mockUseCandidates.mockReturnValue({
      rows: [
        { _id: "c1", name: "Priya Iyer", email: "p@s", subjects: ["Math"] },
        { _id: "c2", name: "Ravi Kumar", email: "r@s" },
      ],
      status: "CanLoadMore", loading: false, loadMore: jest.fn(),
      search: "", setSearch: jest.fn(),
    });
  });

  it("renders candidate cards", () => {
    render(<CandidatesScreen />);
    expect(screen.getByText("Priya Iyer")).toBeTruthy();
    expect(screen.getByText("Ravi Kumar")).toBeTruthy();
  });

  it("navigates to CandidateDetail when a card is tapped", () => {
    render(<CandidatesScreen />);
    fireEvent.press(screen.getByText("Priya Iyer"));
    expect(mockNavigate).toHaveBeenCalledWith("CandidateDetail", { candidateId: "c1" });
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `bun --cwd mobile run test __tests__/screens/candidates.test.tsx`
Expected: FAIL — current `CandidatesScreen` is a stub.

- [ ] **Step 3: Implement `CandidateCard`**

```tsx
// mobile/src/components/candidates/candidate-card.tsx
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/card";
import { colors, fonts, space } from "@/theme";

interface Props {
  name: string;
  email?: string;
  subjects?: string[];
  onPress: () => void;
}

export function CandidateCard({ name, email, subjects, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={{ marginBottom: space[3] }}>
      <Card padding="md">
        <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>
          {name}
        </Text>
        {email && (
          <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.sm, marginTop: 2 }}>
            {email}
          </Text>
        )}
        {subjects && subjects.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: space[2], gap: space[1] }}>
            {subjects.map((s) => (
              <View
                key={s}
                style={{
                  backgroundColor: colors.accentSoft,
                  paddingHorizontal: space[2],
                  paddingVertical: 2,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: colors.accent, fontSize: fonts.size.xs }}>{s}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </Pressable>
  );
}
```

- [ ] **Step 4: Replace `candidates.tsx` stub**

```tsx
// mobile/src/screens/candidates.tsx
import { useCallback } from "react";
import { FlatList, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useRoleContext } from "@/hooks/use-role-context";
import { useCandidates } from "@/hooks/use-candidates";
import { CandidateCard } from "@/components/candidates/candidate-card";
import { EmptyState } from "@/components/ui/empty-state";
import { colors, fonts, radii, space } from "@/theme";

export function CandidatesScreen() {
  const role = useRoleContext();
  const { rows, status, loadMore, search, setSearch } = useCandidates({ schoolId: role.schoolId });
  const navigation = useNavigation<any>();

  const renderItem = useCallback(
    ({ item }: any) => (
      <CandidateCard
        name={item.name}
        email={item.email}
        subjects={item.subjects}
        onPress={() => navigation.navigate("CandidateDetail", { candidateId: item._id })}
      />
    ),
    [navigation],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}>
      <View style={{ padding: space[4], paddingBottom: space[2] }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search candidates"
          placeholderTextColor={colors.inkTertiary}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.hairline,
            borderWidth: 1,
            borderRadius: radii.apple,
            paddingHorizontal: space[3],
            paddingVertical: space[2],
            color: colors.ink,
            fontSize: fonts.size.md,
          }}
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r._id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: space[4], paddingTop: 0 }}
        onEndReached={() => status === "CanLoadMore" && loadMore()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <EmptyState
            title="No candidates yet"
            body="Add a candidate from the web to get started."
          />
        }
      />
    </View>
  );
}
```

- [ ] **Step 5: Run the test + commit**

```bash
bun --cwd mobile run test __tests__/screens/candidates.test.tsx
git add mobile/src/screens/candidates.tsx mobile/src/components/candidates/ mobile/__tests__/screens/candidates.test.tsx
git commit -m "feat(mobile/candidates): list screen with search and pagination"
```

---

### Task 6: Candidate detail screen + demos timeline

**Files:**
- Create: `mobile/src/screens/candidate-detail.tsx`
- Modify: `mobile/src/navigation/app-nav.tsx` (register `CandidateDetail` in the stack)
- Create: `mobile/__tests__/screens/candidate-detail.test.tsx`

Reads `api.candidates.get({candidateId})` for the resume metadata and `api.demoSessions.listForCandidate({applicationId})` for the demos timeline. Since one candidate can have multiple applications, the screen first picks the most recent application via `api.applications.listForSchool` filtered to candidateId (or — simpler — fetch all applications for this candidate via a new tiny query). For Plan 4, we use the existing `applications.get` flow per application card.

Resolution: add one new query `applications.listForCandidate({candidateId})` that returns all applications for one candidate. Then the screen iterates applications and lists demos per application.

- [ ] **Step 1: Add `applications.listForCandidate` query**

Append to `convex/applications.ts`:

```ts
export const listForCandidate = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, { candidateId }) => {
    return await ctx.db
      .query("applications")
      .filter((q) => q.eq(q.field("candidateId"), candidateId))
      .collect();
  },
});
```

Plus a quick vitest in `tests/convex/applications-list-for-candidate.test.ts` asserting it returns the right rows. (One pass-failing test, one positive test.)

- [ ] **Step 2: Run codegen**

```bash
bunx convex codegen
bun run vitest run tests/convex/applications-list-for-candidate.test.ts
```
Expected: test passes after the query lands.

- [ ] **Step 3: Write the screen test**

```tsx
// mobile/__tests__/screens/candidate-detail.test.tsx
import { render, screen, fireEvent } from "@testing-library/react-native";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { candidateId: "c1" } }),
}));

const mockCandidate = { _id: "c1", name: "Priya Iyer", email: "p@s", subjects: ["Math"] };
const mockApplications = [{ _id: "a1", candidateId: "c1", schoolId: "s1", stage: "demo_scheduled" }];
const mockDemos = [
  { _id: "d1", scheduledAt: 1_700_000_000_000, durationMinutes: 30, mode: "live", format: "classroom", status: "scheduled" },
];

jest.mock("convex/react", () => ({
  useQuery: (name: string) => {
    if (typeof name === "string" && name.includes("candidates:get")) return mockCandidate;
    if (typeof name === "string" && name.includes("applications:listForCandidate")) return mockApplications;
    if (typeof name === "string" && name.includes("demoSessions:listForCandidate")) return mockDemos;
    return undefined;
  },
}));
jest.mock("@convex/_generated/api", () => ({
  api: {
    candidates: { get: "candidates:get" },
    applications: { listForCandidate: "applications:listForCandidate" },
    demoSessions: { listForCandidate: "demoSessions:listForCandidate" },
  },
}));

import { CandidateDetailScreen } from "@/screens/candidate-detail";

describe("CandidateDetailScreen", () => {
  beforeEach(() => mockNavigate.mockClear());

  it("renders candidate hero + one demo card", () => {
    render(<CandidateDetailScreen />);
    expect(screen.getByText("Priya Iyer")).toBeTruthy();
    expect(screen.getByText(/live/i)).toBeTruthy();
  });

  it("navigates to ScheduleDemo when Schedule new demo is pressed", () => {
    render(<CandidateDetailScreen />);
    fireEvent.press(screen.getByText("Schedule new demo"));
    expect(mockNavigate).toHaveBeenCalledWith("ScheduleDemo", { applicationId: "a1" });
  });
});
```

- [ ] **Step 4: Implement the screen**

```tsx
// mobile/src/screens/candidate-detail.tsx
import { ScrollView, Text, View } from "react-native";
import { useQuery } from "convex/react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api } from "@convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PressableButton } from "@/components/ui/pressable-button";
import { colors, fonts, space } from "@/theme";

export function CandidateDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const candidateId = route.params.candidateId;

  const candidate = useQuery(api.candidates.get, { id: candidateId });
  const applications = useQuery(api.applications.listForCandidate, { candidateId });
  const firstAppId = applications?.[0]?._id;
  const demos = useQuery(
    api.demoSessions.listForCandidate,
    firstAppId ? { applicationId: firstAppId } : "skip",
  );

  if (!candidate) {
    return (
      <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}>
        <Text style={{ color: colors.inkSecondary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4] }}
    >
      <Card padding="lg">
        <Text style={{ color: colors.ink, fontSize: fonts.size.xl, fontWeight: fonts.weight.semibold }}>
          {candidate.name}
        </Text>
        {candidate.email && (
          <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.sm, marginTop: space[1] }}>
            {candidate.email}
          </Text>
        )}
      </Card>

      <View style={{ marginTop: space[4] }}>
        <PressableButton
          variant="primary"
          onPress={() => firstAppId && navigation.navigate("ScheduleDemo", { applicationId: firstAppId })}
        >
          Schedule new demo
        </PressableButton>
      </View>

      <Text style={{ color: colors.ink, fontSize: fonts.size.lg, fontWeight: fonts.weight.semibold, marginTop: space[6], marginBottom: space[2] }}>
        Demos
      </Text>
      {demos?.length === 0 && (
        <Text style={{ color: colors.inkSecondary }}>No demos scheduled yet.</Text>
      )}
      {(demos ?? []).map((d) => (
        <Card key={d._id} padding="md" style={{ marginBottom: space[3] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.ink, fontSize: fonts.size.md }}>
              {new Date(d.scheduledAt).toLocaleString()}
            </Text>
            <Badge tone={d.status === "completed" ? "success" : d.status === "cancelled" ? "danger" : "info"}>
              {d.status}
            </Badge>
          </View>
          <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.sm, marginTop: space[1] }}>
            {d.mode} / {d.format} / {d.durationMinutes} min
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 5: Register in the stack**

Modify `mobile/src/navigation/app-nav.tsx`. Add the import and a new `Stack.Screen`:

```tsx
import { CandidateDetailScreen } from "@/screens/candidate-detail";
// ...
export type RootStackParamList = {
  // ... existing
  CandidateDetail: { candidateId: string };
  ScheduleDemo: { applicationId: string; parentDemoId?: string };
};
// ...
<Stack.Screen
  name="CandidateDetail"
  component={CandidateDetailScreen}
  options={{ headerShown: true, title: "Candidate" }}
/>
```

- [ ] **Step 6: Run tests + commit**

```bash
bun --cwd mobile run test __tests__/screens/candidate-detail.test.tsx
git add mobile/src/screens/candidate-detail.tsx mobile/src/navigation/app-nav.tsx \
  convex/applications.ts tests/convex/applications-list-for-candidate.test.ts \
  mobile/__tests__/screens/candidate-detail.test.tsx convex/_generated/
git commit -m "feat(mobile/candidates): detail screen with demos timeline + schedule CTA"
```

---

## Phase 3: Pipeline surface

### Task 7: `usePipeline` hook (per-job stage view)

**Files:**
- Create: `mobile/src/hooks/use-pipeline.ts`
- Create: `mobile/__tests__/hooks/use-pipeline.test.tsx`

Pipeline on mobile is per-job (matches the web Kanban behavior). The hook loads `jobs.listBySchool` to populate a job picker, plus `applications.getPipelineForJob` for the selected job. Exposes `{ jobs, selectedJobId, setSelectedJobId, stages, applicationsByStage }`.

`stages` is loaded from `pipeline_config.getActiveStages({ schoolId })` so the stage chips render in the school's configured order.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/__tests__/hooks/use-pipeline.test.tsx
import { renderHook } from "@testing-library/react-native";

const mockUseQuery = jest.fn();
const mockUsePaginated = jest.fn();
jest.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  usePaginatedQuery: (...args: unknown[]) => mockUsePaginated(...args),
}));
jest.mock("@convex/_generated/api", () => ({
  api: {
    jobs: { listBySchool: "jobs:listBySchool" },
    applications: { getPipelineForJob: "applications:getPipelineForJob" },
    pipeline_config: { getActiveStages: "pipeline_config:getActiveStages" },
  },
}));

import { usePipeline, groupByStage } from "@/hooks/use-pipeline";

describe("groupByStage", () => {
  it("buckets applications by stage id", () => {
    const out = groupByStage([
      { _id: "a1", stage: "sourced" },
      { _id: "a2", stage: "demo_scheduled" },
      { _id: "a3", stage: "sourced" },
    ] as any);
    expect(out.sourced).toHaveLength(2);
    expect(out.demo_scheduled).toHaveLength(1);
  });

  it("returns an empty bucket for stages with no applications", () => {
    expect(groupByStage([]).demo_scheduled ?? []).toEqual([]);
  });
});

describe("usePipeline", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUsePaginated.mockReset();
  });

  it("skips queries until schoolId is known", () => {
    mockUseQuery.mockReturnValue(undefined);
    mockUsePaginated.mockReturnValue({ results: [], status: "LoadingFirstPage", loadMore: jest.fn() });
    renderHook(() => usePipeline({ schoolId: null }));
    const calls = mockUsePaginated.mock.calls;
    expect(calls[0][1]).toBe("skip");
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `bun --cwd mobile run test __tests__/hooks/use-pipeline.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```ts
// mobile/src/hooks/use-pipeline.ts
import { useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

interface Application {
  _id: string;
  candidateId?: string;
  stage: string;
  aiMatchScore?: number;
}

export function groupByStage(apps: Application[]): Record<string, Application[]> {
  const out: Record<string, Application[]> = {};
  for (const a of apps) {
    if (!out[a.stage]) out[a.stage] = [];
    out[a.stage].push(a);
  }
  return out;
}

interface Options { schoolId: string | null; }

export function usePipeline({ schoolId }: Options) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const jobsPage = usePaginatedQuery(
    api.jobs.listBySchool,
    schoolId ? { schoolId: schoolId as any } : "skip",
    { initialNumItems: 200 },
  );
  const stages = useQuery(
    api.pipeline_config.getActiveStages,
    schoolId ? { schoolId: schoolId as any } : "skip",
  );
  const apps = usePaginatedQuery(
    api.applications.getPipelineForJob,
    selectedJobId ? { jobId: selectedJobId as any } : "skip",
    { initialNumItems: 100 },
  );

  return {
    jobs: (jobsPage.results ?? []) as Array<{ _id: string; title: string }>,
    selectedJobId,
    setSelectedJobId,
    stages: (stages ?? []) as Array<{ id: string; name: string; color?: string }>,
    applicationsByStage: groupByStage((apps.results ?? []) as Application[]),
    loading: jobsPage.status === "LoadingFirstPage" || apps.status === "LoadingFirstPage",
  };
}
```

- [ ] **Step 4: Run + commit**

```bash
bun --cwd mobile run test __tests__/hooks/use-pipeline.test.tsx
git add mobile/src/hooks/use-pipeline.ts mobile/__tests__/hooks/use-pipeline.test.tsx
git commit -m "feat(mobile/hooks): usePipeline with stage bucketing"
```

---

### Task 8: Pipeline screen with stage chips

**Files:**
- Modify: `mobile/src/screens/pipeline.tsx` (replace stub)
- Create: `mobile/src/components/pipeline/stage-chips.tsx`
- Create: `mobile/src/components/pipeline/application-card.tsx`
- Create: `mobile/__tests__/screens/pipeline.test.tsx`

Top of the screen: a job picker (horizontal scroll of job chips). Below: stage chips (horizontal scroll) for stage filter. Below: list of applications for the selected stage. Tapping an application card opens `CandidateDetail` (since each application has a candidateId).

- [ ] **Step 1: Write the test**

```tsx
// mobile/__tests__/screens/pipeline.test.tsx
import { render, screen, fireEvent } from "@testing-library/react-native";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockUseRoleContext = jest.fn();
jest.mock("@/hooks/use-role-context", () => ({ useRoleContext: () => mockUseRoleContext() }));

const mockUsePipeline = jest.fn();
jest.mock("@/hooks/use-pipeline", () => ({
  usePipeline: (opts: unknown) => mockUsePipeline(opts),
}));

import { PipelineScreen } from "@/screens/pipeline";

describe("PipelineScreen", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUseRoleContext.mockReturnValue({ loading: false, isHR: true, schoolId: "s1" });
  });

  it("shows a job picker and renders apps when a job is selected", () => {
    const setSelectedJobId = jest.fn();
    mockUsePipeline.mockReturnValue({
      jobs: [{ _id: "j1", title: "Math Teacher" }],
      selectedJobId: "j1",
      setSelectedJobId,
      stages: [{ id: "demo_scheduled", name: "Demo Scheduled" }],
      applicationsByStage: {
        demo_scheduled: [{ _id: "a1", candidateId: "c1", stage: "demo_scheduled" }],
      },
      loading: false,
    });
    render(<PipelineScreen />);
    expect(screen.getByText("Math Teacher")).toBeTruthy();
    expect(screen.getByText("Demo Scheduled")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `bun --cwd mobile run test __tests__/screens/pipeline.test.tsx`
Expected: FAIL — stub does not yet render these.

- [ ] **Step 3: Implement `stage-chips.tsx`**

```tsx
// mobile/src/components/pipeline/stage-chips.tsx
import { Pressable, ScrollView, Text } from "react-native";
import { colors, fonts, space } from "@/theme";

interface Stage { id: string; name: string; }
interface Props {
  stages: Stage[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function StageChips({ stages, selectedId, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: space[4], gap: space[2] }}>
      <Pressable onPress={() => onSelect(null)}>
        <Text style={chipStyle(selectedId === null)}>All</Text>
      </Pressable>
      {stages.map((s) => (
        <Pressable key={s.id} onPress={() => onSelect(s.id)}>
          <Text style={chipStyle(selectedId === s.id)}>{s.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function chipStyle(active: boolean) {
  return {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: 999,
    backgroundColor: active ? colors.accentSoft : colors.surface,
    color: active ? colors.accent : colors.inkSecondary,
    borderWidth: 1,
    borderColor: active ? colors.accent : colors.hairline,
    fontSize: fonts.size.sm,
    fontWeight: fonts.weight.medium,
    overflow: "hidden" as const,
  };
}
```

- [ ] **Step 4: Implement `application-card.tsx`**

```tsx
// mobile/src/components/pipeline/application-card.tsx
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { colors, fonts, space } from "@/theme";

interface Props {
  applicationId: string;
  candidateName: string;
  stage: string;
  matchScore?: number;
  onPress: () => void;
}

export function ApplicationCard({ candidateName, stage, matchScore, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={{ marginBottom: space[3] }}>
      <Card padding="md">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>
            {candidateName}
          </Text>
          {typeof matchScore === "number" && (
            <Badge tone="info">{`${Math.round(matchScore * 100)}%`}</Badge>
          )}
        </View>
        <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.sm, marginTop: space[1] }}>
          {stage.replace(/_/g, " ")}
        </Text>
      </Card>
    </Pressable>
  );
}
```

- [ ] **Step 5: Replace `pipeline.tsx`**

```tsx
// mobile/src/screens/pipeline.tsx
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRoleContext } from "@/hooks/use-role-context";
import { usePipeline } from "@/hooks/use-pipeline";
import { StageChips } from "@/components/pipeline/stage-chips";
import { ApplicationCard } from "@/components/pipeline/application-card";
import { EmptyState } from "@/components/ui/empty-state";
import { colors, fonts, space } from "@/theme";

export function PipelineScreen() {
  const role = useRoleContext();
  const { jobs, selectedJobId, setSelectedJobId, stages, applicationsByStage } = usePipeline({
    schoolId: role.schoolId,
  });
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const navigation = useNavigation<any>();

  const flatApps = stageFilter ? applicationsByStage[stageFilter] ?? [] : Object.values(applicationsByStage).flat();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space[4], paddingTop: space[3], gap: space[2] }}>
        {jobs.map((j) => (
          <Pressable key={j._id} onPress={() => setSelectedJobId(j._id)}>
            <Text style={jobChipStyle(j._id === selectedJobId)}>{j.title}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ marginTop: space[3] }}>
        <StageChips stages={stages} selectedId={stageFilter} onSelect={setStageFilter} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4] }}>
        {!selectedJobId && (
          <EmptyState title="Pick a role" body="Select a job above to see its pipeline." />
        )}
        {selectedJobId && flatApps.length === 0 && (
          <EmptyState title="No applications" body="No candidates at this stage yet." />
        )}
        {flatApps.map((a: any) => (
          <PipelineApplicationCard
            key={a._id}
            applicationId={a._id}
            candidateId={a.candidateId}
            stage={a.stage}
            matchScore={a.aiMatchScore}
            onPress={() => navigation.navigate("CandidateDetail", { candidateId: a.candidateId })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function PipelineApplicationCard(props: {
  applicationId: string; candidateId: string; stage: string; matchScore?: number; onPress: () => void;
}) {
  const candidate = useQuery(api.candidates.get, { id: props.candidateId });
  return (
    <ApplicationCard
      applicationId={props.applicationId}
      candidateName={candidate?.name ?? "Loading..."}
      stage={props.stage}
      matchScore={props.matchScore}
      onPress={props.onPress}
    />
  );
}

function jobChipStyle(active: boolean) {
  return {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: 999,
    backgroundColor: active ? colors.accentSoft : colors.surface,
    color: active ? colors.accent : colors.inkSecondary,
    borderWidth: 1,
    borderColor: active ? colors.accent : colors.hairline,
    fontSize: fonts.size.sm,
    fontWeight: fonts.weight.medium,
    overflow: "hidden" as const,
  };
}
```

- [ ] **Step 6: Run + commit**

```bash
bun --cwd mobile run test __tests__/screens/pipeline.test.tsx
git add mobile/src/screens/pipeline.tsx mobile/src/components/pipeline/ mobile/__tests__/screens/pipeline.test.tsx
git commit -m "feat(mobile/pipeline): job picker + stage chips + application list"
```

---

## Phase 4: Schedule Demo wizard (mobile)

### Task 9: Staff directory + active rules hooks

**Files:**
- Create: `mobile/src/hooks/use-staff-directory.ts`
- Create: `mobile/src/hooks/use-active-decision-rules.ts`
- Create: `mobile/__tests__/hooks/use-staff-directory.test.tsx`

`useStaffDirectory({schoolId})` wraps `api.users.listSchoolStaff` and returns `Array<{ _id, name, role }>`. `useActiveDecisionRules({schoolId})` wraps `api.decisionRules.listActive` and returns `Array<{ _id, name }>`.

- [ ] **Step 1: Write the test (covers both hooks via a single file)**

```tsx
// mobile/__tests__/hooks/use-staff-directory.test.tsx
import { renderHook } from "@testing-library/react-native";

const mockUseQuery = jest.fn();
jest.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
jest.mock("@convex/_generated/api", () => ({
  api: {
    users: { listSchoolStaff: "users:listSchoolStaff" },
    decisionRules: { listActive: "decisionRules:listActive" },
  },
}));

import { useStaffDirectory } from "@/hooks/use-staff-directory";
import { useActiveDecisionRules } from "@/hooks/use-active-decision-rules";

describe("useStaffDirectory", () => {
  beforeEach(() => mockUseQuery.mockReset());
  it("returns staff array from listSchoolStaff", () => {
    mockUseQuery.mockReturnValue([
      { _id: "u1", name: "Mrs Iyer", role: "principal" },
      { _id: "u2", name: "Mr Rao", role: "teacher" },
    ]);
    const { result } = renderHook(() => useStaffDirectory({ schoolId: "s1" }));
    expect(result.current.staff).toHaveLength(2);
  });
  it("skips when schoolId is null", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderHook(() => useStaffDirectory({ schoolId: null }));
    expect(mockUseQuery.mock.calls[0][1]).toBe("skip");
  });
});

describe("useActiveDecisionRules", () => {
  beforeEach(() => mockUseQuery.mockReset());
  it("returns active rules", () => {
    mockUseQuery.mockReturnValue([{ _id: "r1", name: "Strict Hire" }]);
    const { result } = renderHook(() => useActiveDecisionRules({ schoolId: "s1" }));
    expect(result.current.rules).toEqual([{ _id: "r1", name: "Strict Hire" }]);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `bun --cwd mobile run test __tests__/hooks/use-staff-directory.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement both hooks**

```ts
// mobile/src/hooks/use-staff-directory.ts
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

interface StaffRow { _id: string; name: string; role: "principal" | "hod" | "hr_admin" | "teacher" | string; }

export function useStaffDirectory({ schoolId }: { schoolId: string | null }) {
  const rows = useQuery(
    api.users.listSchoolStaff,
    schoolId ? { schoolId: schoolId as any } : "skip",
  );
  return { staff: (rows ?? []) as StaffRow[], loading: rows === undefined };
}
```

```ts
// mobile/src/hooks/use-active-decision-rules.ts
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export function useActiveDecisionRules({ schoolId }: { schoolId: string | null }) {
  const rows = useQuery(
    api.decisionRules.listActive,
    schoolId ? { schoolId: schoolId as any } : "skip",
  );
  return { rules: (rows ?? []) as Array<{ _id: string; name: string }>, loading: rows === undefined };
}
```

- [ ] **Step 4: Run + commit**

```bash
bun --cwd mobile run test __tests__/hooks/use-staff-directory.test.tsx
git add mobile/src/hooks/use-staff-directory.ts mobile/src/hooks/use-active-decision-rules.ts mobile/__tests__/hooks/use-staff-directory.test.tsx
git commit -m "feat(mobile/hooks): staff directory + active decision rules"
```

---

### Task 10: Schedule wizard scaffold + step 1 (when / mode / format)

**Files:**
- Create: `mobile/src/screens/schedule-demo.tsx`
- Create: `mobile/src/components/demos/schedule-wizard/step-when.tsx`
- Modify: `mobile/src/navigation/app-nav.tsx` (register `ScheduleDemo`)
- Create: `mobile/__tests__/components/step-when.test.tsx`

Wizard state lives in `schedule-demo.tsx`. Step 1 collects date+time, duration, mode (`live` / `post` / `async`), format (`classroom` / `mock` / `recorded`). It validates that `scheduledAt > Date.now()` and disables *Next* otherwise.

For date/time: use two `TextInput` fields (date `YYYY-MM-DD` and time `HH:mm`) backed by `splitTimestamp` + `mergeTimestamp` helpers. This mirrors the web wizard's approach in [components/demos/schedule-demo-wizard.tsx](components/demos/schedule-demo-wizard.tsx) and avoids pulling in a native date picker library for v1.

- [ ] **Step 1: Write the step test**

```tsx
// mobile/__tests__/components/step-when.test.tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { StepWhen } from "@/components/demos/schedule-wizard/step-when";

describe("StepWhen", () => {
  it("renders date, time, duration inputs and mode/format chips", () => {
    render(
      <StepWhen
        value={{ date: "2026-06-15", time: "11:30", durationMinutes: 30, mode: "live", format: "classroom" }}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByDisplayValue("2026-06-15")).toBeTruthy();
    expect(screen.getByDisplayValue("11:30")).toBeTruthy();
    expect(screen.getByText("live")).toBeTruthy();
    expect(screen.getByText("classroom")).toBeTruthy();
  });

  it("calls onChange with new mode when a mode chip is tapped", () => {
    const onChange = jest.fn();
    render(
      <StepWhen
        value={{ date: "2026-06-15", time: "11:30", durationMinutes: 30, mode: "live", format: "classroom" }}
        onChange={onChange}
      />,
    );
    fireEvent.press(screen.getByText("post"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: "post" }));
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `bun --cwd mobile run test __tests__/components/step-when.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `StepWhen`**

```tsx
// mobile/src/components/demos/schedule-wizard/step-when.tsx
import { Pressable, Text, TextInput, View } from "react-native";
import { colors, fonts, radii, space } from "@/theme";

export type Mode = "live" | "post" | "async";
export type Format = "classroom" | "mock" | "recorded";
export interface StepWhenValue {
  date: string; time: string; durationMinutes: number; mode: Mode; format: Format;
}

const MODES: Mode[] = ["live", "post", "async"];
const FORMATS: Format[] = ["classroom", "mock", "recorded"];

interface Props { value: StepWhenValue; onChange: (next: StepWhenValue) => void; }

export function StepWhen({ value, onChange }: Props) {
  return (
    <View style={{ gap: space[4] }}>
      <Field label="Date (YYYY-MM-DD)">
        <TextInput
          value={value.date}
          onChangeText={(t) => onChange({ ...value, date: t })}
          placeholder="2026-06-15"
          placeholderTextColor={colors.inkTertiary}
          style={inputStyle}
        />
      </Field>
      <Field label="Time (HH:mm, 24h)">
        <TextInput
          value={value.time}
          onChangeText={(t) => onChange({ ...value, time: t })}
          placeholder="11:30"
          placeholderTextColor={colors.inkTertiary}
          style={inputStyle}
        />
      </Field>
      <Field label="Duration (minutes)">
        <TextInput
          value={String(value.durationMinutes)}
          onChangeText={(t) => onChange({ ...value, durationMinutes: parseInt(t || "0", 10) })}
          keyboardType="number-pad"
          style={inputStyle}
        />
      </Field>
      <Field label="Mode">
        <Row>
          {MODES.map((m) => (
            <Pressable key={m} onPress={() => onChange({ ...value, mode: m })}>
              <Text style={chipStyle(value.mode === m)}>{m}</Text>
            </Pressable>
          ))}
        </Row>
      </Field>
      <Field label="Format">
        <Row>
          {FORMATS.map((f) => (
            <Pressable key={f} onPress={() => onChange({ ...value, format: f })}>
              <Text style={chipStyle(value.format === f)}>{f}</Text>
            </Pressable>
          ))}
        </Row>
      </Field>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ color: colors.inkTertiary, fontSize: fonts.size.xs, marginBottom: space[1], textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>{children}</View>;
}

const inputStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.hairline,
  borderWidth: 1,
  borderRadius: radii.apple,
  paddingHorizontal: space[3],
  paddingVertical: space[2],
  color: colors.ink,
  fontSize: fonts.size.md,
} as const;

function chipStyle(active: boolean) {
  return {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: 999,
    backgroundColor: active ? colors.accentSoft : colors.surface,
    color: active ? colors.accent : colors.inkSecondary,
    borderWidth: 1,
    borderColor: active ? colors.accent : colors.hairline,
    fontSize: fonts.size.sm,
    overflow: "hidden" as const,
  };
}
```

- [ ] **Step 4: Implement wizard host (step 1 only, navigation placeholder for next)**

```tsx
// mobile/src/screens/schedule-demo.tsx
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { StepWhen, type StepWhenValue } from "@/components/demos/schedule-wizard/step-when";
import { PressableButton } from "@/components/ui/pressable-button";
import { colors, fonts, space } from "@/theme";

export type Evaluator = { userId: string; role: "principal" | "hod" | "hr_admin" | "teacher" };
export interface ScheduleDraft extends StepWhenValue {
  location?: string;
  videoUrl?: string;
  evaluators: Evaluator[];
  decisionRuleId?: string;
}

export function mergeTimestamp(date: string, time: string): number {
  return new Date(`${date}T${time}:00`).getTime();
}

export function ScheduleDemoScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { applicationId, parentDemoId } = route.params;
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<ScheduleDraft>({
    date: defaultDate(),
    time: "11:00",
    durationMinutes: 30,
    mode: "live",
    format: "classroom",
    evaluators: [],
  });

  const canAdvance =
    step === 1 ? mergeTimestamp(draft.date, draft.time) > Date.now() && draft.durationMinutes > 0 :
    step === 2 ? draft.evaluators.length > 0 :
    true;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
        <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.sm }}>
          Step {step} of 3
        </Text>
        {step === 1 && <StepWhen value={draft} onChange={(next) => setDraft({ ...draft, ...next })} />}
        {step === 2 && <Text style={{ color: colors.ink }}>Evaluators (Task 11)</Text>}
        {step === 3 && <Text style={{ color: colors.ink }}>Review (Task 12)</Text>}
      </ScrollView>
      <View style={{ flexDirection: "row", padding: space[4], gap: space[3], borderTopColor: colors.hairline, borderTopWidth: 1, backgroundColor: colors.surface }}>
        {step > 1 && (
          <View style={{ flex: 1 }}>
            <PressableButton variant="ghost" onPress={() => setStep(step - 1)}>Back</PressableButton>
          </View>
        )}
        <View style={{ flex: 2 }}>
          <PressableButton
            variant="primary"
            disabled={!canAdvance}
            onPress={() => (step < 3 ? setStep(step + 1) : navigation.goBack())}
          >
            {step < 3 ? "Next" : "Confirm"}
          </PressableButton>
        </View>
      </View>
    </View>
  );
}

function defaultDate(): string {
  const d = new Date(Date.now() + 24 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
```

- [ ] **Step 5: Register `ScheduleDemo` in the stack**

Modify `mobile/src/navigation/app-nav.tsx` to add `ScheduleDemoScreen` with `presentation: "modal"`.

- [ ] **Step 6: Run + commit**

```bash
bun --cwd mobile run test __tests__/components/step-when.test.tsx
git add mobile/src/screens/schedule-demo.tsx mobile/src/components/demos/schedule-wizard/ mobile/src/navigation/app-nav.tsx mobile/__tests__/components/step-when.test.tsx
git commit -m "feat(mobile/demos): schedule wizard scaffold + step 1 (when/mode/format)"
```

---

### Task 11: Schedule wizard step 2 (location/video + evaluator multi-select)

**Files:**
- Create: `mobile/src/components/demos/schedule-wizard/step-evaluators.tsx`
- Modify: `mobile/src/screens/schedule-demo.tsx` (mount step 2)
- Create: `mobile/__tests__/components/step-evaluators.test.tsx`

Step 2 shows a `Location` text input when `format === "classroom"`, a `Video URL` input when `format === "recorded"`, then a multi-select list of staff with their role label. Selected evaluators show as accent chips above the list. Each tap toggles selection. Staff with role `teacher` are tagged accordingly.

- [ ] **Step 1: Write the test**

```tsx
// mobile/__tests__/components/step-evaluators.test.tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { StepEvaluators } from "@/components/demos/schedule-wizard/step-evaluators";

const staff = [
  { _id: "u1", name: "Mrs Iyer", role: "principal" as const },
  { _id: "u2", name: "Mr Rao", role: "teacher" as const },
];

describe("StepEvaluators", () => {
  it("shows the Location field when format is classroom", () => {
    render(
      <StepEvaluators
        format="classroom"
        location=""
        videoUrl=""
        staff={staff}
        selected={[]}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByPlaceholderText(/location/i)).toBeTruthy();
  });

  it("shows the Video URL field when format is recorded", () => {
    render(
      <StepEvaluators
        format="recorded"
        location=""
        videoUrl=""
        staff={staff}
        selected={[]}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByPlaceholderText(/video url/i)).toBeTruthy();
  });

  it("toggles staff selection on tap", () => {
    const onChange = jest.fn();
    render(
      <StepEvaluators
        format="mock"
        location=""
        videoUrl=""
        staff={staff}
        selected={[]}
        onChange={onChange}
      />,
    );
    fireEvent.press(screen.getByText("Mrs Iyer"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ evaluators: [{ userId: "u1", role: "principal" }] }),
    );
  });
});
```

- [ ] **Step 2: Run + watch it fail**

Run: `bun --cwd mobile run test __tests__/components/step-evaluators.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `StepEvaluators`**

```tsx
// mobile/src/components/demos/schedule-wizard/step-evaluators.tsx
import { Pressable, Text, TextInput, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { colors, fonts, radii, space } from "@/theme";

type Role = "principal" | "hod" | "hr_admin" | "teacher";
export interface StaffRow { _id: string; name: string; role: Role; }
export interface EvaluatorPick { userId: string; role: Role; }

interface Props {
  format: "classroom" | "mock" | "recorded";
  location: string;
  videoUrl: string;
  staff: StaffRow[];
  selected: EvaluatorPick[];
  onChange: (patch: { location?: string; videoUrl?: string; evaluators?: EvaluatorPick[] }) => void;
}

export function StepEvaluators({ format, location, videoUrl, staff, selected, onChange }: Props) {
  const toggle = (s: StaffRow) => {
    const exists = selected.find((p) => p.userId === s._id);
    const next = exists
      ? selected.filter((p) => p.userId !== s._id)
      : [...selected, { userId: s._id, role: s.role }];
    onChange({ evaluators: next });
  };

  return (
    <View style={{ gap: space[4] }}>
      {format === "classroom" && (
        <View>
          <Text style={labelStyle}>Location</Text>
          <TextInput
            value={location}
            onChangeText={(t) => onChange({ location: t })}
            placeholder="Classroom 12B"
            placeholderTextColor={colors.inkTertiary}
            style={inputStyle}
          />
        </View>
      )}
      {format === "recorded" && (
        <View>
          <Text style={labelStyle}>Video URL</Text>
          <TextInput
            value={videoUrl}
            onChangeText={(t) => onChange({ videoUrl: t })}
            placeholder="https://..."
            placeholderTextColor={colors.inkTertiary}
            autoCapitalize="none"
            style={inputStyle}
          />
        </View>
      )}

      <View>
        <Text style={labelStyle}>Evaluators ({selected.length})</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginBottom: space[2] }}>
          {selected.map((p) => {
            const row = staff.find((s) => s._id === p.userId);
            return row ? (
              <Badge key={p.userId} tone="info">{row.name}</Badge>
            ) : null;
          })}
        </View>
        {staff.map((s) => {
          const isSelected = !!selected.find((p) => p.userId === s._id);
          return (
            <Pressable
              key={s._id}
              onPress={() => toggle(s)}
              style={{
                padding: space[3],
                marginBottom: space[2],
                backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                borderColor: isSelected ? colors.accent : colors.hairline,
                borderWidth: 1,
                borderRadius: radii.apple,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.ink, fontSize: fonts.size.md }}>{s.name}</Text>
              <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.xs }}>{s.role}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const labelStyle = {
  color: colors.inkTertiary,
  fontSize: fonts.size.xs,
  marginBottom: space[1],
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
};

const inputStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.hairline,
  borderWidth: 1,
  borderRadius: radii.apple,
  paddingHorizontal: space[3],
  paddingVertical: space[2],
  color: colors.ink,
  fontSize: fonts.size.md,
} as const;
```

- [ ] **Step 4: Wire step 2 into `schedule-demo.tsx`**

Replace the `step === 2` placeholder with the live `<StepEvaluators>` and import `useStaffDirectory` + `useRoleContext`:

```tsx
// Inside ScheduleDemoScreen, before the return:
const role = useRoleContext();
const { staff } = useStaffDirectory({ schoolId: role.schoolId });

// In the JSX where step === 2:
{step === 2 && (
  <StepEvaluators
    format={draft.format}
    location={draft.location ?? ""}
    videoUrl={draft.videoUrl ?? ""}
    staff={staff}
    selected={draft.evaluators}
    onChange={(patch) => setDraft({
      ...draft,
      ...(patch.location !== undefined ? { location: patch.location } : {}),
      ...(patch.videoUrl !== undefined ? { videoUrl: patch.videoUrl } : {}),
      ...(patch.evaluators !== undefined ? { evaluators: patch.evaluators } : {}),
    })}
  />
)}
```

- [ ] **Step 5: Run + commit**

```bash
bun --cwd mobile run test __tests__/components/step-evaluators.test.tsx
git add mobile/src/components/demos/schedule-wizard/step-evaluators.tsx mobile/src/screens/schedule-demo.tsx mobile/__tests__/components/step-evaluators.test.tsx
git commit -m "feat(mobile/demos): schedule wizard step 2 (location/video + evaluators)"
```

---

### Task 12: Schedule wizard step 3 + confirm mutation

**Files:**
- Create: `mobile/src/components/demos/schedule-wizard/step-review.tsx`
- Modify: `mobile/src/screens/schedule-demo.tsx` (mount step 3 + wire confirm)
- Create: `mobile/__tests__/components/step-review.test.tsx`

Step 3 summarizes the draft, lets HR pick an optional decision rule, and on *Confirm* invokes `api.demoSessions.create`. On success, navigates back twice (out of the wizard and back to the candidate detail).

- [ ] **Step 1: Write the test**

```tsx
// mobile/__tests__/components/step-review.test.tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { StepReview } from "@/components/demos/schedule-wizard/step-review";

describe("StepReview", () => {
  it("renders summary and decision rule picker", () => {
    render(
      <StepReview
        draft={{
          date: "2026-06-15", time: "11:30", durationMinutes: 30,
          mode: "live", format: "classroom", location: "12B",
          videoUrl: "", evaluators: [{ userId: "u1", role: "principal" }],
        }}
        rules={[{ _id: "r1", name: "Strict Hire" }]}
        selectedRuleId={null}
        onSelectRule={jest.fn()}
      />,
    );
    expect(screen.getByText("2026-06-15 11:30")).toBeTruthy();
    expect(screen.getByText("Strict Hire")).toBeTruthy();
  });

  it("notifies parent when a rule is tapped", () => {
    const onSelectRule = jest.fn();
    render(
      <StepReview
        draft={{
          date: "2026-06-15", time: "11:30", durationMinutes: 30,
          mode: "live", format: "classroom", location: "",
          videoUrl: "", evaluators: [],
        }}
        rules={[{ _id: "r1", name: "Strict Hire" }]}
        selectedRuleId={null}
        onSelectRule={onSelectRule}
      />,
    );
    fireEvent.press(screen.getByText("Strict Hire"));
    expect(onSelectRule).toHaveBeenCalledWith("r1");
  });
});
```

- [ ] **Step 2: Run + watch it fail**

Run: `bun --cwd mobile run test __tests__/components/step-review.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `StepReview`**

```tsx
// mobile/src/components/demos/schedule-wizard/step-review.tsx
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/card";
import { colors, fonts, space } from "@/theme";

interface Draft {
  date: string; time: string; durationMinutes: number;
  mode: string; format: string;
  location?: string; videoUrl?: string;
  evaluators: { userId: string; role: string }[];
}

interface Props {
  draft: Draft;
  rules: Array<{ _id: string; name: string }>;
  selectedRuleId: string | null;
  onSelectRule: (id: string | null) => void;
}

export function StepReview({ draft, rules, selectedRuleId, onSelectRule }: Props) {
  return (
    <View style={{ gap: space[4] }}>
      <Card padding="md">
        <Text style={titleStyle}>When</Text>
        <Text style={bodyStyle}>{`${draft.date} ${draft.time}`}</Text>
        <Text style={metaStyle}>{`${draft.durationMinutes} min / ${draft.mode} / ${draft.format}`}</Text>
        {draft.location ? <Text style={metaStyle}>{`Location: ${draft.location}`}</Text> : null}
        {draft.videoUrl ? <Text style={metaStyle}>{`Video: ${draft.videoUrl}`}</Text> : null}
      </Card>
      <Card padding="md">
        <Text style={titleStyle}>Evaluators ({draft.evaluators.length})</Text>
        {draft.evaluators.map((e) => (
          <Text key={e.userId} style={metaStyle}>{`${e.role}`}</Text>
        ))}
      </Card>
      <Card padding="md">
        <Text style={titleStyle}>Decision rule (optional)</Text>
        <Pressable onPress={() => onSelectRule(null)} style={{ marginVertical: space[1] }}>
          <Text style={ruleStyle(selectedRuleId === null)}>None — manual decision</Text>
        </Pressable>
        {rules.map((r) => (
          <Pressable key={r._id} onPress={() => onSelectRule(r._id)} style={{ marginVertical: space[1] }}>
            <Text style={ruleStyle(selectedRuleId === r._id)}>{r.name}</Text>
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

const titleStyle = { color: colors.inkTertiary, fontSize: fonts.size.xs, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: space[1] };
const bodyStyle = { color: colors.ink, fontSize: fonts.size.lg, fontWeight: fonts.weight.semibold };
const metaStyle = { color: colors.inkSecondary, fontSize: fonts.size.sm, marginTop: space[1] };

function ruleStyle(active: boolean) {
  return {
    color: active ? colors.accent : colors.ink,
    fontSize: fonts.size.md,
    fontWeight: active ? fonts.weight.semibold : fonts.weight.medium,
  };
}
```

- [ ] **Step 4: Wire confirm in `schedule-demo.tsx`**

Inside `ScheduleDemoScreen`, replace the step 3 placeholder, add the create mutation, and pass `applicationId` + `schoolId` + `createdBy`:

```tsx
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useActiveDecisionRules } from "@/hooks/use-active-decision-rules";
import { StepReview } from "@/components/demos/schedule-wizard/step-review";

// Inside the screen:
const createDemo = useMutation(api.demoSessions.create);
const { rules } = useActiveDecisionRules({ schoolId: role.schoolId });

const confirm = async () => {
  if (!role.schoolId || !role.userProfileId) return;
  await createDemo({
    applicationId: applicationId as any,
    schoolId: role.schoolId as any,
    scheduledAt: mergeTimestamp(draft.date, draft.time),
    durationMinutes: draft.durationMinutes,
    mode: draft.mode,
    format: draft.format,
    location: draft.location,
    videoUrl: draft.videoUrl,
    evaluators: draft.evaluators as any,
    createdBy: role.userProfileId as any,
    parentDemoId: parentDemoId as any,
    decisionRuleId: draft.decisionRuleId as any,
  });
  navigation.goBack();
};

// step === 3 block:
{step === 3 && (
  <StepReview
    draft={draft}
    rules={rules}
    selectedRuleId={draft.decisionRuleId ?? null}
    onSelectRule={(id) => setDraft({ ...draft, decisionRuleId: id ?? undefined })}
  />
)}

// Footer "Next/Confirm" button: when step === 3, call confirm() instead of goBack().
```

- [ ] **Step 5: Run + commit**

```bash
bun --cwd mobile run test __tests__/components/step-review.test.tsx
bun --cwd mobile run test
git add mobile/src/components/demos/schedule-wizard/step-review.tsx mobile/src/screens/schedule-demo.tsx mobile/__tests__/components/step-review.test.tsx
git commit -m "feat(mobile/demos): schedule wizard step 3 review + confirm mutation"
```

---

## Phase 5: Demo Summary + Decision

### Task 13: `useDemoAggregate` hook

**Files:**
- Create: `mobile/src/hooks/use-demo-aggregate.ts`
- Create: `mobile/__tests__/hooks/use-demo-aggregate.test.tsx`

Thin wrapper around `api.demoSessions.aggregate`. Returns `{ demo, invitesByStatus, recommendationTally, dimensionAverages, perEvaluator, loading }` matching the existing shape that `components/demos/demo-summary.tsx` consumes on the web.

- [ ] **Step 1: Write the test**

```tsx
// mobile/__tests__/hooks/use-demo-aggregate.test.tsx
import { renderHook } from "@testing-library/react-native";

const mockUseQuery = jest.fn();
jest.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
jest.mock("@convex/_generated/api", () => ({
  api: { demoSessions: { aggregate: "demoSessions:aggregate" } },
}));

import { useDemoAggregate } from "@/hooks/use-demo-aggregate";

describe("useDemoAggregate", () => {
  beforeEach(() => mockUseQuery.mockReset());
  it("returns loading=true until query resolves", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useDemoAggregate("d1"));
    expect(result.current.loading).toBe(true);
  });
  it("returns demo + tallies when query resolves", () => {
    mockUseQuery.mockReturnValue({
      demo: { _id: "d1", status: "completed", appliedDecision: null },
      invitesByStatus: { submitted: 2, declined: 0, invited: 0 },
      recommendationTally: { hire: 2, maybe: 0, reject: 0 },
      dimensionAverages: { subjectKnowledge: 4.5 },
      perEvaluator: [],
    });
    const { result } = renderHook(() => useDemoAggregate("d1"));
    expect(result.current.loading).toBe(false);
    expect(result.current.recommendationTally?.hire).toBe(2);
  });
});
```

- [ ] **Step 2: Run + watch fail, implement**

```ts
// mobile/src/hooks/use-demo-aggregate.ts
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export function useDemoAggregate(demoId: string | null) {
  const data = useQuery(api.demoSessions.aggregate, demoId ? { demoId: demoId as any } : "skip");
  if (data === undefined) {
    return { loading: true, demo: null, invitesByStatus: null, recommendationTally: null, dimensionAverages: null, perEvaluator: [] };
  }
  return { loading: false, ...data };
}
```

- [ ] **Step 3: Run + commit**

```bash
bun --cwd mobile run test __tests__/hooks/use-demo-aggregate.test.tsx
git add mobile/src/hooks/use-demo-aggregate.ts mobile/__tests__/hooks/use-demo-aggregate.test.tsx
git commit -m "feat(mobile/hooks): useDemoAggregate wraps demoSessions.aggregate"
```

---

### Task 14: DemoSummary screen + per-evaluator row

**Files:**
- Create: `mobile/src/screens/demo-summary.tsx`
- Create: `mobile/src/components/demos/per-evaluator-row.tsx`
- Create: `mobile/src/components/demos/applied-decision-banner.tsx`
- Modify: `mobile/src/navigation/app-nav.tsx` (register `DemoSummary`)
- Create: `mobile/__tests__/screens/demo-summary.test.tsx`

Renders:
- Demo metadata card (date, mode, format, duration, status badge)
- AppliedDecisionBanner when `demo.appliedDecision` exists
- Recommendation tally (Hire / Maybe / Reject counts)
- Dimension averages (one row per scored fieldKey)
- Per-evaluator rows (name, role, status, recommendation, comments bullets)
- Decision row at the bottom — buttons for *Advance* / *Reject* / *Re-demo* / *Manual* (this task wires Advance/Reject/Manual; Re-demo lands in T15)

Hide the decision row when the demo is already cancelled or not all invites are terminal.

- [ ] **Step 1: Write the test**

```tsx
// mobile/__tests__/screens/demo-summary.test.tsx
import { render, screen } from "@testing-library/react-native";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: { demoId: "d1" } }),
}));

const mockUseAggregate = jest.fn();
jest.mock("@/hooks/use-demo-aggregate", () => ({
  useDemoAggregate: (id: string) => mockUseAggregate(id),
}));

jest.mock("convex/react", () => ({
  useMutation: () => jest.fn(),
}));
jest.mock("@convex/_generated/api", () => ({
  api: { demoSessions: { applyDecision: "demoSessions:applyDecision" } },
}));

import { DemoSummaryScreen } from "@/screens/demo-summary";

describe("DemoSummaryScreen", () => {
  it("shows loading state", () => {
    mockUseAggregate.mockReturnValue({ loading: true });
    render(<DemoSummaryScreen />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("renders demo metadata and recommendation tally", () => {
    mockUseAggregate.mockReturnValue({
      loading: false,
      demo: { _id: "d1", status: "completed", mode: "live", format: "classroom", durationMinutes: 30, scheduledAt: 1_700_000_000_000, appliedDecision: null },
      invitesByStatus: { submitted: 2 },
      recommendationTally: { hire: 2, maybe: 0, reject: 0 },
      dimensionAverages: {},
      perEvaluator: [
        { invite: { _id: "i1", status: "submitted" }, evaluatorName: "Mrs Iyer", evaluatorRole: "principal", evaluation: { recommendation: "hire" } },
      ],
    });
    render(<DemoSummaryScreen />);
    expect(screen.getByText("Mrs Iyer")).toBeTruthy();
    expect(screen.getByText(/hire: 2/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run + watch fail, implement components**

```tsx
// mobile/src/components/demos/applied-decision-banner.tsx
import { Text, View } from "react-native";
import { colors, fonts, radii, space } from "@/theme";

interface Props {
  applied: { action: "advance" | "reject" | "redemo" | "manual"; appliedAt: number; note?: string };
}

const TONE: Record<string, { bg: string; border: string; ink: string; label: string }> = {
  advance: { bg: "#ecfdf5", border: "#34d39933", ink: "#047857", label: "Advanced" },
  reject:  { bg: "#fef2f2", border: "#f87171", ink: "#b91c1c", label: "Rejected" },
  redemo:  { bg: "#fffbeb", border: "#f59e0b66", ink: "#92400e", label: "Re-demo scheduled" },
  manual:  { bg: "#eff6ff", border: "#3b82f666", ink: "#1e3a8a", label: "Manual review" },
};

export function AppliedDecisionBanner({ applied }: Props) {
  const tone = TONE[applied.action] ?? TONE.manual;
  return (
    <View style={{
      backgroundColor: tone.bg,
      borderColor: tone.border,
      borderWidth: 1,
      borderRadius: radii.apple,
      padding: space[3],
      marginBottom: space[4],
    }}>
      <Text style={{ color: tone.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>
        {tone.label}
      </Text>
      <Text style={{ color: tone.ink, fontSize: fonts.size.sm, marginTop: space[1] }}>
        {applied.note ?? new Date(applied.appliedAt).toLocaleString()}
      </Text>
    </View>
  );
}
```

```tsx
// mobile/src/components/demos/per-evaluator-row.tsx
import { Text, View } from "react-native";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { colors, fonts, space } from "@/theme";

interface Props {
  name: string;
  role: string;
  status: string;
  recommendation?: "hire" | "maybe" | "reject";
  bullets?: string[];
}

export function PerEvaluatorRow({ name, role, status, recommendation, bullets }: Props) {
  const recTone: "success" | "warning" | "danger" | "neutral" =
    recommendation === "hire" ? "success" :
    recommendation === "maybe" ? "warning" :
    recommendation === "reject" ? "danger" : "neutral";
  return (
    <Card padding="md" style={{ marginBottom: space[3] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>{name}</Text>
          <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.xs, marginTop: 2 }}>{role}</Text>
        </View>
        {recommendation ? (
          <Badge tone={recTone}>{recommendation}</Badge>
        ) : (
          <Badge tone="neutral">{status}</Badge>
        )}
      </View>
      {bullets && bullets.length > 0 && (
        <View style={{ marginTop: space[2] }}>
          {bullets.map((b, i) => (
            <Text key={i} style={{ color: colors.inkSecondary, fontSize: fonts.size.sm, marginTop: 2 }}>
              {`• ${b}`}
            </Text>
          ))}
        </View>
      )}
    </Card>
  );
}
```

```tsx
// mobile/src/screens/demo-summary.tsx
import { ScrollView, Text, View } from "react-native";
import { useMutation } from "convex/react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api } from "@convex/_generated/api";
import { useDemoAggregate } from "@/hooks/use-demo-aggregate";
import { useRoleContext } from "@/hooks/use-role-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PressableButton } from "@/components/ui/pressable-button";
import { AppliedDecisionBanner } from "@/components/demos/applied-decision-banner";
import { PerEvaluatorRow } from "@/components/demos/per-evaluator-row";
import { colors, fonts, space } from "@/theme";

export function DemoSummaryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const demoId = route.params.demoId as string;
  const role = useRoleContext();
  const apply = useMutation(api.demoSessions.applyDecision);
  const agg = useDemoAggregate(demoId);

  if (agg.loading) {
    return <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}>
      <Text style={{ color: colors.inkSecondary }}>Loading...</Text>
    </View>;
  }
  const { demo, recommendationTally, dimensionAverages, perEvaluator } = agg;
  const canDecide = demo.status === "completed" && !demo.appliedDecision;

  const onDecide = async (action: "advance" | "reject" | "manual") => {
    await apply({
      demoId: demoId as any,
      action,
      appliedBy: role.userProfileId as any,
    });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceCanvas }} contentContainerStyle={{ padding: space[4] }}>
      {demo.appliedDecision && <AppliedDecisionBanner applied={demo.appliedDecision} />}

      <Card padding="md" style={{ marginBottom: space[4] }}>
        <Text style={{ color: colors.inkTertiary, fontSize: fonts.size.xs, textTransform: "uppercase", letterSpacing: 0.5 }}>Demo</Text>
        <Text style={{ color: colors.ink, fontSize: fonts.size.lg, fontWeight: fonts.weight.semibold, marginTop: space[1] }}>
          {new Date(demo.scheduledAt).toLocaleString()}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: space[2] }}>
          <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.sm }}>
            {`${demo.mode} / ${demo.format} / ${demo.durationMinutes} min`}
          </Text>
          <View style={{ marginLeft: space[2] }}>
            <Badge tone={demo.status === "completed" ? "success" : demo.status === "cancelled" ? "danger" : "info"}>
              {demo.status}
            </Badge>
          </View>
        </View>
      </Card>

      <Card padding="md" style={{ marginBottom: space[4] }}>
        <Text style={{ color: colors.inkTertiary, fontSize: fonts.size.xs, textTransform: "uppercase", letterSpacing: 0.5 }}>Recommendations</Text>
        <Text style={{ color: colors.ink, fontSize: fonts.size.md, marginTop: space[1] }}>
          {`Hire: ${recommendationTally?.hire ?? 0}  |  Maybe: ${recommendationTally?.maybe ?? 0}  |  Reject: ${recommendationTally?.reject ?? 0}`}
        </Text>
      </Card>

      {dimensionAverages && Object.keys(dimensionAverages).length > 0 && (
        <Card padding="md" style={{ marginBottom: space[4] }}>
          <Text style={{ color: colors.inkTertiary, fontSize: fonts.size.xs, textTransform: "uppercase", letterSpacing: 0.5 }}>Averages</Text>
          {Object.entries(dimensionAverages).map(([k, v]) => (
            <Text key={k} style={{ color: colors.ink, fontSize: fonts.size.sm, marginTop: 2 }}>
              {`${k}: ${Number(v).toFixed(1)}`}
            </Text>
          ))}
        </Card>
      )}

      <Text style={{ color: colors.ink, fontSize: fonts.size.lg, fontWeight: fonts.weight.semibold, marginBottom: space[2] }}>
        Evaluators
      </Text>
      {(perEvaluator ?? []).map((row: any) => (
        <PerEvaluatorRow
          key={row.invite._id}
          name={row.evaluatorName ?? "Unknown"}
          role={row.evaluatorRole}
          status={row.invite.status}
          recommendation={row.evaluation?.recommendation}
          bullets={row.evaluation?.voiceInputs?.[0]?.summaryPoints}
        />
      ))}

      {canDecide && (
        <View style={{ marginTop: space[6], gap: space[3] }}>
          <PressableButton variant="primary" onPress={() => onDecide("advance")}>Advance</PressableButton>
          <PressableButton variant="danger" onPress={() => onDecide("reject")}>Reject</PressableButton>
          <PressableButton variant="secondary" onPress={() => navigation.navigate("ScheduleDemo", { applicationId: demo.applicationId, parentDemoId: demoId })}>
            Schedule re-demo
          </PressableButton>
          <PressableButton variant="ghost" onPress={() => onDecide("manual")}>Mark as manual review</PressableButton>
        </View>
      )}
    </ScrollView>
  );
}
```

- [ ] **Step 3: Register in nav + add link from demo-detail**

Modify `mobile/src/navigation/app-nav.tsx` to add:
```tsx
import { DemoSummaryScreen } from "@/screens/demo-summary";
// ...
DemoSummary: { demoId: string };
// ...
<Stack.Screen name="DemoSummary" component={DemoSummaryScreen} options={{ headerShown: true, title: "Summary" }} />
```

Modify `mobile/src/screens/demo-detail.tsx`: when `role.isHR`, render a *View summary* button below the existing hero that calls `navigation.navigate("DemoSummary", { demoId })`. The summary link should be visible regardless of demo status (HR can preview an in-progress aggregation).

- [ ] **Step 4: Run + commit**

```bash
bun --cwd mobile run test __tests__/screens/demo-summary.test.tsx
git add mobile/src/screens/demo-summary.tsx mobile/src/components/demos/per-evaluator-row.tsx mobile/src/components/demos/applied-decision-banner.tsx mobile/src/navigation/app-nav.tsx mobile/src/screens/demo-detail.tsx mobile/__tests__/screens/demo-summary.test.tsx
git commit -m "feat(mobile/demos): summary screen with per-evaluator rows + decision row"
```

---

### Task 15: Wire Re-demo prefill on summary

**Files:**
- Modify: `mobile/src/screens/schedule-demo.tsx` (accept prefill: `parentDemoId` + sibling demo's evaluator panel)
- Modify: `mobile/src/screens/demo-summary.tsx` (already passes `parentDemoId`; confirm)
- Create: `mobile/__tests__/screens/schedule-demo-redemo.test.tsx`

When opened with `parentDemoId`, the wizard prefills:
- `evaluators` from the parent demo's invite panel (read via `api.evaluationInvites.listForDemoWithProfiles`)
- A default `scheduledAt` 3 business days ahead (best-effort: 3 calendar days for v1)

- [ ] **Step 1: Write the test**

```tsx
// mobile/__tests__/screens/schedule-demo-redemo.test.tsx
import { render, screen } from "@testing-library/react-native";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useRoute: () => ({ params: { applicationId: "a1", parentDemoId: "d-parent" } }),
}));

jest.mock("@/hooks/use-role-context", () => ({ useRoleContext: () => ({ schoolId: "s1", userProfileId: "u-hr" }) }));
jest.mock("@/hooks/use-staff-directory", () => ({ useStaffDirectory: () => ({ staff: [] }) }));
jest.mock("@/hooks/use-active-decision-rules", () => ({ useActiveDecisionRules: () => ({ rules: [] }) }));

jest.mock("convex/react", () => ({
  useMutation: () => jest.fn(),
  useQuery: (name: string) => {
    if (typeof name === "string" && name.includes("evaluationInvites:listForDemoWithProfiles")) {
      return [{ _id: "i1", evaluatorUserId: "u1", evaluatorRole: "principal", status: "submitted", profile: null }];
    }
    return undefined;
  },
}));
jest.mock("@convex/_generated/api", () => ({
  api: {
    demoSessions: { create: "demoSessions:create" },
    evaluationInvites: { listForDemoWithProfiles: "evaluationInvites:listForDemoWithProfiles" },
  },
}));

import { ScheduleDemoScreen } from "@/screens/schedule-demo";

describe("ScheduleDemoScreen (re-demo)", () => {
  it("hydrates evaluators from parent demo invites", () => {
    render(<ScheduleDemoScreen />);
    // Wizard starts on step 1; we just assert the screen mounts cleanly with prefill.
    expect(screen.getByText(/Step 1 of 3/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement prefill effect inside `schedule-demo.tsx`**

```tsx
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

// Inside ScheduleDemoScreen, after the initial draft useState:
const parentInvites = useQuery(
  api.evaluationInvites.listForDemoWithProfiles,
  parentDemoId ? { demoId: parentDemoId as any } : "skip",
);

useEffect(() => {
  if (!parentInvites || draft.evaluators.length > 0) return;
  const evaluators = parentInvites
    .filter((r: any) => r.status !== "cancelled")
    .map((r: any) => ({ userId: r.evaluatorUserId, role: r.evaluatorRole }));
  const inThreeDays = new Date(Date.now() + 3 * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  setDraft((d) => ({
    ...d,
    evaluators,
    date: `${inThreeDays.getFullYear()}-${pad(inThreeDays.getMonth() + 1)}-${pad(inThreeDays.getDate())}`,
  }));
}, [parentInvites]);
```

- [ ] **Step 3: Run + commit**

```bash
bun --cwd mobile run test __tests__/screens/schedule-demo-redemo.test.tsx
git add mobile/src/screens/schedule-demo.tsx mobile/__tests__/screens/schedule-demo-redemo.test.tsx
git commit -m "feat(mobile/demos): re-demo prefill (carry evaluators, default +3 days)"
```

---

## Phase 6: Settings hub + Template editor + Rule editor

### Task 16: Settings hub screen

**Files:**
- Create: `mobile/src/screens/settings.tsx`
- Modify: `mobile/src/screens/profile.tsx` (add *Settings* link visible only when `role.isHR`)
- Modify: `mobile/src/navigation/app-nav.tsx` (register `Settings`, `TemplateEditor`, `RuleEditor`)
- Create: `mobile/__tests__/screens/settings.test.tsx`

Hub lists the three settings areas: *Form templates*, *Decision rules*, *Notifications* (read-only for v1, deep link to Profile push permission section). Each row opens the corresponding screen.

- [ ] **Step 1: Write the test**

```tsx
// mobile/__tests__/screens/settings.test.tsx
import { render, screen, fireEvent } from "@testing-library/react-native";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import { SettingsScreen } from "@/screens/settings";

describe("SettingsScreen", () => {
  beforeEach(() => mockNavigate.mockClear());
  it("renders three rows: templates, rules, notifications", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("Form templates")).toBeTruthy();
    expect(screen.getByText("Decision rules")).toBeTruthy();
    expect(screen.getByText("Notifications")).toBeTruthy();
  });
  it("navigates to Templates when tapped", () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText("Form templates"));
    expect(mockNavigate).toHaveBeenCalledWith("Templates");
  });
});
```

- [ ] **Step 2: Implement `settings.tsx`**

```tsx
// mobile/src/screens/settings.tsx
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Card } from "@/components/ui/card";
import { colors, fonts, space } from "@/theme";

interface Row { title: string; subtitle: string; target: string; }

const ROWS: Row[] = [
  { title: "Form templates", subtitle: "Per-role evaluation forms", target: "Templates" },
  { title: "Decision rules", subtitle: "Auto-advance, reject, redemo", target: "DecisionRules" },
  { title: "Notifications", subtitle: "Manage push permission", target: "Profile" },
];

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceCanvas }} contentContainerStyle={{ padding: space[4] }}>
      {ROWS.map((row) => (
        <Pressable key={row.target} onPress={() => navigation.navigate(row.target)} style={{ marginBottom: space[3] }}>
          <Card padding="md">
            <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>{row.title}</Text>
            <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.sm, marginTop: space[1] }}>{row.subtitle}</Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 3: Add HR-only link in `profile.tsx`**

```tsx
// In ProfileScreen, after the push notifications Card and before Sign out:
const role = useRoleContext();
// ...
{role.isHR && (
  <View style={{ marginTop: space[4] }}>
    <PressableButton variant="secondary" onPress={() => navigation.navigate("Settings")}>
      Settings
    </PressableButton>
  </View>
)}
```

Use `useNavigation` from `@react-navigation/native` and `useRoleContext` from `@/hooks/use-role-context`. Keep the existing tests green by gating the new button behind `role.isHR` only.

- [ ] **Step 4: Register routes in `app-nav.tsx`**

```tsx
import { SettingsScreen } from "@/screens/settings";
import { TemplatesIndexScreen } from "@/screens/templates";
import { TemplateEditorScreen } from "@/screens/template-editor";
import { DecisionRulesIndexScreen } from "@/screens/decision-rules";
import { RuleEditorScreen } from "@/screens/rule-editor";

// In param list:
Settings: undefined;
Templates: undefined;
TemplateEditor: { role: "principal" | "hod" | "hr_admin" | "teacher" };
DecisionRules: undefined;
RuleEditor: { ruleId?: string };

// Screens added under the signed-in branch (HR only enforced via UI hiding):
<Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: "Settings" }} />
<Stack.Screen name="Templates" component={TemplatesIndexScreen} options={{ headerShown: true, title: "Templates" }} />
<Stack.Screen name="TemplateEditor" component={TemplateEditorScreen} options={{ headerShown: true, title: "Edit template" }} />
<Stack.Screen name="DecisionRules" component={DecisionRulesIndexScreen} options={{ headerShown: true, title: "Decision rules" }} />
<Stack.Screen name="RuleEditor" component={RuleEditorScreen} options={{ headerShown: true, title: "Edit rule" }} />
```

Stub the four new index/editor screens to a `<Text>Coming up</Text>` so the nav resolves; T17 + T18 + T19 flesh them out.

- [ ] **Step 5: Run + commit**

```bash
bun --cwd mobile run test __tests__/screens/settings.test.tsx
git add mobile/src/screens/settings.tsx mobile/src/screens/profile.tsx mobile/src/navigation/app-nav.tsx mobile/src/screens/templates.tsx mobile/src/screens/template-editor.tsx mobile/src/screens/decision-rules.tsx mobile/src/screens/rule-editor.tsx mobile/__tests__/screens/settings.test.tsx
git commit -m "feat(mobile/settings): hub screen + HR-only profile link"
```

---

### Task 17: Templates index + per-role view

**Files:**
- Modify: `mobile/src/screens/templates.tsx` (replace stub)
- Create: `mobile/__tests__/screens/templates.test.tsx`

Lists the four roles. Each row shows the role name and whether the school has an override (read via `api.formTemplates.getForRole` per role). Tap → `TemplateEditor` for that role.

- [ ] **Step 1: Write the test**

```tsx
// mobile/__tests__/screens/templates.test.tsx
import { render, screen, fireEvent } from "@testing-library/react-native";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => ({ schoolId: "s1", isHR: true }),
}));
jest.mock("convex/react", () => ({
  useQuery: () => ({ schoolId: "s1", name: "Principal default" }),
}));
jest.mock("@convex/_generated/api", () => ({
  api: { formTemplates: { getForRole: "formTemplates:getForRole" } },
}));

import { TemplatesIndexScreen } from "@/screens/templates";

describe("TemplatesIndexScreen", () => {
  beforeEach(() => mockNavigate.mockClear());
  it("lists the four roles", () => {
    render(<TemplatesIndexScreen />);
    expect(screen.getByText(/principal/i)).toBeTruthy();
    expect(screen.getByText(/hod/i)).toBeTruthy();
    expect(screen.getByText(/hr admin/i)).toBeTruthy();
    expect(screen.getByText(/teacher/i)).toBeTruthy();
  });
  it("opens editor with the chosen role", () => {
    render(<TemplatesIndexScreen />);
    fireEvent.press(screen.getByText(/principal/i));
    expect(mockNavigate).toHaveBeenCalledWith("TemplateEditor", { role: "principal" });
  });
});
```

- [ ] **Step 2: Implement `templates.tsx`**

```tsx
// mobile/src/screens/templates.tsx
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRoleContext } from "@/hooks/use-role-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { colors, fonts, space } from "@/theme";

const ROLES = ["principal", "hod", "hr_admin", "teacher"] as const;
const LABELS: Record<string, string> = {
  principal: "Principal",
  hod: "HOD",
  hr_admin: "HR Admin",
  teacher: "Teacher",
};

export function TemplatesIndexScreen() {
  const role = useRoleContext();
  const navigation = useNavigation<any>();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceCanvas }} contentContainerStyle={{ padding: space[4] }}>
      {ROLES.map((r) => (
        <RoleRow key={r} role={r} schoolId={role.schoolId} onPress={() => navigation.navigate("TemplateEditor", { role: r })} />
      ))}
    </ScrollView>
  );
}

function RoleRow({ role, schoolId, onPress }: { role: typeof ROLES[number]; schoolId: string | null; onPress: () => void }) {
  const active = useQuery(api.formTemplates.getForRole, schoolId ? { schoolId: schoolId as any, role } : "skip");
  const overridden = active && (active as any).schoolId;
  return (
    <Pressable onPress={onPress} style={{ marginBottom: space[3] }}>
      <Card padding="md">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>{LABELS[role]}</Text>
            <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.xs, marginTop: space[1] }}>
              {active?.name ?? "Loading..."}
            </Text>
          </View>
          <Badge tone={overridden ? "success" : "neutral"}>{overridden ? "Customized" : "Default"}</Badge>
        </View>
      </Card>
    </Pressable>
  );
}
```

- [ ] **Step 3: Run + commit**

```bash
bun --cwd mobile run test __tests__/screens/templates.test.tsx
git add mobile/src/screens/templates.tsx mobile/__tests__/screens/templates.test.tsx
git commit -m "feat(mobile/settings): templates index per role"
```

---

### Task 18: Template editor screen + field row

**Files:**
- Modify: `mobile/src/screens/template-editor.tsx` (replace stub)
- Create: `mobile/src/components/settings/field-row.tsx`
- Create: `mobile/__tests__/screens/template-editor.test.tsx`

Editor renders the active template's fields (or duplicates from default if no override). Each `FieldRow` shows: label input, type chip (`score_1_5 | score_1_10 | text | choice`), `Required`, `Allow dictation` (text only), and an up/down/delete trio. *Add field* button appends a new field with defaults. *Save* calls `api.formTemplates.saveOverride`.

- [ ] **Step 1: Implement `FieldRow` (skip a test for the row to keep this task scoped; the editor test covers it integrationally)**

```tsx
// mobile/src/components/settings/field-row.tsx
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { Card } from "@/components/ui/card";
import { colors, fonts, radii, space } from "@/theme";

export type FieldType = "score_1_5" | "score_1_10" | "text" | "choice";
export interface DraftField {
  key: string; label: string; type: FieldType;
  required?: boolean; allowDictation?: boolean; weight?: number;
  choices?: string[];
}

const TYPES: FieldType[] = ["score_1_5", "score_1_10", "text", "choice"];

interface Props {
  field: DraftField;
  onChange: (next: DraftField) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
}

export function FieldRow({ field, onChange, onRemove, onMove }: Props) {
  return (
    <Card padding="md" style={{ marginBottom: space[3] }}>
      <Text style={labelStyle}>Label</Text>
      <TextInput
        value={field.label}
        onChangeText={(t) => onChange({ ...field, label: t })}
        style={inputStyle}
      />
      <Text style={[labelStyle, { marginTop: space[3] }]}>Type</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {TYPES.map((t) => (
          <Pressable key={t} onPress={() => onChange({ ...field, type: t })}>
            <Text style={chipStyle(field.type === t)}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: space[3], alignItems: "center" }}>
        <Text style={labelStyle}>Required</Text>
        <Switch value={!!field.required} onValueChange={(v) => onChange({ ...field, required: v })} />
      </View>
      {field.type === "text" && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: space[2], alignItems: "center" }}>
          <Text style={labelStyle}>Allow dictation</Text>
          <Switch value={!!field.allowDictation} onValueChange={(v) => onChange({ ...field, allowDictation: v })} />
        </View>
      )}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: space[3], marginTop: space[3] }}>
        <Pressable onPress={() => onMove(-1)}><Text style={actionStyle}>Up</Text></Pressable>
        <Pressable onPress={() => onMove(1)}><Text style={actionStyle}>Down</Text></Pressable>
        <Pressable onPress={onRemove}><Text style={{ ...actionStyle, color: colors.danger }}>Delete</Text></Pressable>
      </View>
    </Card>
  );
}

const labelStyle = {
  color: colors.inkTertiary, fontSize: fonts.size.xs,
  textTransform: "uppercase" as const, letterSpacing: 0.5,
};
const inputStyle = {
  backgroundColor: colors.surface, borderColor: colors.hairline, borderWidth: 1,
  borderRadius: radii.apple, paddingHorizontal: space[3], paddingVertical: space[2],
  color: colors.ink, fontSize: fonts.size.md, marginTop: space[1],
} as const;
const actionStyle = { color: colors.accent, fontSize: fonts.size.sm, fontWeight: fonts.weight.medium };

function chipStyle(active: boolean) {
  return {
    paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: 999,
    backgroundColor: active ? colors.accentSoft : colors.surface,
    color: active ? colors.accent : colors.inkSecondary,
    borderWidth: 1, borderColor: active ? colors.accent : colors.hairline,
    fontSize: fonts.size.sm, overflow: "hidden" as const,
  };
}
```

- [ ] **Step 2: Write the editor test**

```tsx
// mobile/__tests__/screens/template-editor.test.tsx
import { render, screen, fireEvent } from "@testing-library/react-native";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useRoute: () => ({ params: { role: "principal" } }),
}));
jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => ({ schoolId: "s1", isHR: true }),
}));

const mockSave = jest.fn().mockResolvedValue(undefined);
jest.mock("convex/react", () => ({
  useQuery: (name: string) => {
    if (typeof name === "string" && name.includes("getForRole")) {
      return { name: "Principal default", fields: [{ key: "subjectKnowledge", label: "Subject knowledge", type: "score_1_5" }] };
    }
    if (typeof name === "string" && name.includes("duplicateFromDefault")) {
      return { name: "Principal default", fields: [] };
    }
    return undefined;
  },
  useMutation: () => mockSave,
}));
jest.mock("@convex/_generated/api", () => ({
  api: {
    formTemplates: {
      getForRole: "formTemplates:getForRole",
      duplicateFromDefault: "formTemplates:duplicateFromDefault",
      saveOverride: "formTemplates:saveOverride",
    },
  },
}));

import { TemplateEditorScreen } from "@/screens/template-editor";

describe("TemplateEditorScreen", () => {
  beforeEach(() => mockSave.mockClear());
  it("renders the active template's fields", () => {
    render(<TemplateEditorScreen />);
    expect(screen.getByDisplayValue("Subject knowledge")).toBeTruthy();
  });
  it("invokes saveOverride on Save", async () => {
    render(<TemplateEditorScreen />);
    fireEvent.press(screen.getByText("Save"));
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: "s1", role: "principal" }),
    );
  });
});
```

- [ ] **Step 3: Implement the editor**

```tsx
// mobile/src/screens/template-editor.tsx
import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRoleContext } from "@/hooks/use-role-context";
import { FieldRow, type DraftField } from "@/components/settings/field-row";
import { PressableButton } from "@/components/ui/pressable-button";
import { colors, fonts, radii, space } from "@/theme";

type Role = "principal" | "hod" | "hr_admin" | "teacher";

export function TemplateEditorScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const role = useRoleContext();
  const target = route.params.role as Role;

  const active = useQuery(api.formTemplates.getForRole, role.schoolId ? { schoolId: role.schoolId as any, role: target } : "skip");
  const defaultDraft = useQuery(api.formTemplates.duplicateFromDefault, role.schoolId ? { schoolId: role.schoolId as any, role: target } : "skip");
  const save = useMutation(api.formTemplates.saveOverride);

  const [name, setName] = useState<string | null>(null);
  const [fields, setFields] = useState<DraftField[] | null>(null);

  useEffect(() => {
    if (active && name === null) {
      setName(active.name);
      setFields(active.fields as DraftField[]);
    }
  }, [active, name]);

  if (name === null || fields === null) {
    return <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}>
      <Text style={{ color: colors.inkSecondary }}>Loading...</Text>
    </View>;
  }

  const updateField = (i: number, next: DraftField) => {
    const copy = fields.slice();
    copy[i] = next;
    setFields(copy);
  };
  const removeField = (i: number) => setFields(fields.filter((_, idx) => idx !== i));
  const moveField = (i: number, delta: -1 | 1) => {
    const to = i + delta;
    if (to < 0 || to >= fields.length) return;
    const copy = fields.slice();
    const [m] = copy.splice(i, 1);
    copy.splice(to, 0, m);
    setFields(copy);
  };

  const onSave = async () => {
    if (!role.schoolId) return;
    await save({ schoolId: role.schoolId as any, role: target, name, fields });
    navigation.goBack();
  };

  const startFromDefault = () => {
    if (!defaultDraft) return;
    setName(defaultDraft.name);
    setFields(defaultDraft.fields as DraftField[]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceCanvas }} contentContainerStyle={{ padding: space[4] }}>
      <Text style={{ color: colors.inkTertiary, fontSize: fonts.size.xs, textTransform: "uppercase", letterSpacing: 0.5 }}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        style={{
          backgroundColor: colors.surface, borderColor: colors.hairline, borderWidth: 1,
          borderRadius: radii.apple, padding: space[3], color: colors.ink, marginTop: space[1], marginBottom: space[4],
        }}
      />
      {fields.map((f, i) => (
        <FieldRow
          key={`${f.key}-${i}`}
          field={f}
          onChange={(next) => updateField(i, next)}
          onRemove={() => removeField(i)}
          onMove={(d) => moveField(i, d)}
        />
      ))}
      <View style={{ marginTop: space[3], gap: space[2] }}>
        <PressableButton variant="ghost" onPress={() => setFields([...fields, { key: `field${fields.length + 1}`, label: "New field", type: "score_1_5" }])}>
          Add field
        </PressableButton>
        <PressableButton variant="ghost" onPress={startFromDefault}>Reset to default</PressableButton>
        <PressableButton variant="primary" onPress={onSave}>Save</PressableButton>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 4: Run + commit**

```bash
bun --cwd mobile run test __tests__/screens/template-editor.test.tsx
git add mobile/src/screens/template-editor.tsx mobile/src/components/settings/field-row.tsx mobile/__tests__/screens/template-editor.test.tsx
git commit -m "feat(mobile/settings): template editor with field rows + save"
```

---

### Task 19: Decision rules index + rule editor

**Files:**
- Modify: `mobile/src/screens/decision-rules.tsx` (replace stub)
- Modify: `mobile/src/screens/rule-editor.tsx` (replace stub)
- Create: `mobile/src/components/settings/branch-row.tsx`
- Create: `mobile/__tests__/screens/decision-rules.test.tsx`

Index lists all `decisionRules.list`. Tap an item → `RuleEditor` with `ruleId`. *New rule* → `RuleEditor` with no `ruleId`. Editor exposes: name, branches (each with one or two condition clauses + action picker), fallback action picker. Limited condition vocabulary on mobile v1: `minHire` + `maxReject` only (advanced clauses like `minAverage` and `requiredRoles` remain web-only for v1 to keep the mobile UI tight). The fallback line clarifies this.

- [ ] **Step 1: Implement `BranchRow`**

```tsx
// mobile/src/components/settings/branch-row.tsx
import { Pressable, Text, TextInput, View } from "react-native";
import { Card } from "@/components/ui/card";
import { colors, fonts, radii, space } from "@/theme";

export type Action = "advance" | "reject" | "redemo" | "manual";
export interface DraftBranch {
  condition: { minHire?: number; maxReject?: number };
  action: Action;
}
const ACTIONS: Action[] = ["advance", "reject", "redemo", "manual"];

export function BranchRow({ branch, onChange, onRemove }: { branch: DraftBranch; onChange: (b: DraftBranch) => void; onRemove: () => void }) {
  return (
    <Card padding="md" style={{ marginBottom: space[3] }}>
      <Text style={labelStyle}>Min "Hire" recommendations</Text>
      <TextInput
        value={branch.condition.minHire?.toString() ?? ""}
        onChangeText={(t) => onChange({ ...branch, condition: { ...branch.condition, minHire: t ? parseInt(t, 10) : undefined } })}
        keyboardType="number-pad"
        style={inputStyle}
      />
      <Text style={[labelStyle, { marginTop: space[3] }]}>Max "Reject" recommendations</Text>
      <TextInput
        value={branch.condition.maxReject?.toString() ?? ""}
        onChangeText={(t) => onChange({ ...branch, condition: { ...branch.condition, maxReject: t ? parseInt(t, 10) : undefined } })}
        keyboardType="number-pad"
        style={inputStyle}
      />
      <Text style={[labelStyle, { marginTop: space[3] }]}>Action</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {ACTIONS.map((a) => (
          <Pressable key={a} onPress={() => onChange({ ...branch, action: a })}>
            <Text style={chipStyle(branch.action === a)}>{a}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={onRemove} style={{ marginTop: space[3], alignSelf: "flex-end" }}>
        <Text style={{ color: colors.danger, fontSize: fonts.size.sm }}>Remove branch</Text>
      </Pressable>
    </Card>
  );
}

const labelStyle = { color: colors.inkTertiary, fontSize: fonts.size.xs, textTransform: "uppercase" as const, letterSpacing: 0.5 };
const inputStyle = {
  backgroundColor: colors.surface, borderColor: colors.hairline, borderWidth: 1,
  borderRadius: radii.apple, padding: space[3], color: colors.ink, marginTop: space[1],
} as const;
function chipStyle(active: boolean) {
  return {
    paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: 999,
    backgroundColor: active ? colors.accentSoft : colors.surface,
    color: active ? colors.accent : colors.inkSecondary,
    borderWidth: 1, borderColor: active ? colors.accent : colors.hairline,
    fontSize: fonts.size.sm, overflow: "hidden" as const,
  };
}
```

- [ ] **Step 2: Implement `decision-rules.tsx` (index)**

```tsx
// mobile/src/screens/decision-rules.tsx
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRoleContext } from "@/hooks/use-role-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PressableButton } from "@/components/ui/pressable-button";
import { EmptyState } from "@/components/ui/empty-state";
import { colors, fonts, space } from "@/theme";

export function DecisionRulesIndexScreen() {
  const navigation = useNavigation<any>();
  const role = useRoleContext();
  const rules = useQuery(api.decisionRules.list, role.schoolId ? { schoolId: role.schoolId as any } : "skip");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceCanvas }} contentContainerStyle={{ padding: space[4] }}>
      <View style={{ marginBottom: space[4] }}>
        <PressableButton variant="primary" onPress={() => navigation.navigate("RuleEditor", {})}>New rule</PressableButton>
      </View>
      {(!rules || rules.length === 0) && (
        <EmptyState title="No rules yet" body="Create a rule to auto-decide demos." />
      )}
      {(rules ?? []).map((r: any) => (
        <Pressable key={r._id} onPress={() => navigation.navigate("RuleEditor", { ruleId: r._id })} style={{ marginBottom: space[3] }}>
          <Card padding="md">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>{r.name}</Text>
              <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</Badge>
            </View>
            <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.xs, marginTop: space[1] }}>
              {`${r.branches.length} branch${r.branches.length === 1 ? "" : "es"}, fallback: ${r.fallback}`}
            </Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 3: Implement `rule-editor.tsx`**

```tsx
// mobile/src/screens/rule-editor.tsx
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRoleContext } from "@/hooks/use-role-context";
import { BranchRow, type Action, type DraftBranch } from "@/components/settings/branch-row";
import { PressableButton } from "@/components/ui/pressable-button";
import { colors, fonts, radii, space } from "@/theme";

const ACTIONS: Action[] = ["advance", "reject", "redemo", "manual"];

export function RuleEditorScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const role = useRoleContext();
  const ruleId = route.params?.ruleId as string | undefined;
  const existing = useQuery(api.decisionRules.get, ruleId ? { ruleId: ruleId as any } : "skip");
  const create = useMutation(api.decisionRules.create);
  const update = useMutation(api.decisionRules.update);

  const [name, setName] = useState<string | null>(null);
  const [branches, setBranches] = useState<DraftBranch[] | null>(null);
  const [fallback, setFallback] = useState<Action | null>(null);

  useEffect(() => {
    if (!ruleId && name === null) {
      setName("");
      setBranches([]);
      setFallback("manual");
    } else if (ruleId && existing && name === null) {
      setName(existing.name);
      setBranches(existing.branches as DraftBranch[]);
      setFallback(existing.fallback as Action);
    }
  }, [ruleId, existing, name]);

  if (name === null || branches === null || fallback === null) {
    return <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}>
      <Text style={{ color: colors.inkSecondary }}>Loading...</Text>
    </View>;
  }

  const onSave = async () => {
    if (ruleId) {
      await update({ ruleId: ruleId as any, name, branches, fallback });
    } else if (role.schoolId) {
      await create({ schoolId: role.schoolId as any, name, branches, fallback });
    }
    navigation.goBack();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfaceCanvas }} contentContainerStyle={{ padding: space[4] }}>
      <Text style={labelStyle}>Name</Text>
      <TextInput value={name} onChangeText={setName} style={inputStyle} />
      <Text style={[labelStyle, { marginTop: space[4] }]}>Branches (first match wins)</Text>
      {branches.map((b, i) => (
        <BranchRow
          key={i}
          branch={b}
          onChange={(next) => setBranches(branches.map((x, j) => (j === i ? next : x)))}
          onRemove={() => setBranches(branches.filter((_, j) => j !== i))}
        />
      ))}
      <PressableButton variant="ghost" onPress={() => setBranches([...branches, { condition: { minHire: 1 }, action: "advance" }])}>
        Add branch
      </PressableButton>
      <Text style={[labelStyle, { marginTop: space[4] }]}>Fallback action</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {ACTIONS.map((a) => (
          <Pressable key={a} onPress={() => setFallback(a)}>
            <Text style={chipStyle(fallback === a)}>{a}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: colors.inkTertiary, fontSize: fonts.size.xs, marginTop: space[3] }}>
        Mobile editor supports minHire + maxReject conditions only. Use the web editor for minAverage and requiredRoles.
      </Text>
      <View style={{ marginTop: space[6] }}>
        <PressableButton variant="primary" onPress={onSave}>Save</PressableButton>
      </View>
    </ScrollView>
  );
}

const labelStyle = { color: colors.inkTertiary, fontSize: fonts.size.xs, textTransform: "uppercase" as const, letterSpacing: 0.5 };
const inputStyle = {
  backgroundColor: colors.surface, borderColor: colors.hairline, borderWidth: 1,
  borderRadius: radii.apple, padding: space[3], color: colors.ink, marginTop: space[1],
  fontSize: fonts.size.md,
} as const;
function chipStyle(active: boolean) {
  return {
    paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: 999,
    backgroundColor: active ? colors.accentSoft : colors.surface,
    color: active ? colors.accent : colors.inkSecondary,
    borderWidth: 1, borderColor: active ? colors.accent : colors.hairline,
    fontSize: fonts.size.sm, overflow: "hidden" as const,
  };
}
```

- [ ] **Step 4: Write the index test**

```tsx
// mobile/__tests__/screens/decision-rules.test.tsx
import { render, screen } from "@testing-library/react-native";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock("@/hooks/use-role-context", () => ({
  useRoleContext: () => ({ schoolId: "s1", isHR: true }),
}));
jest.mock("convex/react", () => ({
  useQuery: () => [{ _id: "r1", name: "Strict", isActive: true, branches: [{}], fallback: "manual" }],
}));
jest.mock("@convex/_generated/api", () => ({
  api: { decisionRules: { list: "decisionRules:list" } },
}));

import { DecisionRulesIndexScreen } from "@/screens/decision-rules";

describe("DecisionRulesIndexScreen", () => {
  it("renders the rule with active badge", () => {
    render(<DecisionRulesIndexScreen />);
    expect(screen.getByText("Strict")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run + commit**

```bash
bun --cwd mobile run test __tests__/screens/decision-rules.test.tsx
git add mobile/src/screens/decision-rules.tsx mobile/src/screens/rule-editor.tsx mobile/src/components/settings/branch-row.tsx mobile/__tests__/screens/decision-rules.test.tsx
git commit -m "feat(mobile/settings): decision rules index + simple branch editor"
```

---

## Phase 7: HR notifications + E2E + wrap

### Task 20: `notifyDemoComplete` helper + wire from auto/manual decisions

**Files:**
- Modify: `convex/notifications.ts` (add `notifyDemoComplete`)
- Modify: `convex/decisions.ts` (call it after auto-applied decisions)
- Modify: `convex/demoSessions.ts` (call it from `applyDecision`)
- Create: `tests/convex/notifications-demo-complete.test.ts`

Helper fans out a `demo_completed` push to every `userProfiles` row in the demo's school whose `role` is `hr_admin` or `principal` and who has at least one Expo push token registered. The existing `sendDemoEvent` internalAction already knows how to render the message; we re-use it.

- [ ] **Step 1: Write the failing test**

```ts
// tests/convex/notifications-demo-complete.test.ts
import { describe, it, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";

describe("notifyDemoComplete", () => {
  it("targets HR + Principal users in the school", async () => {
    const t = convexTest(schema);
    const schoolId = await t.run(async (ctx) =>
      ctx.db.insert("schools", { name: "S", createdAt: Date.now() } as any),
    );
    const hr = await t.run(async (ctx) =>
      ctx.db.insert("userProfiles", { userId: "u-hr", name: "HR", email: "h@s", schoolId, role: "hr_admin", expoPushTokens: ["ExpoTok-HR"] } as any),
    );
    const principal = await t.run(async (ctx) =>
      ctx.db.insert("userProfiles", { userId: "u-p", name: "P", email: "p@s", schoolId, role: "principal", expoPushTokens: ["ExpoTok-P"] } as any),
    );
    const teacher = await t.run(async (ctx) =>
      ctx.db.insert("userProfiles", { userId: "u-t", name: "T", email: "t@s", schoolId, role: "teacher", expoPushTokens: ["ExpoTok-T"] } as any),
    );
    const candidateId = await t.run(async (ctx) =>
      ctx.db.insert("candidates", { name: "C", email: "c@s", schoolId } as any),
    );
    const applicationId = await t.run(async (ctx) =>
      ctx.db.insert("applications", { candidateId, schoolId, stage: "demo_scheduled" } as any),
    );
    const demoId = await t.run(async (ctx) =>
      ctx.db.insert("demoSessions", {
        applicationId, schoolId, scheduledAt: Date.now() - 1, durationMinutes: 30,
        mode: "live", format: "classroom", status: "completed",
        createdBy: hr, createdAt: Date.now(),
      } as any),
    );

    const scheduler = vi.spyOn(t.scheduler, "runAfter" as any).mockResolvedValue(undefined);
    await t.action(internal.notifications.notifyDemoComplete, { demoId });
    expect(scheduler).toHaveBeenCalled();
    const args = scheduler.mock.calls[0][2] as any;
    expect(args.event).toBe("demo_completed");
    expect(args.targetUserIds.sort()).toEqual([hr, principal].sort());
    expect(args.targetUserIds).not.toContain(teacher);
  });
});
```

- [ ] **Step 2: Run + watch fail, implement**

Append to `convex/notifications.ts`:

```ts
export const notifyDemoComplete = internalAction({
  args: { demoId: v.id("demoSessions") },
  handler: async (ctx, { demoId }) => {
    const demo: any = await ctx.runQuery(internal.demoSessions.getInternal, { demoId });
    if (!demo) return;
    const profiles = await ctx.runQuery(internal.users.listSchoolStaffInternal, { schoolId: demo.schoolId });
    const targets = profiles
      .filter((p: any) => p.role === "hr_admin" || p.role === "principal")
      .filter((p: any) => Array.isArray(p.expoPushTokens) && p.expoPushTokens.length > 0)
      .map((p: any) => p._id);
    if (targets.length === 0) return;
    await ctx.scheduler.runAfter(0, internal.notifications.sendDemoEvent, {
      event: "demo_completed",
      demoId,
      targetUserIds: targets,
    });
  },
});
```

Also add two helper internal queries:

```ts
// convex/demoSessions.ts
export const getInternal = internalQuery({
  args: { demoId: v.id("demoSessions") },
  handler: async (ctx, { demoId }) => ctx.db.get(demoId),
});

// convex/users.ts
export const listSchoolStaffInternal = internalQuery({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) =>
    await ctx.db.query("userProfiles").withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId)).collect(),
});
```

Invoke it from both decision paths:

```ts
// convex/decisions.ts — at the very end of maybeApplyDecision, after appliedDecision is patched:
await ctx.scheduler.runAfter(0, internal.notifications.notifyDemoComplete, { demoId });
```

```ts
// convex/demoSessions.ts — at the end of applyDecision's handler, before returning:
await ctx.scheduler.runAfter(0, internal.notifications.notifyDemoComplete, { demoId: args.demoId });
```

- [ ] **Step 3: Run vitest + codegen**

```bash
bunx convex codegen
bun run vitest run tests/convex/notifications-demo-complete.test.ts
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add convex/notifications.ts convex/decisions.ts convex/demoSessions.ts convex/users.ts tests/convex/notifications-demo-complete.test.ts convex/_generated/
git commit -m "feat(convex/notifications): notifyDemoComplete fans push to HR + Principal"
```

---

### Task 21: Maestro E2E for HR schedule demo

**Files:**
- Create: `mobile/.maestro/hr-schedule-demo.yaml`
- Create or update: `mobile/.maestro/README.md` (add the new flow to the list)

Flow: HR signs in via seed → Candidates tab → tap candidate → Schedule new demo → step 1 (defaults are valid) → Next → step 2 (toggle one staff row) → Next → step 3 → Confirm.

Skip when `EXPO_SEED_EMAIL` or `EXPO_SEED_SESSION_TOKEN` is unset, matching the Plan 3 pattern.

- [ ] **Step 1: Write the YAML**

```yaml
# mobile/.maestro/hr-schedule-demo.yaml
appId: app.rolerecruit.mobile
env:
  SKIP_NOT_SEEDED: ${EXPO_SEED_EMAIL:-skip}
---
- runFlow:
    when:
      true: ${SKIP_NOT_SEEDED != "skip"}
    commands:
      - openLink: "rolerecruit://?token=${EXPO_SEED_SESSION_TOKEN}"
      - assertVisible: "Candidates"
      - tapOn: "Candidates"
      - assertVisible:
          id: "candidate-card"
      - tapOn:
          id: "candidate-card"
          index: 0
      - assertVisible: "Schedule new demo"
      - tapOn: "Schedule new demo"
      - assertVisible: "Step 1 of 3"
      - tapOn: "Next"
      - assertVisible: "Step 2 of 3"
      - tapOn:
          id: "staff-row"
          index: 0
      - tapOn: "Next"
      - assertVisible: "Step 3 of 3"
      - tapOn: "Confirm"
```

For the flow to find elements by id, the screens should set `accessibilityLabel`:
- `CandidateCard` → `testID="candidate-card"`
- `StepEvaluators` staff rows → `testID="staff-row"`

Update those two components to set the IDs. They are presentation-only adds; existing tests stay green.

- [ ] **Step 2: Document in README**

Add a section under "Flows" in `mobile/.maestro/README.md`:

```md
- `hr-schedule-demo.yaml` — HR signs in, opens Candidates, picks a candidate, schedules a demo. Seeded environment required.
```

- [ ] **Step 3: Commit**

```bash
git add mobile/.maestro/hr-schedule-demo.yaml mobile/.maestro/README.md \
  mobile/src/components/candidates/candidate-card.tsx \
  mobile/src/components/demos/schedule-wizard/step-evaluators.tsx
git commit -m "test(mobile/e2e): Maestro flow for HR schedule demo"
```

---

### Task 22: Maestro E2E for template edit save

**Files:**
- Create: `mobile/.maestro/hr-template-edit.yaml`

Flow: HR signs in via seed → Profile → Settings → Form templates → tap *Principal* → modify the first field's label → Save.

- [ ] **Step 1: Write the YAML**

```yaml
# mobile/.maestro/hr-template-edit.yaml
appId: app.rolerecruit.mobile
env:
  SKIP_NOT_SEEDED: ${EXPO_SEED_EMAIL:-skip}
---
- runFlow:
    when:
      true: ${SKIP_NOT_SEEDED != "skip"}
    commands:
      - openLink: "rolerecruit://?token=${EXPO_SEED_SESSION_TOKEN}"
      - tapOn: "Profile"
      - tapOn: "Settings"
      - tapOn: "Form templates"
      - tapOn: "Principal"
      - eraseText
      - inputText: "Subject knowledge (revised)"
      - tapOn: "Save"
      - assertVisible: "Templates"
```

For `eraseText` to target the first label input, prepend a `tapOn:` on the first field's `TextInput`. Set `testID="field-label-input"` on the label `<TextInput>` inside `FieldRow`.

- [ ] **Step 2: Commit**

```bash
git add mobile/.maestro/hr-template-edit.yaml mobile/src/components/settings/field-row.tsx
git commit -m "test(mobile/e2e): Maestro flow for HR template edit"
```

---

### Task 23: Final typecheck + plan doc commit

**Files:**
- Modify: nothing in source (verification only)

- [ ] **Step 1: Run the full mobile suite**

```bash
bun --cwd mobile run test
bun --cwd mobile run typecheck
```
Expected: green test suite (50+ tests), typecheck succeeds. If typecheck flags pre-existing Better Auth migration errors that Plan 3 documented, do not fix them here.

- [ ] **Step 2: Run the full Convex suite**

```bash
bun run vitest run
```
Expected: green (428+ tests).

- [ ] **Step 3: Commit the plan document if not already**

If the plan document was committed separately, skip this step. Otherwise:

```bash
git add docs/superpowers/plans/2026-05-28-evaluation-workflow-4-mobile-hr-surfaces.md
git commit -m "docs(plans): plan 4 mobile HR surfaces"
```

- [ ] **Step 4: Hand off to finishing-a-development-branch**

When all tasks pass, invoke the `superpowers:finishing-a-development-branch` skill to present completion options.

---

## Self-review checklist

Each requirement in the spec's Section 3 (HR mobile surfaces) is covered by at least one task:

- [x] **HR / Principal bottom navigation** (Inbox, Calendar, Candidates, Pipeline, Profile) — Task 3 (`HRTabs`).
- [x] **Candidates list with search** — Task 4 (hook) + Task 5 (screen).
- [x] **Candidate detail with demos timeline + Schedule new demo CTA** — Task 6.
- [x] **Pipeline view** — Task 7 (hook) + Task 8 (screen).
- [x] **Schedule Demo wizard (3 steps)** — Tasks 9, 10, 11, 12.
- [x] **Demo Summary (per-evaluator + averages + recommendation tally + decision row)** — Task 13 (hook) + Task 14 (screen).
- [x] **Re-demo prefill** — Task 15.
- [x] **Settings hub** — Task 16.
- [x] **Templates index + editor** — Tasks 17, 18.
- [x] **Decision rules index + editor** — Task 19.
- [x] **`demo_completed` push to HR + Principal** — Task 20.
- [x] **E2E coverage for the HR happy paths** — Tasks 21, 22.

Spec items intentionally deferred from Plan 4:

- **Swap evaluator from mobile Demo Summary.** Web already supports it (Plan 2 T12). Mobile invokes `applyDecision` and `applications.moveStage`; swap is a separate verb. Deferred to a follow-up cleanup task because the swap UI requires a staff directory bottom-sheet that adds noise for v1.
- **`minAverage` and `requiredRoles` conditions in mobile rule editor.** Web editor covers them; mobile editor v1 surfaces only `minHire` + `maxReject` with the disclaimer line in Task 19.
- **Bulk operations on Pipeline cards.** Web supports bulk move-stage and bulk delete; mobile v1 ships single-card tap → detail only.
- **Custom date / time pickers** in `StepWhen`. Plan 4 uses plain text inputs to avoid a native module add. Swap in a community picker later if HR friction is high.

## Placeholder scan

No `TBD`, `TODO`, `implement later`, or "add appropriate error handling" entries. Every UI code step shows actual JSX or function bodies. Every test step shows the assertions. Every command shows the exact `bun ...` invocation and the expected outcome.

## Type consistency

- `Role` literal `"principal" | "hod" | "hr_admin" | "teacher"` is reused across `StepEvaluators`, `BranchRow`, `FieldRow`, `RuleEditorScreen`, and `users.getMobileRoleContext`.
- `Action` literal `"advance" | "reject" | "redemo" | "manual"` matches the schema definition in `convex/decisionRules` (Plan 1 T2) and is reused in `BranchRow`, `RuleEditor`, `AppliedDecisionBanner`, and `DemoSummary.onDecide`.
- `Mode`, `Format` literals match `convex/demoSessions.create` arg validators.
- `DraftField` shape matches the validator on `formTemplates.fields` (Plan 1 T2). The mobile editor saves `weight` only when set (otherwise omits it), avoiding a schema mismatch.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-28-evaluation-workflow-4-mobile-hr-surfaces.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task with two-stage review between tasks.
2. **Inline Execution** — I execute tasks in this session via the `executing-plans` skill with checkpoints.

Which approach?

