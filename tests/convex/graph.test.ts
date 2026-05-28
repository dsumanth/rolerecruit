// tests/convex/graph.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as graph from "../../convex/graph";
import * as candidates from "../../convex/candidates";
import * as ai from "../../convex/ai";
import * as aiCandidateParsing from "../../convex/ai_candidate_parsing";
import * as embeddings from "../../convex/embeddings";
import * as intake from "../../convex/intake";
import * as backfill from "../../convex/backfill";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";
import * as schools from "../../convex/schools";
import * as applications from "../../convex/applications";
import * as triage from "../../convex/triage";
import * as outreach from "../../convex/outreach";
import * as reverseMatching from "../../convex/reverseMatching";
import * as scoring from "../../convex/scoring";
import * as jobs from "../../convex/jobs";
import * as jobsAi from "../../convex/jobs_ai";

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "graph.ts": async () => graph,
  "candidates.ts": async () => candidates,
  "ai.ts": async () => ai,
  "ai_candidate_parsing.ts": async () => aiCandidateParsing,
  "embeddings.ts": async () => embeddings,
  "intake.ts": async () => intake,
  "backfill.ts": async () => backfill,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
  "schools.ts": async () => schools,
  "applications.ts": async () => applications,
  "triage.ts": async () => triage,
  "outreach.ts": async () => outreach,
  "reverseMatching.ts": async () => reverseMatching,
  "scoring.ts": async () => scoring,
  "jobs.ts": async () => jobs,
  "jobs_ai.ts": async () => jobsAi,
};

const ORIGINAL_GOOGLE_KEY = process.env.GOOGLE_API_KEY;

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
  // Restore GOOGLE_API_KEY before each test — one test deletes it to exercise
  // the no-LLM fallback path; without this restore the deletion leaks across tests.
  if (ORIGINAL_GOOGLE_KEY === undefined) {
    delete process.env.GOOGLE_API_KEY;
  } else {
    process.env.GOOGLE_API_KEY = ORIGINAL_GOOGLE_KEY;
  }
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

