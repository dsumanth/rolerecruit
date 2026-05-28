import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
vi.mock("../../convex/lib/llmClient", () => ({
  getLlmClient: () => ({ chat: { completions: { create: mockCreate } } }),
  LLM_MODEL: "test-model",
}));

import { classifyReply } from "../../convex/conversation_classify";

beforeEach(() => mockCreate.mockReset());

describe("classifyReply", () => {
  it("returns parsed intent + confidence from the LLM response", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ intent: "faq", confidence: 0.9, summary: "salary q" }) } }],
    });
    const result = await classifyReply({
      replyText: "What's the salary?",
      threadContext: [{ role: "agent", body: "We'd like to invite you" }],
    });
    expect(result.intent).toBe("faq");
    expect(result.confidence).toBe(0.9);
  });

  it("returns intent='unclear' when the LLM response is unparseable JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "not json at all" } }],
    });
    const result = await classifyReply({ replyText: "test", threadContext: [] });
    expect(result.intent).toBe("unclear");
    expect(result.confidence).toBe(0);
  });

  it("coerces an invalid intent value to 'unclear'", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ intent: "smalltalk", confidence: 0.9 }) } }],
    });
    const result = await classifyReply({ replyText: "hi", threadContext: [] });
    expect(result.intent).toBe("unclear");
  });
});
