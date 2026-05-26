// convex/triage.ts
import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { TRIAGE_PROMPT_VERSION } from "./versions";
import { OUTREACH_DRAFT_SYSTEM } from "./prompts/outreachDraft";
import { DEFAULT_HYBRID_WEIGHTS } from "./types";
import OpenAI from "openai";

function getClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
}

export const writeTriageDecision = internalMutation({
  args: {
    applicationId: v.id("applications"),
    candidateId: v.id("candidates"),
    schoolId: v.id("schools"),
    primaryRoleId: v.optional(v.id("jobPostings")),
    primaryMatchScore: v.number(),
    primaryMatchReasons: v.array(v.string()),
    crossRoleMatches: v.array(v.object({
      roleId: v.id("jobPostings"),
      score: v.number(),
      reasons: v.array(v.string()),
    })),
    outcome: v.union(
      v.literal("auto_shortlisted"),
      v.literal("auto_rejected"),
      v.literal("human_review"),
      v.literal("cross_role_suggested"),
    ),
    outcomeReasoning: v.string(),
    outreachDraftId: v.optional(v.id("outreachMessages")),
    hybridWeights: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("triageDecisions", {
      ...args,
      createdAt: Date.now(),
      triagePromptVersion: TRIAGE_PROMPT_VERSION,
    });
  },
});

export const runTriage = action({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args): Promise<void> => {
    const app = await ctx.runQuery(api.applications.get, { applicationId: args.applicationId });
    if (!app) throw new Error("Application not found");

    const config = await ctx.runQuery(api.schools.getTriageConfig, { schoolId: app.schoolId });
    if (!config || !config.triageEnabled) return;

    const weights = DEFAULT_HYBRID_WEIGHTS;

    const openRoles = await ctx.runQuery(api.jobs.listOpenForSchool, { schoolId: app.schoolId });
    if (openRoles.length === 0) return;

    const perRole: Array<{ roleId: string; score: number; reasons: string[] }> = [];
    for (const role of openRoles) {
      const matches = await ctx.runAction(api.reverseMatching.findCandidatesForJob, {
        jobId: role._id,
        limit: 50,
        useLlmRerank: false,
        weights,
      });
      const hit = matches.find((m: any) => String(m.candidateId) === String(app.candidateId));
      if (hit) perRole.push({ roleId: role._id, score: hit.score, reasons: hit.reasons });
    }

    const primary = perRole.find((p) => String(p.roleId) === String(app.jobPostingId)) ?? {
      roleId: app.jobPostingId,
      score: 0,
      reasons: [],
    };
    const crossRoles = perRole
      .filter((p) => String(p.roleId) !== String(app.jobPostingId) && p.score >= 70)
      .sort((a, b) => b.score - a.score);

    const candidate = await ctx.runQuery(api.candidates.get, { candidateId: app.candidateId });
    const redFlagCount = candidate?.parsedFacets?.redFlags?.length ?? 0;

    let outcome: "auto_shortlisted" | "auto_rejected" | "human_review" | "cross_role_suggested";
    let reasoning: string;

    const score01 = primary.score / 100;
    if (score01 >= config.autoShortlistThreshold && redFlagCount < config.redFlagOverrideCount) {
      outcome = "auto_shortlisted";
      reasoning = `Strong fit (${primary.score}/100). ${primary.reasons.slice(0, 2).join("; ")}`;
    } else if (score01 <= config.autoRejectThreshold) {
      outcome = "auto_rejected";
      reasoning = `Low fit (${primary.score}/100). ${primary.reasons.join("; ") || "No qualifying signals."}`;
    } else if (crossRoles[0] && crossRoles[0].score >= 80 && primary.score < 75) {
      outcome = "cross_role_suggested";
      reasoning = `Better fit for ${crossRoles[0].roleId} (${crossRoles[0].score}/100) than primary (${primary.score}/100).`;
    } else {
      outcome = "human_review";
      reasoning = `Borderline fit (${primary.score}/100)${redFlagCount > 0 ? `, ${redFlagCount} red flag(s)` : ""}.`;
    }

    let outreachDraftId: any = undefined;
    if (outcome !== "human_review") {
      const draftBody = await draftOutreach(ctx, {
        candidate,
        school: await ctx.runQuery(api.schools.get, { schoolId: app.schoolId }),
        role: openRoles.find((r: any) => String(r._id) === String(primary.roleId)),
        outcome,
        primaryReasons: primary.reasons,
      });
      if (draftBody) {
        outreachDraftId = await ctx.runMutation(internal.outreach.createDraft, {
          applicationId: args.applicationId,
          candidateId: app.candidateId,
          type: outcome === "auto_shortlisted" ? "shortlist" : outcome === "auto_rejected" ? "rejection" : "cross_role_suggestion",
          channel: "whatsapp",
          body: draftBody,
          scheduledSendAt: outcome === "auto_shortlisted" || outcome === "auto_rejected"
            ? Date.now() + config.autoSendDelaySec * 1000
            : undefined,
        });
      }
    }

    const decisionId: any = await ctx.runMutation(internal.triage.writeTriageDecision, {
      applicationId: args.applicationId,
      candidateId: app.candidateId,
      schoolId: app.schoolId,
      primaryRoleId: app.jobPostingId,
      primaryMatchScore: primary.score,
      primaryMatchReasons: primary.reasons,
      crossRoleMatches: crossRoles.map((c) => ({ roleId: c.roleId as any, score: c.score, reasons: c.reasons })),
      outcome,
      outcomeReasoning: reasoning,
      outreachDraftId,
      hybridWeights: weights,
    });

    await ctx.runMutation(internal.applications.setTriageResult, {
      applicationId: args.applicationId,
      triageOutcome: outcome,
      triageDecisionId: decisionId,
      matchReasons: primary.reasons,
      aiMatchScore: primary.score,
    });

    for (const cr of crossRoles.slice(0, 3)) {
      const newAppId: any = await ctx.runMutation(api.applications.create, {
        candidateId: app.candidateId,
        jobPostingId: cr.roleId as any,
        schoolId: app.schoolId,
        skipTriage: true,
      });
      await ctx.runMutation(internal.applications.setSource, {
        applicationId: newAppId,
        source: "triage_cross_match",
      });
    }
  },
});

