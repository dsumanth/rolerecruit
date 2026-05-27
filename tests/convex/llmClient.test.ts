// tests/convex/llmClient.test.ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getLlmClient, LLM_MODEL } from "../../convex/lib/llmClient";

const ORIGINAL_KEY = process.env.GOOGLE_API_KEY;

beforeEach(() => {
  delete process.env.GOOGLE_API_KEY;
});

afterEach(() => {
  if (ORIGINAL_KEY !== undefined) {
    process.env.GOOGLE_API_KEY = ORIGINAL_KEY;
  } else {
    delete process.env.GOOGLE_API_KEY;
  }
});

describe("llmClient", () => {
  it("returns null when GOOGLE_API_KEY is unset", () => {
    expect(getLlmClient()).toBeNull();
  });

  it("returns an OpenAI client when GOOGLE_API_KEY is set", () => {
    process.env.GOOGLE_API_KEY = "test-key";
    const client = getLlmClient();
    expect(client).not.toBeNull();
    expect(client!.baseURL).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/",
    );
  });

  it("exports the correct model name", () => {
    expect(LLM_MODEL).toBe("gemini-2.5-flash-lite");
  });
});
