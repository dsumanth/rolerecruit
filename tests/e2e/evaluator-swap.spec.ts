import { test, expect } from "./fixtures/auth";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Evaluator swap E2E.
 *
 *   HR opens demo summary → swap principal for backup principal → old invite
 *   cancelled, new invite issued, banner reflects the change.
 *
 * Runtime is currently DEFERRED for the same reason as evaluation-flow.spec.ts.
 */

const seedPath = join(__dirname, ".fixtures", "eval-seed.json");
const hasAuth = !!process.env.BETTER_AUTH_E2E_STORAGE_STATE;
const hasSeed = existsSync(seedPath);
const shouldRun = hasAuth && hasSeed;
const maybeTest = shouldRun ? test : test.skip;

type EvalSeed = {
  schoolId: string;
  appId: string;
  principalId: string;
  backupPrincipalId: string;
};

const seed: EvalSeed | null = hasSeed
  ? (JSON.parse(readFileSync(seedPath, "utf-8")) as EvalSeed)
  : null;

maybeTest(
  "HR swaps an unsubmitted evaluator from the demo summary",
  async ({ page }) => {
    if (!seed) throw new Error("seed must be defined when shouldRun is true");

    // Schedule a fresh demo with a single principal evaluator.
    await page.goto("/dashboard/pipeline");
    await page.getByRole("button", { name: /TGT Maths/i }).click();
    await page.getByText("E2E Candidate", { exact: true }).click();
    await page.getByRole("button", { name: /^Evaluate$/ }).click();
    await page.getByRole("button", { name: /^Schedule demo$/ }).click();
    await page.getByLabel(/^Date$/).fill("2030-03-01");
    await page.getByLabel(/^Time$/).fill("10:00");
    await page.getByLabel(/Duration \(minutes\)/).fill("30");
    await page.getByLabel(/^live$/).check();
    await page.getByLabel(/^classroom$/).check();
    await page.getByRole("button", { name: /^Next$/ }).click();
    await page.getByLabel(/Test Principal/).check();
    await page.getByRole("button", { name: /^Review$/ }).click();
    await page.getByRole("button", { name: /^Confirm$/ }).click();

    // Open the demo detail page from the DemosPanel link.
    await page.getByRole("link", { name: /2030/ }).click();
    await page.waitForURL(/\/dashboard\/demos\/[^/]+/);

    // Click the Swap button on the principal row.
    await page.getByRole("button", { name: /^Swap$/ }).first().click();
    await expect(page.getByRole("dialog", { name: /swap evaluator/i })).toBeVisible();

    await page.getByPlaceholder(/search by name/i).fill("Backup");
    await page.getByRole("button", { name: /Backup Principal/ }).click();
    await expect(page.getByText(/evaluator swapped/i)).toBeVisible();

    // After swap, the summary refreshes: invite tally shows 1 cancelled + 1 invited.
    await expect(page.getByText(/1 cancelled/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/1 invited/i)).toBeVisible();
  },
);
