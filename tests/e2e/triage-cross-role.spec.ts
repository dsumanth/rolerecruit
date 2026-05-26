// tests/e2e/triage-cross-role.spec.ts
import { test, expect } from "@playwright/test";

/**
 * PREREQUISITES:
 * - A school with triageEnabled=true and slug "test-school"
 * - BOTH a PGT Physics job (slug "pgt-physics") AND a TGT Science job open at that school
 * - An hr_admin user authenticated for /dashboard routes
 *
 * To un-skip: seed the above via Convex dashboard or a seed script,
 * ensure the dev server is running (`bun run dev`), then remove `.skip`.
 *
 * Auth note: this project uses Clerk. For E2E auth you'll need either:
 *   - A Clerk test-mode account (CLERK_SECRET_KEY set to test key), or
 *   - A Playwright storage-state fixture that captures a logged-in session.
 * See https://clerk.com/docs/testing/playwright for guidance.
 */
test.skip("applicant for one role appears as cross-role for another open role", async ({ page }) => {
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
});
