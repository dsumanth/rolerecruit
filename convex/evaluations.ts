import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function generateToken(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export const create = mutation({
  args: {
    applicationId: v.id("applications"),
    evaluatorRole: v.union(
      v.literal("principal"),
      v.literal("hod"),
      v.literal("hr_admin")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const token = generateToken();

    const id = await ctx.db.insert("evaluations", {
      applicationId: args.applicationId,
      evaluatorUserId: identity?.subject ?? "anonymous",
      evaluatorRole: args.evaluatorRole,
      token,
      submitted: false,
    });

    return { _id: id, token };
  },
});

export const submitFeedback = mutation({
  args: {
    token: v.string(),
    subjectKnowledge: v.number(),
    classroomManagement: v.number(),
    communication: v.number(),
    overallFit: v.number(),
    comments: v.optional(v.string()),
    recommendation: v.union(
      v.literal("hire"),
      v.literal("maybe"),
      v.literal("reject")
    ),
  },
  handler: async (ctx, args) => {
    const evaluation = await ctx.db
      .query("evaluations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!evaluation) throw new Error("Invalid feedback link");
    if (evaluation.submitted) throw new Error("Feedback already submitted");

    return await ctx.db.patch(evaluation._id, {
      subjectKnowledge: args.subjectKnowledge,
      classroomManagement: args.classroomManagement,
      communication: args.communication,
      overallFit: args.overallFit,
      comments: args.comments,
      recommendation: args.recommendation,
      submitted: true,
      submittedAt: Date.now(),
    });
  },
});

export const getByApplication = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("evaluations")
      .withIndex("by_applicationId", (q) =>
        q.eq("applicationId", args.applicationId)
      )
      .collect();
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const evaluation = await ctx.db
      .query("evaluations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!evaluation) return null;

    const application = await ctx.db.get(evaluation.applicationId);
    if (!application) return null;

    const candidate = await ctx.db.get(application.candidateId);

    return {
      _id: evaluation._id,
      submitted: evaluation.submitted,
      evaluatorRole: evaluation.evaluatorRole,
      application: {
        stage: application.stage,
      },
      candidate: candidate
        ? {
            name: candidate.name,
            subjects: candidate.subjects,
          }
        : null,
    };
  },
});
