# DeepSeek → Gemini 2.5 Flash-Lite Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace DeepSeek v4-Flash with Gemini 2.5 Flash-Lite across all 8 Convex modules + 6 test files + 1 UI surface, using Gemini's OpenAI-compatible endpoint to keep the change minimal and consolidate 8 duplicated client constructors into one shared helper.

**Architecture:** Gemini exposes an OpenAI-compatible endpoint at `https://generativelanguage.googleapis.com/v1beta/openai/`. The existing `openai` SDK works unchanged — only `baseURL`, `apiKey`, and `model` need to change. New shared helper at `convex/lib/llmClient.ts` becomes the single source of truth so a future provider swap touches one file instead of eight.

**Tech Stack:** Next.js 14, Convex 1.39.1, `openai` SDK (kept), Gemini 2.5 Flash-Lite via OpenAI-compat endpoint, vitest + convex-test.

---

## Context

The current implementation calls DeepSeek v4-Flash from 8 Convex modules. Investigation surfaced three blocking problems for an India-deployed K-12 hiring SaaS:

1. **Regulatory exposure** — India's Ministry of Finance prohibited DeepSeek on official devices (Jan 2025); CERT-In has an open investigation; DPDP Act 2023 Section 16 gives one-step authority to blacklist China-jurisdiction providers.
2. **Data residency** — DeepSeek's hosted API ships data to PRC servers; no India region; incompatible with DPDP duty-of-care for minors' education records.
3. **Reliability** — DeepSeek's own docs warn JSON mode "may occasionally return empty content."

Gemini 2.5 Flash-Lite is **cheaper on input** ($0.10 vs $0.14 per 1M tokens), runs in `asia-south1` (Mumbai) for sub-200ms latency, has DPDP-compatible contractual data residency via Vertex/Google Cloud, and ships native JSON-schema enforcement. Total annual API cost at the projected scale (5K candidates/yr/school, 100 queries/day, all of Phase 3 fully built) is ~$10/school/year — indistinguishable from DeepSeek. The decision reduces purely to compliance + reliability, both of which favor Gemini decisively.

**This plan does not touch embeddings** — `text-embedding-3-small` from OpenAI remains unchanged. The swap is LLM-only.

---

## File Structure

**New file:**
- `convex/lib/llmClient.ts` — exports `getLlmClient()` returning `OpenAI | null`, and `LLM_MODEL` constant. Single source of truth for LLM provider config.

**Modified files (refactored to use shared helper):**
- `convex/ai.ts` — facet extraction + parsing (3 model-string sites)
- `convex/jobs_ai.ts` — job parsing + embeddings (2 model-string sites)
- `convex/triage.ts` — triage decisions (1 site)
- `convex/talentSearch.ts` — talent search reranking (1 site)
- `convex/scoring.ts` — scoring + explanations (2 sites)
- `convex/pools.ts` — talent pool generation (2 sites)
- `convex/reverseMatching.ts` — reverse matching (1 site)
- `convex/globalCriteria.ts` — global criteria suggestions (1 site)

**Modified test files (env-var rename):**
- `tests/convex/intake.test.ts`
- `tests/convex/intake_pdf.test.ts`
- `tests/convex/facetExtraction.test.ts`
- `tests/convex/talentSearch.test.ts`
- `tests/convex/triage.test.ts`
- `tests/convex/graph.test.ts`

**Modified UI:**
- `app/dashboard/settings/page.tsx` (line ~357) — env-var label in Convex settings panel

**Modified config:**
- `.env.local.example` — add `GOOGLE_API_KEY=` with link to AI Studio

---

## Task 1: Create shared LLM client helper

**Files:**
- Create: `convex/lib/llmClient.ts`
- Test: `tests/convex/llmClient.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/convex/llmClient.test.ts`:

```ts
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
    expect(client!.baseURL).toBe("https://generativelanguage.googleapis.com/v1beta/openai/");
  });

  it("exports the correct model name", () => {
    expect(LLM_MODEL).toBe("gemini-2.5-flash-lite");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/convex/llmClient.test.ts`
Expected: FAIL with "Cannot find module '../../convex/lib/llmClient'"

- [ ] **Step 3: Implement the helper**

Create `convex/lib/llmClient.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/convex/llmClient.test.ts`
Expected: PASS (3/3 tests)

- [ ] **Step 5: Commit**

```bash
git add convex/lib/llmClient.ts tests/convex/llmClient.test.ts
git commit -m "feat(llm): add shared Gemini client helper

Single source of truth for LLM provider config. Uses Gemini 2.5 Flash-Lite
via Google's OpenAI-compatible endpoint, keeping the openai SDK unchanged.
Future provider swaps touch one file."
```

