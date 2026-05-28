import { getLlmClient, LLM_MODEL } from "./lib/llmClient";
import { CONVERSATION_CLASSIFY_SYSTEM } from "./prompts/conversationClassify";

export type Intent = "faq" | "reschedule" | "negotiation" | "unclear";

export interface ClassifyInput {
  replyText: string;
  threadContext: Array<{ role: "agent" | "candidate"; body: string }>;
}

export interface ClassifyOutput {
  intent: Intent;
  confidence: number;
  summary: string;
}

const VALID_INTENTS = new Set<Intent>(["faq", "reschedule", "negotiation", "unclear"]);

export async function classifyReply(input: ClassifyInput): Promise<ClassifyOutput> {
  const client = getLlmClient();
  if (!client) return { intent: "unclear", confidence: 0, summary: "no_llm" };
  try {
    const res = await client.chat.completions.create({
      model: LLM_MODEL,
      max_tokens: 256,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CONVERSATION_CLASSIFY_SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            reply: input.replyText,
            recentContext: input.threadContext.slice(-5),
          }),
        },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    const intent = VALID_INTENTS.has(parsed.intent) ? (parsed.intent as Intent) : "unclear";
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
    const summary = typeof parsed.summary === "string" ? parsed.summary : "";
    return { intent, confidence, summary };
  } catch {
    return { intent: "unclear", confidence: 0, summary: "parse_error" };
  }
}
