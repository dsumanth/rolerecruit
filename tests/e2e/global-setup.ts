import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Playwright global setup — runs before any test file.
 *
 * Calls `npx convex run seed:seedE2E` to ensure the E2E test data exists,
 * then writes the returned IDs to tests/e2e/.fixtures/seed.json so specs
 * can reference them without hardcoding.
 *
 * Requirements:
 *   - A running local Convex dev server (`npx convex dev`)
 *   - The seed action deployed to that backend
 *
 * If Convex is not running the setup logs a clear error and exits non-zero.
 */
export default async function globalSetup() {
  const fixturesDir = join(__dirname, ".fixtures");
  mkdirSync(fixturesDir, { recursive: true });

  console.log("[global-setup] Seeding E2E test data via Convex…");

  let output: string;
  try {
    output = execSync("npx convex run seed:seedE2E --prod false", {
      cwd: process.cwd(),
      encoding: "utf-8",
      // Give the action up to 60 s (embedding calls can be slow)
      timeout: 60_000,
      env: { ...process.env },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[global-setup] ERROR: Failed to run seed:seedE2E.\n" +
        "Is the local Convex dev server running? (`npx convex dev`)\n\n" +
        message
    );
    process.exit(1);
  }

  // convex run prints the return value as JSON on its own line.
  // Extract the first JSON object from the output.
  const jsonMatch = output.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    console.error(
      "[global-setup] ERROR: Could not parse JSON from convex run output:\n" +
        output
    );
    process.exit(1);
  }

  let seed: {
    schoolId: string;
    pgtPhysicsJobId: string;
    tgtScienceJobId: string;
  };
  try {
    seed = JSON.parse(jsonMatch[0]);
  } catch {
    console.error(
      "[global-setup] ERROR: Invalid JSON from convex run:\n" + jsonMatch[0]
    );
    process.exit(1);
  }

  const seedPath = join(fixturesDir, "seed.json");
  writeFileSync(seedPath, JSON.stringify(seed, null, 2));

  console.log(
    `[global-setup] Seed complete. IDs written to ${seedPath}:\n` +
      JSON.stringify(seed, null, 2)
  );
}
