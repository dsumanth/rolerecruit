// convex/talentSearch.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { NL_SEARCH_TRANSLATOR_SYSTEM } from "./prompts/nlSearchTranslator";
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";

export const searchNatural = action({
  args: { question: v.string() },
  handler: async (ctx, args): Promise<{ candidates: any[]; intent: string; filter: any }> => {
    const client = getLlmClient();
    if (!client) return { candidates: [], intent: "", filter: {} };

    const res = await client.chat.completions.create({
      model: LLM_MODEL,
      max_tokens: 512,
      temperature: 0,
      messages: [
        { role: "system", content: NL_SEARCH_TRANSLATOR_SYSTEM },
        { role: "user", content: args.question.substring(0, 500) },
      ],
    });

    const text = res.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { candidates: [], intent: "", filter: {} };
    const parsed = JSON.parse(jsonMatch[0]);
    const filter = parsed.filter ?? {};

    const results = await ctx.runQuery(api.candidates.hardFilter, {
      subjects: filter.subjects,
      boards: filter.boards,
      minYears: filter.minYears,
      limit: 50,
    });

    const finalCandidates = results.filter((c: any) => {
      if (filter.requireLeadership) {
        const roles = c.parsedFacets?.leadershipRoles ?? [];
        if (roles.length === 0) return false;
      }
      if (filter.requireSpecializations?.length) {
        const specs = (c.parsedFacets?.specializations ?? []).map((s: any) => s.value.toLowerCase());
        const need = filter.requireSpecializations.every((rs: string) => specs.includes(rs.toLowerCase()));
        if (!need) return false;
      }
      if (typeof filter.redFlagsAllowedMax === "number") {
        const rf = c.parsedFacets?.redFlags?.length ?? 0;
        if (rf > filter.redFlagsAllowedMax) return false;
      }
      return true;
    });

    return { candidates: finalCandidates, intent: parsed.intent ?? "", filter };
  },
});
