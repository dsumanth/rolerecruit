// convex/evidenceValidator.ts
import type { ParsedFacets, RawChunk, FacetValue } from "./types";

export interface ValidationResult {
  ok: boolean;
  invalidFacets: Array<{
    facetType: string;
    value: string;
    reason: string;
  }>;
}

export interface FilterResult {
  filtered: ParsedFacets;
  droppedCount: number;
  firstReason: string | null;
}

function validateOne(fv: FacetValue, chunks: RawChunk[]): string | null {
  if (!fv || !fv.evidence) return "missing evidence";
  const { quote, offset } = fv.evidence;
  const containing = chunks.find((c) => c.text.includes(quote));
  if (!containing) return `evidence quote "${quote.substring(0, 30)}..." not found in any rawChunk`;
  const localOffset = offset - containing.offset;
  if (localOffset < 0 || localOffset >= containing.text.length) {
    return `offset ${offset} outside chunk range [${containing.offset}, ${containing.offset + containing.text.length})`;
  }
  if (!containing.text.substring(localOffset).startsWith(quote)) {
    return `offset ${offset} does not start the quote in the matching chunk`;
  }
  return null;
}

// For facets where the value's identifying keyword should literally appear in
// the supporting quote. Catches LLM interpretation overreach — e.g. tagging a
// school chain name as "CBSE_private" when CBSE isn't actually in the quote.
//
// Only applied to facet types where the rule is unambiguous. Other facet types
// (specializations like "JEE_prep", pedagogicalApproach like "inquiry_based")
// can legitimately be derived from less literal phrasing.
function keywordsForValueCheck(facetType: string, value: string): string[] | null {
  switch (facetType) {
    case "schoolTypes":
      // Use the segment before the first "_" — the board/type prefix.
      // CBSE_private → CBSE; ICSE_private → ICSE; IB_international → IB;
      // government_aided → government; government → government.
      return [value.split("_")[0]].filter((s) => s.length >= 2);
    case "languages":
      // Use the language name directly.
      return [value].filter((s) => s.length >= 2);
    default:
      return null; // no value-in-quote rule
  }
}

function checkValueSupportedByQuote(facetType: string, fv: FacetValue): string | null {
  const keywords = keywordsForValueCheck(facetType, fv.value);
  if (!keywords || keywords.length === 0) return null;
  const quoteLower = fv.evidence.quote.toLowerCase();
  const found = keywords.some((kw) => quoteLower.includes(kw.toLowerCase()));
  if (found) return null;
  return `value "${fv.value}" not supported by quote (keyword "${keywords.join("/")}" absent)`;
}

export function validateEvidence(facets: ParsedFacets, chunks: RawChunk[]): ValidationResult {
  const invalidFacets: ValidationResult["invalidFacets"] = [];
  const typedKeys: (keyof ParsedFacets)[] = [
    "specializations", "gradeLevels", "pedagogicalApproach", "leadershipRoles",
    "extracurricular", "languages", "schoolTypes", "keyAchievements", "redFlags",
  ];
  for (const k of typedKeys) {
    const arr = facets[k] as FacetValue[];
    for (const fv of arr) {
      const err = validateOne(fv, chunks);
      if (err) invalidFacets.push({ facetType: k as string, value: fv.value, reason: err });
    }
  }
  for (const [extraKey, arr] of Object.entries(facets.extras)) {
    for (const fv of arr) {
      const err = validateOne(fv, chunks);
      if (err) invalidFacets.push({ facetType: `extras.${extraKey}`, value: fv.value, reason: err });
    }
  }
  return { ok: invalidFacets.length === 0, invalidFacets };
}

// Like validateEvidence, but returns a NEW ParsedFacets with invalid items
// removed (instead of just reporting OK/NOT-OK). Use this when you want to
// salvage the good facets and discard the hallucinated ones.
//
// Applies two checks per item:
//   1. The basic evidence check (quote appears in a rawChunk at the right offset).
//   2. For schoolTypes/languages, the value's keyword must appear in the quote.
export function validateAndFilterFacets(facets: ParsedFacets, chunks: RawChunk[]): FilterResult {
  const dropped: Array<{ facetType: string; value: string; reason: string }> = [];

  const filterArr = (arr: FacetValue[], facetType: string): FacetValue[] => {
    const out: FacetValue[] = [];
    for (const fv of arr) {
      const evidenceErr = validateOne(fv, chunks);
      if (evidenceErr) {
        dropped.push({ facetType, value: fv.value, reason: evidenceErr });
        continue;
      }
      const supportErr = checkValueSupportedByQuote(facetType, fv);
      if (supportErr) {
        dropped.push({ facetType, value: fv.value, reason: supportErr });
        continue;
      }
      out.push(fv);
    }
    return out;
  };

  const filtered: ParsedFacets = {
    specializations: filterArr(facets.specializations, "specializations"),
    gradeLevels: filterArr(facets.gradeLevels, "gradeLevels"),
    pedagogicalApproach: filterArr(facets.pedagogicalApproach, "pedagogicalApproach"),
    leadershipRoles: filterArr(facets.leadershipRoles, "leadershipRoles"),
    extracurricular: filterArr(facets.extracurricular, "extracurricular"),
    languages: filterArr(facets.languages, "languages"),
    schoolTypes: filterArr(facets.schoolTypes, "schoolTypes"),
    keyAchievements: filterArr(facets.keyAchievements, "keyAchievements"),
    redFlags: filterArr(facets.redFlags, "redFlags"),
    extras: {},
  };
  for (const [extraKey, arr] of Object.entries(facets.extras)) {
    const kept = filterArr(arr, `extras.${extraKey}`);
    if (kept.length > 0) filtered.extras[extraKey] = kept;
  }

  return {
    filtered,
    droppedCount: dropped.length,
    firstReason: dropped[0]?.reason ?? null,
  };
}
