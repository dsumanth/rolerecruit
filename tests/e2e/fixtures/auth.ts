/**
 * Playwright auth fixture — pre-authenticates as an hr_admin user via a saved
 * Better Auth storage-state file (the cookie jar from a real sign-in).
 *
 * The triage specs depend on this fixture. They are skipped unless
 * BETTER_AUTH_E2E_STORAGE_STATE is set.
 *
 * ── How to create the storage state file ─────────────────────────────────────
 *
 * 1. Start the dev servers:
 *      bunx convex dev &
 *      bun run dev
 *
 * 2. Make sure your test hr_admin user exists in the Better Auth backend
 *    (sign up via /sign-up, verify the email link, then complete /onboarding
 *    to seed userProfiles).
 *
 * 3. Run the helper to record the session cookie:
 *      bun tests/e2e/save-auth-state.ts
 *    A Chromium window opens. Sign in. Press Enter back in the terminal.
 *
 * 4. Set the env var:
 *      export BETTER_AUTH_E2E_STORAGE_STATE=tests/e2e/.auth/hr-admin.json
 *
 * 5. The triage specs will now run automatically:
 *      bun run test:e2e
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

export const test = base.extend<object, object>({
  storageState: async ({}, use) => {
    const path = process.env.BETTER_AUTH_E2E_STORAGE_STATE;
    if (!path) {
      throw new Error(
        "BETTER_AUTH_E2E_STORAGE_STATE env var must point to a Playwright storageState JSON.\n" +
          "Run `bun tests/e2e/save-auth-state.ts` while logged in as your test hr_admin user,\n" +
          "then:\n" +
          "  export BETTER_AUTH_E2E_STORAGE_STATE=tests/e2e/.auth/hr-admin.json"
      );
    }
    await use(path);
  },
});
