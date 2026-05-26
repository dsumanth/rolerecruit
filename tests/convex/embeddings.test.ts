// tests/convex/embeddings.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as embeddings from "../../convex/embeddings";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "embeddings.ts": async () => embeddings,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
});

describe("embeddings", () => {
  it("embedText returns a 1536-dim vector with stub provider", async () => {
    const t = convexTest(schema, modules);
    const vec = await t.action("embeddings:embedText", { text: "B.Ed CBSE Physics" });
    expect(Array.isArray(vec)).toBe(true);
    expect(vec.length).toBe(1536);
  });

  it("embedBatch returns five vectors keyed by section", async () => {
    const t = convexTest(schema, modules);
    const out = await t.action("embeddings:embedBatch", {
      sections: {
        overall: "summary text",
        experience: "work history text",
        pedagogy: "teaching philosophy text",
        achievements: "outcomes text",
        leadership: "leadership text",
      },
    });
    expect(out).toHaveProperty("overall");
    expect(out.overall.length).toBe(1536);
    expect(out.experience.length).toBe(1536);
    expect(out.pedagogy.length).toBe(1536);
    expect(out.achievements.length).toBe(1536);
    expect(out.leadership.length).toBe(1536);
  });

  it("returns null when no provider configured", async () => {
    process.env.EMBEDDING_PROVIDER = "";
    delete process.env.OPENAI_API_KEY;
    const t = convexTest(schema, modules);
    const v = await t.action("embeddings:embedText", { text: "x" });
    expect(v).toBeNull();
  });
});