---

## Task 2: Migrate `convex/ai.ts` to shared helper

**Files:**
- Modify: `convex/ai.ts` (3 model-string sites at lines 35-39, 66, 130, 198)

- [ ] **Step 1: Read current `getClient()` in `convex/ai.ts`**

Read lines 1-50 of `convex/ai.ts` to confirm the existing pattern.

- [ ] **Step 2: Replace local `getClient` with shared helper import**

Remove the local `getClient()` function (lines 35-39). Add at the top of the file (with other imports):

```ts
import { getLlmClient, LLM_MODEL } from "./lib/llmClient";
```

Replace every call site `const client = getClient();` with `const client = getLlmClient();`.

- [ ] **Step 3: Replace model strings**

Find every `model: "deepseek-v4-flash"` in `convex/ai.ts` and replace with `model: LLM_MODEL` (3 instances at lines ~66, ~130, ~198 per the touch-point map; verify with grep).

Run: `rg -n "deepseek-v4-flash" convex/ai.ts`
Expected: no matches after this step.

- [ ] **Step 4: Run existing ai-related tests**

Run: `bun test tests/convex/intake.test.ts tests/convex/facetExtraction.test.ts tests/convex/graph.test.ts`
Expected: all PASS (tests delete the API-key env var, so they exercise the null-client fallback path; behavior should be unchanged).

- [ ] **Step 5: Commit**

```bash
git add convex/ai.ts
git commit -m "refactor(ai): use shared Gemini LLM client

Replaces local getClient() + hardcoded 'deepseek-v4-flash' with imports
from convex/lib/llmClient.ts. No behavior change — the env-var-missing
fallback still returns null and triggers emptyProfile()."
```

---

## Task 3: Migrate remaining 7 Convex modules

**Files:**
- Modify: `convex/jobs_ai.ts` (2 sites)
- Modify: `convex/triage.ts` (1 site)
- Modify: `convex/talentSearch.ts` (1 site)
- Modify: `convex/scoring.ts` (2 sites)
- Modify: `convex/pools.ts` (2 sites)
- Modify: `convex/reverseMatching.ts` (1 site)
- Modify: `convex/globalCriteria.ts` (1 site)

For each file, apply the same refactor pattern as Task 2:

1. Remove the local `getClient()` function (typically near the top of the file)
2. Add `import { getLlmClient, LLM_MODEL } from "./lib/llmClient";`
3. Rename `getClient()` call sites to `getLlmClient()`
4. Replace `"deepseek-v4-flash"` with `LLM_MODEL` in `client.chat.completions.create(...)` calls

- [ ] **Step 1: Migrate `convex/jobs_ai.ts`**

Apply the refactor pattern above. Confirm with:

Run: `rg -n "deepseek-v4-flash|getClient\b" convex/jobs_ai.ts`
Expected: no matches.

- [ ] **Step 2: Migrate `convex/triage.ts`**

Apply the refactor pattern above. Confirm with:

Run: `rg -n "deepseek-v4-flash|getClient\b" convex/triage.ts`
Expected: no matches.

- [ ] **Step 3: Migrate `convex/talentSearch.ts`**

Apply the refactor pattern above. Confirm with:

Run: `rg -n "deepseek-v4-flash|getClient\b" convex/talentSearch.ts`
Expected: no matches.

- [ ] **Step 4: Migrate `convex/scoring.ts`**

Apply the refactor pattern above. Confirm with:

Run: `rg -n "deepseek-v4-flash|getClient\b" convex/scoring.ts`
Expected: no matches.

- [ ] **Step 5: Migrate `convex/pools.ts`**

Apply the refactor pattern above. Confirm with:

Run: `rg -n "deepseek-v4-flash|getClient\b" convex/pools.ts`
Expected: no matches.

- [ ] **Step 6: Migrate `convex/reverseMatching.ts`**

Apply the refactor pattern above. Confirm with:

Run: `rg -n "deepseek-v4-flash|getClient\b" convex/reverseMatching.ts`
Expected: no matches.

- [ ] **Step 7: Migrate `convex/globalCriteria.ts`**

Apply the refactor pattern above. Confirm with:

Run: `rg -n "deepseek-v4-flash|getClient\b" convex/globalCriteria.ts`
Expected: no matches.

- [ ] **Step 8: Confirm no remaining DeepSeek references in `convex/`**

Run: `rg -n -i "deepseek" convex/`
Expected: no matches.

