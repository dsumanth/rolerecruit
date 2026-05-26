// tests/e2e/triage-happy-path.spec.ts
import { test, expect } from "@playwright/test";

/**
 * PREREQUISITES (set up in your fixture or beforeAll):
 * - A school with triageEnabled=true and slug "test-school"
 * - At least one active PGT Physics job at that school (slug "pgt-physics")
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
test.skip("strong-fit careers application surfaces in Auto-Shortlisted with draft outreach", async ({ page }) => {
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
});
