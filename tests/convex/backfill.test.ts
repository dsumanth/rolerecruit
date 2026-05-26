import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as backfill from "../../convex/backfill";
import * as candidates from "../../convex/candidates";
import * as intake from "../../convex/intake";
import * as ai from "../../convex/ai";
import * as embeddings from "../../convex/embeddings";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "backfill.ts": async () => backfill,
  "candidates.ts": async () => candidates,
  "intake.ts": async () => intake,
  "ai.ts": async () => ai,
  "embeddings.ts": async () => embeddings,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => { process.env.EMBEDDING_PROVIDER = "stub"; });

describe("backfill", () => {
  it("findStaleCandidates returns candidates missing version stamps", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation("candidates:create", {
      name: "Stale", qualifications: [], certifications: [],
      boardExperience: [], subjects: ["Physics"],
    });
    const stale = await t.query("backfill:findStaleCandidates", { limit: 10 });
    expect(stale.map((c: any) => c._id)).toContain(id);
  });
});
