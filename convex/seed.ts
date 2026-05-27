import { internalAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Idempotent E2E seed action.
 *
 * Creates (or re-uses) "Test School" with triageEnabled=true, two active job
 * postings (PGT Physics, TGT Science), and triggers role-embedding computation.
 *
 * Usage:
 *   npx convex run seed:seedE2E
 */
export const seedE2E = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    schoolId: Id<"schools">;
    pgtPhysicsJobId: Id<"jobPostings">;
    tgtScienceJobId: Id<"jobPostings">;
  }> => {
    // ── 1. School ──────────────────────────────────────────────────────────────
    // Check for existing school by slug "test-school"
    let schoolId: Id<"schools"> | null = await ctx.runQuery(
      api.careers.getSchoolBySlug,
      { slug: "test-school" }
    ).then((s) => (s ? s._id : null));

    if (!schoolId) {
      // Create school (create mutation throws if name already exists, so we rely on
      // slug check above being the primary idempotency guard)
      schoolId = await ctx.runMutation(api.schools.create, {
        name: "Test School",
        board: "CBSE",
        city: "Mumbai",
        state: "MH",
      });

      // Set slug and triageEnabled together
      await ctx.runMutation(api.schools.updateSettings, {
        schoolId,
        slug: "test-school",
      });
    }

    // Always ensure triageEnabled + plan defaults are set
    await ctx.runMutation(api.schools.updateTriageConfig, {
      schoolId,
      triageEnabled: true,
      autoShortlistThreshold: 0.85,
      autoRejectThreshold: 0.30,
      autoSendDelaySec: 14400,
      redFlagOverrideCount: 2,
    });

    // ── 2. Jobs ────────────────────────────────────────────────────────────────
    // Fetch existing active jobs for this school to be idempotent
    const { page: existingJobs } = await ctx.runQuery(api.jobs.listBySchool, {
      schoolId,
      paginationOpts: { numItems: 1000, cursor: null },
    });

    const existingPgt = existingJobs.find(
      (j) => j.title === "PGT Physics" && j.subject === "Physics"
    );
    const existingTgt = existingJobs.find(
      (j) => j.title === "TGT Science" && j.subject === "Science"
    );

    let pgtPhysicsJobId: Id<"jobPostings">;
    if (existingPgt) {
      pgtPhysicsJobId = existingPgt._id;
    } else {
      pgtPhysicsJobId = await ctx.runMutation(api.jobs.create, {
        schoolId,
        title: "PGT Physics",
        subject: "Physics",
        level: "PGT",
        board: "CBSE",
        qualifications: ["B.Ed", "M.Sc Physics"],
        minExperience: 3,
        naturalLanguageDescription:
          "We are looking for an experienced PGT Physics teacher for Classes 11 and 12 CBSE. " +
          "The candidate should have a strong foundation in theoretical and applied physics, " +
          "ability to prepare students for board exams, and a passion for science education.",
      });
      // Publish (sets status=active and schedules embeddings)
      await ctx.runMutation(api.jobs.publish, { jobId: pgtPhysicsJobId });
    }

    let tgtScienceJobId: Id<"jobPostings">;
    if (existingTgt) {
      tgtScienceJobId = existingTgt._id;
    } else {
      tgtScienceJobId = await ctx.runMutation(api.jobs.create, {
        schoolId,
        title: "TGT Science",
        subject: "Science",
        level: "TGT",
        board: "CBSE",
        qualifications: ["B.Ed", "B.Sc"],
        minExperience: 2,
        naturalLanguageDescription:
          "We are seeking a TGT Science teacher for Classes 6 to 10 CBSE. " +
          "The candidate should be proficient in Physics, Chemistry, and Biology at the middle-school level, " +
          "with strong classroom management skills and experience in activity-based learning.",
      });
      await ctx.runMutation(api.jobs.publish, { jobId: tgtScienceJobId });
    }

    // ── 3. Ensure role embeddings exist ───────────────────────────────────────
    // computeRoleEmbeddings is already scheduled by publish() via scheduler.runAfter(0, …).
    // Running it explicitly here ensures it completes synchronously during seeding
    // (publish schedules it asynchronously; in a test environment we want it ready now).
    await ctx.runAction(api.jobs_ai.computeRoleEmbeddings, { jobId: pgtPhysicsJobId });
    await ctx.runAction(api.jobs_ai.computeRoleEmbeddings, { jobId: tgtScienceJobId });

    return { schoolId, pgtPhysicsJobId, tgtScienceJobId };
  },
});