describe("materializeGraphFromIntake", () => {
  it("creates Candidate node + edges for previousSchools / qualifications / certifications / subjects / boards / region", async () => {
    const t = convexTest(schema, modules);
    const candId = await t.mutation("candidates:create", {
      name: "Priya Sharma", qualifications: ["B.Ed", "M.Sc Physics"], certifications: ["CTET"],
      boardExperience: ["CBSE"], subjects: ["Physics", "Chemistry"],
    });

    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: candId,
      relationships: {
        previousSchools: [
          { name: "DPS RK Puram", role: "PGT Physics", subjects: ["Physics"], yearStart: 2018, yearEnd: 2022 },
        ],
        qualifications: [
          { degree: "B.Ed", university: "Delhi University", yearEnd: 2019 },
          { degree: "M.Sc Physics", university: "Delhi University", yearEnd: 2017 },
        ],
        certifications: ["CTET"],
        referredBy: undefined,
        region: "Delhi NCR",
      },
      subjects: ["Physics", "Chemistry"],
      boardExperience: ["CBSE"],
    });

    // Candidate node exists
    const candNodes = await t.run(async (ctx: any) =>
      ctx.db.query("nodes").withIndex("by_type_externalId", (q: any) => q.eq("type", "Candidate").eq("externalId", String(candId))).collect()
    );
    expect(candNodes.length).toBe(1);
    const candNode = candNodes[0];

    // TAUGHT_AT edge to DPS RK Puram
    const taughtAt = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_from_type", (q: any) => q.eq("fromId", candNode._id).eq("type", "TAUGHT_AT")).collect()
    );
    expect(taughtAt.length).toBe(1);

    // Two HOLDS edges (B.Ed + M.Sc Physics)
    const holds = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_from_type", (q: any) => q.eq("fromId", candNode._id).eq("type", "HOLDS")).collect()
    );
    expect(holds.length).toBe(2);

    // CERTIFIED_IN, SPECIALIZES_IN (×2), BELONGS_TO (CBSE), LOCATED_IN (region)
    const certEdges = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_from_type", (q: any) => q.eq("fromId", candNode._id).eq("type", "CERTIFIED_IN")).collect()
    );
    expect(certEdges.length).toBe(1);
    const specEdges = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_from_type", (q: any) => q.eq("fromId", candNode._id).eq("type", "SPECIALIZES_IN")).collect()
    );
    expect(specEdges.length).toBe(2);
    const boardEdges = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_from_type", (q: any) => q.eq("fromId", candNode._id).eq("type", "BELONGS_TO")).collect()
    );
    // BELONGS_TO includes (CBSE board) + (2 cohort memberships: DU B.Ed 2019 + DU M.Sc Physics 2017) = 3
    expect(boardEdges.length).toBe(3);
    const regionEdges = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_from_type", (q: any) => q.eq("fromId", candNode._id).eq("type", "LOCATED_IN")).collect()
    );
    expect(regionEdges.length).toBe(1);
  });

  it("composes a Cohort node from (university, program, endYear) shared across candidates", async () => {
    const t = convexTest(schema, modules);
    const candA = await t.mutation("candidates:create", {
      name: "Cand A", qualifications: ["B.Ed"], subjects: [],
    });
    const candB = await t.mutation("candidates:create", {
      name: "Cand B", qualifications: ["B.Ed"], subjects: [],
    });
    const candC = await t.mutation("candidates:create", {
      name: "Cand C", qualifications: ["M.Ed"], subjects: [],
    });
    const baseRel = { previousSchools: [], certifications: [] };
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: candA,
      relationships: { ...baseRel, qualifications: [{ degree: "B.Ed", university: "Delhi University", yearEnd: 2019 }] },
      subjects: [], boardExperience: [],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: candB,
      relationships: { ...baseRel, qualifications: [{ degree: "B.Ed", university: "Delhi University", yearEnd: 2019 }] },
      subjects: [], boardExperience: [],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: candC,
      relationships: { ...baseRel, qualifications: [{ degree: "M.Ed", university: "Delhi University", yearEnd: 2020 }] },
      subjects: [], boardExperience: [],
    });

    // Exactly two Cohort nodes (DU B.Ed 2019 and DU M.Ed 2020)
    const cohortNodes = await t.run(async (ctx: any) =>
      ctx.db.query("nodes").withIndex("by_type", (q: any) => q.eq("type", "Cohort")).collect()
    );
    expect(cohortNodes.length).toBe(2);

    const buEd = cohortNodes.find((c: any) => c.externalId === "delhi university|bed|2019");
    expect(buEd).toBeDefined();

    // Both A and B point to the DU B.Ed 2019 Cohort via BELONGS_TO
    const cohortMembership = await t.run(async (ctx: any) =>
      ctx.db.query("edges").withIndex("by_to_type", (q: any) => q.eq("toId", buEd!._id).eq("type", "BELONGS_TO")).collect()
    );
    expect(cohortMembership.length).toBe(2);
  });

  it("is idempotent — running twice on the same input doesn't duplicate edges", async () => {
    const t = convexTest(schema, modules);
    const candId = await t.mutation("candidates:create", {
      name: "Cand X", qualifications: ["B.Ed"], subjects: ["Physics"],
    });
    const rel = {
      previousSchools: [{ name: "DPS RK Puram", yearStart: 2018, yearEnd: 2022 }],
      qualifications: [{ degree: "B.Ed", university: "Delhi University", yearEnd: 2019 }],
      certifications: ["CTET"],
    };
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: candId, relationships: rel, subjects: ["Physics"], boardExperience: ["CBSE"],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: candId, relationships: rel, subjects: ["Physics"], boardExperience: ["CBSE"],
    });

    const allEdges = await t.run(async (ctx: any) =>
      ctx.db.query("edges").collect()
    );
    // Expected unique edges:
    // - TAUGHT_AT (DPS), HOLDS (B.Ed qual), FROM (qual→DU), CERTIFIED_IN (CTET),
    //   SPECIALIZES_IN (Physics), BELONGS_TO (CBSE board), BELONGS_TO (Cohort)
    // = 7 edges
    expect(allEdges.length).toBe(7);
  });
});

