// tests/e2e/triage-happy-path.spec.ts
import { test, expect } from "./fixtures/auth";

/**
 * PREREQUISITES (automated via global-setup.ts + fixtures/auth.ts):
 * - A running local Convex backend (`npx convex dev`)
 * - A running Next.js dev server (`bun run dev` on http://localhost:3000)
 * - Seeded test data: school slug "test-school", triageEnabled=true, active PGT Physics job
 *   — seeded automatically by the Playwright global setup.
 * - Clerk auth state for an hr_admin user:
 *   Set CLERK_E2E_STORAGE_STATE=tests/e2e/.auth/hr-admin.json
 *   See tests/e2e/README.md for how to generate this file.
 *
 * If CLERK_E2E_STORAGE_STATE is not set, the test is skipped (preserving original behaviour).
 */

const shouldRun = !!process.env.CLERK_E2E_STORAGE_STATE;
const maybeTest = shouldRun ? test : test.skip;

maybeTest(
  "strong-fit careers application surfaces in Auto-Shortlisted with draft outreach",
  async ({ page }) => {
    // Step 1: candidate submits application via careers site
    await page.goto("/careers/test-school/jobs/pgt-physics");
    await page.fill('[name="name"]', "Priya Sharma");
    await page.fill('[name="email"]', "priya@example.com");
    await page.fill('[name="phone"]', "+919876543210");
    await page.fill('[name="qualifications"]', "B.Ed, M.Sc Physics");
    await page.fill('[name="subjects"]', "Physics");
    await page.fill('[name="boardExperience"]', "CBSE");
    await page.fill('[name="yearsExperience"]', "7");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Application received")).toBeVisible({ timeout: 5000 });

    // Step 2: recruiter sees auto-shortlisted in queue
    await page.goto("/dashboard/triage");
    await page.click("text=Auto-Shortlisted");
    await expect(page.locator("text=Priya Sharma").first()).toBeVisible({ timeout: 15000 });
    await page.locator("text=Show draft outreach").first().click();
    await expect(page.locator("pre").first()).toContainText(/priya/i);
  }
);