Run: `bun run tsc --noEmit`
Expected: clean (no type errors).

- [ ] **Step 9: Run all tests**

Run: `bun test`
Expected: all existing tests PASS. The env-var-missing fallback still triggers because none of these tests set `GOOGLE_API_KEY` either.

- [ ] **Step 10: Commit**

```bash
git add convex/jobs_ai.ts convex/triage.ts convex/talentSearch.ts convex/scoring.ts convex/pools.ts convex/reverseMatching.ts convex/globalCriteria.ts
git commit -m "refactor(convex): migrate 7 remaining LLM call sites to shared client

jobs_ai, triage, talentSearch, scoring, pools, reverseMatching, and
globalCriteria all now import getLlmClient + LLM_MODEL from the shared
helper. Removes 7 duplicated getClient() definitions."
```

---

## Task 4: Rename env-var teardowns in test suite

**Files:**
- Modify: `tests/convex/intake.test.ts` (line ~27)
- Modify: `tests/convex/intake_pdf.test.ts` (lines ~30, ~60)
- Modify: `tests/convex/facetExtraction.test.ts` (line ~19)
- Modify: `tests/convex/talentSearch.test.ts` (line ~20)
- Modify: `tests/convex/triage.test.ts` (line ~41)
- Modify: `tests/convex/graph.test.ts` (lines ~44, ~48, ~50-53)

The tests delete `DEEPSEEK_API_KEY` to exercise the null-client fallback. After the swap, they should delete `GOOGLE_API_KEY` instead. The `graph.test.ts` file additionally saves/restores the original value via `ORIGINAL_DEEPSEEK_KEY` — rename to `ORIGINAL_GOOGLE_KEY`.

- [ ] **Step 1: Rename in `tests/convex/intake.test.ts`**

Replace `delete process.env.DEEPSEEK_API_KEY;` with `delete process.env.GOOGLE_API_KEY;`.

- [ ] **Step 2: Rename in `tests/convex/intake_pdf.test.ts`**

Replace both occurrences of `delete process.env.DEEPSEEK_API_KEY;` with `delete process.env.GOOGLE_API_KEY;`. Update any inline comments referencing DeepSeek.

- [ ] **Step 3: Rename in `tests/convex/facetExtraction.test.ts`**

Replace `delete process.env.DEEPSEEK_API_KEY;` with `delete process.env.GOOGLE_API_KEY;`.

- [ ] **Step 4: Rename in `tests/convex/talentSearch.test.ts`**

Replace `delete process.env.DEEPSEEK_API_KEY;` with `delete process.env.GOOGLE_API_KEY;`.

- [ ] **Step 5: Rename in `tests/convex/triage.test.ts`**

Replace `delete process.env.DEEPSEEK_API_KEY;` with `delete process.env.GOOGLE_API_KEY;`.

- [ ] **Step 6: Rename in `tests/convex/graph.test.ts`**

Replace `const ORIGINAL_DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;` with `const ORIGINAL_GOOGLE_KEY = process.env.GOOGLE_API_KEY;`. Rename all references to `ORIGINAL_DEEPSEEK_KEY` → `ORIGINAL_GOOGLE_KEY` and `DEEPSEEK_API_KEY` → `GOOGLE_API_KEY` in the save/restore logic.

- [ ] **Step 7: Confirm no remaining DeepSeek references in tests**

Run: `rg -n -i "deepseek" tests/`
Expected: no matches.

- [ ] **Step 8: Run full test suite**

Run: `bun test`
Expected: all tests PASS, same count as before.

- [ ] **Step 9: Commit**

```bash
git add tests/convex/intake.test.ts tests/convex/intake_pdf.test.ts tests/convex/facetExtraction.test.ts tests/convex/talentSearch.test.ts tests/convex/triage.test.ts tests/convex/graph.test.ts
git commit -m "test: rename DEEPSEEK_API_KEY teardown to GOOGLE_API_KEY

Tests still exercise the null-client fallback. Variable rename only —
no semantic change."
```

---

## Task 5: Update settings UI label

**Files:**
- Modify: `app/dashboard/settings/page.tsx` (line ~357)

- [ ] **Step 1: Locate the env-var display**

Run: `rg -n "DEEPSEEK_API_KEY" app/dashboard/settings/page.tsx`
Expected: one match around line 357.

- [ ] **Step 2: Update label**

Replace the literal `DEEPSEEK_API_KEY` string with `GOOGLE_API_KEY` in the settings panel. If there's a human-readable label like "DeepSeek API Key", update it to "Google AI API Key (Gemini)".

