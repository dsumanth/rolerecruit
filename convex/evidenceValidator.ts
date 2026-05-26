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

function validateOne(fv: FacetValue, chunks: RawChunk[]): string | null {
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