describe("intake → graph integration", () => {
  it("parseAndStoreCandidate (no LLM) still works and leaves graph empty", async () => {
    // With no GOOGLE_API_KEY, parseProfileFromText returns emptyProfile() —
    // relationships are empty — so no graph is built. This guards against the
    // intake hook crashing on empty input.
    delete process.env.GOOGLE_API_KEY;
    const t = convexTest(schema, modules);
    const candId = await t.mutation("candidates:create", {
      name: "X", qualifications: ["B.Ed"], subjects: ["Physics"],
    });
    await t.action("intake:parseAndStoreCandidate", { candidateId: candId, rawText: "" });

    // No Candidate node because materializeGraphFromIntake bails when
    // relationships are all empty (see helper below)
    const allNodes = await t.run(async (ctx: any) => ctx.db.query("nodes").collect());
    expect(allNodes.length).toBe(0);
  });

  it("intake.runGraphMaterialization mutation builds the graph from a candidate row", async () => {
    const t = convexTest(schema, modules);
    const candId = await t.mutation("candidates:create", {
      name: "Priya Sharma", qualifications: ["B.Ed"], certifications: ["CTET"],
      boardExperience: ["CBSE"], subjects: ["Physics"],
    });
    // Seed the candidate with parsedFacets + a synthetic relationships hint by
    // patching the row directly (in production this is written by writeCompiledData)
    await t.run(async (ctx: any) => {
      await ctx.db.patch(candId, {
        parsedFacets: {
          specializations: [], gradeLevels: [], pedagogicalApproach: [],
          leadershipRoles: [], extracurricular: [], languages: [],
          schoolTypes: [], keyAchievements: [], redFlags: [], extras: {},
        },
        rawChunks: [],
        parsedAt: Date.now(),
        parsedVersion: "facets-v2",
      });
    });

    // Materialize directly from a synthetic relationships block
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: candId,
      relationships: {
        previousSchools: [{ name: "DPS RK Puram", yearStart: 2018, yearEnd: 2022 }],
        qualifications: [{ degree: "B.Ed", university: "Delhi University", yearEnd: 2019 }],
        certifications: ["CTET"],
      },
      subjects: ["Physics"],
      boardExperience: ["CBSE"],
    });

    // Candidate node should be stamped with the graphVersion on the candidates row
    const c = await t.query("candidates:get", { candidateId: candId });
    expect(c!.graphVersion).toBe("graph-v1");
  });
});

describe("graph backfill", () => {
  it("backfillGraph paginates through candidates and stamps graphVersion", async () => {
    const t = convexTest(schema, modules);

    // Seed 5 candidates, all with parsedFacets but no graph
    const ids: any[] = [];
    for (let i = 0; i < 5; i++) {
      const cId = await t.mutation("candidates:create", {
        name: `Cand ${i}`, qualifications: ["B.Ed"], certifications: ["CTET"],
        boardExperience: ["CBSE"], subjects: ["Physics"],
      });
      // Patch with minimal parsed state (no graphVersion → backfill picks it up)
      await t.run(async (ctx: any) => {
        await ctx.db.patch(cId, {
          parsedFacets: {
            specializations: [], gradeLevels: [], pedagogicalApproach: [],
            leadershipRoles: [], extracurricular: [], languages: [],
            schoolTypes: [], keyAchievements: [], redFlags: [], extras: {},
          },
          rawChunks: [],
          parsedAt: Date.now(),
          parsedVersion: "facets-v2",
        });
      });
      ids.push(cId);
    }

    // Run backfill with pageSize=2 to force multiple pages
    const result = await t.action("backfill:backfillGraph", { pageSize: 2 });
    expect(result.processed).toBe(5);
    expect(result.failed).toBe(0);

    // All 5 should have a Candidate node + at least one edge (Physics SPECIALIZES_IN + CBSE BELONGS_TO + CTET CERTIFIED_IN)
    for (const id of ids) {
      const c = await t.query("candidates:get", { candidateId: id });
      expect(c!.graphVersion).toBe("graph-v1");
    }
    const candNodes = await t.run(async (ctx: any) =>
      ctx.db.query("nodes").withIndex("by_type", (q: any) => q.eq("type", "Candidate")).collect()
    );
    expect(candNodes.length).toBe(5);
  });
});

