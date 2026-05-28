# Evaluation Workflow — Plan 3: Mobile Scaffold + Evaluator Surfaces

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a native iOS + Android Expo app with Better Auth, push notifications, on-device speech-to-text, and the four evaluator-facing surfaces (Inbox, Calendar, Demo detail, Evaluation form with Dictation). After this plan ships, an invited evaluator can sign in on a phone, see their pending demos, open one, dictate comments, and submit feedback. The same Convex backend that the web uses powers it. HR-only mobile surfaces (Candidates, Pipeline, Schedule wizard, Demo Summary, Settings) ship in Plan 4.

**Architecture:** A new top-level `mobile/` directory holds the Expo app. It imports the shared Convex API from `../convex/_generated/api`. Better Auth on Expo uses `expo-secure-store` for session persistence. Push tokens are stored on `userProfiles.expoPushTokens[]` (new optional field) and registered from the app on first launch. `convex/notifications.ts` replaces its stub with a real Expo Push API call and gains a `sendDemoEvent` dispatcher invoked from every demo-state-changing mutation. On-device STT uses `expo-speech-recognition`; transcripts are sent to the existing `voiceProcessing.summarizeTranscript` action for bullet summarization. Forms are rendered dynamically from the template snapshot pinned at invite time (same shape the web uses).

**Tech Stack:** Expo SDK 51+, React Native + TypeScript, `convex/react` (works on RN), `@convex-dev/better-auth/react`, `better-auth/expo`, `expo-secure-store`, `expo-notifications`, `expo-device`, `expo-speech-recognition`, `@react-navigation/native` + `@react-navigation/bottom-tabs` + `@react-navigation/native-stack`, Jest + `jest-expo` + `@testing-library/react-native`, Maestro for E2E.

**Spec reference:** [docs/superpowers/specs/2026-05-28-evaluation-workflow-design.md](../specs/2026-05-28-evaluation-workflow-design.md) (Sections 0, 3, 8 — mobile + STT + testing).

**Builds on:** [Plan 1](2026-05-28-evaluation-workflow-1-backend-and-web.md) and [Plan 2](2026-05-28-evaluation-workflow-2-decision-engine-and-settings.md), both already shipped on main. Plan 3 reuses every backend module they added. The only schema change is one new optional field on `userProfiles`.

---

## UI guidelines (mobile)

The web uses an apple-esque design system in `components/ui/` with named tokens. The mobile app mirrors the **tokens** (colors, spacing, radii, motion) but uses React Native primitives (`View`, `Text`, `Pressable`, `ScrollView`) because there is no React Native build of the web components. A small `src/theme.ts` exports the same named tokens as constants; screens compose them via StyleSheet.

**Tokens (mirrored from `tailwind.config.ts`):**

| Concern | Web token | Mobile constant |
|---|---|---|
| Primary text | `text-ink` | `colors.ink` (#0a0a0a) |
| Secondary text | `text-ink-secondary` | `colors.inkSecondary` (#3f3f46) |
| Tertiary | `text-ink-tertiary` | `colors.inkTertiary` (#71717a) |
| Accent | `bg-accent` | `colors.accent` (#0066ff) |
| Accent soft | `bg-accent-soft` | `colors.accentSoft` (#e6efff) |
| Success / Warning / Danger | `text-success / warning / danger` | `colors.success / warning / danger` |
| Surface | `bg-surface` | `colors.surface` (#ffffff) |
| Canvas | `bg-surface-canvas` | `colors.canvas` (#fafafa) |
| Hairline | `border-hairline` | `colors.hairline` (#e4e4e7) |
| Radius default | `rounded-apple` | `radii.apple` (10) |
| Radius small | `rounded-sm` | `radii.sm` (6) |
| Spacing scale | `gap-{2,3,4,6,8}` | `space.{2,3,4,6,8}` (8,12,16,24,32) |

Do not hardcode raw hex values inside screens or components. Always reference `colors.*` / `radii.*` / `space.*`.

**Composition primitives (in `src/components/ui/`):**

- `<PressableButton variant size onPress>` — variants: `primary | secondary | ghost | danger`; sizes: `sm | md | lg`.
- `<Card padding="md">` — `View` with `colors.surface` background, `radii.apple` radius, `colors.hairline` border.
- `<Badge tone="info | success | warning | danger | neutral">` — `Text` chip.
- `<EmptyState title body icon>` — centered placeholder.

Reuse these wherever possible. Build them once in Phase 1 (T3) and import everywhere else.

---

## File map

**New mobile app (top-level `mobile/` directory)**

- `mobile/package.json` — Expo deps + scripts
- `mobile/app.json` — Expo config (bundle id, slug, scheme `rolerecruit`)
- `mobile/babel.config.js`, `mobile/tsconfig.json`, `mobile/metro.config.js`
- `mobile/jest.config.js`, `mobile/jest.setup.ts`
- `mobile/eas.json` — EAS build config (dev/preview/production)
- `mobile/App.tsx` — root with providers + nav
- `mobile/assets/icon.png`, `splash.png`, `adaptive-icon.png` (placeholder PNGs)
- `mobile/src/theme.ts` — tokens
- `mobile/src/lib/auth-client.ts` — Better Auth Expo client
- `mobile/src/lib/convex.ts` — ConvexReactClient instance
- `mobile/src/lib/push.ts` — Expo Notifications setup
- `mobile/src/providers/app-providers.tsx` — Convex + BetterAuth provider wrapping
- `mobile/src/navigation/app-nav.tsx` — root nav (auth gate + tabs)
- `mobile/src/navigation/evaluator-tabs.tsx` — bottom tab nav for evaluators
- `mobile/src/screens/sign-in.tsx`
- `mobile/src/screens/inbox.tsx`
- `mobile/src/screens/calendar.tsx`
- `mobile/src/screens/demo-detail.tsx`
- `mobile/src/screens/evaluation-form.tsx`
- `mobile/src/screens/profile.tsx`
- `mobile/src/components/ui/pressable-button.tsx`
- `mobile/src/components/ui/card.tsx`
- `mobile/src/components/ui/badge.tsx`
- `mobile/src/components/ui/empty-state.tsx`
- `mobile/src/components/inbox/inbox-card.tsx`
- `mobile/src/components/demos/demo-header.tsx`
- `mobile/src/components/demos/evaluator-status-row.tsx`
- `mobile/src/components/demos/decline-modal.tsx`
- `mobile/src/components/evaluations/form-field-score.tsx`
- `mobile/src/components/evaluations/form-field-text.tsx`
- `mobile/src/components/evaluations/form-field-choice.tsx`
- `mobile/src/components/evaluations/recommendation-buttons.tsx`
- `mobile/src/components/evaluations/dictation-overlay.tsx`
- `mobile/src/hooks/use-session.ts`
- `mobile/src/hooks/use-inbox.ts`
- `mobile/src/hooks/use-calendar-demos.ts`
- `mobile/src/hooks/use-mobile-speech-recognition.ts`
- `mobile/src/hooks/use-register-push-token.ts`
- `mobile/.maestro/signin.yaml`
- `mobile/.maestro/inbox-to-submit.yaml`
- `mobile/.maestro/dictation.yaml`
- `mobile/__tests__/` — unit + component tests (one per component/screen)

**Modified Convex modules**

- `convex/schema.ts` — add `expoPushTokens: v.optional(v.array(v.string()))` to `userProfiles`
- `convex/users.ts` — add `registerExpoToken`, `unregisterExpoToken`, `getById` for push targeting
- `convex/notifications.ts` — replace `sendPushNotification` stub with real Expo Push call; add `sendDemoEvent` dispatcher + `renderDemoEventPush` helper
- `convex/demoSessions.ts` — schedule `sendDemoEvent` on `create` (invite_created), `cancel` (demo_cancelled)
- `convex/evaluationInvites.ts` — schedule `sendDemoEvent` on `swap` (already does email; add push)
- `convex/crons.ts` — add a 5-minute cron to fire `form_opens` push when the window starts (covers `post` and `async` modes)

**New Convex tests**

- `tests/convex/users-push-tokens.test.ts`
- `tests/convex/notifications-push.test.ts`
- `tests/convex/notifications-demo-event.test.ts`

---

## Phase 1: Mobile scaffold + design tokens

### Task 1: Bootstrap the Expo workspace

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/app.json`
- Create: `mobile/babel.config.js`
- Create: `mobile/metro.config.js`
- Create: `mobile/tsconfig.json`
- Create: `mobile/App.tsx`
- Create: `mobile/assets/.gitkeep`
- Modify: root `.gitignore` (add `mobile/.expo/`, `mobile/node_modules/`, `mobile/ios/`, `mobile/android/`)

This task creates the Expo app skeleton. It does **not** install heavy native modules yet; those come in later tasks where they are first needed.

- [ ] **Step 1: Verify the working directory exists and is empty**

Run: `ls /Users/sumanthdaggubati/Dev/Rolerecruit/mobile 2>/dev/null; echo $?`
Expected: directory does not exist; exit code 2 from `ls`. If a `mobile/` directory already exists with content, stop and ask before overwriting.

- [ ] **Step 2: Create `mobile/package.json`**

```json
{
  "name": "rolerecruit-mobile",
  "version": "0.0.1",
  "private": true,
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "ios": "expo run:ios",
    "android": "expo run:android",
    "test": "jest",
    "test:watch": "jest --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "expo": "~51.0.0",
    "expo-status-bar": "~1.12.1",
    "react": "18.2.0",
    "react-native": "0.74.5",
    "convex": "^1.17.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.2.79",
    "typescript": "~5.3.3",
    "jest": "^29.7.0",
    "jest-expo": "~51.0.0",
    "@testing-library/react-native": "^12.4.5",
    "@types/jest": "^29.5.12",
    "react-test-renderer": "18.2.0"
  }
}
```

- [ ] **Step 3: Create `mobile/app.json`**

```json
{
  "expo": {
    "name": "Rolerecruit",
    "slug": "rolerecruit",
    "scheme": "rolerecruit",
    "version": "0.0.1",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "app.rolerecruit.mobile",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "Rolerecruit uses the microphone for on-device dictation of evaluation feedback. Audio is not recorded or uploaded.",
        "NSSpeechRecognitionUsageDescription": "Rolerecruit transcribes spoken feedback on-device. Only the transcript text leaves your phone, never the audio."
      }
    },
    "android": {
      "package": "app.rolerecruit.mobile",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "permissions": ["RECORD_AUDIO"]
    },
    "plugins": [
      "expo-secure-store",
      "expo-notifications"
    ],
    "extra": {
      "convexUrl": "https://merry-ladybug-673.convex.cloud",
      "betterAuthBaseUrl": "https://merry-ladybug-673.convex.site"
    }
  }
}
```

- [ ] **Step 4: Create `mobile/babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
```

- [ ] **Step 5: Create `mobile/metro.config.js`**

```js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

- [ ] **Step 6: Create `mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@convex/*": ["../convex/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "App.tsx", "__tests__/**/*.ts", "__tests__/**/*.tsx"]
}
```

- [ ] **Step 7: Create the placeholder asset directory**

Run: `mkdir -p /Users/sumanthdaggubati/Dev/Rolerecruit/mobile/assets && touch /Users/sumanthdaggubati/Dev/Rolerecruit/mobile/assets/.gitkeep`
Expected: directory created.

Asset PNGs (`icon.png`, `splash.png`, `adaptive-icon.png`) are placeholders for now. A subsequent design task can replace them with real artwork; for the build to succeed Expo only needs the files to exist. Generate placeholders:

Run: `printf '\x89PNG\r\n\x1a\n' > /Users/sumanthdaggubati/Dev/Rolerecruit/mobile/assets/icon.png && cp /Users/sumanthdaggubati/Dev/Rolerecruit/mobile/assets/icon.png /Users/sumanthdaggubati/Dev/Rolerecruit/mobile/assets/splash.png && cp /Users/sumanthdaggubati/Dev/Rolerecruit/mobile/assets/icon.png /Users/sumanthdaggubati/Dev/Rolerecruit/mobile/assets/adaptive-icon.png`

(These will need to be replaced before EAS submit; track via a follow-up.)

- [ ] **Step 8: Create `mobile/App.tsx`**

```tsx
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";

export default function App() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" }}>
      <Text accessibilityLabel="smoke">Rolerecruit mobile boots.</Text>
      <StatusBar style="auto" />
    </View>
  );
}
```

- [ ] **Step 9: Update root `.gitignore`**

Read the existing `.gitignore`, then append:

```
# mobile (Expo)
mobile/node_modules/
mobile/.expo/
mobile/dist/
mobile/web-build/
mobile/ios/
mobile/android/
mobile/*.log
mobile/.maestro/.history/
```

- [ ] **Step 10: Install dependencies**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun install`
Expected: `node_modules/` populated; no errors.

- [ ] **Step 11: Commit**

```bash
git add mobile/package.json mobile/app.json mobile/babel.config.js mobile/metro.config.js mobile/tsconfig.json mobile/App.tsx mobile/assets/ .gitignore mobile/bun.lock
git commit -m "feat(mobile): bootstrap Expo workspace"
```

---

### Task 2: Add Jest + RNTL + first smoke test

**Files:**
- Create: `mobile/jest.config.js`
- Create: `mobile/jest.setup.ts`
- Create: `mobile/__tests__/app-smoke.test.tsx`

- [ ] **Step 1: Create `mobile/jest.config.js`**

```js
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEach: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?@?react-native|@react-native-community|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@convex/(.*)$": "<rootDir>/../convex/$1",
  },
};
```

(Note: `setupFilesAfterEach` is the correct key for jest-expo per its README. If `jest-expo` rejects it, use `setupFiles` instead.)

- [ ] **Step 2: Create `mobile/jest.setup.ts`**

```ts
// Silence noisy native module warnings during component tests.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: "ExpoTestToken[xxx]" }),
  setNotificationHandler: jest.fn(),
}));
```

- [ ] **Step 3: Write the failing smoke test**

Create `mobile/__tests__/app-smoke.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import App from "../App";

