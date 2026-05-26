// tests/convex/graph.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as graph from "../../convex/graph";
import * as candidates from "../../convex/candidates";
import * as ai from "../../convex/ai";
import * as embeddings from "../../convex/embeddings";
import * as intake from "../../convex/intake";
import * as backfill from "../../convex/backfill";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "graph.ts": async () => graph,
  "candidates.ts": async () => candidates,
  "ai.ts": async () => ai,
  "embeddings.ts": async () => embeddings,
  "intake.ts": async () => intake,
  "backfill.ts": async () => backfill,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
});

describe("graph canonicalization", () => {
  it("normalizes school names — strips punctuation, lowercases, collapses whitespace", () => {
    expect(graph.canonicalize("DPS R.K. Puram")).toBe("dps rk puram");
    expect(graph.canonicalize("  DPS   RK Puram  ")).toBe("dps rk puram");
    expect(graph.canonicalize("St. Xavier's School")).toBe("st xaviers school");
  });

  it("builds a stable cohort key", () => {
    expect(graph.cohortKey("Delhi University", "B.Ed", 2019)).toBe("delhi university|bed|2019");
    expect(graph.cohortKey("delhi university", "b.ed", 2019)).toBe("delhi university|bed|2019");
  });
});

describe("graph node/edge upsert", () => {
  it("upsertNode is idempotent on (type, externalId)", async () => {
    const t = convexTest(schema, modules);
    const id1 = await t.mutation("graph:upsertNode", {
      type: "School", externalId: "dps rk puram", displayName: "DPS RK Puram",
    });
    const id2 = await t.mutation("graph:upsertNode", {
      type: "School", externalId: "dps rk puram", displayName: "Delhi Public School RK Puram",
    });
    expect(id1).toBe(id2);

    // displayName should NOT have been overwritten by the second call
    const node = await t.run(async (ctx: any) => ctx.db.get(id1));
    expect(node.displayName).toBe("DPS RK Puram");
  });

  it("addEdge dedupes on (fromId, toId, type)", async () => {
    const t = convexTest(schema, modules);
    const candNode = await t.mutation("graph:upsertNode", {
      type: "Candidate", externalId: "cand_abc", displayName: "Test Cand",
    });
    const schoolNode = await t.mutation("graph:upsertNode", {
      type: "School", externalId: "dps rk puram", displayName: "DPS RK Puram",
    });
    await t.mutation("graph:addEdge", { fromId: candNode, toId: schoolNode, type: "TAUGHT_AT" });
    await t.mutation("graph:addEdge", { fromId: candNode, toId: schoolNode, type: "TAUGHT_AT" });

    const all = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_from_type", (q: any) => q.eq("fromId", candNode).eq("type", "TAUGHT_AT")).collect()
    );
    expect(all.length).toBe(1);
  });
});
