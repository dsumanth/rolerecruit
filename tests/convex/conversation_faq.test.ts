import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
vi.mock("../../convex/lib/llmClient", () => ({
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
  LLM_MODEL: "test-model",
}));

import { draftFaqReply } from "../../convex/conversation_faq";

beforeEach(() => mockCreate.mockReset());

describe("draftFaqReply", () => {
  it("returns the draft + confidence from the LLM", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({ draft: "The salary range is INR 4-6 LPA.", confidence: 0.85 }),
        },
      }],
    });
    const result = await draftFaqReply({
      replyText: "What's the salary?",
      job: { title: "Math TGT", salaryRange: "4-6 LPA", board: "CBSE" } as any,
      school: { name: "Acme", city: "Pune", state: "MH", board: "CBSE" } as any,
      faqContent: "School timings: 8am-3pm. Transport provided.",
    });
    expect(result.draft).toContain("4-6 LPA");
    expect(result.confidence).toBe(0.85);
  });

  it("returns confidence 0 and empty draft when LLM fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("llm down"));
    const result = await draftFaqReply({
      replyText: "test",
      job: { title: "T" } as any,
      school: { name: "S" } as any,
      faqContent: "",
    });
    expect(result.draft).toBe("");
    expect(result.confidence).toBe(0);
  });
});
