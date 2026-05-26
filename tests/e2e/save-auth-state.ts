/**
 * One-shot helper to record a Clerk auth state file for E2E tests.
 *
 * Usage:
 *   1. Make sure the dev server is running: `bun run dev` (on http://localhost:3000)
 *   2. Run: `bun tests/e2e/save-auth-state.ts`
 *   3. A Chromium window opens. Sign in manually as your hr_admin test user
 *      (or whatever role the triage specs need).
 *   4. Once you see /dashboard (or any logged-in page), come back to the terminal
 *      and press Enter.
 *   5. The script saves the browser storage state to
 *      tests/e2e/.auth/hr-admin.json and exits.
 *
 * After that:
 *   export CLERK_E2E_STORAGE_STATE=tests/e2e/.auth/hr-admin.json
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

  // Verify the user is actually authenticated
  const url = page.url();
  const cookies = await ctx.cookies();
  const hasClerkSession = cookies.some((c) => c.name.startsWith("__session") || c.name.includes("clerk"));

  if (!hasClerkSession) {
    console.warn("\n⚠  No Clerk session cookies detected. The saved state may not authenticate.");
    console.warn(`   Current URL: ${url}`);
    console.warn("   Sign in inside the browser first, THEN press Enter.");
  }

  await ctx.storageState({ path: STATE_PATH });
  console.log(`\n✓ Saved auth state to ${STATE_PATH}`);
  console.log(`✓ Found ${cookies.length} cookies, ${cookies.filter((c) => c.name.startsWith("__session") || c.name.includes("clerk")).length} Clerk-related.`);

  if (existsSync(STATE_PATH)) {
    console.log(`\nNext:`);
    console.log(`  export CLERK_E2E_STORAGE_STATE=${STATE_PATH}`);
    console.log(`  bun run test:e2e\n`);
  }

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
