import { test, expect } from "./fixtures/auth";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Happy path: a strong-fit candidate applies via the careers site, the Triage
 * Agent runs asynchronously, and writes a triageDecisions row to Convex.
 *
 * Verifies the FULL backend pipeline: form submit → candidate created → intake
 * parse → triage scoring → decision row. We poll Convex directly rather than
 * the dashboard UI because the test storageState user typically belongs to a
 * different school than the seeded "Test School" (their dashboard queue would
 * be filtered to their own school).
 *
 * Setup: seed via Playwright globalSetup (uses convex/seed.ts:seedE2E).
 * The dashboard UI is verified manually in the smoke-test path documented in
 * tests/e2e/README.md.
 */

const shouldRun = !!process.env.BETTER_AUTH_E2E_STORAGE_STATE;
const maybeTest = shouldRun ? test : test.skip;

const seedPath = join(__dirname, ".fixtures", "seed.json");
const seed = JSON.parse(readFileSync(seedPath, "utf-8")) as {
  schoolId: string;
  pgtPhysicsJobId: string;
  tgtScienceJobId: string;
};

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210";

async function queryConvex<T = any>(path: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const json = (await res.json()) as { status: string; value?: T; errorMessage?: string };
  if (json.status !== "success") throw new Error(json.errorMessage ?? "Convex query failed");
  return json.value as T;
}

maybeTest(
  "strong-fit careers application surfaces in the Triage Queue (Convex-verified)",
  async ({ page }) => {
    // Triage runs an LLM intake parse (DeepSeek) which can take 10-20s.
    test.setTimeout(180_000);

    // Step 1 — submit the careers application
    await page.goto(`/careers/test-school/jobs/${seed.pgtPhysicsJobId}`);

    await page.getByPlaceholder("Rajesh Kumar").fill("Priya Sharma");
    await page.getByPlaceholder("rajesh@email.com").fill("priya@example.com");
    await page.getByPlaceholder("9876543210").fill("9876543210");
    await page.getByPlaceholder("B.Ed, M.Sc Physics").fill("B.Ed, M.Sc Physics");
    await page.getByPlaceholder("Physics, Mathematics").fill("Physics");
    await page.getByPlaceholder("CBSE, ICSE").fill("CBSE");
    await page.getByPlaceholder("5", { exact: true }).fill("7");

    await page.getByRole("button", { name: /submit application/i }).click();
    await expect(page.getByText("Application submitted")).toBeVisible({ timeout: 10_000 });

    // Step 2 — poll Convex directly until the Triage Agent writes a decision row
    // for the new application. The triage agent fires via ctx.scheduler.runAfter
    // and takes 10-20s to complete (intake parse + per-role scoring).
    let queue: any[] = [];
    let priya: any = null;
    for (let attempt = 0; attempt < 30 && !priya; attempt++) {
      queue = await queryConvex<any[]>("triage:queueForSchool", {
        schoolId: seed.schoolId,
        limit: 50,
      });
      priya = queue.find((item) => item.candidate?.name === "Priya Sharma");
      if (!priya) await new Promise((r) => setTimeout(r, 3_000));
    }

    expect(priya, "Priya Sharma should appear in test-school triage queue").toBeTruthy();
    expect(priya.application.triageOutcome).toBeDefined();
    expect(priya.decision).toBeDefined();
    expect(priya.decision.hybridWeights).toBeDefined();
    expect(priya.decision.hybridWeights.w_struct).toBe(0.5);
    expect(priya.decision.hybridWeights.w_sem).toBe(0.3);
    expect(priya.decision.hybridWeights.w_rules).toBe(0.2);
  },
);
