import type { Doc, Id } from "./_generated/dataModel";
import {
  evaluateRule,
  type RuleInput,
} from "./lib/decisionRuleEngine";
import { internal } from "./_generated/api";

type DbCtx = { db: any; scheduler?: any };

export async function maybeApplyDecision(
  ctx: DbCtx,
  demoId: Id<"demoSessions">,
): Promise<void> {
  const demo = await ctx.db.get(demoId);
  if (!demo) return;
  if (!demo.decisionRuleId) return;
  if (demo.appliedDecision) return;
  if (demo.status === "cancelled") return;

  const allInvites: Doc<"evaluationInvites">[] = await ctx.db
    .query("evaluationInvites")
    .withIndex("by_demoSessionId", (q: any) => q.eq("demoSessionId", demoId))
    .collect();

  const nonCancelled = allInvites.filter((i) => i.status !== "cancelled");
  if (nonCancelled.length === 0) return;

  const allTerminal = nonCancelled.every(
    (i) => i.status === "submitted" || i.status === "declined",
  );
  if (!allTerminal) return;

  const rule = await ctx.db.get(demo.decisionRuleId);
  if (!rule || !rule.isActive) return;

  const evaluations: Doc<"evaluations">[] = [];
  const templateIds = new Set<string>();
  for (const inv of nonCancelled) {
    if (inv.status !== "submitted") continue;
    const evs: Doc<"evaluations">[] = await ctx.db
      .query("evaluations")
      .withIndex("by_inviteId", (q: any) => q.eq("inviteId", inv._id))
      .collect();
    for (const e of evs) {
      evaluations.push(e);
      templateIds.add(e.formTemplateId as unknown as string);
    }
  }
  const templates: Doc<"formTemplates">[] = [];
  for (const id of templateIds) {
    const t = await ctx.db.get(id as Id<"formTemplates">);
    if (t) templates.push(t);
  }

  const input: RuleInput = {
    rule: { branches: rule.branches, fallback: rule.fallback },
    invites: nonCancelled.map((i) => ({
      _id: i._id as unknown as string,
      evaluatorRole: i.evaluatorRole,
      status: i.status,
      formTemplateId: i.formTemplateId as unknown as string,
    })),
    evaluations: evaluations.map((e) => ({
      _id: e._id as unknown as string,
      inviteId: e.inviteId as unknown as string,
      formTemplateId: e.formTemplateId as unknown as string,
      responses: e.responses as Record<string, number | string>,
      recommendation: e.recommendation,
    })),
    templates: templates.map((t) => ({
      _id: t._id as unknown as string,
      fields: t.fields.map((f) => ({ key: f.key, type: f.type, weight: f.weight })),
    })),
  };

  const action = evaluateRule(input);

  await ctx.db.patch(demoId, {
    status: "completed",
    appliedDecision: {
      action,
      appliedAt: Date.now(),
      appliedBy: undefined,
      note: `Auto-applied by rule "${rule.name}"`,
    },
  });

  if (action === "advance") {
    await ctx.db.patch(demo.applicationId, { stage: "advanced" });
  } else if (action === "reject") {
    await ctx.db.patch(demo.applicationId, { stage: "rejected" });
  }

  if (ctx.scheduler) {
    await ctx.scheduler.runAfter(0, internal.notifications.notifyDemoComplete, { demoId });
  }
}
