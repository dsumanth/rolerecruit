import { test, expect } from "./fixtures/auth";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Decision-rule auto-apply E2E.
 *
 *   HR schedules demo w/ rule → all evaluators hire → application auto-advances
 *
 * Runtime is currently DEFERRED for the same reason as evaluation-flow.spec.ts
 * (shared dev Convex deployment with a parallel session). The spec is the
 * deliverable; see that file's header for runtime preconditions.
 */

const seedPath = join(__dirname, ".fixtures", "eval-seed.json");
const hasAuth = !!process.env.BETTER_AUTH_E2E_STORAGE_STATE;
const hasSeed = existsSync(seedPath);
const shouldRun = hasAuth && hasSeed;
const maybeTest = shouldRun ? test : test.skip;

type EvalSeed = {
  schoolId: string;
  candidateId: string;
  jobId: string;
  appId: string;
  principalId: string;
  hodId: string;
  backupPrincipalId: string;
  ruleId: string;
};

const seed: EvalSeed | null = hasSeed
  ? (JSON.parse(readFileSync(seedPath, "utf-8")) as EvalSeed)
  : null;

maybeTest(
  "schedule with decision rule -> all hire -> auto-advance",
  async ({ page, context }) => {
    if (!seed) throw new Error("seed must be defined when shouldRun is true");

    await page.goto("/dashboard/pipeline");
    await page.getByRole("button", { name: /TGT Maths/i }).click();
    await page.getByText("E2E Candidate", { exact: true }).click();
    await page.getByRole("button", { name: /^Evaluate$/ }).click();
    await page.getByRole("button", { name: /^Schedule demo$/ }).click();

    await page.getByLabel(/^Date$/).fill("2030-01-01");
    await page.getByLabel(/^Time$/).fill("10:00");
    await page.getByLabel(/Duration \(minutes\)/).fill("30");
    await page.getByLabel(/^live$/).check();
    await page.getByLabel(/^classroom$/).check();
    await page.getByRole("button", { name: /^Next$/ }).click();

    await page.getByLabel(/Test Principal/).check();
    await page.getByLabel(/Test HOD/).check();
    await page.getByRole("button", { name: /^Review$/ }).click();

    // Pick the rule from the optional dropdown on the review step.
    await page
      .getByLabel(/decision rule/i)
      .selectOption({ label: "Standard hire path" });
    await page.getByRole("button", { name: /^Confirm$/ }).click();
    await expect(page.getByText(/scheduled/i).first()).toBeVisible();

    // Submit "hire" for both evaluators in fresh contexts.
    for (let i = 0; i < 2; i++) {
      const tokenUrl = await page.evaluate(async (index) => {
        const res = await fetch(`/api/test/last-invite-url?index=${index}`);
        const json = (await res.json()) as { url: string };
        return json.url;
      }, i);
      const evaluatorContext = await context.browser()!.newContext();
      const evalPage = await evaluatorContext.newPage();
      await evalPage.goto(tokenUrl);
      await evalPage.waitForURL(/\/evaluations\/[^/]+\?token=/);
      await evalPage
        .getByRole("button", { name: /^Score 4 for subject knowledge$/ })
        .click();
      // Principal & HOD templates both have a "communication" field; the
      // remaining required fields differ per role. The form's required-field
      // validation will surface if a field is missed.
      await evalPage.getByRole("button", { name: /^Hire$/ }).click();
      await evalPage.getByRole("button", { name: /^Submit evaluation$/ }).click();
      await evalPage.waitForURL(/\/evaluations(\?|$)/);
      await evaluatorContext.close();
    }

    // Demo detail should now show the auto-applied banner + Advanced badge.
    await page.reload();
    await page.getByRole("button", { name: /^Evaluate$/ }).click();
    await page.getByRole("link", { name: /2030/ }).click();
    await page.waitForURL(/\/dashboard\/demos\/[^/]+/);
    await expect(page.getByText(/auto-decided/i)).toBeVisible();
    await expect(page.getByText(/advanced/i).first()).toBeVisible();
  },
);