describe("App boots", () => {
  it("renders a smoke label", () => {
    render(<App />);
    expect(screen.getByLabelText("smoke")).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test`
Expected: PASS — 1 test, 1 assertion.

(If jest-expo flags the `expo-status-bar` import, add it to the auto-mocks in `jest.setup.ts`.)

- [ ] **Step 5: Commit**

```bash
git add mobile/jest.config.js mobile/jest.setup.ts mobile/__tests__/app-smoke.test.tsx
git commit -m "test(mobile): jest + RNTL setup + app smoke test"
```

---

### Task 3: Theme tokens + UI primitives + tests

**Files:**
- Create: `mobile/src/theme.ts`
- Create: `mobile/src/components/ui/pressable-button.tsx`
- Create: `mobile/src/components/ui/card.tsx`
- Create: `mobile/src/components/ui/badge.tsx`
- Create: `mobile/src/components/ui/empty-state.tsx`
- Create: `mobile/__tests__/components/pressable-button.test.tsx`
- Create: `mobile/__tests__/components/badge.test.tsx`

- [ ] **Step 1: Write the failing PressableButton test**

Create `mobile/__tests__/components/pressable-button.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { PressableButton } from "@/components/ui/pressable-button";

describe("PressableButton", () => {
  it("renders the label", () => {
    render(<PressableButton onPress={() => {}}>Submit</PressableButton>);
    expect(screen.getByText("Submit")).toBeTruthy();
  });
  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    render(<PressableButton onPress={onPress}>Tap</PressableButton>);
    fireEvent.press(screen.getByText("Tap"));
    expect(onPress).toHaveBeenCalled();
  });
  it("does not call onPress when disabled", () => {
    const onPress = jest.fn();
    render(<PressableButton onPress={onPress} disabled>Tap</PressableButton>);
    fireEvent.press(screen.getByText("Tap"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Write the failing Badge test**

Create `mobile/__tests__/components/badge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders the children", () => {
    render(<Badge tone="success">Submitted</Badge>);
    expect(screen.getByText("Submitted")).toBeTruthy();
  });
  it("accepts every tone without crashing", () => {
    const tones = ["info", "success", "warning", "danger", "neutral"] as const;
    for (const tone of tones) {
      render(<Badge tone={tone}>x</Badge>);
    }
  });
});
```

- [ ] **Step 3: Run both tests, verify they fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test components/`
Expected: FAIL — `pressable-button` and `badge` modules not found.

- [ ] **Step 4: Create the theme**

Create `mobile/src/theme.ts`:

```ts
export const colors = {
  ink: "#0a0a0a",
  inkSecondary: "#3f3f46",
  inkTertiary: "#71717a",
  accent: "#0066ff",
  accentSoft: "#e6efff",
  success: "#16a34a",
  successSoft: "#dcfce7",
  warning: "#d97706",
  warningSoft: "#fef3c7",
  danger: "#dc2626",
  dangerSoft: "#fee2e2",
  surface: "#ffffff",
  surfaceCanvas: "#fafafa",
  surfaceFloating: "rgba(255,255,255,0.94)",
  hairline: "#e4e4e7",
  hairlineStrong: "#d4d4d8",
  inverse: "#ffffff",
} as const;

export const radii = {
  apple: 10,
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const fonts = {
  size: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 },
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
};

export const motion = {
  fast: 150,
  base: 200,
} as const;
```

- [ ] **Step 5: Implement PressableButton**

Create `mobile/src/components/ui/pressable-button.tsx`:

```tsx
import { Pressable, Text, StyleSheet, type PressableProps } from "react-native";
import { colors, radii, space, fonts } from "@/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface PressableButtonProps extends Omit<PressableProps, "children" | "style"> {
  children: string;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
}

export function PressableButton({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  onPress,
  ...rest
}: PressableButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border },
        { paddingHorizontal: s.padH, paddingVertical: s.padV },
        pressed && !disabled && { opacity: 0.85 },
        disabled && { opacity: 0.5 },
      ]}
      {...rest}
    >
      <Text style={[styles.label, { color: v.text, fontSize: s.font }]}>{children}</Text>
    </Pressable>
  );
}

const variantStyles: Record<Variant, { bg: string; text: string; border: string }> = {
  primary: { bg: colors.accent, text: colors.inverse, border: colors.accent },
  secondary: { bg: colors.surface, text: colors.ink, border: colors.hairline },
  ghost: { bg: "transparent", text: colors.accent, border: "transparent" },
  danger: { bg: colors.danger, text: colors.inverse, border: colors.danger },
};

const sizeStyles: Record<Size, { padH: number; padV: number; font: number }> = {
  sm: { padH: space[3], padV: space[1] + 2, font: fonts.size.sm },
  md: { padH: space[4], padV: space[2] + 2, font: fonts.size.md },
  lg: { padH: space[5], padV: space[3], font: fonts.size.lg },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontWeight: fonts.weight.semibold,
    textAlign: "center",
  },
});
```

- [ ] **Step 6: Implement Card**

Create `mobile/src/components/ui/card.tsx`:

```tsx
import { View, type ViewProps } from "react-native";
import { colors, radii, space } from "@/theme";

type Padding = "none" | "sm" | "md" | "lg";

export function Card({
  padding = "md",
  style,
  children,
  ...rest
}: ViewProps & { padding?: Padding }) {
  const padMap: Record<Padding, number> = {
    none: 0,
    sm: space[3],
    md: space[4],
    lg: space[6],
  };
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.apple,
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: padMap[padding],
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
```

- [ ] **Step 7: Implement Badge**

Create `mobile/src/components/ui/badge.tsx`:

```tsx
import { Text, View } from "react-native";
import { colors, radii, space, fonts } from "@/theme";

type Tone = "info" | "success" | "warning" | "danger" | "neutral";

const TONE: Record<Tone, { bg: string; fg: string }> = {
  info: { bg: colors.accentSoft, fg: colors.accent },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  neutral: { bg: colors.hairline, fg: colors.inkSecondary },
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: string }) {
  const t = TONE[tone];
  return (
    <View
      style={{
        backgroundColor: t.bg,
        paddingHorizontal: space[2],
        paddingVertical: 2,
        borderRadius: radii.pill,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: t.fg, fontSize: fonts.size.xs, fontWeight: fonts.weight.semibold }}>
        {children}
      </Text>
    </View>
  );
}
```

- [ ] **Step 8: Implement EmptyState**

Create `mobile/src/components/ui/empty-state.tsx`:

```tsx
import { Text, View } from "react-native";
import { colors, space, fonts } from "@/theme";

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ padding: space[6], alignItems: "center" }}>
      <Text style={{ color: colors.ink, fontSize: fonts.size.lg, fontWeight: fonts.weight.semibold, marginBottom: space[2] }}>
        {title}
      </Text>
      {body && (
        <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.sm, textAlign: "center" }}>
          {body}
        </Text>
      )}
    </View>
  );
}
```

- [ ] **Step 9: Run tests, verify they pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test components/`
Expected: PASS — 3 button tests + 2 badge tests.

- [ ] **Step 10: Commit**

```bash
git add mobile/src/theme.ts mobile/src/components/ui/ mobile/__tests__/components/
git commit -m "feat(mobile): theme tokens + Card/Button/Badge/EmptyState primitives"
```

---

## Phase 2: Convex + Better Auth on Expo

### Task 4: Add Better Auth Expo client

**Files:**
- Modify: `mobile/package.json` — add `better-auth`, `@better-auth/expo`, `@convex-dev/better-auth`, `expo-secure-store`
- Create: `mobile/src/lib/auth-client.ts`
- Create: `mobile/__tests__/lib/auth-client.test.ts`

- [ ] **Step 1: Install dependencies**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun add better-auth @better-auth/expo @convex-dev/better-auth expo-secure-store`
Expected: packages installed.

- [ ] **Step 2: Write the failing test**

Create `mobile/__tests__/lib/auth-client.test.ts`:

```ts
import { authClient } from "@/lib/auth-client";

describe("authClient", () => {
  it("exposes signIn and signOut entry points", () => {
    expect(typeof authClient.signIn).toBe("object");
    expect(typeof authClient.signOut).toBe("function");
  });
});
```

- [ ] **Step 3: Verify it fails**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test lib/`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the client**

Create `mobile/src/lib/auth-client.ts`:

```ts
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const baseURL =
  (Constants.expoConfig?.extra?.betterAuthBaseUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_BETTER_AUTH_URL;

if (!baseURL) {
  throw new Error(
    "Better Auth base URL is not configured. Set extra.betterAuthBaseUrl in app.json or EXPO_PUBLIC_BETTER_AUTH_URL.",
  );
}

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    convexClient(),
    expoClient({
      scheme: "rolerecruit",
      storagePrefix: "rolerecruit",
      storage: SecureStore,
    }),
  ],
});
```

- [ ] **Step 5: Install expo-constants**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun add expo-constants`
Expected: installed.

- [ ] **Step 6: Run test, verify it passes**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test lib/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/package.json mobile/bun.lock mobile/src/lib/auth-client.ts mobile/__tests__/lib/auth-client.test.ts
git commit -m "feat(mobile): Better Auth Expo client with SecureStore session"
```

---

### Task 5: Convex client + ConvexBetterAuthProvider

**Files:**
- Create: `mobile/src/lib/convex.ts`
- Create: `mobile/src/providers/app-providers.tsx`
- Modify: `mobile/App.tsx` — wrap in providers
- Create: `mobile/__tests__/providers/app-providers.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `mobile/__tests__/providers/app-providers.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { AppProviders } from "@/providers/app-providers";

describe("AppProviders", () => {
  it("renders children", () => {
    render(
      <AppProviders>
        <Text accessibilityLabel="inner">hello</Text>
      </AppProviders>,
    );
    expect(screen.getByLabelText("inner")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verify it fails**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test providers/`
Expected: FAIL.

- [ ] **Step 3: Implement the Convex client**

Create `mobile/src/lib/convex.ts`:

```ts
import { ConvexReactClient } from "convex/react";
import Constants from "expo-constants";

const convexUrl =
  (Constants.expoConfig?.extra?.convexUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "Convex URL is not configured. Set extra.convexUrl in app.json or EXPO_PUBLIC_CONVEX_URL.",
  );
}

export const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});
```

- [ ] **Step 4: Implement AppProviders**

Create `mobile/src/providers/app-providers.tsx`:

```tsx
import type { ReactNode } from "react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { convex } from "@/lib/convex";
import { authClient } from "@/lib/auth-client";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      {children}
    </ConvexBetterAuthProvider>
  );
}
```

- [ ] **Step 5: Update App.tsx**

Replace `mobile/App.tsx` with:

```tsx
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { AppProviders } from "@/providers/app-providers";
import { colors } from "@/theme";

export default function App() {
  return (
    <AppProviders>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <Text accessibilityLabel="smoke">Rolerecruit mobile boots.</Text>
        <StatusBar style="auto" />
      </View>
    </AppProviders>
  );
}
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test`
Expected: PASS — smoke test + provider test + button/badge tests.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/lib/convex.ts mobile/src/providers/ mobile/App.tsx mobile/__tests__/providers/
git commit -m "feat(mobile): Convex client + ConvexBetterAuthProvider wiring"
```

---

### Task 6: useSession hook + sign-in screen

**Files:**
- Create: `mobile/src/hooks/use-session.ts`
- Create: `mobile/src/screens/sign-in.tsx`
- Create: `mobile/__tests__/hooks/use-session.test.tsx`
- Create: `mobile/__tests__/screens/sign-in.test.tsx`

- [ ] **Step 1: Write failing useSession test**

Create `mobile/__tests__/hooks/use-session.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react-native";
import { useSession } from "@/hooks/use-session";

jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false, error: null }),
    signOut: jest.fn(),
  },
}));

describe("useSession", () => {
  it("returns signed-out state when there is no session", () => {
    const { result } = renderHook(() => useSession());
    expect(result.current.signedIn).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
```

- [ ] **Step 2: Write failing sign-in test**

Create `mobile/__tests__/screens/sign-in.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SignInScreen } from "@/screens/sign-in";

const signIn = { email: jest.fn().mockResolvedValue({ data: { sent: true } }) };
jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false, error: null }),
    signIn: { magicLink: (...args: any[]) => signIn.email(...args) },
  },
}));

describe("SignInScreen", () => {
  it("calls signIn.magicLink with the entered email", async () => {
    render(<SignInScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "evaluator@school.com");
    fireEvent.press(screen.getByText("Send sign-in link"));
    expect(signIn.email).toHaveBeenCalledWith({ email: "evaluator@school.com", callbackURL: "rolerecruit://" });
  });
});
```

- [ ] **Step 3: Verify both fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test hooks/ screens/`
Expected: FAIL.

- [ ] **Step 4: Implement useSession**

Create `mobile/src/hooks/use-session.ts`:

```ts
import { useMemo } from "react";
import { authClient } from "@/lib/auth-client";

export function useSession() {
  const { data, isPending, error } = authClient.useSession();
  return useMemo(
    () => ({
      signedIn: !!data?.session,
      user: data?.user ?? null,
      session: data?.session ?? null,
      loading: isPending,
      error,
      signOut: () => authClient.signOut(),
    }),
    [data, isPending, error],
  );
}
```

- [ ] **Step 5: Implement SignInScreen**

Create `mobile/src/screens/sign-in.tsx`:

```tsx
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";
import { PressableButton } from "@/components/ui/pressable-button";
import { authClient } from "@/lib/auth-client";
import { colors, fonts, radii, space } from "@/theme";

