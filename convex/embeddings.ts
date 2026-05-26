// convex/embeddings.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { EMBEDDING_DIMS, EMBEDDING_VERSION } from "./versions";
import type { FacetEmbeddings } from "./types";
import OpenAI from "openai";

type EmbeddingProvider = "openai" | "stub" | "none";

function getProvider(): EmbeddingProvider {
  const explicit = process.env.EMBEDDING_PROVIDER;
  if (explicit === "stub") return "stub";
  if (explicit === "openai") return "openai";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "none";
}

// Deterministic stub for tests
function stubEmbed(text: string): number[] {
  const vec = new Array(EMBEDDING_DIMS).fill(0);
  for (let i = 0; i < text.length && i < EMBEDDING_DIMS; i++) {
    vec[i] = (text.charCodeAt(i) % 100) / 100;
  }
  return vec;
}

async function openaiEmbedSingle(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const client = new OpenAI({ apiKey });
  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text.substring(0, 8000),
    dimensions: EMBEDDING_DIMS,
  });
  return res.data[0]?.embedding ?? null;
}

async function openaiEmbedBatch(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return texts.map(() => null);
  const client = new OpenAI({ apiKey });
  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texts.map((t) => t.substring(0, 8000)),
    dimensions: EMBEDDING_DIMS,
  });
  return texts.map((_, i) => res.data[i]?.embedding ?? null);
}

export const embedText = action({
  args: { text: v.string() },
  handler: async (_ctx, args): Promise<number[] | null> => {
    const provider = getProvider();
    if (provider === "stub") return stubEmbed(args.text);
    if (provider === "openai") return await openaiEmbedSingle(args.text);
    return null;
  },
});

export const embedBatch = action({
  args: {
    sections: v.object({
      overall: v.string(),
      experience: v.string(),
      pedagogy: v.string(),
      achievements: v.string(),
      leadership: v.string(),
    }),
  },
  handler: async (_ctx, args): Promise<FacetEmbeddings | null> => {
    const provider = getProvider();
    const keys: (keyof typeof args.sections)[] = ["overall", "experience", "pedagogy", "achievements", "leadership"];
    const inputs = keys.map((k) => args.sections[k]);

    if (provider === "stub") {
      const out: any = {};
      for (const k of keys) out[k] = stubEmbed(args.sections[k]);
      return out;
    }
    if (provider === "openai") {
      const vectors = await openaiEmbedBatch(inputs);
      if (vectors.some((v) => v === null)) return null;
      const out: any = {};
      keys.forEach((k, i) => { out[k] = vectors[i]; });
      return out;
    }
    return null;
  },
});

export function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export { EMBEDDING_VERSION };
