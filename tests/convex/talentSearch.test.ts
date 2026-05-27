import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as talentSearch from "../../convex/talentSearch";
import * as candidates from "../../convex/candidates";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "talentSearch.ts": async () => talentSearch,
  "candidates.ts": async () => candidates,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  delete process.env.GOOGLE_API_KEY;
});

describe("talentSearch", () => {
  it("returns empty result gracefully when no LLM is configured", async () => {
    const t = convexTest(schema, modules);
    const out = await t.action("talentSearch:searchNatural", { question: "Physics teachers" });
    expect(out).toEqual({ candidates: [], intent: "", filter: {} });
  });
});
