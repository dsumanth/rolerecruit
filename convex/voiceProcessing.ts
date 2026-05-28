import { action } from "./_generated/server";
import { v } from "convex/values";
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";

export function buildSummaryPrompt(args: {
  transcript: string;
  fieldKey: string;
  language: string;
}): string {
  return `You are summarizing an evaluator's spoken feedback about a teaching candidate.

Field being summarized: ${args.fieldKey}
Language detected: ${args.language}

Transcript:
"""
${args.transcript}
"""

Summarize this feedback into 3 to 5 concise bullet points. Each bullet is a single observation or judgment, preserving specifics. Do not invent. Do not add headings or commentary. Output as a numbered list, one bullet per line.`;
}

export function parseSummaryResponse(raw: string): string[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets: string[] = [];
  for (const line of lines) {
    const m = line.match(/^(?:\d+[.)]|[-*•])\s+(.+)$/);
    if (m) {
      let b = m[1].trim();
      if (b.length > 120) b = b.slice(0, 117).trimEnd() + "...";
      bullets.push(b);
      if (bullets.length >= 5) break;
    }
  }
  return bullets;
}

export const summarizeTranscript = action({
  args: {
    transcript: v.string(),
    fieldKey: v.string(),
    language: v.string(),
    durationSec: v.number(),
  },
  handler: async (_ctx, args) => {
    if (args.transcript.trim().length < 5) {
      return { summaryPoints: [] as string[], language: args.language };
    }
    const prompt = buildSummaryPrompt({
      transcript: args.transcript,
      fieldKey: args.fieldKey,
      language: args.language,
    });
    const client = getLlmClient();
    if (!client) {
      // Fallback: just take first 3 sentences as bullets.
      const sentences = args.transcript
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
      return {
        summaryPoints: sentences.map((s) => (s.length > 120 ? s.slice(0, 117) + "..." : s)),
        language: args.language,
      };
    }
    const completion = await client.chat.completions.create({
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });
    const raw = completion.choices?.[0]?.message?.content ?? "";
    return {
      summaryPoints: parseSummaryResponse(raw),
      language: args.language,
    };
  },
});
