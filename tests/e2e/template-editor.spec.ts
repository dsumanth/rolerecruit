import { test, expect } from "./fixtures/auth";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Template editor E2E.
 *
 *   HR edits the principal template → schedules a new demo → new field appears
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
};

const seed: EvalSeed | null = hasSeed
  ? (JSON.parse(readFileSync(seedPath, "utf-8")) as EvalSeed)
  : null;

maybeTest(
  "HR edits principal template, new demo uses the new field",
  async ({ page }) => {
    if (!seed) throw new Error("seed must be defined when shouldRun is true");

    await page.goto("/dashboard/settings/templates");
    // First "Edit" button on the list is for Principal.
    await page.getByRole("link", { name: /Edit Principal template/i }).click();

    await page.getByLabel(/^Template name$/).fill("Principal v2");
    await page.getByRole("button", { name: /^Add field$/ }).click();

    const fieldKey = page.getByLabel(/^Field key$/).last();
    await fieldKey.fill("rapport");
    const fieldLabel = page.getByLabel(/^Field label$/).last();
    await fieldLabel.fill("Rapport with students");

    await page.getByRole("button", { name: /^Save template$/ }).click();
    await expect(page.getByText(/template saved/i)).toBeVisible();

    // Schedule a new demo and check the new field renders on the invite form.
    await page.goto("/dashboard/pipeline");
    await page.getByRole("button", { name: /TGT Maths/i }).click();
    await page.getByText("E2E Candidate", { exact: true }).click();
    await page.getByRole("button", { name: /^Evaluate$/ }).click();
    await page.getByRole("button", { name: /^Schedule demo$/ }).click();
    await page.getByLabel(/^Date$/).fill("2030-02-01");
    await page.getByLabel(/^Time$/).fill("10:00");
    await page.getByLabel(/Duration \(minutes\)/).fill("30");
    await page.getByLabel(/^live$/).check();
    await page.getByLabel(/^classroom$/).check();
    await page.getByRole("button", { name: /^Next$/ }).click();
    await page.getByLabel(/Test Principal/).check();
    await page.getByRole("button", { name: /^Review$/ }).click();
    await page.getByRole("button", { name: /^Confirm$/ }).click();

    const tokenUrl = await page.evaluate(async () => {
      const res = await fetch("/api/test/last-invite-url");
      const json = (await res.json()) as { url: string };
      return json.url;
    });
    await page.goto(tokenUrl);
    await page.waitForURL(/\/evaluations\/[^/]+\?token=/);
    await expect(page.getByText(/rapport with students/i)).toBeVisible();
  },
);