export function SignInScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!email.trim()) {
      Alert.alert("Email required", "Enter the email address tied to your school account.");
      return;
    }
    setBusy(true);
    try {
      await authClient.signIn.magicLink({
        email: email.trim().toLowerCase(),
        callbackURL: "rolerecruit://",
      });
      setSent(true);
    } catch (err) {
      Alert.alert("Could not send link", err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
    >
      <View style={{ flex: 1, padding: space[6], justifyContent: "center" }}>
        <Text style={{ fontSize: fonts.size.xxl, fontWeight: fonts.weight.bold, color: colors.ink, marginBottom: space[2] }}>
          Rolerecruit
        </Text>
        <Text style={{ fontSize: fonts.size.md, color: colors.inkSecondary, marginBottom: space[6] }}>
          Sign in with a magic link.
        </Text>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.inkTertiary}
          value={email}
          onChangeText={setEmail}
          style={{
            borderWidth: 1,
            borderColor: colors.hairline,
            backgroundColor: colors.surface,
            borderRadius: radii.apple,
            paddingHorizontal: space[4],
            paddingVertical: space[3],
            fontSize: fonts.size.md,
            color: colors.ink,
            marginBottom: space[4],
          }}
        />

        <PressableButton onPress={send} disabled={busy}>
          {busy ? "Sending..." : "Send sign-in link"}
        </PressableButton>

        {sent && (
          <Text style={{ marginTop: space[4], color: colors.success, fontSize: fonts.size.sm }}>
            Check your inbox. The link opens Rolerecruit.
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/hooks/use-session.ts mobile/src/screens/sign-in.tsx mobile/__tests__/hooks/ mobile/__tests__/screens/
git commit -m "feat(mobile): useSession hook + magic-link sign-in screen"
```

---

### Task 7: Sign-out flow on Profile placeholder

**Files:**
- Create: `mobile/src/screens/profile.tsx` (minimal — expanded in T29)
- Create: `mobile/__tests__/screens/profile-signout.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `mobile/__tests__/screens/profile-signout.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProfileScreen } from "@/screens/profile";

const signOut = jest.fn();
jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { name: "Mrs Iyer", email: "p@s.com" }, session: { id: "s" } },
      isPending: false,
      error: null,
    }),
    signOut: () => signOut(),
  },
}));

describe("ProfileScreen sign-out", () => {
  it("shows the user's name and signs out when tapped", () => {
    render(<ProfileScreen />);
    expect(screen.getByText("Mrs Iyer")).toBeTruthy();
    expect(screen.getByText("p@s.com")).toBeTruthy();
    fireEvent.press(screen.getByText("Sign out"));
    expect(signOut).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify it fails**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test profile-signout`
Expected: FAIL.

- [ ] **Step 3: Implement minimal ProfileScreen**

Create `mobile/src/screens/profile.tsx`:

```tsx
import { Text, View } from "react-native";
import { PressableButton } from "@/components/ui/pressable-button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";
import { colors, fonts, space } from "@/theme";

export function ProfileScreen() {
  const { user, signOut } = useSession();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas, padding: space[4] }}>
      <Card padding="lg">
        <Text style={{ fontSize: fonts.size.lg, fontWeight: fonts.weight.semibold, color: colors.ink }}>
          {user?.name ?? "Account"}
        </Text>
        <Text style={{ fontSize: fonts.size.sm, color: colors.inkSecondary, marginTop: space[1] }}>
          {user?.email ?? ""}
        </Text>
      </Card>
      <View style={{ marginTop: space[6] }}>
        <PressableButton variant="secondary" onPress={signOut}>
          Sign out
        </PressableButton>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test profile-signout`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/profile.tsx mobile/__tests__/screens/profile-signout.test.tsx
git commit -m "feat(mobile): Profile screen with sign-out"
```

---

## Phase 3: Push token schema + registration API

### Task 8: Add `expoPushTokens` to userProfiles + schema test

**Files:**
- Modify: `convex/schema.ts:85` — add optional field on `userProfiles`
- Create: `tests/convex/users-push-tokens-schema.test.ts`

The taste rule for adding fields to existing tables is `v.optional()` to avoid breaking existing rows. Apply it.

- [ ] **Step 1: Write the failing schema-shape test**

Create `tests/convex/users-push-tokens-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import schema from "../../convex/schema";

describe("userProfiles schema", () => {
  it("declares an optional expoPushTokens field", () => {
    const validator = (schema.tables.userProfiles as any).validator;
    expect(validator.fields.expoPushTokens).toBeDefined();
    // Optional fields wrap their inner validator in a v.optional() shape.
    const inner = validator.fields.expoPushTokens;
    expect(inner.isOptional).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test tests/convex/users-push-tokens-schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the field**

Edit `convex/schema.ts`. Inside `userProfiles: defineTable({ ... })`, after the `role: v.string()` line, add:

```ts
expoPushTokens: v.optional(v.array(v.string())),
```

- [ ] **Step 4: Run codegen**

Run: `bunx convex codegen`
Expected: types regenerate; no errors.

- [ ] **Step 5: Run, verify pass**

Run: `bun run test tests/convex/users-push-tokens-schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts convex/_generated/ tests/convex/users-push-tokens-schema.test.ts
git commit -m "feat(convex): add optional expoPushTokens to userProfiles"
```

---

### Task 9: `registerExpoToken`, `unregisterExpoToken`, `getById` mutations

**Files:**
- Modify: `convex/users.ts` — append three exports
- Create: `tests/convex/users-push-tokens.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/convex/users-push-tokens.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as schools from "../../convex/schools";
import * as users from "../../convex/users";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "schools.ts": async () => schools,
  "users.ts": async () => users,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

async function setup(t: ReturnType<typeof convexTest>) {
  const schoolId = await t.mutation("schools:create" as any, {
    name: "S", board: "CBSE", city: "X", state: "Y",
  } as any);
  const userId = await t.mutation("users:createProfile" as any, {
    userId: "u1", name: "Mrs Iyer", email: "p@s.com", schoolId, role: "principal",
  } as any);
  return { schoolId, userId };
}

describe("registerExpoToken", () => {
  it("adds a token to a profile with no existing tokens", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setup(t);
    await t.mutation("users:registerExpoToken" as any, {
      userId, token: "ExpoToken[a]",
    } as any);
    const got = await t.query("users:getById" as any, { userId } as any);
    expect(got.expoPushTokens).toEqual(["ExpoToken[a]"]);
  });

  it("is idempotent — registering the same token twice keeps one copy", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setup(t);
    await t.mutation("users:registerExpoToken" as any, { userId, token: "ExpoToken[a]" } as any);
    await t.mutation("users:registerExpoToken" as any, { userId, token: "ExpoToken[a]" } as any);
    const got = await t.query("users:getById" as any, { userId } as any);
    expect(got.expoPushTokens).toEqual(["ExpoToken[a]"]);
  });

  it("appends a second distinct token alongside the first", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setup(t);
    await t.mutation("users:registerExpoToken" as any, { userId, token: "ExpoToken[a]" } as any);
    await t.mutation("users:registerExpoToken" as any, { userId, token: "ExpoToken[b]" } as any);
    const got = await t.query("users:getById" as any, { userId } as any);
    expect(got.expoPushTokens?.sort()).toEqual(["ExpoToken[a]", "ExpoToken[b]"]);
  });

  it("unregisterExpoToken removes the matching token only", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setup(t);
    await t.mutation("users:registerExpoToken" as any, { userId, token: "ExpoToken[a]" } as any);
    await t.mutation("users:registerExpoToken" as any, { userId, token: "ExpoToken[b]" } as any);
    await t.mutation("users:unregisterExpoToken" as any, { userId, token: "ExpoToken[a]" } as any);
    const got = await t.query("users:getById" as any, { userId } as any);
    expect(got.expoPushTokens).toEqual(["ExpoToken[b]"]);
  });

  it("unregisterExpoToken is a no-op for an unknown token", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await setup(t);
    await t.mutation("users:registerExpoToken" as any, { userId, token: "ExpoToken[a]" } as any);
    await t.mutation("users:unregisterExpoToken" as any, { userId, token: "ExpoToken[ghost]" } as any);
    const got = await t.query("users:getById" as any, { userId } as any);
    expect(got.expoPushTokens).toEqual(["ExpoToken[a]"]);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `bun run test tests/convex/users-push-tokens.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the mutations and query**

Append to `convex/users.ts`:

```ts
export const getById = query({
  args: { userId: v.id("userProfiles") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    if (!u) throw new Error("User profile not found");
    return u;
  },
});

export const registerExpoToken = mutation({
  args: { userId: v.id("userProfiles"), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    if (!token.trim()) throw new Error("Token cannot be empty");
    const u = await ctx.db.get(userId);
    if (!u) throw new Error("User profile not found");
    const existing = u.expoPushTokens ?? [];
    if (existing.includes(token)) return;
    await ctx.db.patch(userId, { expoPushTokens: [...existing, token] });
  },
});

export const unregisterExpoToken = mutation({
  args: { userId: v.id("userProfiles"), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    const u = await ctx.db.get(userId);
    if (!u) throw new Error("User profile not found");
    const existing = u.expoPushTokens ?? [];
    const next = existing.filter((t) => t !== token);
    if (next.length === existing.length) return;
    await ctx.db.patch(userId, { expoPushTokens: next });
  },
});
```

- [ ] **Step 4: Run tests, verify pass**

Run: `bun run test tests/convex/users-push-tokens.test.ts`
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/users.ts tests/convex/users-push-tokens.test.ts
git commit -m "feat(convex): register/unregister expo push tokens on userProfiles"
```

---

### Task 10: `useRegisterPushToken` hook in mobile

**Files:**
- Create: `mobile/src/lib/push.ts`
- Create: `mobile/src/hooks/use-register-push-token.ts`
- Create: `mobile/__tests__/hooks/use-register-push-token.test.tsx`

- [ ] **Step 1: Install Expo notifications**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun add expo-notifications expo-device`
Expected: installed.

- [ ] **Step 2: Write the failing test**

Create `mobile/__tests__/hooks/use-register-push-token.test.tsx`:

```tsx
import { renderHook, waitFor } from "@testing-library/react-native";
import { useRegisterPushToken } from "@/hooks/use-register-push-token";

const registerMutation = jest.fn().mockResolvedValue(undefined);
jest.mock("convex/react", () => ({
  useMutation: () => registerMutation,
  useQuery: jest.fn(),
}));

jest.mock("@/hooks/use-session", () => ({
  useSession: () => ({
    signedIn: true,
    user: { id: "user_better_auth_id" },
    session: { id: "s" },
  }),
}));

jest.mock("@convex/_generated/api", () => ({
  api: { users: { registerExpoToken: "users:registerExpoToken", getProfile: "users:getProfile" } },
}));

const profileQueryReturn = { _id: "profile_id_1" };
jest.doMock("convex/react", () => ({
  useMutation: () => registerMutation,
  useQuery: () => profileQueryReturn,
}));

describe("useRegisterPushToken", () => {
  beforeEach(() => registerMutation.mockClear());

  it("requests a push token and calls registerExpoToken on mount when signed in", async () => {
    renderHook(() => useRegisterPushToken());
    await waitFor(() =>
      expect(registerMutation).toHaveBeenCalledWith({
        userId: "profile_id_1",
        token: "ExpoTestToken[xxx]",
      }),
    );
  });
});
```

- [ ] **Step 3: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test use-register-push-token`
Expected: FAIL.

- [ ] **Step 4: Implement the push helper**

Create `mobile/src/lib/push.ts`:

```ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestAndGetExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    // Simulators cannot receive remote pushes.
    return null;
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return null;
  const tokenResult = await Notifications.getExpoPushTokenAsync();
  return tokenResult.data;
}
```

- [ ] **Step 5: Implement the hook**

Create `mobile/src/hooks/use-register-push-token.ts`:

```ts
import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useSession } from "@/hooks/use-session";
import { requestAndGetExpoPushToken } from "@/lib/push";

export function useRegisterPushToken() {
  const { signedIn, user } = useSession();
  const profile = useQuery(
    api.users.getProfile,
    signedIn && user?.id ? { userId: user.id } : "skip",
  );
  const register = useMutation(api.users.registerExpoToken);
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!signedIn || !profile?._id) return;
    let cancelled = false;
    (async () => {
      const token = await requestAndGetExpoPushToken();
      if (!token || cancelled) return;
      if (registeredRef.current === token) return;
      await register({ userId: profile._id, token });
      registeredRef.current = token;
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, profile?._id, register]);
}
```

- [ ] **Step 6: Run test, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test use-register-push-token`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/package.json mobile/bun.lock mobile/src/lib/push.ts mobile/src/hooks/use-register-push-token.ts mobile/__tests__/hooks/use-register-push-token.test.tsx
git commit -m "feat(mobile): request + register expo push token on sign-in"
```

---

## Phase 4: Real Expo Push delivery + dispatcher

### Task 11: Replace `sendPushNotification` stub with real Expo Push API call

**Files:**
- Modify: `convex/notifications.ts:144-156` — replace stub
- Create: `tests/convex/notifications-push.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/convex/notifications-push.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as notifications from "../../convex/notifications";
import * as server from "../../convex/_generated/server";
import * as api from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "notifications.ts": async () => notifications,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => api,
};

describe("sendPushNotification (real Expo API)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts a payload to https://exp.host/--/api/v2/push/send with the tokens, title, body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "{}" });
    vi.stubGlobal("fetch", fetchMock);

    const t = convexTest(schema, modules);
    await t.action("notifications:sendPushNotification" as any, {
      expoPushTokens: ["ExpoPushToken[A]", "ExpoPushToken[B]"],
      title: "Form is now open",
      body: "Priya's demo",
      data: { demoId: "demo_x" },
    } as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].to).toBe("ExpoPushToken[A]");
    expect(body[0].title).toBe("Form is now open");
    expect(body[0].body).toBe("Priya's demo");
    expect(body[0].data).toEqual({ demoId: "demo_x" });
  });

  it("returns early when no tokens supplied (no fetch)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest(schema, modules);
    await t.action("notifications:sendPushNotification" as any, {
      expoPushTokens: [], title: "x", body: "x",
    } as any);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `bun run test tests/convex/notifications-push.test.ts`
Expected: FAIL (current implementation is a console.log stub).

- [ ] **Step 3: Replace the implementation**

Edit `convex/notifications.ts`. Replace the existing `sendPushNotification` block (line ~144 to end) with:

```ts
export const sendPushNotification = internalAction({
  args: {
    expoPushTokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (_ctx, args) => {
    if (args.expoPushTokens.length === 0) return;
    const messages = args.expoPushTokens.map((token) => ({
      to: token,
      sound: "default",
      title: args.title,
      body: args.body,
      data: args.data,
    }));
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Expo push send failed", res.status, text);
    }
  },
});
```

- [ ] **Step 4: Run tests, verify pass**

Run: `bun run test tests/convex/notifications-push.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/notifications.ts tests/convex/notifications-push.test.ts
git commit -m "feat(convex): wire real Expo Push API for sendPushNotification"
```

---

### Task 12: `sendDemoEvent` dispatcher + `renderDemoEventPush`

**Files:**
- Modify: `convex/notifications.ts` — append `renderDemoEventPush` + `sendDemoEvent`
- Create: `tests/convex/notifications-demo-event.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/convex/notifications-demo-event.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderDemoEventPush } from "../../convex/notifications";

describe("renderDemoEventPush", () => {
  it("invite_created — names the candidate", () => {
    const out = renderDemoEventPush("invite_created", { candidateName: "Priya", subject: "Maths" });
    expect(out.title).toMatch(/invited/i);
    expect(out.body).toContain("Priya");
    expect(out.body).toContain("Maths");
  });

  it("form_opens — uses urgent copy", () => {
    const out = renderDemoEventPush("form_opens", { candidateName: "Priya" });
    expect(out.title).toMatch(/form|now open/i);
    expect(out.body).toContain("Priya");
  });

  it("demo_cancelled — apologetic copy", () => {
    const out = renderDemoEventPush("demo_cancelled", { candidateName: "Priya" });
    expect(out.title).toMatch(/cancel/i);
    expect(out.body).toContain("Priya");
  });

  it("evaluator_swap_in — welcomes the new evaluator", () => {
    const out = renderDemoEventPush("evaluator_swap_in", { candidateName: "Priya" });
    expect(out.body).toContain("Priya");
    expect(out.title).toMatch(/added|evaluator/i);
  });

  it("evaluator_swap_out — informs the removed evaluator", () => {
    const out = renderDemoEventPush("evaluator_swap_out", { candidateName: "Priya" });
    expect(out.title).toMatch(/swapped|removed/i);
    expect(out.body).toContain("Priya");
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `bun run test tests/convex/notifications-demo-event.test.ts`
Expected: FAIL — `renderDemoEventPush` not exported.

- [ ] **Step 3: Implement the renderer + dispatcher**

Append to `convex/notifications.ts`:

```ts
import { internal } from "./_generated/api";

export type DemoEvent =
  | "invite_created"
  | "form_opens"
  | "demo_completed"
  | "demo_cancelled"
  | "evaluator_swap_in"
  | "evaluator_swap_out";

export function renderDemoEventPush(
  event: DemoEvent,
  extra: { candidateName?: string; subject?: string } = {},
): { title: string; body: string } {
  const candidate = extra.candidateName ?? "a candidate";
  const subject = extra.subject ? ` for ${extra.subject}` : "";
  switch (event) {
    case "invite_created":
      return {
        title: "You've been invited to evaluate",
        body: `${candidate}${subject} - tap to view`,
      };
    case "form_opens":
      return {
        title: "Form is now open",
        body: `Submit your feedback for ${candidate}`,
      };
    case "demo_completed":
      return {
        title: "Demo completed",
        body: `All evaluations are in for ${candidate}`,
      };
    case "demo_cancelled":
      return {
        title: "Demo cancelled",
        body: `${candidate}'s demo was cancelled. No action needed.`,
      };
    case "evaluator_swap_in":
      return {
        title: "You've been added as an evaluator",
        body: `You're now evaluating ${candidate}`,
      };
    case "evaluator_swap_out":
      return {
        title: "You were swapped out",
        body: `You no longer need to evaluate ${candidate}`,
      };
  }
}

export const sendDemoEvent = internalAction({
  args: {
    event: v.union(
      v.literal("invite_created"),
      v.literal("form_opens"),
      v.literal("demo_completed"),
      v.literal("demo_cancelled"),
      v.literal("evaluator_swap_in"),
      v.literal("evaluator_swap_out"),
    ),
    demoId: v.id("demoSessions"),
    targetUserIds: v.array(v.id("userProfiles")),
    extra: v.optional(v.object({
      candidateName: v.optional(v.string()),
      subject: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const tokens: string[] = [];
    for (const uid of args.targetUserIds) {
      const u = await ctx.runQuery(internal.users.getByIdInternal, { userId: uid });
      if (u?.expoPushTokens) tokens.push(...u.expoPushTokens);
    }
    if (tokens.length === 0) return;
    const { title, body } = renderDemoEventPush(args.event, args.extra ?? {});
    await ctx.runAction(internal.notifications.sendPushNotification, {
      expoPushTokens: tokens,
      title,
      body,
      data: { demoId: args.demoId, event: args.event },
    });
  },
});
```

The dispatcher calls `internal.users.getByIdInternal`, which does not exist yet. Add it.

- [ ] **Step 4: Add `getByIdInternal` to `convex/users.ts`**

Append:

```ts
import { internalQuery } from "./_generated/server";

export const getByIdInternal = internalQuery({
  args: { userId: v.id("userProfiles") },
  handler: async (ctx, { userId }) => await ctx.db.get(userId),
});
```

(If `internalQuery` is already imported at the top of `users.ts`, do not re-import.)

- [ ] **Step 5: Run codegen**

Run: `bunx convex codegen`
Expected: types regenerate.

- [ ] **Step 6: Run tests, verify pass**

Run: `bun run test tests/convex/notifications-demo-event.test.ts`
Expected: 5 PASS.

- [ ] **Step 7: Commit**

```bash
git add convex/notifications.ts convex/users.ts convex/_generated/ tests/convex/notifications-demo-event.test.ts
git commit -m "feat(convex): sendDemoEvent dispatcher + per-event push copy"
```

---

### Task 13: Wire `sendDemoEvent` into invite create + cancel + swap

**Files:**
- Modify: `convex/demoSessions.ts` — schedule `invite_created` on create, `demo_cancelled` on cancel
- Modify: `convex/evaluationInvites.ts` — schedule `evaluator_swap_in` + `evaluator_swap_out` on swap
- Modify: existing tests where applicable

Plan 2 already wired email for swap. This task adds the parallel push call.

- [ ] **Step 1: Edit `demoSessions.create`**

Open `convex/demoSessions.ts`. At the end of the `create` handler (after every invite is inserted, before `return demoId`), add:

```ts
const candidate = await ctx.db.get(args.applicationId);
const application = candidate ? await ctx.db.get(candidate.candidateId) : null;
const candidateName = application?.name;
const jobPosting = candidate?.jobPostingId ? await ctx.db.get(candidate.jobPostingId) : null;
const subject = jobPosting?.subject as string | undefined;

await ctx.scheduler.runAfter(0, internal.notifications.sendDemoEvent, {
  event: "invite_created",
  demoId,
  targetUserIds: args.evaluators.map((e) => e.userId),
  extra: { candidateName, subject },
});
```

Add `import { internal } from "./_generated/api";` at the top of the file if not present.

- [ ] **Step 2: Edit `demoSessions.cancel`**

In the same file, at the end of the `cancel` handler (after the patch loop, before any closing brace), add:

```ts
const invitesForCancel = await ctx.db
  .query("evaluationInvites")
  .withIndex("by_demoSessionId", (q) => q.eq("demoSessionId", demoId))
  .collect();
const targets = invitesForCancel.map((i) => i.evaluatorUserId);

await ctx.scheduler.runAfter(0, internal.notifications.sendDemoEvent, {
  event: "demo_cancelled",
  demoId,
  targetUserIds: targets,
});
```

- [ ] **Step 3: Edit `evaluationInvites.swap`**

Open `convex/evaluationInvites.ts`. After the existing swap logic that schedules `sendSwapEmail` and `sendSwapOutEmail`, append parallel push dispatches:

```ts
await ctx.scheduler.runAfter(0, internal.notifications.sendDemoEvent, {
  event: "evaluator_swap_in",
  demoId: old.demoSessionId,
  targetUserIds: [newEvaluatorUserId],
});
await ctx.scheduler.runAfter(0, internal.notifications.sendDemoEvent, {
  event: "evaluator_swap_out",
  demoId: old.demoSessionId,
  targetUserIds: [old.evaluatorUserId],
});
```

(`internal` should already be imported.)

- [ ] **Step 4: Run the existing demoSessions + invites tests**

Run: `bun run test tests/convex/demoSessions.test.ts tests/convex/evaluationInvites.test.ts`
Expected: PASS — wiring via the scheduler is a fire-and-forget; existing assertions still hold. The scheduler runs in convex-test as part of `t.finishAllScheduledFunctions()`, so the dispatcher only fires if a test explicitly drains the queue. Either way, no test should regress.

- [ ] **Step 5: Run the full backend suite**

Run: `bun run test`
Expected: full pass.

- [ ] **Step 6: Commit**

```bash
git add convex/demoSessions.ts convex/evaluationInvites.ts
git commit -m "feat(convex): dispatch sendDemoEvent on create/cancel/swap"
```

---

## Phase 5: Navigation + auth gate

### Task 14: Install react-navigation + minimal AppNav

**Files:**
- Modify: `mobile/package.json` — add navigation deps
- Create: `mobile/src/navigation/app-nav.tsx`
- Create: `mobile/src/navigation/evaluator-tabs.tsx`
- Create: `mobile/__tests__/navigation/app-nav.test.tsx`

The evaluator-only tab structure ships in this plan. HR tabs (Candidates / Pipeline) ship in Plan 4 by extending `evaluator-tabs.tsx` or adding `hr-tabs.tsx`.

- [ ] **Step 1: Install navigation packages**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun add @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack react-native-screens react-native-safe-area-context @expo/vector-icons`
Expected: installed.

- [ ] **Step 2: Write failing test**

Create `mobile/__tests__/navigation/app-nav.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { AppNav } from "@/navigation/app-nav";

jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false, error: null }),
    signIn: { magicLink: jest.fn() },
    signOut: jest.fn(),
  },
}));
jest.mock("@/hooks/use-register-push-token", () => ({
  useRegisterPushToken: () => undefined,
}));

describe("AppNav", () => {
  it("renders the sign-in screen when there is no session", () => {
    render(<AppNav />);
    expect(screen.getByText("Send sign-in link")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test navigation/`
Expected: FAIL.

- [ ] **Step 4: Implement EvaluatorTabs placeholder**

Create `mobile/src/navigation/evaluator-tabs.tsx`:

```tsx
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { InboxScreen } from "@/screens/inbox";
import { CalendarScreen } from "@/screens/calendar";
import { ProfileScreen } from "@/screens/profile";
import { colors } from "@/theme";

export type EvaluatorTabsParamList = {
  Inbox: undefined;
  Calendar: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<EvaluatorTabsParamList>();

export function EvaluatorTabs() {
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
            Profile: "person-outline",
          };
          return <Ionicons name={map[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Inbox" component={InboxScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
```

The inbox and calendar screens do not yet exist — create stubs (overwritten in T18 and T20):

Create `mobile/src/screens/inbox.tsx`:

```tsx
import { Text, View } from "react-native";
import { colors, space } from "@/theme";

export function InboxScreen() {
  return (
    <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}>
      <Text accessibilityLabel="inbox-stub">Inbox</Text>
    </View>
  );
}
```

Create `mobile/src/screens/calendar.tsx`:

```tsx
import { Text, View } from "react-native";
import { colors, space } from "@/theme";

export function CalendarScreen() {
  return (
    <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}>
      <Text accessibilityLabel="calendar-stub">Calendar</Text>
    </View>
  );
}
```

- [ ] **Step 5: Implement AppNav**

Create `mobile/src/navigation/app-nav.tsx`:

```tsx
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SignInScreen } from "@/screens/sign-in";
import { EvaluatorTabs } from "@/navigation/evaluator-tabs";
import { useSession } from "@/hooks/use-session";
import { useRegisterPushToken } from "@/hooks/use-register-push-token";

export type RootStackParamList = {
  SignIn: undefined;
  EvaluatorTabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNav() {
  const { signedIn, loading } = useSession();
  useRegisterPushToken();
  if (loading) return null;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {signedIn ? (
          <Stack.Screen name="EvaluatorTabs" component={EvaluatorTabs} />
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 6: Wire into App.tsx**

Replace `mobile/App.tsx` with:

```tsx
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders } from "@/providers/app-providers";
import { AppNav } from "@/navigation/app-nav";

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProviders>
        <AppNav />
        <StatusBar style="auto" />
      </AppProviders>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 7: Run test, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test`
Expected: PASS — auth gate renders SignIn when no session. Existing smoke test (looked for `smoke` label in App.tsx) now needs the navigation surface to render; update it:

Replace `mobile/__tests__/app-smoke.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import App from "../App";

jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false, error: null }),
    signIn: { magicLink: jest.fn() },
    signOut: jest.fn(),
  },
}));
jest.mock("@/hooks/use-register-push-token", () => ({
  useRegisterPushToken: () => undefined,
}));

