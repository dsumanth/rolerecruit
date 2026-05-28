import { getLlmClient, LLM_MODEL } from "./lib/llmClient";
import { CONVERSATION_FAQ_DRAFT_SYSTEM } from "./prompts/conversationFaqDraft";

export interface FaqDraftInput {
  replyText: string;
  job: {
    title?: string;
    subject?: string;
    level?: string;
    board?: string;
    salaryRange?: string;
    qualifications?: string[];
  };
  school: {
    name?: string;
    city?: string;
    state?: string;
    board?: string;
    about?: string;
    perks?: Array<{ label: string; description: string }>;
  };
  faqContent: string;
}

export interface FaqDraftOutput {
  draft: string;
  confidence: number;
}

export async function draftFaqReply(input: FaqDraftInput): Promise<FaqDraftOutput> {
  const client = getLlmClient();
  if (!client) return { draft: "", confidence: 0 };
  try {
    const res = await client.chat.completions.create({
      model: LLM_MODEL,
      max_tokens: 400,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CONVERSATION_FAQ_DRAFT_SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            question: input.replyText,
            jobContext: {
              title: input.job.title,
              subject: input.job.subject,
              level: input.job.level,
              board: input.job.board,
              salaryRange: input.job.salaryRange,
              qualifications: input.job.qualifications,
            },
            schoolContext: {
              name: input.school.name,
              city: input.school.city,
              state: input.school.state,
              board: input.school.board,
              about: input.school.about,
              perks: input.school.perks,
            },
            schoolFaq: input.faqContent,
          }),
        },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    const draft = typeof parsed.draft === "string" ? parsed.draft : "";
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
    return { draft, confidence };
  } catch {
    return { draft: "", confidence: 0 };
  }
}
