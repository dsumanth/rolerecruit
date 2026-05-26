import { test, expect } from "./fixtures/auth";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Happy path: a strong-fit candidate applies via the careers site, the Triage
 * Agent auto-scores them across all open roles at the school, and the
 * recruiter sees them in the Triage Queue.
 *
 * Requires globalSetup to have seeded a PGT Physics job at /careers/test-school
 * (via `convex/seed.ts:seedE2E`). Job IDs are read from tests/e2e/.fixtures/seed.json.
 *
 * Requires CLERK_E2E_STORAGE_STATE for the dashboard assertion (auth-gated).
 * Run `bun tests/e2e/save-auth-state.ts` to record one. The conditional skip
 * below preserves original behaviour when the env var is absent.
 */

const shouldRun = !!process.env.CLERK_E2E_STORAGE_STATE;
const maybeTest = shouldRun ? test : test.skip;

const seedPath = join(__dirname, ".fixtures", "seed.json");
const seed = JSON.parse(readFileSync(seedPath, "utf-8")) as {
  schoolId: string;
  pgtPhysicsJobId: string;
  tgtScienceJobId: string;
};

maybeTest(
  "strong-fit careers application surfaces in the Triage Queue",
  async ({ page }) => {
    // Step 1 — candidate submits application via the JOB-specific careers page
    await page.goto(`/careers/test-school/jobs/${seed.pgtPhysicsJobId}`);

    await page.getByPlaceholder("Rajesh Kumar").fill("Priya Sharma");
    await page.getByPlaceholder("rajesh@email.com").fill("priya@example.com");
    await page.getByPlaceholder("9876543210").fill("9876543210");
    await page.getByPlaceholder("B.Ed, M.Sc Physics").fill("B.Ed, M.Sc Physics");
    await page.getByPlaceholder("Physics, Mathematics").fill("Physics");
    await page.getByPlaceholder("CBSE, ICSE").fill("CBSE");
    await page.getByPlaceholder("5").fill("7");

    await page.getByRole("button", { name: /submit application/i }).click();
    await expect(page.getByText("Application submitted")).toBeVisible({ timeout: 10_000 });

    // Step 2 — recruiter sees Priya in the triage queue. The triage agent runs
    // asynchronously (scheduled action) and uses the LLM for scoring; outcome
    // can be auto_shortlisted (with DeepSeek+OpenAI keys) or human_review (in
    // local dev without keys). Either is a successful triage run.
    await page.goto("/dashboard/triage");

    // Iterate across the four outcome tabs to find Priya wherever she landed.
    const tabs = ["Needs Review", "Auto-Shortlisted", "Auto-Rejected", "Cross-Role"];
    let found = false;
    for (let attempt = 0; attempt < 6 && !found; attempt++) {
      for (const tab of tabs) {
        await page.getByRole("button", { name: tab }).click();
        if (await page.getByText("Priya Sharma").first().isVisible().catch(() => false)) {
          found = true;
          break;
        }
      }
      if (!found) {
        await page.waitForTimeout(5_000); // give the scheduled triage time to run
        await page.reload();
      }
    }
    expect(found).toBe(true);
  },
);