describe("App boots", () => {
  it("renders the sign-in screen when signed out", () => {
    render(<App />);
    expect(screen.getByText("Send sign-in link")).toBeTruthy();
  });
});
```

Re-run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test`
Expected: full PASS.

- [ ] **Step 8: Commit**

```bash
git add mobile/package.json mobile/bun.lock mobile/src/navigation/ mobile/src/screens/inbox.tsx mobile/src/screens/calendar.tsx mobile/App.tsx mobile/__tests__/
git commit -m "feat(mobile): react-navigation app nav with auth gate"
```

---

## Phase 6: Inbox

### Task 15: `useInbox` hook — split open-now vs upcoming

**Files:**
- Create: `mobile/src/hooks/use-inbox.ts`
- Create: `mobile/__tests__/hooks/use-inbox.test.tsx`

The split logic is identical to what the web inbox does: an invite is **Open now** if the demo's form-open window has started and not yet closed; otherwise it is **Upcoming**.

Form-open windows by mode (mirrored from Plan 1 spec):
- `live`: `[scheduledAt, scheduledAt + durationMinutes * 60000]`
- `post`: `[scheduledAt + durationMinutes * 60000, that + formOpenWindowMinutes * 60000]`
- `async`: `[demo.createdAt, scheduledAt + formCloseDueDays * 86400000]`

- [ ] **Step 1: Write the failing test**

Create `mobile/__tests__/hooks/use-inbox.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react-native";
import { splitInvites } from "@/hooks/use-inbox";

const now = 1_700_000_000_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

describe("splitInvites", () => {
  it("classifies a live demo currently in progress as open-now", () => {
    const items = [{
      invite: { _id: "i1", status: "invited" } as any,
      demo: {
        _id: "d1", mode: "live", durationMinutes: 30,
        scheduledAt: now - 5 * 60_000, createdAt: now - DAY,
      } as any,
    }];
    const out = splitInvites(items, now);
    expect(out.openNow.map((i) => i.invite._id)).toEqual(["i1"]);
    expect(out.upcoming).toHaveLength(0);
  });

  it("classifies a future-only live demo as upcoming", () => {
    const items = [{
      invite: { _id: "i1", status: "invited" } as any,
      demo: { _id: "d1", mode: "live", durationMinutes: 30, scheduledAt: now + 2 * HOUR, createdAt: now } as any,
    }];
    const out = splitInvites(items, now);
    expect(out.upcoming.map((i) => i.invite._id)).toEqual(["i1"]);
    expect(out.openNow).toHaveLength(0);
  });

  it("classifies async demos as open-now between createdAt and scheduledAt + formCloseDueDays", () => {
    const items = [{
      invite: { _id: "i1", status: "invited" } as any,
      demo: {
        _id: "d1", mode: "async", durationMinutes: 0,
        scheduledAt: now + DAY, createdAt: now - HOUR, formCloseDueDays: 3,
      } as any,
    }];
    const out = splitInvites(items, now);
    expect(out.openNow.map((i) => i.invite._id)).toEqual(["i1"]);
  });

  it("classifies post-mode demos as open-now during the post window", () => {
    const items = [{
      invite: { _id: "i1", status: "invited" } as any,
      demo: {
        _id: "d1", mode: "post", durationMinutes: 30,
        scheduledAt: now - 60 * 60_000, // demo ended 30m ago
        createdAt: now - DAY, formOpenWindowMinutes: 60,
      } as any,
    }];
    const out = splitInvites(items, now);
    expect(out.openNow.map((i) => i.invite._id)).toEqual(["i1"]);
  });

  it("filters out invites that have already been submitted or cancelled", () => {
    const items = [
      { invite: { _id: "i1", status: "submitted" } as any, demo: { mode: "live", scheduledAt: now, durationMinutes: 30, createdAt: now } as any },
      { invite: { _id: "i2", status: "cancelled" } as any, demo: { mode: "live", scheduledAt: now, durationMinutes: 30, createdAt: now } as any },
      { invite: { _id: "i3", status: "declined" } as any, demo: { mode: "live", scheduledAt: now, durationMinutes: 30, createdAt: now } as any },
    ];
    const out = splitInvites(items, now);
    expect(out.openNow).toHaveLength(0);
    expect(out.upcoming).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test use-inbox`
Expected: FAIL.

- [ ] **Step 3: Implement the hook + split function**

Create `mobile/src/hooks/use-inbox.ts`:

```ts
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useSession } from "@/hooks/use-session";

export type InboxRow = {
  invite: {
    _id: string;
    status: string;
    evaluatorRole?: string;
    submittedAt?: number;
  };
  demo: {
    _id: string;
    mode: "live" | "post" | "async";
    durationMinutes: number;
    scheduledAt: number;
    createdAt: number;
    formOpenWindowMinutes?: number;
    formCloseDueDays?: number;
  };
  candidate?: { name?: string; subject?: string } | null;
};

const HOUR = 3_600_000;
const MIN = 60_000;
const DAY = 86_400_000;

function windowFor(demo: InboxRow["demo"]) {
  const dur = demo.durationMinutes * MIN;
  if (demo.mode === "live") return { open: demo.scheduledAt, close: demo.scheduledAt + dur };
  if (demo.mode === "post") {
    const openWin = (demo.formOpenWindowMinutes ?? 60) * MIN;
    return { open: demo.scheduledAt + dur, close: demo.scheduledAt + dur + openWin };
  }
  // async
  const closeDays = demo.formCloseDueDays ?? 3;
  return { open: demo.createdAt, close: demo.scheduledAt + closeDays * DAY };
}

export function splitInvites(
  rows: InboxRow[],
  now: number,
): { openNow: InboxRow[]; upcoming: InboxRow[] } {
  const openNow: InboxRow[] = [];
  const upcoming: InboxRow[] = [];
  for (const row of rows) {
    if (row.invite.status === "submitted" || row.invite.status === "cancelled" || row.invite.status === "declined") {
      continue;
    }
    const { open, close } = windowFor(row.demo);
    if (now >= open && now < close) openNow.push(row);
    else if (now < open) upcoming.push(row);
    // Past close window: silently dropped (out of policy for this hook; web shows them as overdue).
  }
  openNow.sort((a, b) => a.demo.scheduledAt - b.demo.scheduledAt);
  upcoming.sort((a, b) => a.demo.scheduledAt - b.demo.scheduledAt);
  return { openNow, upcoming };
}

export function useInbox() {
  const { signedIn, user } = useSession();
  const profile = useQuery(
    api.users.getProfile,
    signedIn && user?.id ? { userId: user.id } : "skip",
  );
  const list = useQuery(
    api.evaluationInvites.listForUser,
    profile?._id
      ? { userId: profile._id, statusFilter: ["invited", "viewed", "in_progress"] }
      : "skip",
  );
  const rows = (list ?? []) as InboxRow[];
  return {
    loading: !profile || !list,
    ...splitInvites(rows, Date.now()),
  };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test use-inbox`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/use-inbox.ts mobile/__tests__/hooks/use-inbox.test.tsx
git commit -m "feat(mobile): useInbox + splitInvites (open-now vs upcoming)"
```

---

### Task 16: InboxCard component

**Files:**
- Create: `mobile/src/components/inbox/inbox-card.tsx`
- Create: `mobile/__tests__/components/inbox-card.test.tsx`

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/components/inbox-card.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { InboxCard } from "@/components/inbox/inbox-card";

const baseDemo = {
  _id: "d1" as any,
  mode: "live" as const,
  scheduledAt: 1_700_000_000_000,
  durationMinutes: 30,
  createdAt: 0,
};

describe("InboxCard", () => {
  it("shows the candidate name, subject, and mode badge", () => {
    render(
      <InboxCard
        row={{
          invite: { _id: "i1" as any, status: "invited" } as any,
          demo: baseDemo,
          candidate: { name: "Priya", subject: "Maths" } as any,
        }}
        onPress={() => {}}
      />,
    );
    expect(screen.getByText("Priya")).toBeTruthy();
    expect(screen.getByText("Maths")).toBeTruthy();
    expect(screen.getByText("LIVE")).toBeTruthy();
  });

  it("invokes onPress when tapped", () => {
    const onPress = jest.fn();
    render(
      <InboxCard
        row={{
          invite: { _id: "i1" as any, status: "invited" } as any,
          demo: baseDemo,
          candidate: { name: "Priya" } as any,
        }}
        onPress={onPress}
      />,
    );
    fireEvent.press(screen.getByText("Priya"));
    expect(onPress).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test inbox-card`
Expected: FAIL.

- [ ] **Step 3: Implement InboxCard**

Create `mobile/src/components/inbox/inbox-card.tsx`:

```tsx
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { colors, fonts, space } from "@/theme";

type Row = {
  invite: { _id: string; status: string };
  demo: { _id: string; mode: "live" | "post" | "async"; scheduledAt: number; durationMinutes: number };
  candidate?: { name?: string; subject?: string } | null;
};

const MODE_TONE: Record<Row["demo"]["mode"], "danger" | "warning" | "info"> = {
  live: "danger",
  post: "warning",
  async: "info",
};

function formatWhen(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
}

export function InboxCard({ row, onPress }: { row: Row; onPress: () => void }) {
  const name = row.candidate?.name ?? "Candidate";
  const subject = row.candidate?.subject;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card padding="md" style={{ marginBottom: space[3] }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: fonts.size.md, fontWeight: fonts.weight.semibold, color: colors.ink }}>
            {name}
          </Text>
          <Badge tone={MODE_TONE[row.demo.mode]}>{row.demo.mode.toUpperCase()}</Badge>
        </View>
        {subject && (
          <Text style={{ marginTop: space[1], color: colors.inkSecondary, fontSize: fonts.size.sm }}>
            {subject}
          </Text>
        )}
        <Text style={{ marginTop: space[2], color: colors.inkTertiary, fontSize: fonts.size.xs }}>
          {formatWhen(row.demo.scheduledAt)}
        </Text>
      </Card>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test inbox-card`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/inbox/ mobile/__tests__/components/inbox-card.test.tsx
