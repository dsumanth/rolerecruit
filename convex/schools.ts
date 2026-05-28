import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const DEFAULT_PIPELINE_STAGES = [
  { id: "sourced", name: "Sourced", order: 0, isTerminal: false, color: "#86868b" },
  { id: "screened", name: "Screened", order: 1, isTerminal: false, color: "#86868b" },
  { id: "demo_scheduled", name: "Demo Scheduled", order: 2, isTerminal: false, color: "#0071e3" },
  { id: "demo_completed", name: "Demo Completed", order: 3, isTerminal: false, color: "#5856d6" },
  { id: "offer_sent", name: "Offer Sent", order: 4, isTerminal: false, color: "#ff9f0a" },
  { id: "hired", name: "Hired", order: 5, isTerminal: true, color: "#34c759" },
  { id: "rejected", name: "Rejected", order: 6, isTerminal: true, color: "#ff3b30" },
  { id: "on_hold", name: "On Hold", order: 7, isTerminal: false, color: "#aeaeb2" },
];

const DEFAULT_PIPELINE_TRANSITIONS = [
  { fromStageId: "sourced", toStageId: "screened" },
  { fromStageId: "sourced", toStageId: "rejected" },
  { fromStageId: "sourced", toStageId: "on_hold" },
  { fromStageId: "screened", toStageId: "demo_scheduled" },
  { fromStageId: "screened", toStageId: "rejected" },
  { fromStageId: "screened", toStageId: "on_hold" },
  { fromStageId: "demo_scheduled", toStageId: "demo_completed" },
  { fromStageId: "demo_scheduled", toStageId: "rejected" },
  { fromStageId: "demo_completed", toStageId: "offer_sent" },
  { fromStageId: "demo_completed", toStageId: "rejected" },
  { fromStageId: "offer_sent", toStageId: "hired" },
  { fromStageId: "offer_sent", toStageId: "rejected" },
  { fromStageId: "on_hold", toStageId: "screened" },
  { fromStageId: "on_hold", toStageId: "rejected" },
];

const DEFAULT_ROLES = [
  { name: "hr_admin", permissions: ["*"], isSystem: true },
  { name: "principal", permissions: ["dashboard", "jobs", "pipeline", "feedback", "talent"], isSystem: true },
  { name: "hod", permissions: ["pipeline", "feedback"], isSystem: true },
  { name: "viewer", permissions: ["dashboard"], isSystem: true },
];

export const create = mutation({
  args: {
    name: v.string(),
    board: v.union(
      v.literal("CBSE"),
      v.literal("ICSE"),
      v.literal("IB"),
      v.literal("State"),
      v.literal("IGCSE")
    ),
    city: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("schools")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      throw new Error("A school with this name already exists");
    }

    const schoolId = await ctx.db.insert("schools", {
      name: args.name,
      board: args.board,
      city: args.city,
      state: args.state,
      planTier: "free",
      whatsappEnabled: false,
    });

    await ctx.db.insert("pipelineConfigs", {
      schoolId,
      stages: DEFAULT_PIPELINE_STAGES,
      transitions: DEFAULT_PIPELINE_TRANSITIONS,
      version: 1,
    });

    for (const r of DEFAULT_ROLES) {
      await ctx.db.insert("roles", { ...r, schoolId });
    }

    return schoolId;
  },
});

export const updateBriefSettings = mutation({
  args: {
    schoolId: v.id("schools"),
    recipientUserIds: v.array(v.string()),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.schoolId, {
      morningBriefRecipientUserIds: args.recipientUserIds,
      morningBriefEnabled: args.enabled,
    });
  },
});

export const updateFaqContent = mutation({
  args: {
    schoolId: v.id("schools"),
    faqContent: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.schoolId, { faqContent: args.faqContent });
  },
});

export const get = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
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

export const getInternal = internalQuery({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.schoolId);
  },
});

export const generateLogoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const setLogo = mutation({
  args: {
    schoolId: v.id("schools"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) throw new Error("School not found");
    if (school.logoStorageId) {
      await ctx.storage.delete(school.logoStorageId);
    }
    await ctx.db.patch(args.schoolId, { logoStorageId: args.storageId });
  },
});

export const clearLogo = mutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) throw new Error("School not found");
    if (school.logoStorageId) {
      await ctx.storage.delete(school.logoStorageId);
    }
    await ctx.db.patch(args.schoolId, { logoStorageId: undefined });
  },
});

export const generateHeroImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const setHeroImage = mutation({
  args: {
    schoolId: v.id("schools"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) throw new Error("School not found");
    if (school.heroImageStorageId) {
      await ctx.storage.delete(school.heroImageStorageId);
    }
    await ctx.db.patch(args.schoolId, { heroImageStorageId: args.storageId });
  },
});

export const clearHeroImage = mutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) throw new Error("School not found");
    if (school.heroImageStorageId) {
      await ctx.storage.delete(school.heroImageStorageId);
    }
    await ctx.db.patch(args.schoolId, { heroImageStorageId: undefined });
  },
});

