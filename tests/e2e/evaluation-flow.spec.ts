import { test, expect } from "./fixtures/auth";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Full evaluation web flow E2E.
 *
 *   HR schedules demo → evaluator submits via token URL → HR decides "Advance"
 *
 * Runtime is currently DEFERRED: this worktree shares a Convex deployment with
 * a parallel session running on a different schema, so seeding here would
 * conflict. The spec is the deliverable; running it requires either:
 *
 *   1. This branch merging to main (unified schema), OR
 *   2. A dedicated dev Convex deployment provisioned for this worktree.
 *
 * Then:
 *
 *   export BETTER_AUTH_E2E_STORAGE_STATE=tests/e2e/.auth/hr-admin.json
 *   bun run seed:eval-demo > tests/e2e/.fixtures/eval-seed.json
 *   bun run test:e2e tests/e2e/evaluation-flow.spec.ts
 *
 * Notes on selectors:
 *   - The Evaluate tab + Schedule Demo CTA live behind the application drawer,
 *     which opens via clicking a row on /dashboard/pipeline. There is no
 *     URL-based deep-link to that drawer in Plan 1, so we drive it via UI.
 *   - The evaluation form's score buttons have aria-labels of the form
 *     `Score <n> for <field label lowercased>`. For a principal template the
 *     labels are: Subject knowledge, Classroom management, Communication,
 *     Overall fit. See convex/formTemplates.defaults.ts.
 *   - Decision modal buttons: "Advance", "Reject", "Re-demo", "Just record".
 *     "Make decision" is the CTA on /dashboard/demos/<id>.
 *
 * Skip conditions: requires both BETTER_AUTH_E2E_STORAGE_STATE and a seed JSON
 * written by `bun run seed:eval-demo`. When either is absent we skip rather
 * than fail; keeps CI green until the deployment story is resolved.
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
};

const seed: EvalSeed | null = hasSeed
  ? (JSON.parse(readFileSync(seedPath, "utf-8")) as EvalSeed)
  : null;