- [ ] **Step 3: Verify no other references in `app/`**

Run: `rg -n -i "deepseek" app/`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/settings/page.tsx
git commit -m "ui(settings): show GOOGLE_API_KEY in deployment env panel

Cosmetic update following the LLM provider swap."
```

---

## Task 6: Update `.env.local.example`

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Inspect current state**

Run: `cat .env.local.example`

If `DEEPSEEK_API_KEY` is listed, remove or replace it. If neither is listed, add `GOOGLE_API_KEY`.

- [ ] **Step 2: Add Gemini key with documentation comment**

Add to `.env.local.example`:

```
# LLM provider: Gemini 2.5 Flash-Lite via OpenAI-compatible endpoint.
# Get a key at https://aistudio.google.com/apikey
GOOGLE_API_KEY=
```

Remove any line starting with `DEEPSEEK_API_KEY` if present.

- [ ] **Step 3: Commit**

```bash
git add .env.local.example
git commit -m "docs(env): document GOOGLE_API_KEY for Gemini provider"
```

---

## Task 7: Final verification + real-backend smoke test

**Files:** none modified.

- [ ] **Step 1: Full test suite + typecheck**

Run: `bun test && bun run tsc --noEmit`
Expected: all tests PASS, no type errors.

- [ ] **Step 2: Confirm zero DeepSeek references project-wide**

Run: `rg -n -i "deepseek" --glob '!docs/**' --glob '!*.md'`
Expected: no matches (docs/markdown excluded — historical plan files are allowed to reference DeepSeek).

- [ ] **Step 3: Set live Gemini API key in dev**

In a separate terminal (do not commit):

```bash
# Get a key from https://aistudio.google.com/apikey
npx convex env set GOOGLE_API_KEY ai-studio-key-here
```

- [ ] **Step 4: Manual smoke test — upload a real resume**

1. Run dev: `bun run dev`
2. Open `http://localhost:3000/dashboard/talent`
3. Upload a real PDF resume
4. Verify in Convex dashboard that the candidate's `parsedFacets`, `qualifications`, `subjects`, `boardExperience`, and `relationships` are all populated and look correct
5. Verify `facetEmbeddings` are present (these still come from OpenAI — unchanged)
6. Verify the candidate appears in `/dashboard/sourcing/cohorts` if relationships were extracted

Expected: behavior identical to the DeepSeek setup, with sub-1s parse latency.

- [ ] **Step 5: Document smoke test result in PR description**

When opening the PR for this migration, include:

```
## Smoke test
- [x] Uploaded <N> real resumes against dev backend with Gemini key set
- [x] Facets populated correctly
- [x] Relationships extracted and graph nodes/edges materialized
- [x] No regressions in test suite (X/X passing)
```

---

## Verification

End-to-end checks for "the swap is complete":

1. `rg -i deepseek convex/ tests/ app/` returns **zero** matches.
2. `bun test` shows the same pass count as pre-swap (177/177 at the time of writing).
3. `bun run tsc --noEmit` is clean.
4. `convex/lib/llmClient.ts` exists with two exports: `getLlmClient`, `LLM_MODEL`.
5. With `GOOGLE_API_KEY` unset → all LLM call sites gracefully fall back to deterministic/empty behavior (existing safety net).
6. With `GOOGLE_API_KEY` set in Convex dev → uploading a resume produces a populated `parsedFacets` and visible graph nodes within 2 seconds.

## Rollback

If Gemini's JSON output proves unreliable on real resumes:

1. Revert the commit chain (`git revert <task-1>..<task-7>` or `git reset --hard <pre-swap-sha>`).
2. Set `DEEPSEEK_API_KEY` back in Convex dev.
3. Note: the `convex/lib/llmClient.ts` helper is still a net win even if the provider gets reverted — leave the helper in place and just swap `baseURL` and `LLM_MODEL` back to DeepSeek values.

## Out of scope (deliberately deferred)

- **Embeddings provider swap.** `text-embedding-3-small` (OpenAI) remains. Gemini has embedding models too, but this swap is LLM-only to keep risk contained.
- **Native JSON schema enforcement.** Existing call sites use regex extraction from `text.match(/\{[\s\S]*\}/)`. Gemini supports `response_format: { type: "json_object" }` natively; adopting it would be a follow-up hardening pass, not part of this swap.
- **Levers 1 + 2 from the YAGNI discussion** (compute-on-read default for Phase 3b+, no new typed facet embeddings). Separate planning cycle.
- **Self-hosted Gemini / on-prem alternatives.** Not needed at current scale; `asia-south1` Vertex hosting solves residency.
