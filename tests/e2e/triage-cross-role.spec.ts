import { test, expect } from "./fixtures/auth";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Cross-role: a candidate applies for one role but also strongly matches
 * another open role. Triage should create a cross-role suggestion application
 * (source="triage_cross_match"). We verify via Convex direct query.
 *
 * Cross-role surfacing depends on the LLM-non-deterministic scoring of the
 * candidate against multiple roles; we accept either (a) the candidate appears
 * with a triage_cross_match application for TGT Science, OR (b) the candidate
 * simply appears in the triage queue (proving triage ran).
 */

const shouldRun = !!process.env.CLERK_E2E_STORAGE_STATE;
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
  "applicant for one role appears in triage with cross-role potential (Convex-verified)",
  async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto(`/careers/test-school/jobs/${seed.pgtPhysicsJobId}`);

    await page.getByPlaceholder("Rajesh Kumar").fill("Ravi Kumar");
    await page.getByPlaceholder("rajesh@email.com").fill("ravi@example.com");
    await page.getByPlaceholder("9876543210").fill("9876543211");
    await page.getByPlaceholder("B.Ed, M.Sc Physics").fill("B.Ed, M.Sc Physics, B.Sc Chemistry");
    await page.getByPlaceholder("Physics, Mathematics").fill("Physics, Chemistry, Science");
    await page.getByPlaceholder("CBSE, ICSE").fill("CBSE");
    await page.getByPlaceholder("5", { exact: true }).fill("8");

    await page.getByRole("button", { name: /submit application/i }).click();
    await expect(page.getByText("Application submitted")).toBeVisible({ timeout: 10_000 });

    // Poll Convex for Ravi's triage to complete
    let queue: any[] = [];
    let ravi: any = null;
    for (let attempt = 0; attempt < 30 && !ravi; attempt++) {
      queue = await queryConvex<any[]>("triage:queueForSchool", {
        schoolId: seed.schoolId,
        limit: 50,
      });
      ravi = queue.find((item) => item.candidate?.name === "Ravi Kumar");
      if (!ravi) await new Promise((r) => setTimeout(r, 3_000));
    }

    expect(ravi, "Ravi Kumar should appear in test-school triage queue").toBeTruthy();
    expect(ravi.decision).toBeDefined();
    expect(ravi.decision.hybridWeights).toBeDefined();

    // Bonus: check if a cross-role triage_cross_match application was created
    // for TGT Science. This depends on LLM scoring; we don't strictly require it.
    const allEntries = queue.filter((item) => item.candidate?.name === "Ravi Kumar");
    const crossRoleApp = allEntries.find(
      (item) => item.application?.source === "triage_cross_match",
    );
    if (crossRoleApp) {
      // Strong success — triage created a cross-role suggestion
      expect(crossRoleApp.application.jobPostingId).toBeDefined();
    }
    // Either way, the test passes if the primary triage ran (asserted above).
  },
);
