// tests/e2e/triage-cross-role.spec.ts
import { test, expect } from "./fixtures/auth";

/**
 * PREREQUISITES (automated via global-setup.ts + fixtures/auth.ts):
 * - A running local Convex backend (`npx convex dev`)
 * - A running Next.js dev server (`bun run dev` on http://localhost:3000)
 * - Seeded test data: school slug "test-school", triageEnabled=true,
 *   active PGT Physics job AND active TGT Science job
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
  "applicant for one role appears as cross-role for another open role",
  async ({ page }) => {
    await page.goto("/careers/test-school/jobs/pgt-physics");
    await page.fill('[name="name"]', "Ravi Kumar");
    await page.fill('[name="qualifications"]', "B.Ed, M.Sc Physics, B.Sc Chemistry");
    await page.fill('[name="subjects"]', "Physics, Chemistry, Biology");
    await page.fill('[name="boardExperience"]', "CBSE");
    await page.fill('[name="yearsExperience"]', "8");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Application received")).toBeVisible({ timeout: 5000 });

    await page.goto("/dashboard/triage");
    await page.click("text=Cross-Role");
    await expect(page.locator("text=Ravi Kumar").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=TGT Science").first()).toBeVisible();
  }
);