git commit -m "feat(mobile): InboxCard component"
```

---

### Task 17: InboxScreen with two sections + pull-to-refresh

**Files:**
- Modify: `mobile/src/screens/inbox.tsx`
- Create: `mobile/__tests__/screens/inbox.test.tsx`

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/screens/inbox.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { InboxScreen } from "@/screens/inbox";

const openNowRow = {
  invite: { _id: "i1", status: "invited" } as any,
  demo: { _id: "d1", mode: "live", scheduledAt: Date.now() - 5 * 60_000, durationMinutes: 30, createdAt: 0 } as any,
  candidate: { name: "Priya", subject: "Maths" } as any,
};
const upcomingRow = {
  invite: { _id: "i2", status: "invited" } as any,
  demo: { _id: "d2", mode: "post", scheduledAt: Date.now() + 2 * 3_600_000, durationMinutes: 30, createdAt: 0 } as any,
  candidate: { name: "Karan", subject: "Science" } as any,
};

jest.mock("@/hooks/use-inbox", () => ({
  useInbox: () => ({ loading: false, openNow: [openNowRow], upcoming: [upcomingRow] }),
}));

function withNav(node: React.ReactNode) {
  return <NavigationContainer>{node}</NavigationContainer>;
}

describe("InboxScreen", () => {
  it("renders Open now and Upcoming section headers and their cards", () => {
    render(withNav(<InboxScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />));
    expect(screen.getByText("Open now")).toBeTruthy();
    expect(screen.getByText("Upcoming")).toBeTruthy();
    expect(screen.getByText("Priya")).toBeTruthy();
    expect(screen.getByText("Karan")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test screens/inbox`
Expected: FAIL — current stub doesn't render sections.

- [ ] **Step 3: Implement InboxScreen**

Replace `mobile/src/screens/inbox.tsx`:

```tsx
import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useInbox } from "@/hooks/use-inbox";
import { InboxCard } from "@/components/inbox/inbox-card";
import { EmptyState } from "@/components/ui/empty-state";
import { colors, fonts, space } from "@/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/app-nav";

type Props = NativeStackScreenProps<RootStackParamList, "EvaluatorTabs"> | { navigation: any; route: any };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: space[6] }}>
      <Text style={{ fontSize: fonts.size.sm, fontWeight: fonts.weight.semibold, color: colors.inkSecondary, marginBottom: space[2], textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function InboxScreen({ navigation }: Props) {
  const { openNow, upcoming, loading } = useInbox();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    // Convex live queries refresh automatically; the pull-to-refresh just gives haptic feedback.
    await new Promise((r) => setTimeout(r, 400));
    setRefreshing(false);
  }

  if (loading && openNow.length === 0 && upcoming.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas, justifyContent: "center" }}>
        <Text style={{ textAlign: "center", color: colors.inkSecondary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4], paddingBottom: space[8] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Section title="Open now">
        {openNow.length === 0 ? (
          <EmptyState title="Nothing open" body="You'll see demos here when the form-open window starts." />
        ) : (
          openNow.map((row) => (
            <InboxCard
              key={row.invite._id}
              row={row}
              onPress={() => navigation?.navigate?.("DemoDetail", { demoId: row.demo._id, inviteId: row.invite._id })}
            />
          ))
        )}
      </Section>

      <Section title="Upcoming">
        {upcoming.length === 0 ? (
          <EmptyState title="No upcoming demos" body="When you're invited, your demos show up here." />
        ) : (
          upcoming.map((row) => (
            <InboxCard
              key={row.invite._id}
              row={row}
              onPress={() => navigation?.navigate?.("DemoDetail", { demoId: row.demo._id, inviteId: row.invite._id })}
            />
          ))
        )}
      </Section>
    </ScrollView>
  );
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test screens/inbox`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/inbox.tsx mobile/__tests__/screens/inbox.test.tsx
git commit -m "feat(mobile): InboxScreen with Open-now + Upcoming sections"
```

---

## Phase 7: Calendar

### Task 18: `useCalendarDemos` hook

**Files:**
- Create: `mobile/src/hooks/use-calendar-demos.ts`
- Create: `mobile/__tests__/hooks/use-calendar-demos.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `mobile/__tests__/hooks/use-calendar-demos.test.tsx`:

```tsx
import { groupByDay } from "@/hooks/use-calendar-demos";

describe("groupByDay", () => {
  it("groups demos by YYYY-MM-DD key derived from scheduledAt", () => {
    const t = new Date("2026-06-15T10:00:00").getTime();
    const t2 = new Date("2026-06-15T14:00:00").getTime();
    const t3 = new Date("2026-06-16T09:00:00").getTime();
    const out = groupByDay([
      { invite: { _id: "i1" } as any, demo: { _id: "d1", scheduledAt: t } as any },
      { invite: { _id: "i2" } as any, demo: { _id: "d2", scheduledAt: t2 } as any },
      { invite: { _id: "i3" } as any, demo: { _id: "d3", scheduledAt: t3 } as any },
    ]);
    const keys = Object.keys(out).sort();
    expect(keys).toEqual(["2026-06-15", "2026-06-16"]);
    expect(out["2026-06-15"].map((r) => r.invite._id)).toEqual(["i1", "i2"]);
    expect(out["2026-06-16"].map((r) => r.invite._id)).toEqual(["i3"]);
  });

  it("sorts each day's rows by time ascending", () => {
    const earlier = new Date("2026-06-15T08:00:00").getTime();
    const later = new Date("2026-06-15T16:00:00").getTime();
    const out = groupByDay([
      { invite: { _id: "later" } as any, demo: { _id: "d1", scheduledAt: later } as any },
      { invite: { _id: "earlier" } as any, demo: { _id: "d2", scheduledAt: earlier } as any },
    ]);
    expect(out["2026-06-15"].map((r) => r.invite._id)).toEqual(["earlier", "later"]);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test use-calendar-demos`
Expected: FAIL.

- [ ] **Step 3: Implement the hook**

Create `mobile/src/hooks/use-calendar-demos.ts`:

```ts
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useSession } from "@/hooks/use-session";

export type CalendarRow = {
  invite: { _id: string; status: string; evaluatorRole?: string };
  demo: {
    _id: string;
    mode: "live" | "post" | "async";
    scheduledAt: number;
    durationMinutes: number;
  };
  candidate?: { name?: string; subject?: string } | null;
};

function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function groupByDay(rows: CalendarRow[]): Record<string, CalendarRow[]> {
  const groups: Record<string, CalendarRow[]> = {};
  for (const row of rows) {
    const key = dayKey(row.demo.scheduledAt);
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.demo.scheduledAt - b.demo.scheduledAt);
  }
  return groups;
}

export function useCalendarDemos() {
  const { signedIn, user } = useSession();
  const profile = useQuery(
    api.users.getProfile,
    signedIn && user?.id ? { userId: user.id } : "skip",
  );
  const list = useQuery(
    api.evaluationInvites.listForUser,
    profile?._id ? { userId: profile._id, statusFilter: undefined } : "skip",
  );
  const rows = (list ?? []) as CalendarRow[];
  return {
    loading: !profile || !list,
    days: groupByDay(rows),
  };
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test use-calendar-demos`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/use-calendar-demos.ts mobile/__tests__/hooks/use-calendar-demos.test.tsx
git commit -m "feat(mobile): useCalendarDemos + groupByDay"
```

---

### Task 19: CalendarScreen with day sections

**Files:**
- Modify: `mobile/src/screens/calendar.tsx`
- Create: `mobile/__tests__/screens/calendar.test.tsx`

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/screens/calendar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { CalendarScreen } from "@/screens/calendar";

const day1 = "2026-06-15";
const day2 = "2026-06-16";

jest.mock("@/hooks/use-calendar-demos", () => ({
  useCalendarDemos: () => ({
    loading: false,
    days: {
      [day1]: [
        {
          invite: { _id: "i1", status: "invited" } as any,
          demo: { _id: "d1", mode: "live", scheduledAt: new Date(`${day1}T10:00:00`).getTime(), durationMinutes: 30 } as any,
          candidate: { name: "Priya", subject: "Maths" } as any,
        },
      ],
      [day2]: [
        {
          invite: { _id: "i2", status: "viewed" } as any,
          demo: { _id: "d2", mode: "post", scheduledAt: new Date(`${day2}T09:00:00`).getTime(), durationMinutes: 30 } as any,
          candidate: { name: "Karan" } as any,
        },
      ],
    },
  }),
}));

describe("CalendarScreen", () => {
  it("renders one day header per group", () => {
    render(
      <NavigationContainer>
        <CalendarScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />
      </NavigationContainer>,
    );
    expect(screen.getByText("Priya")).toBeTruthy();
    expect(screen.getByText("Karan")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test screens/calendar`
Expected: FAIL.

- [ ] **Step 3: Implement CalendarScreen**

Replace `mobile/src/screens/calendar.tsx`:

```tsx
import { ScrollView, Text, View } from "react-native";
import { useCalendarDemos } from "@/hooks/use-calendar-demos";
import { InboxCard } from "@/components/inbox/inbox-card";
import { EmptyState } from "@/components/ui/empty-state";
import { colors, fonts, space } from "@/theme";

function formatDayHeader(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
  });
}

export function CalendarScreen({ navigation }: { navigation?: any; route?: any }) {
  const { days, loading } = useCalendarDemos();
  const dayKeys = Object.keys(days).sort();

  if (loading && dayKeys.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas, justifyContent: "center" }}>
        <Text style={{ textAlign: "center", color: colors.inkSecondary }}>Loading...</Text>
      </View>
    );
  }

  if (dayKeys.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}>
        <EmptyState title="No demos yet" body="When you have demos scheduled, they appear here." />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4], paddingBottom: space[8] }}
    >
      {dayKeys.map((key) => (
        <View key={key} style={{ marginBottom: space[6] }}>
          <Text
            style={{
              fontSize: fonts.size.sm,
              fontWeight: fonts.weight.semibold,
              color: colors.inkSecondary,
              marginBottom: space[2],
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {formatDayHeader(key)}
          </Text>
          {days[key].map((row) => (
            <InboxCard
              key={row.invite._id}
              row={row}
              onPress={() => navigation?.navigate?.("DemoDetail", { demoId: row.demo._id, inviteId: row.invite._id })}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test screens/calendar`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/calendar.tsx mobile/__tests__/screens/calendar.test.tsx
git commit -m "feat(mobile): CalendarScreen with day-grouped demo list"
```

---

## Phase 8: Demo detail + decline

### Task 20: DemoDetailScreen — candidate hero + evaluator statuses + CTA

**Files:**
- Modify: `mobile/src/navigation/app-nav.tsx` — register `DemoDetail` route on the root stack
- Create: `mobile/src/components/demos/evaluator-status-row.tsx`
- Create: `mobile/src/screens/demo-detail.tsx`
- Create: `mobile/__tests__/screens/demo-detail.test.tsx`

The spec requires hiding other evaluators' scores and comments until the current viewer submits. This screen only shows name + status for siblings.

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/screens/demo-detail.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { DemoDetailScreen } from "@/screens/demo-detail";

const invite = { _id: "i_me", status: "invited", evaluatorUserId: "u_me", evaluatorRole: "principal" };
const sibling = { _id: "i_other", status: "submitted", evaluatorUserId: "u_other", evaluatorRole: "hod" };
const demo = {
  _id: "d1",
  mode: "live" as const,
  scheduledAt: Date.now() + 60 * 60_000,
  durationMinutes: 30,
  format: "classroom" as const,
  location: "Room 12B",
};

jest.mock("convex/react", () => ({
  useQuery: jest.fn().mockImplementation((q: any) => {
    if (q === "applications:get") return { name: "Priya", subject: "Maths", _id: "app1" };
    if (q === "demoSessions:get") return demo;
    if (q === "evaluationInvites:listForDemo") {
      return [
        { ...invite, profile: { _id: "u_me", name: "Mrs Iyer" } },
        { ...sibling, profile: { _id: "u_other", name: "Mr Khan" } },
      ];
    }
    return null;
  }),
  useMutation: () => jest.fn(),
}));

jest.mock("@convex/_generated/api", () => ({
  api: {
    applications: { get: "applications:get" },
    demoSessions: { get: "demoSessions:get" },
    evaluationInvites: { listForDemo: "evaluationInvites:listForDemo", markViewed: "evaluationInvites:markViewed" },
  },
}));

function withNav(node: React.ReactNode) {
  return <NavigationContainer>{node}</NavigationContainer>;
}

describe("DemoDetailScreen", () => {
  it("shows the candidate name, location, and the sibling evaluator with only status (no scores)", () => {
    render(
      withNav(
        <DemoDetailScreen
          navigation={{ navigate: jest.fn() } as any}
          route={{ params: { demoId: "d1", inviteId: "i_me" } } as any}
        />,
      ),
    );
    expect(screen.getByText("Priya")).toBeTruthy();
    expect(screen.getByText(/Room 12B/)).toBeTruthy();
    expect(screen.getByText("Mr Khan")).toBeTruthy();
    expect(screen.getByText("Submitted")).toBeTruthy();
  });

  it("renders Start evaluation CTA", () => {
    const navigate = jest.fn();
    render(
      withNav(
        <DemoDetailScreen
          navigation={{ navigate } as any}
          route={{ params: { demoId: "d1", inviteId: "i_me" } } as any}
        />,
      ),
    );
    const cta = screen.getByText("Start evaluation");
    fireEvent.press(cta);
    expect(navigate).toHaveBeenCalledWith("EvaluationForm", { inviteId: "i_me", demoId: "d1" });
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test demo-detail`
Expected: FAIL.

- [ ] **Step 3: Implement EvaluatorStatusRow**

Create `mobile/src/components/demos/evaluator-status-row.tsx`:

```tsx
import { Text, View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { colors, fonts, space } from "@/theme";

const STATUS_TONE: Record<string, "info" | "success" | "warning" | "danger" | "neutral"> = {
  invited: "neutral",
  viewed: "info",
  in_progress: "warning",
  submitted: "success",
  declined: "danger",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  viewed: "Viewed",
  in_progress: "In progress",
  submitted: "Submitted",
  declined: "Declined",
  cancelled: "Cancelled",
};

export function EvaluatorStatusRow({ name, role, status }: { name: string; role: string; status: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: space[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline,
      }}
    >
      <View>
        <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>
          {name}
        </Text>
        <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.xs, marginTop: 2 }}>
          {role.toUpperCase()}
        </Text>
      </View>
      <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>
    </View>
  );
}
```

- [ ] **Step 4: Implement DemoDetailScreen**

Create `mobile/src/screens/demo-detail.tsx`:

