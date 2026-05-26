/**
 * Playwright auth fixture — pre-authenticates as an hr_admin user via a
 * saved Clerk storage-state file.
 *
 * This project uses @clerk/nextjs for auth. @clerk/testing is NOT a direct
 * dependency, so we use the simpler storage-state approach instead.
 *
 * ── How to create the storage state file ─────────────────────────────────────
 *
 * 1. Start the dev servers:
 *      npx convex dev &
 *      npm run dev
 *
 * 2. Record an authenticated session with Playwright codegen:
 *      npx playwright codegen http://localhost:3000
 *    Log in as your hr_admin test user inside the browser that opens.
 *
 * 3. After login, save the browser state in your Node REPL or add a helper
 *    script:
 *      await page.context().storageState({ path: "tests/e2e/.auth/hr-admin.json" });
 *
 *    Alternatively, add a `saveState` helper test:
 *      // tests/e2e/save-auth-state.ts
 *      import { chromium } from "@playwright/test";
 *      (async () => {
 *        const browser = await chromium.launch({ headless: false });
 *        const ctx = await browser.newContext();
 *        const page = await ctx.newPage();
 *        await page.goto("http://localhost:3000");
 *        // Log in manually, then press Enter in the terminal
 *        await new Promise((r) => process.stdin.once("data", r));
 *        await ctx.storageState({ path: "tests/e2e/.auth/hr-admin.json" });
 *        await browser.close();
 *      })();
 *
 * 4. Set the env var:
 *      export CLERK_E2E_STORAGE_STATE=tests/e2e/.auth/hr-admin.json
 *
 * 5. The triage specs will now run automatically when this env var is set.
 *    Without it they remain skipped.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

export const test = base.extend<object, object>({
  storageState: async ({}, use) => {
    const path = process.env.CLERK_E2E_STORAGE_STATE;
    if (!path) {
      throw new Error(
        "CLERK_E2E_STORAGE_STATE env var must point to a Playwright storageState JSON.\n" +
          "Run `npx playwright codegen http://localhost:3000` while logged in as your\n" +
          "test hr_admin user and save the context state:\n" +
          "  await page.context().storageState({ path: 'tests/e2e/.auth/hr-admin.json' });\n" +
          "Then set:\n" +
          "  export CLERK_E2E_STORAGE_STATE=tests/e2e/.auth/hr-admin.json"
      );
    }
    await use(path);
  },
});