export const updateSettings = mutation({
  args: {
    schoolId: v.id("schools"),
    slug: v.optional(v.string()),
    whatsappEnabled: v.optional(v.boolean()),
    messageChannelPrefs: v.optional(v.object({
      shortlist: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      demo_schedule: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      feedback_request: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      offer: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      rejection: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
      custom: v.optional(v.union(v.literal("whatsapp"), v.literal("email"), v.literal("both"), v.literal("none"))),
    })),
    tagline: v.optional(v.string()),
    about: v.optional(v.string()),
    foundedYear: v.optional(v.number()),
    studentCount: v.optional(v.number()),
    facultyCount: v.optional(v.number()),
    perks: v.optional(v.array(v.object({
      label: v.string(),
      description: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, any> = {};
    if (args.slug !== undefined) patch.slug = args.slug || undefined;
    if (args.whatsappEnabled !== undefined) patch.whatsappEnabled = args.whatsappEnabled;
    if (args.messageChannelPrefs !== undefined) patch.messageChannelPrefs = args.messageChannelPrefs;
    if (args.tagline !== undefined) patch.tagline = args.tagline || undefined;
    if (args.about !== undefined) patch.about = args.about || undefined;
    if (args.foundedYear !== undefined) patch.foundedYear = args.foundedYear;
    if (args.studentCount !== undefined) patch.studentCount = args.studentCount;
    if (args.facultyCount !== undefined) patch.facultyCount = args.facultyCount;
    if (args.perks !== undefined) patch.perks = args.perks;
    return await ctx.db.patch(args.schoolId, patch);
  },
});

export const updateCalendarConnectedInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    connected: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.schoolId, { googleCalendarConnected: args.connected });
  },
});

export const getTriageConfig = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) return null;
    return {
      triageEnabled: school.triageEnabled ?? false,
      autoShortlistThreshold: school.autoShortlistThreshold ?? 0.85,
      autoRejectThreshold: school.autoRejectThreshold ?? 0.30,
      autoSendDelaySec: school.autoSendDelaySec ?? 14400,
      redFlagOverrideCount: school.redFlagOverrideCount ?? 2,
    };
  },
});

export const updateTriageConfig = mutation({
  args: {
    schoolId: v.id("schools"),
    triageEnabled: v.optional(v.boolean()),
    autoShortlistThreshold: v.optional(v.number()),
    autoRejectThreshold: v.optional(v.number()),
    autoSendDelaySec: v.optional(v.number()),
    redFlagOverrideCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { schoolId, ...patch } = args;
    await ctx.db.patch(schoolId, patch);
  },
});

// ─── Custom domains ────────────────────────────────────────────────────────

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

function validateCustomDomain(domain: string): string | null {
  if (!domain) return "Domain is required";
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) {
    return "Invalid domain format";
  }
  if (domain.split(".").length < 3) {
    return "Please use a subdomain (e.g. careers.yourschool.com), not the apex domain";
  }
  if (domain.endsWith(".rolerecruit.com") || domain === "rolerecruit.com") {
    return "Cannot use a rolerecruit.com domain as a custom domain";
  }
  return null;
}

export const requestCustomDomain = mutation({
  args: {
    schoolId: v.id("schools"),
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    const domain = normalizeDomain(args.domain);
    const validationError = validateCustomDomain(domain);
    if (validationError) throw new Error(validationError);

    const existing = await ctx.db
      .query("schools")
      .withIndex("by_customDomain", (q) => q.eq("customDomain", domain))
      .first();
    if (existing && existing._id !== args.schoolId) {
      throw new Error("This domain is already claimed by another school");
    }

    const school = await ctx.db.get(args.schoolId);
    if (!school) throw new Error("School not found");

    await ctx.db.patch(args.schoolId, {
      customDomain: domain,
      customDomainStatus: "pending_dns",
      customDomainVerifiedAt: undefined,
      customDomainError: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.vercelDomains.registerDomain, {
      schoolId: args.schoolId,
      domain,
    });

    return { domain };
  },
});

export const removeCustomDomain = mutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school || !school.customDomain) return;
    const domain = school.customDomain;

    await ctx.db.patch(args.schoolId, {
      customDomain: undefined,
      customDomainStatus: undefined,
      customDomainVerifiedAt: undefined,
      customDomainError: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.vercelDomains.unregisterDomain, {
      domain,
    });
  },
});

export const setCustomDomainStatusInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    status: v.union(
      v.literal("pending_dns"),
      v.literal("verifying_ssl"),
      v.literal("verified"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, any> = {
      customDomainStatus: args.status,
      customDomainError: args.error,
    };
    if (args.status === "verified") {
      patch.customDomainVerifiedAt = Date.now();
    }
    await ctx.db.patch(args.schoolId, patch);
  },
});

export const listPendingCustomDomains = internalQuery({
  args: {},
  handler: async (ctx) => {
    const schools = await ctx.db.query("schools").collect();
    return schools
      .filter((s) =>
        s.customDomain &&
        (s.customDomainStatus === "pending_dns" || s.customDomainStatus === "verifying_ssl")
      )
      .map((s) => ({ _id: s._id, customDomain: s.customDomain!, slug: s.slug }));
  },
});

export const listVerifiedCustomDomains = internalQuery({
  args: {},
  handler: async (ctx) => {
    const schools = await ctx.db.query("schools").collect();
    return schools
      .filter((s) => s.customDomain && s.customDomainStatus === "verified" && s.slug)
      .map((s) => ({ domain: s.customDomain!, slug: s.slug! }));
  },
});
