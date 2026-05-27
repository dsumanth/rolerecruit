import OpenAI from "openai";

/**
 * Returns an OpenAI-SDK client configured to talk to Gemini 2.5 Flash-Lite
 * via Google's OpenAI-compatible endpoint. Returns null when GOOGLE_API_KEY
 * is unset (callers fall back to deterministic/stub behavior).
 *
 * Provider swap: change baseURL + LLM_MODEL here only.
 */
export function getLlmClient(): OpenAI | null {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
}

export const LLM_MODEL = "gemini-2.5-flash-lite";