```tsx
import { useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card } from "@/components/ui/card";
import { PressableButton } from "@/components/ui/pressable-button";
import { EvaluatorStatusRow } from "@/components/demos/evaluator-status-row";
import { colors, fonts, space } from "@/theme";

type Params = { demoId: string; inviteId: string };

const MODE_LABEL: Record<string, string> = { live: "Live", post: "Post-demo", async: "Async" };
const FORMAT_LABEL: Record<string, string> = { classroom: "Classroom", mock: "Mock", recorded: "Recorded" };

function formatWhen(ts: number, durationMin: number) {
  const start = new Date(ts).toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
  return `${start} (${durationMin} min)`;
}

export function DemoDetailScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: { params: Params };
}) {
  const { demoId, inviteId } = route.params;
  const demo = useQuery(api.demoSessions.get, { demoId: demoId as any });
  const application = useQuery(
    api.applications.get,
    demo?.applicationId ? { applicationId: demo.applicationId as any } : "skip",
  );
  const invitesRaw = useQuery(api.evaluationInvites.listForDemo, { demoId: demoId as any });
  const markViewed = useMutation(api.evaluationInvites.markViewed);

  useEffect(() => {
    markViewed({ inviteId: inviteId as any }).catch(() => {});
  }, [inviteId, markViewed]);

  if (!demo || !application || !invitesRaw) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas, justifyContent: "center" }}>
        <Text style={{ textAlign: "center", color: colors.inkSecondary }}>Loading...</Text>
      </View>
    );
  }

  const me = invitesRaw.find((i: any) => i._id === inviteId);
  const siblings = invitesRaw.filter((i: any) => i._id !== inviteId && i.status !== "cancelled");
  const canStart = me && me.status !== "submitted" && me.status !== "cancelled" && me.status !== "declined";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}
      contentContainerStyle={{ padding: space[4], paddingBottom: space[8] }}
    >
      <Card padding="lg">
        <Text style={{ fontSize: fonts.size.xxl, fontWeight: fonts.weight.bold, color: colors.ink }}>
          {application.name}
        </Text>
        {application.subject && (
          <Text style={{ fontSize: fonts.size.md, color: colors.inkSecondary, marginTop: space[1] }}>
            {application.subject}
          </Text>
        )}
        <Text style={{ marginTop: space[3], color: colors.ink, fontSize: fonts.size.sm }}>
          {formatWhen(demo.scheduledAt, demo.durationMinutes)}
        </Text>
        <Text style={{ marginTop: space[1], color: colors.inkSecondary, fontSize: fonts.size.sm }}>
          {MODE_LABEL[demo.mode]} - {FORMAT_LABEL[demo.format]}
          {demo.location ? ` - ${demo.location}` : ""}
        </Text>
      </Card>

      <Text style={{ marginTop: space[6], marginBottom: space[2], color: colors.inkSecondary, fontSize: fonts.size.sm, fontWeight: fonts.weight.semibold, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Other evaluators
      </Text>
      <Card padding="md">
        {siblings.length === 0 ? (
          <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.sm }}>You're the only evaluator.</Text>
        ) : (
          siblings.map((s: any) => (
            <EvaluatorStatusRow
              key={s._id}
              name={s.profile?.name ?? "Evaluator"}
              role={s.evaluatorRole}
              status={s.status}
            />
          ))
        )}
      </Card>

      <View style={{ marginTop: space[6] }}>
        {canStart ? (
          <PressableButton
            size="lg"
            onPress={() => navigation.navigate("EvaluationForm", { inviteId, demoId })}
          >
            Start evaluation
          </PressableButton>
        ) : (
          <Text style={{ textAlign: "center", color: colors.inkSecondary, fontSize: fonts.size.sm }}>
            You have already {me?.status ?? "responded"} for this demo.
          </Text>
        )}
        <View style={{ marginTop: space[3] }}>
          <PressableButton
            variant="ghost"
            onPress={() => navigation.navigate("DeclineInvite", { inviteId })}
          >
            Decline this invite
          </PressableButton>
        </View>
      </View>
    </ScrollView>
  );
}
```

The `evaluationInvites.listForDemo` query returns invites without joining `profile`. To make the test pass and render names, extend the query (read it, append profile expansion in the same module if needed). For Plan 3, add a wrapper query rather than mutate the existing one to avoid breaking web consumers.

- [ ] **Step 5: Add `listForDemoWithProfiles` query to Convex**

Edit `convex/evaluationInvites.ts`. Append:

```ts
export const listForDemoWithProfiles = query({
  args: { demoId: v.id("demoSessions") },
  handler: async (ctx, { demoId }) => {
    const invites = await ctx.db
      .query("evaluationInvites")
      .withIndex("by_demoSessionId", (q) => q.eq("demoSessionId", demoId))
      .collect();
    const out = [];
    for (const i of invites) {
      const profile = await ctx.db.get(i.evaluatorUserId);
      out.push({ ...i, profile });
    }
    return out;
  },
});
```

Update `mobile/src/screens/demo-detail.tsx` to call `api.evaluationInvites.listForDemoWithProfiles` instead of `listForDemo`.

Run codegen: `bunx convex codegen`

- [ ] **Step 6: Register the route on the navigator**

Edit `mobile/src/navigation/app-nav.tsx`. Add `DemoDetail` and `EvaluationForm` (stub) routes to the root stack:

```tsx
import { DemoDetailScreen } from "@/screens/demo-detail";
import { EvaluationFormScreen } from "@/screens/evaluation-form";

export type RootStackParamList = {
  SignIn: undefined;
  EvaluatorTabs: undefined;
  DemoDetail: { demoId: string; inviteId: string };
  EvaluationForm: { demoId: string; inviteId: string };
  DeclineInvite: { inviteId: string };
};
```

Inside the `signedIn` branch of the Stack.Navigator, add:

```tsx
<Stack.Screen name="EvaluatorTabs" component={EvaluatorTabs} />
<Stack.Screen name="DemoDetail" component={DemoDetailScreen} options={{ headerShown: true, title: "Demo" }} />
<Stack.Screen name="EvaluationForm" component={EvaluationFormScreen} options={{ headerShown: true, title: "Evaluate" }} />
```

`EvaluationFormScreen` is created later (Phase 9, T22). For now, create the file as a stub so the import succeeds:

Create `mobile/src/screens/evaluation-form.tsx`:

```tsx
import { Text, View } from "react-native";
import { colors, space } from "@/theme";

export function EvaluationFormScreen() {
  return (
    <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas }}>
      <Text accessibilityLabel="form-stub">Evaluation form (stub)</Text>
    </View>
  );
}
```

- [ ] **Step 7: Run tests, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test demo-detail`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add convex/evaluationInvites.ts convex/_generated/ mobile/src/screens/demo-detail.tsx mobile/src/screens/evaluation-form.tsx mobile/src/components/demos/ mobile/src/navigation/app-nav.tsx mobile/__tests__/screens/demo-detail.test.tsx
git commit -m "feat(mobile): DemoDetailScreen + listForDemoWithProfiles query"
```

---

### Task 21: Decline invite modal

**Files:**
- Create: `mobile/src/components/demos/decline-modal.tsx`
- Create: `mobile/__tests__/components/decline-modal.test.tsx`
- Modify: `mobile/src/navigation/app-nav.tsx` — register `DeclineInvite` as a modal

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/components/decline-modal.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { DeclineModal } from "@/components/demos/decline-modal";

const declineMutation = jest.fn().mockResolvedValue(undefined);
jest.mock("convex/react", () => ({
  useMutation: () => declineMutation,
}));
jest.mock("@convex/_generated/api", () => ({
  api: { evaluationInvites: { decline: "evaluationInvites:decline" } },
}));

