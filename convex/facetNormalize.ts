// convex/facetNormalize.ts
//
// Normalizes LLM-emitted facet values into the canonical { value, evidence } shape
// that Convex mutations and downstream code expect. The LLM prompt asks for the
// canonical shape, but models drift — they sometimes flatten evidence to the top
// level and store the facet value under a facet-named field (e.g. `language: "English"`
// instead of `value: "English"`). This module is the boundary that absorbs that drift.
import type { FacetValue } from "./types";

const EVIDENCE_KEYS = new Set(["quote", "offset", "context", "evidence", "value"]);

function pickValue(it: Record<string, unknown>): string | null {
  if (typeof it.value === "string") return it.value;
  for (const [k, v] of Object.entries(it)) {
    if (EVIDENCE_KEYS.has(k)) continue;
    if (typeof v === "string") return v;
  }
  return null;
}

function pickEvidenceField<T>(
  it: Record<string, unknown>,
  key: "quote" | "offset" | "context",
  guard: (v: unknown) => v is T,
): T | null {
  const top = (it as any)[key];
  if (guard(top)) return top;
  const nested = (it.evidence as any)?.[key];
  if (guard(nested)) return nested;
  return null;
}

const isString = (v: unknown): v is string => typeof v === "string";
const isNumber = (v: unknown): v is number => typeof v === "number";

function normalizeFacetValue(item: unknown): FacetValue | null {
  if (!item || typeof item !== "object") return null;
  const it = item as Record<string, unknown>;

  const value = pickValue(it);
  const quote = pickEvidenceField(it, "quote", isString);
  const offset = pickEvidenceField(it, "offset", isNumber);
  const context = pickEvidenceField(it, "context", isString);

  if (value === null || quote === null || offset === null || context === null) return null;
  return { value, evidence: { quote, offset, context } };
}

export function normalizeFacetArray(input: unknown): FacetValue[] {
  if (!Array.isArray(input)) return [];
  const out: FacetValue[] = [];
  for (const item of input) {
    const norm = normalizeFacetValue(item);
    if (norm) out.push(norm);
  }
  return out;
}

// Coerce a value the LLM may emit as either a plain string OR a facet-object
// (e.g. `{value: "Physics", evidence: {...}}`, `{subject: "Physics"}`,
// `{degree: "B.Ed", ...}`) into a single string. Falls back through common
// field names that the model uses interchangeably for the "value" slot.
function stringFromMaybeFacet(item: unknown): string | null {
  if (typeof item === "string") return item.trim() || null;
  if (!item || typeof item !== "object") return null;
  const it = item as Record<string, unknown>;
  const candidates = ["value", "degree", "name", "title", "label"];
  for (const k of candidates) {
    if (typeof it[k] === "string" && (it[k] as string).trim()) return (it[k] as string).trim();
  }
  return null;
}

export function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    const s = stringFromMaybeFacet(item);
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

export function normalizeOptionalString(input: unknown): string | null {
  return stringFromMaybeFacet(input);
}