describe("cohort sourcing queries", () => {
  it("listCohorts returns cohorts with member counts", async () => {
    const t = convexTest(schema, modules);
    const c1 = await t.mutation("candidates:create", { name: "A", qualifications: ["B.Ed"], subjects: [] });
    const c2 = await t.mutation("candidates:create", { name: "B", qualifications: ["B.Ed"], subjects: [] });
    const c3 = await t.mutation("candidates:create", { name: "C", qualifications: ["M.Ed"], subjects: [] });

    const rel = (degree: string, year: number) => ({
      previousSchools: [], certifications: [],
      qualifications: [{ degree, university: "Delhi University", yearEnd: year }],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: c1, relationships: rel("B.Ed", 2019), subjects: [], boardExperience: [],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: c2, relationships: rel("B.Ed", 2019), subjects: [], boardExperience: [],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: c3, relationships: rel("M.Ed", 2020), subjects: [], boardExperience: [],
    });

    const cohorts = await t.query("graph:listCohorts", { limit: 50 });
    expect(cohorts.length).toBe(2);
    const buEd = cohorts.find((c: any) => c.displayName === "Delhi University B.Ed 2019");
    expect(buEd?.memberCount).toBe(2);
    const mEd = cohorts.find((c: any) => c.displayName === "Delhi University M.Ed 2020");
    expect(mEd?.memberCount).toBe(1);
  });

  it("listCandidatesInCohort returns candidates connected to the cohort", async () => {
    const t = convexTest(schema, modules);
    const c1 = await t.mutation("candidates:create", { name: "A", qualifications: ["B.Ed"], subjects: [] });
    const c2 = await t.mutation("candidates:create", { name: "B", qualifications: ["B.Ed"], subjects: [] });
    const rel = {
      previousSchools: [], certifications: [],
      qualifications: [{ degree: "B.Ed", university: "Delhi University", yearEnd: 2019 }],
    };
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: c1, relationships: rel, subjects: [], boardExperience: [],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: c2, relationships: rel, subjects: [], boardExperience: [],
    });

    const cohorts = await t.query("graph:listCohorts", { limit: 50 });
    const buEd = cohorts.find((c: any) => c.displayName === "Delhi University B.Ed 2019");
    const members = await t.query("graph:listCandidatesInCohort", {
      cohortNodeId: buEd!.nodeId,
      untappedOnly: false,
      limit: 50,
    });
    expect(members.length).toBe(2);
    expect(members.map((m: any) => m.name).sort()).toEqual(["A", "B"]);
  });

  it("listCandidatesInCohort with untappedOnly=true excludes candidates with active applications", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.mutation("schools:create", {
      name: "S", board: "CBSE", city: "Mumbai", state: "MH",
    });
    const c1 = await t.mutation("candidates:create", { name: "Active", qualifications: ["B.Ed"], subjects: [] });
    const c2 = await t.mutation("candidates:create", { name: "Untapped", qualifications: ["B.Ed"], subjects: [] });
    const rel = {
      previousSchools: [], certifications: [],
      qualifications: [{ degree: "B.Ed", university: "Delhi University", yearEnd: 2019 }],
    };
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: c1, relationships: rel, subjects: [], boardExperience: [],
    });
    await t.mutation("graph:materializeGraphFromIntake", {
      candidateId: c2, relationships: rel, subjects: [], boardExperience: [],
    });

    // c1 has an active application; c2 doesn't
    await t.mutation("applications:create", {
      candidateId: c1, schoolId, skipTriage: true,
    });

    const cohorts = await t.query("graph:listCohorts", { limit: 50 });
    const buEd = cohorts.find((c: any) => c.displayName === "Delhi University B.Ed 2019");

    const untapped = await t.query("graph:listCandidatesInCohort", {
      cohortNodeId: buEd!.nodeId,
      untappedOnly: true,
      limit: 50,
    });
    expect(untapped.length).toBe(1);
    expect(untapped[0].name).toBe("Untapped");
  });
});