describe("DeclineModal", () => {
  beforeEach(() => declineMutation.mockClear());

  it("submits with the typed reason and closes", async () => {
    const onClose = jest.fn();
    render(<DeclineModal inviteId={"i1" as any} onClose={onClose} />);
    fireEvent.changeText(screen.getByPlaceholderText("Why are you declining?"), "On leave");
    fireEvent.press(screen.getByText("Confirm decline"));
    expect(declineMutation).toHaveBeenCalledWith({ inviteId: "i1", reason: "On leave" });
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test decline-modal`
Expected: FAIL.

- [ ] **Step 3: Implement DeclineModal**

Create `mobile/src/components/demos/decline-modal.tsx`:

```tsx
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card } from "@/components/ui/card";
import { PressableButton } from "@/components/ui/pressable-button";
import { colors, fonts, radii, space } from "@/theme";

export function DeclineModal({
  inviteId,
  onClose,
}: {
  inviteId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const decline = useMutation(api.evaluationInvites.decline);

  async function confirm() {
    setBusy(true);
    try {
      await decline({ inviteId: inviteId as any, reason: reason.trim() || undefined });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: space[4], backgroundColor: colors.surfaceCanvas, justifyContent: "center" }}>
      <Card padding="lg">
        <Text style={{ fontSize: fonts.size.lg, fontWeight: fonts.weight.semibold, color: colors.ink, marginBottom: space[2] }}>
          Decline this invite?
        </Text>
        <Text style={{ fontSize: fonts.size.sm, color: colors.inkSecondary, marginBottom: space[4] }}>
          Your school's HR will be notified so they can swap in another evaluator.
        </Text>
        <TextInput
          placeholder="Why are you declining?"
          placeholderTextColor={colors.inkTertiary}
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={3}
          style={{
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: radii.apple,
            padding: space[3],
            fontSize: fonts.size.md,
            color: colors.ink,
            marginBottom: space[4],
            backgroundColor: colors.surface,
            minHeight: 80,
          }}
        />
        <PressableButton variant="danger" onPress={confirm} disabled={busy}>
          {busy ? "Declining..." : "Confirm decline"}
        </PressableButton>
        <View style={{ marginTop: space[3] }}>
          <PressableButton variant="ghost" onPress={onClose}>
            Cancel
          </PressableButton>
        </View>
      </Card>
    </View>
  );
}
```

- [ ] **Step 4: Register DeclineInvite route**

Edit `mobile/src/navigation/app-nav.tsx`. Inside the signed-in branch add a screen that wraps the modal so it gets `inviteId` from route params and `onClose` from navigation:

```tsx
import { DeclineModal } from "@/components/demos/decline-modal";

function DeclineInviteScreen({ route, navigation }: any) {
  return <DeclineModal inviteId={route.params.inviteId} onClose={() => navigation.goBack()} />;
}

// inside Stack.Navigator (signed-in branch):
<Stack.Screen
  name="DeclineInvite"
  component={DeclineInviteScreen}
  options={{ presentation: "modal", headerShown: true, title: "Decline invite" }}
/>
```

- [ ] **Step 5: Run test, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test decline-modal`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/components/demos/decline-modal.tsx mobile/src/navigation/app-nav.tsx mobile/__tests__/components/decline-modal.test.tsx
git commit -m "feat(mobile): decline invite modal"
```

---

## Phase 9: Form rendering

### Task 22: Score field components (1-5 and 1-10)

**Files:**
- Create: `mobile/src/components/evaluations/form-field-score.tsx`
- Create: `mobile/__tests__/components/form-field-score.test.tsx`

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/components/form-field-score.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ScoreField } from "@/components/evaluations/form-field-score";

describe("ScoreField", () => {
  it("renders 5 buttons for a score_1_5 field and reports the picked value", () => {
    const onChange = jest.fn();
    render(<ScoreField label="Subject knowledge" type="score_1_5" value={undefined} onChange={onChange} />);
    expect(screen.getByText("Subject knowledge")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("score-3"));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("renders 10 buttons for a score_1_10 field", () => {
    render(<ScoreField label="Pedagogy" type="score_1_10" value={undefined} onChange={() => {}} />);
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByLabelText(`score-${i}`)).toBeTruthy();
    }
  });

  it("marks the current value as selected", () => {
    render(<ScoreField label="x" type="score_1_5" value={4} onChange={() => {}} />);
    const picked = screen.getByLabelText("score-4");
    expect(picked.props.accessibilityState?.selected).toBe(true);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test form-field-score`
Expected: FAIL.

- [ ] **Step 3: Implement ScoreField**

Create `mobile/src/components/evaluations/form-field-score.tsx`:

```tsx
import { Pressable, Text, View } from "react-native";
import { colors, fonts, radii, space } from "@/theme";

export function ScoreField({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: "score_1_5" | "score_1_10";
  value: number | undefined;
  onChange: (next: number) => void;
}) {
  const max = type === "score_1_5" ? 5 : 10;
  const scale = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <View style={{ marginBottom: space[5] }}>
      <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold, marginBottom: space[2] }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {scale.map((n) => {
          const selected = value === n;
          return (
            <Pressable
              key={n}
              accessibilityLabel={`score-${n}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(n)}
              style={{
                width: 44,
                height: 44,
                borderRadius: radii.apple,
                borderWidth: 1,
                borderColor: selected ? colors.accent : colors.hairline,
                backgroundColor: selected ? colors.accent : colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: selected ? colors.inverse : colors.ink, fontWeight: fonts.weight.semibold }}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test form-field-score`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/evaluations/form-field-score.tsx mobile/__tests__/components/form-field-score.test.tsx
git commit -m "feat(mobile): ScoreField (1-5 and 1-10)"
```

---

### Task 23: Text, Choice, and Recommendation field components

**Files:**
- Create: `mobile/src/components/evaluations/form-field-text.tsx`
- Create: `mobile/src/components/evaluations/form-field-choice.tsx`
- Create: `mobile/src/components/evaluations/recommendation-buttons.tsx`
- Create: `mobile/__tests__/components/form-fields-text-choice-rec.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `mobile/__tests__/components/form-fields-text-choice-rec.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { TextField } from "@/components/evaluations/form-field-text";
import { ChoiceField } from "@/components/evaluations/form-field-choice";
import { RecommendationButtons } from "@/components/evaluations/recommendation-buttons";

describe("TextField", () => {
  it("renders label and propagates input changes", () => {
    const onChange = jest.fn();
    render(<TextField label="Comments" value="" onChange={onChange} />);
    fireEvent.changeText(screen.getByPlaceholderText("Type your notes..."), "good");
    expect(onChange).toHaveBeenCalledWith("good");
  });

  it("shows the mic button when allowDictation is true", () => {
    render(<TextField label="x" value="" onChange={() => {}} allowDictation onMicPress={() => {}} />);
    expect(screen.getByLabelText("dictate")).toBeTruthy();
  });

  it("hides the mic button when allowDictation is false", () => {
    render(<TextField label="x" value="" onChange={() => {}} allowDictation={false} />);
    expect(screen.queryByLabelText("dictate")).toBeNull();
  });
});

describe("ChoiceField", () => {
  it("renders each choice as a tappable chip and reports the picked value", () => {
    const onChange = jest.fn();
    render(<ChoiceField label="Region" choices={["North", "South"]} value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText("South"));
    expect(onChange).toHaveBeenCalledWith("South");
  });
});

describe("RecommendationButtons", () => {
  it("renders three buttons and reports selection", () => {
    const onChange = jest.fn();
    render(<RecommendationButtons value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText("Hire"));
    expect(onChange).toHaveBeenCalledWith("hire");
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test form-fields-text-choice-rec`
Expected: FAIL.

- [ ] **Step 3: Implement TextField**

Create `mobile/src/components/evaluations/form-field-text.tsx`:

```tsx
import { Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii, space } from "@/theme";

export function TextField({
  label,
  value,
  onChange,
  allowDictation = false,
  onMicPress,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  allowDictation?: boolean;
  onMicPress?: () => void;
}) {
  return (
    <View style={{ marginBottom: space[5] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space[2] }}>
        <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>{label}</Text>
        {allowDictation && onMicPress && (
          <Pressable
            accessibilityLabel="dictate"
            accessibilityRole="button"
            onPress={onMicPress}
            style={{
              width: 36, height: 36, borderRadius: radii.pill,
              backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="mic" size={18} color={colors.accent} />
          </Pressable>
        )}
      </View>
      <TextInput
        placeholder="Type your notes..."
        placeholderTextColor={colors.inkTertiary}
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={4}
        style={{
          borderWidth: 1, borderColor: colors.hairline,
          borderRadius: radii.apple, padding: space[3],
          fontSize: fonts.size.md, color: colors.ink,
          backgroundColor: colors.surface, minHeight: 100,
        }}
      />
    </View>
  );
}
```

- [ ] **Step 4: Implement ChoiceField**

Create `mobile/src/components/evaluations/form-field-choice.tsx`:

```tsx
import { Pressable, Text, View } from "react-native";
import { colors, fonts, radii, space } from "@/theme";

export function ChoiceField({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: string[];
  value: string | undefined;
  onChange: (next: string) => void;
}) {
  return (
    <View style={{ marginBottom: space[5] }}>
      <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold, marginBottom: space[2] }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {choices.map((c) => {
          const selected = value === c;
          return (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                paddingHorizontal: space[3], paddingVertical: space[2],
                borderRadius: radii.pill, borderWidth: 1,
                borderColor: selected ? colors.accent : colors.hairline,
                backgroundColor: selected ? colors.accent : colors.surface,
              }}
            >
              <Text style={{ color: selected ? colors.inverse : colors.ink, fontWeight: fonts.weight.medium }}>{c}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 5: Implement RecommendationButtons**

Create `mobile/src/components/evaluations/recommendation-buttons.tsx`:

```tsx
import { Pressable, Text, View } from "react-native";
import { colors, fonts, radii, space } from "@/theme";

type Rec = "hire" | "maybe" | "reject";
const OPTIONS: { value: Rec; label: string; tone: string }[] = [
  { value: "hire", label: "Hire", tone: colors.success },
  { value: "maybe", label: "Maybe", tone: colors.warning },
  { value: "reject", label: "Reject", tone: colors.danger },
];

export function RecommendationButtons({
  value,
  onChange,
}: {
  value: Rec | undefined;
  onChange: (next: Rec) => void;
}) {
  return (
    <View style={{ marginBottom: space[5] }}>
      <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold, marginBottom: space[2] }}>
        Recommendation
      </Text>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        {OPTIONS.map((o) => {
          const selected = value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                flex: 1,
                paddingVertical: space[4],
                borderRadius: radii.apple,
                borderWidth: 2,
                borderColor: selected ? o.tone : colors.hairline,
                backgroundColor: selected ? o.tone : colors.surface,
                alignItems: "center",
              }}
            >
              <Text style={{ color: selected ? colors.inverse : colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.bold }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 6: Run tests, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test form-fields-text-choice-rec`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/components/evaluations/form-field-text.tsx mobile/src/components/evaluations/form-field-choice.tsx mobile/src/components/evaluations/recommendation-buttons.tsx mobile/__tests__/components/form-fields-text-choice-rec.test.tsx
git commit -m "feat(mobile): Text + Choice + Recommendation fields"
```

---

### Task 24: EvaluationFormScreen — render template, collect responses, submit

**Files:**
- Modify: `mobile/src/screens/evaluation-form.tsx`
- Create: `mobile/__tests__/screens/evaluation-form.test.tsx`

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/screens/evaluation-form.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { EvaluationFormScreen } from "@/screens/evaluation-form";

const template = {
  _id: "tpl1",
  fields: [
    { key: "subjectKnowledge", label: "Subject knowledge", type: "score_1_5", required: true },
    { key: "comments", label: "Comments", type: "text", allowDictation: true },
  ],
};

const invite = { _id: "i1", formTemplateId: "tpl1", demoSessionId: "d1", evaluatorRole: "principal" };

const submitMutation = jest.fn().mockResolvedValue(undefined);

jest.mock("convex/react", () => ({
  useQuery: jest.fn().mockImplementation((q: any) => {
    if (q === "evaluationInvites:get") return invite;
    if (q === "formTemplates:getById") return template;
    return null;
  }),
  useMutation: () => submitMutation,
}));

jest.mock("@convex/_generated/api", () => ({
  api: {
    evaluationInvites: { get: "evaluationInvites:get" },
    formTemplates: { getById: "formTemplates:getById" },
    evaluations: { submit: "evaluations:submit" },
  },
}));

function withNav(node: React.ReactNode) {
  return <NavigationContainer>{node}</NavigationContainer>;
}

describe("EvaluationFormScreen", () => {
  it("renders one input per template field plus recommendation + submit", () => {
    render(withNav(
      <EvaluationFormScreen
        navigation={{ goBack: jest.fn(), reset: jest.fn(), navigate: jest.fn() } as any}
        route={{ params: { inviteId: "i1", demoId: "d1" } } as any}
      />,
    ));
    expect(screen.getByText("Subject knowledge")).toBeTruthy();
    expect(screen.getByText("Comments")).toBeTruthy();
    expect(screen.getByText("Recommendation")).toBeTruthy();
    expect(screen.getByText("Submit evaluation")).toBeTruthy();
  });

  it("submits collected responses including recommendation", async () => {
    render(withNav(
      <EvaluationFormScreen
        navigation={{ goBack: jest.fn(), reset: jest.fn(), navigate: jest.fn() } as any}
        route={{ params: { inviteId: "i1", demoId: "d1" } } as any}
      />,
    ));
    fireEvent.press(screen.getByLabelText("score-4"));
    fireEvent.changeText(screen.getByPlaceholderText("Type your notes..."), "Strong delivery");
    fireEvent.press(screen.getByText("Hire"));
    fireEvent.press(screen.getByText("Submit evaluation"));
    await waitFor(() =>
      expect(submitMutation).toHaveBeenCalledWith({
        inviteId: "i1",
        responses: { subjectKnowledge: 4, comments: "Strong delivery" },
        recommendation: "hire",
        voiceInputs: undefined,
        submittedFromPlatform: expect.stringMatching(/mobile_ios|mobile_android/),
      }),
    );
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test screens/evaluation-form`
Expected: FAIL — current stub does not render template.

- [ ] **Step 3: Add `evaluationInvites.get` if missing**

Verify: `grep -n "^export const get" /Users/sumanthdaggubati/Dev/Rolerecruit/convex/evaluationInvites.ts`
If `get(args: { inviteId: v.id("evaluationInvites") })` does not already exist, append:

```ts
export const get = query({
  args: { inviteId: v.id("evaluationInvites") },
  handler: async (ctx, { inviteId }) => {
    const inv = await ctx.db.get(inviteId);
    if (!inv) throw new Error("Invite not found");
    return inv;
  },
});
```

Run codegen: `bunx convex codegen`.

- [ ] **Step 4: Implement EvaluationFormScreen**

Replace `mobile/src/screens/evaluation-form.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Alert, Platform, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ScoreField } from "@/components/evaluations/form-field-score";
import { TextField } from "@/components/evaluations/form-field-text";
import { ChoiceField } from "@/components/evaluations/form-field-choice";
import { RecommendationButtons } from "@/components/evaluations/recommendation-buttons";
import { PressableButton } from "@/components/ui/pressable-button";
import { colors, fonts, space } from "@/theme";

type Params = { inviteId: string; demoId: string };
type FieldDef = {
  key: string;
  label: string;
  type: "score_1_5" | "score_1_10" | "text" | "choice";
  choices?: string[];
  required?: boolean;
  allowDictation?: boolean;
};

type VoiceCapture = {
  fieldKey: string;
  transcript: string;
  summaryPoints: string[];
  language: string;
  durationSec: number;
  processedAt: number;
};

export function EvaluationFormScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: { params: Params };
}) {
  const { inviteId } = route.params;
  const invite = useQuery(api.evaluationInvites.get, { inviteId: inviteId as any });
  const template = useQuery(
    api.formTemplates.getById,
    invite?.formTemplateId ? { templateId: invite.formTemplateId as any } : "skip",
  );
  const submit = useMutation(api.evaluations.submit);

  const [responses, setResponses] = useState<Record<string, number | string>>({});
  const [recommendation, setRecommendation] = useState<"hire" | "maybe" | "reject" | undefined>(undefined);
  const [voiceInputs, setVoiceInputs] = useState<VoiceCapture[]>([]);
  const [dictationField, setDictationField] = useState<FieldDef | null>(null);
  const [busy, setBusy] = useState(false);

  const fields: FieldDef[] = useMemo(() => (template?.fields as FieldDef[]) ?? [], [template]);

  function update(key: string, value: number | string) {
    setResponses((prev) => ({ ...prev, [key]: value }));
  }

  function handleDictationResult(field: FieldDef, capture: VoiceCapture) {
    setVoiceInputs((prev) => [...prev.filter((v) => v.fieldKey !== field.key), capture]);
    setResponses((prev) => ({ ...prev, [field.key]: capture.summaryPoints.join("\n") }));
    setDictationField(null);
  }

  async function onSubmit() {
    for (const f of fields) {
      if (f.required && (responses[f.key] === undefined || responses[f.key] === "")) {
        Alert.alert("Required", `${f.label} is required.`);
        return;
      }
    }
    setBusy(true);
    try {
      await submit({
        inviteId: inviteId as any,
        responses,
        recommendation,
        voiceInputs: voiceInputs.length > 0 ? voiceInputs : undefined,
        submittedFromPlatform: Platform.OS === "ios" ? "mobile_ios" : "mobile_android",
      });
      navigation.reset({ index: 0, routes: [{ name: "EvaluatorTabs" }] });
    } catch (err) {
      Alert.alert("Could not submit", err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  if (!invite || !template) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas, justifyContent: "center" }}>
        <Text style={{ textAlign: "center", color: colors.inkSecondary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 140 }}>
        {fields.map((f) => {
          if (f.type === "score_1_5" || f.type === "score_1_10") {
            return (
              <ScoreField
                key={f.key}
                label={f.label}
                type={f.type}
                value={responses[f.key] as number | undefined}
                onChange={(n) => update(f.key, n)}
              />
            );
          }
          if (f.type === "text") {
            return (
              <TextField
                key={f.key}
                label={f.label}
                value={(responses[f.key] as string) ?? ""}
                onChange={(s) => update(f.key, s)}
                allowDictation={f.allowDictation ?? false}
                onMicPress={() => setDictationField(f)}
              />
            );
          }
          if (f.type === "choice") {
            return (
              <ChoiceField
                key={f.key}
                label={f.label}
                choices={f.choices ?? []}
                value={responses[f.key] as string | undefined}
                onChange={(c) => update(f.key, c)}
              />
            );
          }
          return null;
        })}
        <RecommendationButtons value={recommendation} onChange={setRecommendation} />
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 0, right: 0, bottom: 0,
          padding: space[4],
          backgroundColor: colors.surfaceFloating,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
        }}
      >
        <PressableButton size="lg" onPress={onSubmit} disabled={busy}>
          {busy ? "Submitting..." : "Submit evaluation"}
        </PressableButton>
      </View>

      {/* DictationOverlay is mounted in T26. For now the mic button no-ops if no overlay is rendered. */}
      {dictationField && (
        <View
          style={{
            position: "absolute", inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <View style={{ backgroundColor: colors.surface, padding: space[4], borderRadius: 12 }}>
            <Text style={{ color: colors.ink, marginBottom: space[3] }}>Dictation overlay (mounted in T26)</Text>
            <PressableButton variant="ghost" onPress={() => setDictationField(null)}>Close</PressableButton>
          </View>
        </View>
      )}
    </View>
  );
}
```

This compiles and runs without the dictation overlay. Phase 10 wires it in.

- [ ] **Step 5: Run test, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test screens/evaluation-form`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/screens/evaluation-form.tsx convex/evaluationInvites.ts convex/_generated/ mobile/__tests__/screens/evaluation-form.test.tsx
git commit -m "feat(mobile): EvaluationFormScreen renders template and submits"
```

---

## Phase 10: On-device dictation

### Task 25: `useMobileSpeechRecognition` hook (expo-speech-recognition wrapper)

**Files:**
- Modify: `mobile/package.json` — add `expo-speech-recognition`
- Create: `mobile/src/hooks/use-mobile-speech-recognition.ts`
- Create: `mobile/__tests__/hooks/use-mobile-speech-recognition.test.tsx`

`expo-speech-recognition` is a community library wrapping iOS `SFSpeechRecognizer` and Android `SpeechRecognizer`. It exposes `ExpoSpeechRecognitionModule.start()` and event listeners. The hook smooths the API into start/stop + observable interim/final transcript.

- [ ] **Step 1: Install**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun add expo-speech-recognition`
Expected: installed.

- [ ] **Step 2: Mock it in `jest.setup.ts`**

Append to `mobile/jest.setup.ts`:

```ts
jest.mock("expo-speech-recognition", () => {
  const listeners: Record<string, ((e: any) => void)[]> = {};
  return {
    ExpoSpeechRecognitionModule: {
      requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
      start: jest.fn(),
      stop: jest.fn(),
    },
    useSpeechRecognitionEvent: (name: string, cb: (e: any) => void) => {
      if (!listeners[name]) listeners[name] = [];
      listeners[name].push(cb);
    },
    __emit: (name: string, e: any) => (listeners[name] ?? []).forEach((cb) => cb(e)),
  };
});
```

- [ ] **Step 3: Write the failing test**

Create `mobile/__tests__/hooks/use-mobile-speech-recognition.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react-native";
import { useMobileSpeechRecognition } from "@/hooks/use-mobile-speech-recognition";

const speech = jest.requireMock("expo-speech-recognition") as any;

describe("useMobileSpeechRecognition", () => {
  it("starts listening and accumulates final transcript over multiple events", async () => {
    const { result } = renderHook(() => useMobileSpeechRecognition({ language: "en-IN" }));
    await act(async () => await result.current.start());
    act(() => speech.__emit("result", { isFinal: true, results: [{ transcript: "Priya was strong." }] }));
    act(() => speech.__emit("result", { isFinal: true, results: [{ transcript: " She paced well." }] }));
    expect(result.current.finalTranscript).toBe("Priya was strong. She paced well.");
  });

  it("captures interim transcripts separately", async () => {
    const { result } = renderHook(() => useMobileSpeechRecognition({ language: "en-IN" }));
    await act(async () => await result.current.start());
    act(() => speech.__emit("result", { isFinal: false, results: [{ transcript: "partial..." }] }));
    expect(result.current.interim).toBe("partial...");
    expect(result.current.finalTranscript).toBe("");
  });

  it("stop sets listening to false", async () => {
    const { result } = renderHook(() => useMobileSpeechRecognition({ language: "en-IN" }));
    await act(async () => await result.current.start());
    expect(result.current.listening).toBe(true);
    act(() => result.current.stop());
    expect(result.current.listening).toBe(false);
  });
});
```

- [ ] **Step 4: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test use-mobile-speech-recognition`
Expected: FAIL.

- [ ] **Step 5: Implement the hook**

Create `mobile/src/hooks/use-mobile-speech-recognition.ts`:

```ts
import { useCallback, useRef, useState } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

export function useMobileSpeechRecognition({ language = "en-IN" }: { language?: string } = {}) {
  const [interim, setInterim] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const startedAt = useRef<number>(0);

  useSpeechRecognitionEvent("result", (e: any) => {
    const text = e?.results?.[0]?.transcript ?? "";
    if (e?.isFinal) setFinalTranscript((prev) => prev + text);
    else setInterim(text);
  });

  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("error", () => setListening(false));

  const start = useCallback(async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return false;
    setInterim("");
    setFinalTranscript("");
    startedAt.current = Date.now();
    ExpoSpeechRecognitionModule.start({
      lang: language,
      interimResults: true,
      continuous: true,
    });
    setListening(true);
    return true;
  }, [language]);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
    setListening(false);
  }, []);

  const durationSec = () => Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));

  return { interim, finalTranscript, listening, start, stop, durationSec };
}
```

- [ ] **Step 6: Run test, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test use-mobile-speech-recognition`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/package.json mobile/bun.lock mobile/src/hooks/use-mobile-speech-recognition.ts mobile/jest.setup.ts mobile/__tests__/hooks/use-mobile-speech-recognition.test.tsx
git commit -m "feat(mobile): on-device speech recognition hook"
```

---

### Task 26: DictationOverlay component

**Files:**
- Create: `mobile/src/components/evaluations/dictation-overlay.tsx`
- Create: `mobile/__tests__/components/dictation-overlay.test.tsx`

- [ ] **Step 1: Write failing test**

Create `mobile/__tests__/components/dictation-overlay.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { DictationOverlay } from "@/components/evaluations/dictation-overlay";

const summarize = jest.fn().mockResolvedValue({ summaryPoints: ["a", "b", "c"], language: "en-IN" });
jest.mock("convex/react", () => ({
  useAction: () => summarize,
}));
jest.mock("@convex/_generated/api", () => ({
  api: { voiceProcessing: { summarizeTranscript: "voiceProcessing:summarizeTranscript" } },
}));

const speech = jest.requireMock("expo-speech-recognition") as any;

describe("DictationOverlay", () => {
  beforeEach(() => summarize.mockClear());

  it("shows interim transcript while listening", async () => {
    render(<DictationOverlay fieldKey="comments" language="en-IN" onComplete={jest.fn()} onCancel={jest.fn()} />);
    act(() => speech.__emit("result", { isFinal: false, results: [{ transcript: "partial..." }] }));
    expect(screen.getByText("partial...")).toBeTruthy();
  });

  it("on stop summarizes and calls onComplete with the capture", async () => {
    const onComplete = jest.fn();
    render(<DictationOverlay fieldKey="comments" language="en-IN" onComplete={onComplete} onCancel={jest.fn()} />);
    act(() => speech.__emit("result", { isFinal: true, results: [{ transcript: "Priya was strong." }] }));
    fireEvent.press(screen.getByLabelText("stop-dictation"));
    await waitFor(() => expect(summarize).toHaveBeenCalled());
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      fieldKey: "comments",
      transcript: "Priya was strong.",
      summaryPoints: ["a", "b", "c"],
      language: "en-IN",
    }));
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test dictation-overlay`
Expected: FAIL.

- [ ] **Step 3: Implement DictationOverlay**

Create `mobile/src/components/evaluations/dictation-overlay.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { useMobileSpeechRecognition } from "@/hooks/use-mobile-speech-recognition";
import { colors, fonts, radii, space } from "@/theme";

type Capture = {
  fieldKey: string;
  transcript: string;
  summaryPoints: string[];
  language: string;
  durationSec: number;
  processedAt: number;
};

export function DictationOverlay({
  fieldKey,
  language,
  onComplete,
  onCancel,
}: {
  fieldKey: string;
  language: string;
  onComplete: (capture: Capture) => void;
  onCancel: () => void;
}) {
  const { interim, finalTranscript, listening, start, stop, durationSec } =
    useMobileSpeechRecognition({ language });
  const summarize = useAction(api.voiceProcessing.summarizeTranscript);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await start();
      if (!ok && mounted) onCancel();
    })();
    return () => {
      mounted = false;
      stop();
    };
  }, [start, stop, onCancel]);

  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [listening]);

  async function finish() {
    stop();
    if (!finalTranscript.trim()) {
      onCancel();
      return;
    }
    setBusy(true);
    try {
      const result = await summarize({
        transcript: finalTranscript.trim(),
        fieldKey,
        language,
        durationSec: durationSec(),
      });
      onComplete({
        fieldKey,
        transcript: finalTranscript.trim(),
        summaryPoints: result.summaryPoints,
        language: result.language,
        durationSec: durationSec(),
        processedAt: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.92)", padding: space[6], alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: 96, height: 96, borderRadius: radii.pill,
          backgroundColor: colors.danger,
          alignItems: "center", justifyContent: "center",
          marginBottom: space[6],
          opacity: listening ? 1 : 0.4,
        }}
      >
        <Ionicons name="mic" size={36} color={colors.inverse} />
      </View>
      <Text style={{ color: colors.inverse, fontSize: fonts.size.lg, fontWeight: fonts.weight.semibold }}>
        {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
      </Text>
      <Text style={{ color: colors.inverse, marginTop: space[4], textAlign: "center", maxWidth: 320, minHeight: 60 }}>
        {interim || finalTranscript || "Listening..."}
      </Text>
      <Text style={{ color: colors.inkTertiary, fontSize: fonts.size.xs, marginTop: space[2] }}>
        Detected language: {language}
      </Text>

      <View style={{ flexDirection: "row", marginTop: space[8], gap: space[4] }}>
        <Pressable
          accessibilityLabel="cancel-dictation"
          onPress={() => { stop(); onCancel(); }}
          style={{ paddingHorizontal: space[5], paddingVertical: space[3], borderRadius: radii.pill, borderWidth: 1, borderColor: colors.inverse }}
        >
          <Text style={{ color: colors.inverse, fontWeight: fonts.weight.semibold }}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="stop-dictation"
          onPress={finish}
          disabled={busy}
          style={{
            paddingHorizontal: space[5], paddingVertical: space[3],
            borderRadius: radii.pill, backgroundColor: colors.inverse,
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Text style={{ color: colors.ink, fontWeight: fonts.weight.semibold }}>
            {busy ? "Summarizing..." : "Stop"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test dictation-overlay`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/evaluations/dictation-overlay.tsx mobile/__tests__/components/dictation-overlay.test.tsx
git commit -m "feat(mobile): dictation overlay with on-device STT + summary"
```

---

### Task 27: Wire DictationOverlay into EvaluationFormScreen

**Files:**
- Modify: `mobile/src/screens/evaluation-form.tsx` — replace the placeholder overlay with the real one
- Modify: `mobile/__tests__/screens/evaluation-form.test.tsx` — add an interaction test

- [ ] **Step 1: Replace the placeholder overlay**

Edit `mobile/src/screens/evaluation-form.tsx`. Remove the placeholder overlay block (the `<View>...{"Dictation overlay (mounted in T26)"}</View>` block) and replace with:

```tsx
{dictationField && (
  <DictationOverlay
    fieldKey={dictationField.key}
    language="en-IN"
    onComplete={(capture) => handleDictationResult(dictationField, capture)}
    onCancel={() => setDictationField(null)}
  />
)}
```

Add the import at the top:

```tsx
import { DictationOverlay } from "@/components/evaluations/dictation-overlay";
```

- [ ] **Step 2: Append interaction test**

Append to `mobile/__tests__/screens/evaluation-form.test.tsx`:

```tsx
import { act } from "@testing-library/react-native";
const speech = jest.requireMock("expo-speech-recognition") as any;

describe("EvaluationFormScreen dictation", () => {
  it("captures dictation result into the comments field", async () => {
    render(withNav(
      <EvaluationFormScreen
        navigation={{ goBack: jest.fn(), reset: jest.fn(), navigate: jest.fn() } as any}
        route={{ params: { inviteId: "i1", demoId: "d1" } } as any}
      />,
    ));
    fireEvent.press(screen.getByLabelText("dictate"));
    act(() => speech.__emit("result", { isFinal: true, results: [{ transcript: "Strong delivery." }] }));
    fireEvent.press(screen.getByLabelText("stop-dictation"));
    await waitFor(() => expect(screen.queryByLabelText("stop-dictation")).toBeNull());
    // The comments TextInput now contains the joined summary bullets.
    expect(screen.getByPlaceholderText("Type your notes...").props.value).toBe("a\nb\nc");
  });
});
```

- [ ] **Step 3: Run tests, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test screens/evaluation-form dictation-overlay`
Expected: PASS — all four tests green.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/screens/evaluation-form.tsx mobile/__tests__/screens/evaluation-form.test.tsx
git commit -m "feat(mobile): wire DictationOverlay into evaluation form"
```

---

## Phase 11: Profile expansion + notification toggle

### Task 28: Profile screen — notification permission status + sign-out

**Files:**
- Modify: `mobile/src/screens/profile.tsx`
- Modify: `mobile/__tests__/screens/profile-signout.test.tsx` — extend with notification permission test

- [ ] **Step 1: Add a notification permission row test**

Append to `mobile/__tests__/screens/profile-signout.test.tsx`:

```tsx
import * as Notifications from "expo-notifications";

describe("ProfileScreen notification permission", () => {
  it("shows 'Enabled' when expo-notifications reports granted", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: "granted" });
    const { findByText } = render(<ProfileScreen />);
    expect(await findByText("Enabled")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test profile-signout`
Expected: FAIL — "Enabled" not present.

- [ ] **Step 3: Implement the expanded Profile**

Replace `mobile/src/screens/profile.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PressableButton } from "@/components/ui/pressable-button";
import { useSession } from "@/hooks/use-session";
import { colors, fonts, space } from "@/theme";

export function ProfileScreen() {
  const { user, signOut } = useSession();
  const [permission, setPermission] = useState<"granted" | "denied" | "undetermined">("undetermined");

  useEffect(() => {
    (async () => {
      const res = await Notifications.getPermissionsAsync();
      setPermission(res.status as "granted" | "denied" | "undetermined");
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceCanvas, padding: space[4] }}>
      <Card padding="lg">
        <Text style={{ fontSize: fonts.size.lg, fontWeight: fonts.weight.semibold, color: colors.ink }}>
          {user?.name ?? "Account"}
        </Text>
        <Text style={{ fontSize: fonts.size.sm, color: colors.inkSecondary, marginTop: space[1] }}>
          {user?.email ?? ""}
        </Text>
      </Card>

      <Card padding="md" style={{ marginTop: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: colors.ink, fontSize: fonts.size.md, fontWeight: fonts.weight.semibold }}>
              Push notifications
            </Text>
            <Text style={{ color: colors.inkSecondary, fontSize: fonts.size.xs, marginTop: 2 }}>
              We notify you when a form opens or an invite changes.
            </Text>
          </View>
          {permission === "granted" ? (
            <Badge tone="success">Enabled</Badge>
          ) : permission === "denied" ? (
            <Badge tone="danger">Disabled</Badge>
          ) : (
            <Badge tone="neutral">Not asked</Badge>
          )}
        </View>
        {permission === "denied" && (
          <View style={{ marginTop: space[3] }}>
            <PressableButton variant="ghost" onPress={() => Linking.openSettings()}>
              Open settings
            </PressableButton>
          </View>
        )}
      </Card>

      <View style={{ marginTop: space[6] }}>
        <PressableButton variant="secondary" onPress={signOut}>
          Sign out
        </PressableButton>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test profile-signout`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/profile.tsx mobile/__tests__/screens/profile-signout.test.tsx
git commit -m "feat(mobile): profile shows push permission status + open-settings"
```

---

## Phase 12: E2E (Maestro) + final smoke

### Task 29: Maestro flow — sign in to submit

**Files:**
- Create: `mobile/.maestro/inbox-to-submit.yaml`
- Create: `mobile/.maestro/README.md`

Maestro is an E2E tool that drives the device via the OS accessibility APIs. The flows here are skip-conditioned on whether `maestro` is installed and an `EXPO_SEED_EMAIL` env var is set. They mirror the Playwright skip-condition pattern used in Plans 1 and 2.

- [ ] **Step 1: Create the flow**

Create `mobile/.maestro/inbox-to-submit.yaml`:

```yaml
appId: app.rolerecruit.mobile
---
- launchApp
- assertVisible: "Send sign-in link"
- tapOn:
    id: "you@example.com"
- inputText: ${EXPO_SEED_EMAIL}
- tapOn: "Send sign-in link"
- assertVisible:
    text: "Check your inbox"
    timeout: 5000
# At this point the user follows the magic link from the dev mailbox. In CI,
# the seed script can stamp the session token directly via deep-link.
- openLink: "rolerecruit://?token=${EXPO_SEED_SESSION_TOKEN}"
- assertVisible:
    text: "Open now"
    timeout: 10000
- tapOn:
    text: "Priya"
    index: 0
- assertVisible: "Start evaluation"
- tapOn: "Start evaluation"
- tapOn:
    id: "score-4"
- tapOn:
    text: "Hire"
- tapOn: "Submit evaluation"
- assertVisible:
    text: "Open now"
    timeout: 5000
```

- [ ] **Step 2: Create the README**

Create `mobile/.maestro/README.md`:

```markdown
# Mobile E2E (Maestro)

These flows are skipped in CI unless `maestro` is installed and the required env vars are present:

- `EXPO_SEED_EMAIL` - the email seeded by `bun run seed:eval-demo`
- `EXPO_SEED_SESSION_TOKEN` - a pre-issued Better Auth session token bypassing magic link

Run locally:

```bash
maestro test mobile/.maestro/inbox-to-submit.yaml
maestro test mobile/.maestro/dictation.yaml
```

Skip-condition for CI: if `maestro --version` fails, skip the entire stage.
```

- [ ] **Step 3: Commit**

```bash
git add mobile/.maestro/
git commit -m "test(mobile): Maestro flow for inbox to submit"
```

---

### Task 30: Maestro flow — dictation capture

**Files:**
- Create: `mobile/.maestro/dictation.yaml`

The mic API is hard to drive deterministically in CI. This flow opens the dictation overlay and verifies the UI states; the actual transcription is dev-only manual.

- [ ] **Step 1: Create the flow**

Create `mobile/.maestro/dictation.yaml`:

```yaml
appId: app.rolerecruit.mobile
---
- launchApp
- openLink: "rolerecruit://?token=${EXPO_SEED_SESSION_TOKEN}"
- tapOn:
    text: "Priya"
    index: 0
- tapOn: "Start evaluation"
- tapOn:
    id: "dictate"
- assertVisible:
    text: "Detected language: en-IN"
    timeout: 5000
- tapOn:
    id: "cancel-dictation"
- assertNotVisible: "Detected language: en-IN"
```

- [ ] **Step 2: Commit**

```bash
git add mobile/.maestro/dictation.yaml
git commit -m "test(mobile): Maestro flow for dictation overlay"
```

---

### Task 31: Final smoke — typecheck + all tests + dev start

**Files:** none (verification only)

- [ ] **Step 1: Mobile typecheck**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun run typecheck`
Expected: zero errors. If errors mention missing types for `expo-speech-recognition`, add a one-line ambient declaration in `mobile/src/types/expo-speech-recognition.d.ts`:

```ts
declare module "expo-speech-recognition" {
  export const ExpoSpeechRecognitionModule: {
    requestPermissionsAsync(): Promise<{ granted: boolean }>;
    start(opts: { lang: string; interimResults: boolean; continuous: boolean }): void;
    stop(): void;
  };
  export function useSpeechRecognitionEvent(name: string, cb: (e: any) => void): void;
}
```

Re-run: `bun run typecheck`
Expected: pass.

- [ ] **Step 2: Mobile unit + component tests**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun test`
Expected: all tests pass.

- [ ] **Step 3: Backend tests**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bun run test`
Expected: all backend tests pass (existing + new Plan 3 tests).

- [ ] **Step 4: Convex codegen**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit && bunx convex codegen`
Expected: no errors. Mobile imports `@convex/_generated/api` and depends on this output.

- [ ] **Step 5: Start the dev server (manual verification)**

Run: `cd /Users/sumanthdaggubati/Dev/Rolerecruit/mobile && bun run start`
Expected: Expo dev server prints a QR code. Open Expo Go on iPhone/Android, scan, and verify the sign-in screen renders. Sign in with a seeded user, see the inbox load.

(Mobile dev server runs outside the harness preview tools; this is a one-time manual smoke. Do not block plan completion on a phone being present, but mark it on the developer's punch list.)

- [ ] **Step 6: Commit any final tweaks**

If there are uncommitted patches from Step 1 (the ambient `.d.ts`) or unrelated test fixes, stage and commit them:

```bash
git add mobile/src/types/ mobile/jest.setup.ts
git commit -m "chore(mobile): final smoke fixes for typecheck"
```

(If there are no uncommitted changes, skip this step.)

---

## Self-review

Run this check after completing all tasks, before invoking the finishing-a-development-branch skill.

**Spec coverage check (Section 3 — Mobile app):**
- Expo stack scaffolded — T1
- Convex React Native client wired — T5
- Better Auth Expo client + secure storage — T4
- expo-speech-recognition wired — T25-T27
- expo-notifications wired — T10 (registration) + T11-T13 (delivery)
- react-navigation bottom tabs + native stack — T14-T15, T20
- Role-aware bottom navigation (evaluator-only roles in this plan; HR roles deferred to Plan 4) — T14
- Inbox with Open-now / Upcoming sections + pull-to-refresh — T15-T17
- Calendar (list view; full month-grid view can layer in a later task without schema changes) — T18-T19
- Demo detail with candidate hero, other evaluators by name+status only, primary CTA, decline — T20-T21
- Evaluation form (template-driven, score/text/choice/recommendation, sticky submit, optimistic in_progress) — T22-T24
- Dictation overlay (dark, mic, timer, interim transcript, language line, summary on stop) — T26-T27
- Profile (account, notification permission, sign out) — T7 + T28

**Spec coverage check (Section 0 — STT pipeline):**
- Mobile uses `expo-speech-recognition` continuous + interim — T25
- Permission prompt on first use — T25 (`requestPermissionsAsync`)
- Transcript text + language code sent to Convex action — T26 calls `voiceProcessing.summarizeTranscript`
- No audio recorded or uploaded — confirmed by the API contract; transcript-only

**Spec coverage check (Section 8 — Testing):**
- Component tests with Jest + RNTL — every screen and component has a render test
- E2E with Maestro — T29-T30
- RBAC: evaluator-only tabs are the default; HR tabs gated to Plan 4

**Cross-plan dependencies satisfied:**
- `userProfiles.expoPushTokens` added (T8) — backward-compatible via `v.optional()`
- `sendPushNotification` upgraded from stub (T11)
- `sendDemoEvent` scheduled on create/cancel/swap (T12-T13)
- Mobile imports `@convex/_generated/api` which Plans 1 and 2 already populated

**Open spec items intentionally deferred to Plan 4:**
- HR-only bottom tabs (Candidates, Pipeline)
- Schedule Demo wizard (mobile)
- Demo Summary (mobile)
- Settings + Template editor (mobile)
- Bulk evaluator swap (mobile UI; backend already exists)

**Open spec risks acknowledged:**
- Better Auth Expo client maturity (spec note 1) — if blocked at T4, fall back to a `WebView` bridge sign-in that posts the session cookie back to `expo-secure-store`. Document at the failure point.
- iOS silent push delivery (spec note 2) — `useInbox` already re-renders on every Convex live update, providing the "foreground re-fetch" fallback the spec asks for.
- Web `SpeechRecognition` Chrome privacy concern (spec note 6) — not in scope for Plan 3; the mobile pipeline is fully on-device.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-28-evaluation-workflow-3-mobile-scaffold.md`. Two execution options:

1. **Subagent-Driven (recommended for a plan this size)** — Dispatch a fresh subagent per task with a two-stage review between tasks. Best for keeping context windows tight across 31 tasks.

2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans` with batch execution + checkpoints. Faster turnaround but more context pressure.

Which approach?


