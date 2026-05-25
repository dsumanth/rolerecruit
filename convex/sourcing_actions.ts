import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const MOCK_CANDIDATES = [
  {
    name: "Anita Sharma",
    phone: "919876543210",
    email: "anita.sharma@email.com",
    location: "Hyderabad",
    qualifications: ["B.Ed", "M.Sc Physics"],
    certifications: ["CTET"],
    boardExperience: ["CBSE"],
    subjects: ["Physics"],
    yearsExperience: 5,
    currentSchool: "Delhi Public School",
  },
  {
    name: "Rajesh Kumar",
    phone: "919876543211",
    email: "rajesh.k@email.com",
    location: "Bangalore",
    qualifications: ["B.Ed", "M.Sc Physics"],
    certifications: ["State TET"],
    boardExperience: ["CBSE", "State"],
    subjects: ["Physics", "Mathematics"],
    yearsExperience: 8,
    currentSchool: "National Public School",
  },
  {
    name: "Priya Patel",
    phone: "919876543212",
    email: "priya.p@email.com",
    location: "Mumbai",
    qualifications: ["D.El.Ed", "B.Sc"],
    certifications: [],
    boardExperience: ["State"],
    subjects: ["Science", "Physics"],
    yearsExperience: 2,
    currentSchool: "St. Xavier's School",
  },
  {
    name: "Suresh Reddy",
    phone: "919876543213",
    email: "suresh.r@email.com",
    location: "Chennai",
    qualifications: ["B.Ed", "M.Phil Physics"],
    certifications: ["CTET", "NET"],
    boardExperience: ["CBSE", "ICSE"],
    subjects: ["Physics"],
    yearsExperience: 12,
    currentSchool: "DAV Public School",
  },
  {
    name: "Meera Iyer",
    phone: "919876543214",
    email: "meera.i@email.com",
    location: "Pune",
    qualifications: ["B.Ed", "M.Sc"],
    certifications: ["CTET"],
    boardExperience: ["ICSE"],
    subjects: ["Physics", "Chemistry"],
    yearsExperience: 4,
    currentSchool: "Bishop's School",
  },
];

export const runSourcing = action({
  args: {
    jobId: v.id("jobPostings"),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<{ runId: any; candidatesFound: number }> => {
    const runId = await ctx.runMutation(api.sourcing.startRun as any, {
      jobId: args.jobId,
      schoolId: args.schoolId,
    });

    try {
      await ctx.runMutation(api.sourcing.markRunning as any, {
        runId,
        apifyRunId: "mock-run",
      });

      const job = await ctx.runQuery(api.jobs.get as any, {
        jobId: args.jobId,
      });

      for (const mc of MOCK_CANDIDATES) {
        const candidateId = await ctx.runMutation(api.candidates.create as any, {
          name: mc.name,
          phone: mc.phone,
          email: mc.email,
          location: mc.location,
          qualifications: mc.qualifications,
          certifications: mc.certifications,
          boardExperience: mc.boardExperience,
          subjects: mc.subjects,
          yearsExperience: mc.yearsExperience,
          currentSchool: mc.currentSchool,
          sourceChannel: "roleRecruit_sourcing",
        });

        await ctx.runMutation(api.applications.create as any, {
          candidateId,
          jobPostingId: args.jobId,
          schoolId: args.schoolId,
        });
      }

      await ctx.runMutation(api.sourcing.markCompleted as any, {
        runId,
        candidatesFound: MOCK_CANDIDATES.length,
        candidatesScored: MOCK_CANDIDATES.length,
      });

      return { runId, candidatesFound: MOCK_CANDIDATES.length };
    } catch (err: any) {
      await ctx.runMutation(api.sourcing.markFailed as any, {
        runId,
        error: err.message ?? "Unknown error",
      });

      throw err;
    }
  },
});