maybeTest(
  "HR schedules demo, evaluator submits via token, HR advances candidate",
  async ({ page, context }) => {
    if (!seed) throw new Error("seed must be defined when shouldRun is true");

    // ── 1. HR opens the application drawer via the Pipeline page ───────────
    await page.goto("/dashboard/pipeline");

    // Pick the job in the sidebar so the pipeline table renders. The seed
    // creates a single "TGT Maths" job; if the test user's schoolId differs
    // from `seed.schoolId` the sidebar will be empty; that's a seed/auth
    // mismatch the operator must resolve before running.
    await page.getByRole("button", { name: /TGT Maths/i }).click();

    // Click the candidate row. The pipeline table renders candidate names as
    // cells; an exact name match opens the drawer via `setSelectedApp`.
    await page.getByText("E2E Candidate", { exact: true }).click();

    // ── 2. Switch to the Evaluate tab ──────────────────────────────────────
    await page.getByRole("button", { name: /^Evaluate$/ }).click();

    // ── 3. Open the Schedule Demo wizard ───────────────────────────────────
    await page.getByRole("button", { name: /^Schedule demo$/ }).click();

    // Step 0: when / mode / format. The wizard's date/time/duration inputs
    // are <Input> elements whose visible <label> text matches the regex.
    await page.getByLabel(/^Date$/).fill("2030-01-01");
    await page.getByLabel(/^Time$/).fill("10:00");
    await page.getByLabel(/Duration \(minutes\)/).fill("30");
    // Radios are <label><input type="radio" class="sr-only" />text</label>,
    // so `getByLabel` resolves the radio via its associating <label>.
    await page.getByLabel(/^live$/).check();
    await page.getByLabel(/^classroom$/).check();
    await page.getByRole("button", { name: /^Next$/ }).click();

    // Step 1: pick the Test Principal as the sole evaluator.
    await page.getByLabel(/Test Principal/).check();
    await page.getByRole("button", { name: /^Review$/ }).click();

    // Step 2: confirm.
    await page.getByRole("button", { name: /^Confirm$/ }).click();

    // The DemosPanel re-renders with the new row. Wait for it.
    await expect(page.getByText(/scheduled/i).first()).toBeVisible();

    // ── 4. Read the most recent invite's token URL ─────────────────────────
    const tokenUrl = await page.evaluate(async () => {
      const res = await fetch("/api/test/last-invite-url");
      if (!res.ok) throw new Error(`last-invite-url returned ${res.status}`);
      const json = (await res.json()) as { url: string };
      return json.url;
    });
    expect(tokenUrl).toMatch(/\/evaluations\/from-token\?token=/);

    // ── 5. Open the evaluator-facing form in a fresh context ───────────────
    // A new context bypasses the HR's auth cookies so we exercise the
    // token-only auth path (mirrors a principal clicking the email link).
    const evaluatorContext = await context.browser()!.newContext();
    const evalPage = await evaluatorContext.newPage();
    await evalPage.goto(tokenUrl);

    // /evaluations/from-token redirects to /evaluations/<inviteId>?token=…
    await evalPage.waitForURL(/\/evaluations\/[^/]+\?token=/);

    // Score the four required principal dimensions + pick "hire".
    await evalPage
      .getByRole("button", { name: /^Score 4 for subject knowledge$/ })
      .click();
    await evalPage
      .getByRole("button", { name: /^Score 5 for classroom management$/ })
      .click();
    await evalPage
      .getByRole("button", { name: /^Score 4 for communication$/ })
      .click();
    await evalPage
      .getByRole("button", { name: /^Score 4 for overall fit$/ })
      .click();
    // Comments is a <textarea> with a visible "Comments" label.
    await evalPage.getByLabel(/^Comments$/).fill("Strong candidate");
    await evalPage.getByRole("button", { name: /^Hire$/ }).click();
    await evalPage.getByRole("button", { name: /^Submit evaluation$/ }).click();

    // After submit the form pushes to /evaluations?submitted=1.
    await evalPage.waitForURL(/\/evaluations(\?|$)/);
    await evaluatorContext.close();

    // ── 6. Find the demo ID on the HR side and navigate to its detail page ─
    // The demo ID is not in the URL after schedule, so we either harvest it
    // from the DemosPanel <Link> or from the last-invite API. We use the
    // DemosPanel link href (only one demo exists for this application).
    await page.reload();
    await page.getByRole("button", { name: /^Evaluate$/ }).click();
    const demoLinkLocator = page.getByRole("link", {
      // Locale-formatted timestamp like "1/1/2030, 10:00:00 am" (en-IN).
      // Matching just the year keeps this robust across en-IN locale quirks.
      name: /2030/,
    });
    await expect(demoLinkLocator).toBeVisible();
    await demoLinkLocator.click();

    // ── 7. Demo detail page: verify the aggregation, then advance ──────────
    await page.waitForURL(/\/dashboard\/demos\/[^/]+/);
    await expect(page.getByText(/Recommendation tally/i)).toBeVisible();
    await expect(page.getByText(/Hire: 1/)).toBeVisible();

    await page.getByRole("button", { name: /^Make decision$/ }).click();
    await page.getByRole("button", { name: /^Advance$/ }).click();

    // ── 8. Confirm the application moved to the "advanced" stage ───────────
    //
    // TODO: We currently re-open the drawer to read its stage. The drawer
    // does NOT prominently render the application's stage as visible text in
    // Plan 1; the Info tab renders it. If the assertion below proves flaky
    // the right next step is to query Convex directly (as the triage spec
    // does) rather than scrape the drawer.
    await page.goto("/dashboard/pipeline");
    await page.getByRole("button", { name: /TGT Maths/i }).click();
    await page.getByText("E2E Candidate", { exact: true }).click();
    await expect(page.getByText(/advanced/i).first()).toBeVisible();
  },
);

// ── Future work ─────────────────────────────────────────────────────────────
//
// test.fixme cases worth adding once Plan 1 ships:
//
// test.fixme("re-demo flow carries evaluator panel + lineage", …)
// test.fixme("decision-rule auto-applies after last submission", …)  // Plan 2
//
// Both depend on UI hooks (re-demo prefill button, rule editor) that the
// current plan only sketches.
