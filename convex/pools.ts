import { mutation, query, action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";

export const create = mutation({
  args: {
    schoolId: v.id("schools"),
    name: v.string(),
    tags: v.array(v.string()),
    createdBy: v.union(v.literal("ai"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pools")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();
    if (existing) throw new Error(`Pool "${args.name}" already exists`);

    return await ctx.db.insert("pools", {
      schoolId: args.schoolId,
      name: args.name,
      createdBy: args.createdBy,
      tags: args.tags,
      createdAt: Date.now(),
    });
  },
});

export const listForSchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pools")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .collect();
  },
});

export const update = mutation({
  args: {
    poolId: v.id("pools"),
    name: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const pool = await ctx.db.get(args.poolId);
    if (!pool) throw new Error("Pool not found");

    if (args.name && args.name !== pool.name) {
      const existing = await ctx.db
        .query("pools")
        .withIndex("by_schoolId", (q) => q.eq("schoolId", pool.schoolId))
        .filter((q) => q.eq(q.field("name"), args.name))
        .first();
      if (existing) throw new Error(`Pool "${args.name}" already exists`);
    }

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.tags !== undefined) patch.tags = args.tags;

    return await ctx.db.patch(args.poolId, patch);
  },
});

export const remove = mutation({
  args: { poolId: v.id("pools") },
  handler: async (ctx, args) => {
    const candidatePools = await ctx.db
      .query("candidatePools")
      .withIndex("by_poolId", (q) => q.eq("poolId", args.poolId))
      .collect();

    for (const cp of candidatePools) {
      const candidate = await ctx.db.get(cp.candidateId);
      if (candidate && candidate.poolIds) {
        const updated = candidate.poolIds.filter((id) => id !== args.poolId);
        await ctx.db.patch(cp.candidateId, { poolIds: updated.length > 0 ? updated : undefined });
      }
      await ctx.db.delete(cp._id);
    }

    await ctx.db.delete(args.poolId);
  },
});

export const assignToPool = mutation({
  args: {
    candidateId: v.id("candidates"),
    poolId: v.id("pools"),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) throw new Error("Candidate not found");

    await ctx.db.insert("candidatePools", {
      candidateId: args.candidateId,
      poolId: args.poolId,
      confidence: args.confidence,
      createdAt: Date.now(),
    });

    const currentPoolIds = candidate.poolIds ?? [];
    if (!currentPoolIds.includes(args.poolId)) {
      await ctx.db.patch(args.candidateId, {
        poolIds: [...currentPoolIds, args.poolId],
      });
    }
  },
});

export const unassignFromPool = mutation({
  args: {
    candidateId: v.id("candidates"),
    poolId: v.id("pools"),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("candidatePools")
      .withIndex("by_candidateId", (q) => q.eq("candidateId", args.candidateId))
      .filter((q) => q.eq(q.field("poolId"), args.poolId))
      .collect();

    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }

    const candidate = await ctx.db.get(args.candidateId);
    if (candidate && candidate.poolIds) {
      const updated = candidate.poolIds.filter((id) => id !== args.poolId);
      await ctx.db.patch(args.candidateId, { poolIds: updated.length > 0 ? updated : undefined });
    }
  },
});

export const suggest = action({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args): Promise<{ name: string; tags: string[]; sampleCandidateIds: number[] }[]> => {
    const client = getLlmClient();
    if (!client) return [];

    const apps: any[] = await ctx.runQuery(api.applications.getUnmatchedForSchool as any, {
      schoolId: args.schoolId,
    });

    const unpooled: any[] = apps.filter((a: any) => !a.candidate?.poolIds || a.candidate.poolIds.length === 0);
    if (unpooled.length === 0) return [];

    const candidateData: { name: string; subjects: string[]; qualifications: string[]; yearsExperience?: number }[] = unpooled.slice(0, 20).map((a: any) => ({
      name: a.candidate?.name,
      subjects: a.candidate?.subjects ?? [],
      qualifications: a.candidate?.qualifications ?? [],
      yearsExperience: a.candidate?.yearsExperience,
    }));

    try {
      const response: any = await client.chat.completions.create({
        model: LLM_MODEL,
        max_tokens: 1024,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are an expert in K-12 teacher categorization. Group these teachers into logical talent pools based on their subjects, qualifications, and experience. Pool names should follow the format like 'TGT English', 'PGT Mathematics', 'PRT All Subjects', etc. Return ONLY a JSON array (no markdown, no explanation): [{ name, tags: string[], sampleCandidateIds: number[] }] where sampleCandidateIds are 0-based indices into the candidates array.",
          },
          { role: "user", content: JSON.stringify(candidateData) },
        ],
      });

      const text: string = response.choices[0]?.message?.content ?? "";
      const jsonMatch: RegExpMatchArray | null = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      return JSON.parse(jsonMatch[0]) as { name: string; tags: string[]; sampleCandidateIds: number[] }[];
    } catch {
      return [];
    }
  },
});

export const autoTagCandidate = internalAction({
  args: {
    candidateId: v.id("candidates"),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const client = getLlmClient();
    if (!client) return;

    const candidate = await ctx.runQuery(api.candidates.get as any, {
      candidateId: args.candidateId,
    });
    if (!candidate) return;

    const existingPools = await ctx.runQuery(api.pools.listForSchool as any, {
      schoolId: args.schoolId,
    });

    const profile = {
      subjects: candidate.subjects ?? [],
      qualifications: candidate.qualifications ?? [],
      yearsExperience: candidate.yearsExperience,
      boardExperience: candidate.boardExperience ?? [],
    };

    try {
      const response = await client.chat.completions.create({
        model: LLM_MODEL,
        max_tokens: 512,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Categorize this teacher into one or more pools like TGT English, PGT Mathematics, PRT All Subjects. Return ONLY a JSON array (no markdown, no explanation): [{ name: string, confidence: number, tags: string[] }]. Confidence should be 0-100.",
          },
          { role: "user", content: JSON.stringify(profile) },
        ],
      });

      const text = response.choices[0]?.message?.content ?? "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return;

      const suggestions: Array<{ name: string; confidence: number; tags: string[] }> =
        JSON.parse(jsonMatch[0]);

      for (const suggestion of suggestions) {
        let pool = existingPools.find(
          (p: any) => p.name.toLowerCase() === suggestion.name.toLowerCase()
        );

        if (!pool) {
          const poolId = await ctx.runMutation(api.pools.create as any, {
            schoolId: args.schoolId,
            name: suggestion.name,
            tags: suggestion.tags,
            createdBy: "ai",
          });
          pool = { _id: poolId };
        }

        await ctx.runMutation(api.pools.assignToPool as any, {
          candidateId: args.candidateId,
          poolId: pool._id,
          confidence: suggestion.confidence,
        });
      }
    } catch {
      // AI tagging failure is non-critical — candidate stays untagged
    }
  },
});
