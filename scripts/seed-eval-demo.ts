#!/usr/bin/env bun
/**
 * Seeds the demo evaluation flow for the Playwright E2E
 * (`tests/e2e/evaluation-flow.spec.ts`).
 *
 * Creates one school + one candidate + one job + one application + one
 * principal user profile, then prints the resulting IDs as JSON. The E2E spec
 * reads those IDs to deep-link into the application drawer.
 *
 * Usage:
 *   bun run seed:eval-demo
 *
 * Requirements:
 *   - NEXT_PUBLIC_CONVEX_URL must point at a running Convex deployment with
 *     the Plan-1 schema deployed.
 *   - `users.createProfile` throws if a profile with the same `userId` already
 *     exists, so this script is NOT idempotent on the principal; rename the
 *     `userId` constant if you need to re-run against the same deployment.
 *
 * Out-of-scope on this worktree: the worktree shares a Convex deployment with
 * a parallel session running on a different schema, so this script is
 * deferred. Run it after the branch merges to main, or after a dedicated dev
 * deployment is provisioned here.
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

async function main() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");

  const client = new ConvexHttpClient(url);

  const schoolId = await client.mutation(api.schools.create as any, {
    name: "E2E Test School",
    board: "CBSE",
    city: "Test",
    state: "Test",
  });

  const candidateId = await client.mutation(api.candidates.create as any, {
    name: "E2E Candidate",
    qualifications: ["B.Ed"],
    subjects: ["Maths"],
  });

  const jobId = await client.mutation(api.jobs.create as any, {
    schoolId,
    title: "TGT Maths",
    subject: "Maths",
    level: "TGT",
    board: "CBSE",
    qualifications: ["B.Ed"],
    naturalLanguageDescription: "E2E job",
  });

  const appId = await client.mutation(api.applications.create as any, {
    candidateId,
    jobPostingId: jobId,
    schoolId,
    skipTriage: true,
  });

  const principalId = await client.mutation(api.users.createProfile as any, {
    userId: "e2e-principal",
    name: "Test Principal",
    email: "principal@e2e.test",
    schoolId,
    role: "principal",
  });

  console.log(
    JSON.stringify(
      { schoolId, candidateId, jobId, appId, principalId },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
