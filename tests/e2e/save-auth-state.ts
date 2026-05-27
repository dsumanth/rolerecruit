/**
 * One-shot helper to record a Better Auth session cookie file for E2E tests.
 *
 * Usage:
 *   1. Start the dev server: `bun run dev` (on http://localhost:3000)
 *   2. Make sure your test hr_admin user exists (sign up, verify email,
 *      complete /onboarding).
 *   3. Run: `bun tests/e2e/save-auth-state.ts`
 *   4. A Chromium window opens. Sign in as your hr_admin user.
 *   5. Once you reach /dashboard, come back to the terminal and press Enter.
 *   6. The script saves the browser storage state to
 *      tests/e2e/.auth/hr-admin.json and exits.
 *
 * After that:
 *   export BETTER_AUTH_E2E_STORAGE_STATE=tests/e2e/.auth/hr-admin.json
 *   bun run test:e2e
 *
 * The .auth/ directory is gitignored so the file never gets committed.
 */

import { chromium } from "@playwright/test";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const STATE_PATH = "tests/e2e/.auth/hr-admin.json";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

async function main() {
  mkdirSync(dirname(STATE_PATH), { recursive: true });

  console.log(`\nOpening Chromium → ${APP_URL}`);
  console.log("→ Sign in as your hr_admin user.");
  console.log("→ Once you reach the dashboard, come back here and press Enter.\n");

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await page.goto(APP_URL);
  } catch (err) {
    console.error(`\nFailed to reach ${APP_URL}. Is the dev server running?`);
    console.error(err);
    await browser.close();
    process.exit(1);
  }

  // Wait for user to press Enter
  await new Promise<void>((resolve) => {
    process.stdin.setRawMode?.(false);
    process.stdin.resume();
    process.stdin.once("data", () => resolve());
  });

  // Verify the user is actually authenticated by looking for the Better Auth
  // session cookie. The default cookie name is `better-auth.session_token`.
  const url = page.url();
  const cookies = await ctx.cookies();
  const sessionCookie = cookies.find((c) => c.name === "better-auth.session_token");

  if (!sessionCookie) {
    console.warn("\n⚠  No Better Auth session cookie detected. The saved state may not authenticate.");
    console.warn(`   Current URL: ${url}`);
    console.warn("   Sign in inside the browser first, THEN press Enter.");
  }

  await ctx.storageState({ path: STATE_PATH });
  console.log(`\n✓ Saved auth state to ${STATE_PATH}`);
  console.log(
    `✓ Found ${cookies.length} cookies${sessionCookie ? " (including better-auth.session_token)" : ""}.`
  );

  if (existsSync(STATE_PATH)) {
    console.log(`\nNext:`);
    console.log(`  export BETTER_AUTH_E2E_STORAGE_STATE=${STATE_PATH}`);
    console.log(`  bun run test:e2e\n`);
  }

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