async function draftOutreach(ctx: any, args: { candidate: any; school: any; role: any; outcome: string; primaryReasons: string[] }): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const res = await client.chat.completions.create({
    model: "deepseek-v4-flash",
    max_tokens: 512,
    temperature: 0.4,
    messages: [
      { role: "system", content: OUTREACH_DRAFT_SYSTEM },
      { role: "user", content: JSON.stringify({
        candidateSummary: args.candidate?.candidateSummary ?? "",
        candidateName: args.candidate?.name ?? "",
        schoolName: args.school?.name ?? "",
        schoolCity: args.school?.city ?? "",
        roleTitle: args.role?.title ?? "",
        type: args.outcome === "auto_shortlisted" ? "shortlist" : args.outcome === "auto_rejected" ? "rejection" : "cross_role_suggestion",
        channel: "whatsapp",
        primaryReasons: args.primaryReasons,
      }) },
    ],
  });
  return res.choices[0]?.message?.content ?? null;
}

export const getByApplicationId = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("triageDecisions")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", args.applicationId))
      .first();
  },
});

export const queueForSchool = query({
  args: {
    schoolId: v.id("schools"),
    outcomes: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const want = new Set(args.outcomes ?? ["auto_shortlisted", "auto_rejected", "human_review", "cross_role_suggested"]);
    const limit = args.limit ?? 50;
    const apps = await ctx.db
      .query("applications")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.neq(q.field("triageOutcome"), undefined))
      .order("desc")
      .take(200);
    const filtered = apps.filter((a: any) => a.triageOutcome && want.has(a.triageOutcome));
    const enriched = [];
    for (const a of filtered.slice(0, limit)) {
      const decision = a.triageDecisionId ? await ctx.db.get(a.triageDecisionId) : null;
      const candidate = await ctx.db.get(a.candidateId);
      const job = a.jobPostingId ? await ctx.db.get(a.jobPostingId) : null;
      const draftId = (decision as any)?.outreachDraftId;
      const draft = draftId ? await ctx.db.get(draftId) : null;
      enriched.push({ application: a, candidate, job, decision, draft });
    }
    return enriched;
  },
});

export const approveDraft = mutation({
  args: { decisionId: v.id("triageDecisions"), overriddenBy: v.string() },
  handler: async (ctx, args) => {
    const decision = await ctx.db.get(args.decisionId);
    if (!decision || !decision.outreachDraftId) return;
    const draft = await ctx.db.get(decision.outreachDraftId);
    if (!draft) return;
    if (draft.status === "draft_pending_approval") {
      await ctx.db.patch(decision.outreachDraftId, {
        status: "scheduled",
        scheduledSendAt: Date.now() + 5000,
      });
    }
  },
});

export const overrideOutcome = mutation({
  args: {
    decisionId: v.id("triageDecisions"),
    overriddenBy: v.string(),
    toOutcome: v.union(
      v.literal("auto_shortlisted"),
      v.literal("auto_rejected"),
      v.literal("human_review"),
      v.literal("cross_role_suggested"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const decision = await ctx.db.get(args.decisionId);
    if (!decision) return;
    await ctx.db.patch(args.decisionId, {
      humanOverride: {
        overriddenAt: Date.now(),
        overriddenBy: args.overriddenBy,
        fromOutcome: decision.outcome,
        toOutcome: args.toOutcome,
        note: args.note,
      },
    });
    await ctx.db.patch(decision.applicationId, { triageOutcome: args.toOutcome });
  },
});
