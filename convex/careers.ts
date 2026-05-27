import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

export const getSchoolBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const school = await ctx.db
      .query("schools")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!school) return null;
    const logoUrl = school.logoStorageId
      ? await ctx.storage.getUrl(school.logoStorageId)
      : null;
    const heroImageUrl = school.heroImageStorageId
      ? await ctx.storage.getUrl(school.heroImageStorageId)
      : null;
    return { ...school, logoUrl, heroImageUrl };
  },
});

export const getSchoolByCustomDomain = query({
  args: { domain: v.string() },
  handler: async (ctx, args) => {
    const school = await ctx.db
      .query("schools")
      .withIndex("by_customDomain", (q) => q.eq("customDomain", args.domain))
      .first();
    if (!school) return null;
    if (school.customDomainStatus !== "verified") return null;
    const logoUrl = school.logoStorageId
      ? await ctx.storage.getUrl(school.logoStorageId)
      : null;
    const heroImageUrl = school.heroImageStorageId
      ? await ctx.storage.getUrl(school.heroImageStorageId)
      : null;
    return { ...school, logoUrl, heroImageUrl };
  },
});

export const getOpenJobs = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobPostings")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
  },
});

export const getJob = query({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

function generateTrackingToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export const submitApplication = mutation({
  args: {
    schoolId: v.id("schools"),
    jobId: v.optional(v.id("jobPostings")),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    qualifications: v.array(v.string()),
    certifications: v.optional(v.array(v.string())),
    boardExperience: v.optional(v.array(v.string())),
    subjects: v.array(v.string()),
    yearsExperience: v.optional(v.number()),
    currentSchool: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.phone && !args.email) {
      throw new Error("Either phone or email is required");
    }
    if (args.phone && !/^\d{10,12}$/.test(args.phone)) {
      throw new Error("Invalid phone number");
    }

    const candidateId = await ctx.db.insert("candidates", {
      name: args.name,
      phone: args.phone,
      email: args.email,
      qualifications: args.qualifications,
      certifications: args.certifications ?? [],
      boardExperience: args.boardExperience ?? [],
      subjects: args.subjects,
      yearsExperience: args.yearsExperience,
      currentSchool: args.currentSchool,
      sourceChannel: "careers_portal",
      talentBankFlag: false,
    });

    const profileText = [
      `Name: ${args.name}`,
      args.email ? `Email: ${args.email}` : null,
      args.phone ? `Phone: ${args.phone}` : null,
      args.qualifications.length ? `Qualifications: ${args.qualifications.join(", ")}` : null,
      (args.certifications ?? []).length ? `Certifications: ${(args.certifications ?? []).join(", ")}` : null,
      (args.boardExperience ?? []).length ? `Board Experience: ${(args.boardExperience ?? []).join(", ")}` : null,
      args.subjects.length ? `Subjects: ${args.subjects.join(", ")}` : null,
      args.yearsExperience != null ? `Years of Experience: ${args.yearsExperience}` : null,
      args.currentSchool ? `Current School: ${args.currentSchool}` : null,
    ].filter(Boolean).join("\n");

    await ctx.runMutation(internal.candidates.setOrigin, {
      candidateId,
      origin: "fresh_application",
    });
    await ctx.scheduler.runAfter(0, api.intake.parseAndStoreCandidate, {
      candidateId,
      rawText: profileText,
    });

    const trackingToken = generateTrackingToken();

    const appId = await ctx.db.insert("applications", {
      candidateId,
      jobPostingId: args.jobId,
      schoolId: args.schoolId,
      stage: "sourced",
      trackingToken,
      source: "careers_site",
      matchedAt: Date.now(),
      createdAt: Date.now(),
    });

    // Kick off triage for the new application. Phase 1: runs hybrid match across
    // all open roles at the school, then writes a triageDecisions row.
    await ctx.scheduler.runAfter(0, api.triage.runTriage, { applicationId: appId });

    const school = await ctx.db.get(args.schoolId);
    const jobTitle = args.jobId ? (await ctx.db.get(args.jobId))?.title : undefined;

    await ctx.scheduler.runAfter(0, internal.resend.sendMagicLink as any, {
      applicationId: appId,
      candidateId,
      candidateName: args.name,
      candidateEmail: args.email,
      candidatePhone: args.phone,
      trackingToken,
      schoolName: school?.name ?? "RoleRecruit",
      jobTitle,
      whatsappEnabled: school?.whatsappEnabled ?? false,
    });

    return { candidateId, applicationId: appId, trackingToken };
  },
});

export const submitApplicationForIngestion = internalMutation({
  args: {
    schoolId: v.id("schools"),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    qualifications: v.array(v.string()),
    certifications: v.optional(v.array(v.string())),
    boardExperience: v.optional(v.array(v.string())),
    subjects: v.array(v.string()),
    yearsExperience: v.optional(v.number()),
    currentSchool: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const candidateId = await ctx.db.insert("candidates", {
      name: args.name,
      phone: args.phone,
      email: args.email,
      qualifications: args.qualifications,
      certifications: args.certifications ?? [],
      boardExperience: args.boardExperience ?? [],
      subjects: args.subjects,
      yearsExperience: args.yearsExperience,
      currentSchool: args.currentSchool,
      sourceChannel: "email_parsed",
      talentBankFlag: false,
    });

    const ingestionProfileText = [
      `Name: ${args.name}`,
      args.email ? `Email: ${args.email}` : null,
      args.phone ? `Phone: ${args.phone}` : null,
      args.qualifications.length ? `Qualifications: ${args.qualifications.join(", ")}` : null,
      (args.certifications ?? []).length ? `Certifications: ${(args.certifications ?? []).join(", ")}` : null,
      (args.boardExperience ?? []).length ? `Board Experience: ${(args.boardExperience ?? []).join(", ")}` : null,
      args.subjects.length ? `Subjects: ${args.subjects.join(", ")}` : null,
      args.yearsExperience != null ? `Years of Experience: ${args.yearsExperience}` : null,
      args.currentSchool ? `Current School: ${args.currentSchool}` : null,
    ].filter(Boolean).join("\n");

    await ctx.runMutation(internal.candidates.setOrigin, {
      candidateId,
      origin: "fresh_application",
    });
    await ctx.scheduler.runAfter(0, api.intake.parseAndStoreCandidate, {
      candidateId,
      rawText: ingestionProfileText,
    });

    const trackingToken = generateTrackingToken();

    const appId = await ctx.db.insert("applications", {
      candidateId,
      schoolId: args.schoolId,
      stage: "sourced",
      trackingToken,
      source: "careers_site",
      matchedAt: Date.now(),
      createdAt: Date.now(),
    });

    // Trigger triage for the new application (Phase 1 intake-then-triage chain)
    await ctx.scheduler.runAfter(0, api.triage.runTriage, { applicationId: appId });

    return { candidateId, applicationId: appId, trackingToken };
  },
});
