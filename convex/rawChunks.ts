import type { RawChunk } from "./types";

const VALID_SECTIONS = new Set<RawChunk["section"]>([
  "header", "experience", "pedagogy", "achievements", "leadership", "other",
]);

// The LLM occasionally drifts off-prompt and emits a section label outside the
// allowed enum (e.g. "education" instead of "pedagogy"), which the
// writeCompiledData validator then rejects — taking down the whole parse. Any
// unknown label collapses to "other": the chunk text is still preserved for
// evidence validation and the overall embedding; only the per-facet bucketing
// is lost.
function sanitizeRawChunk(c: unknown): RawChunk | null {
  if (!c || typeof c !== "object") return null;
  const obj = c as Record<string, unknown>;
  if (typeof obj.text !== "string" || !obj.text) return null;
  const section: RawChunk["section"] =
    typeof obj.section === "string" && VALID_SECTIONS.has(obj.section as RawChunk["section"])
      ? (obj.section as RawChunk["section"])
      : "other";
  const offset = typeof obj.offset === "number" && Number.isFinite(obj.offset) ? obj.offset : 0;
  return { text: obj.text, section, offset };
}

export function sanitizeRawChunks(input: unknown): RawChunk[] {
  if (!Array.isArray(input)) return [];
  const out: RawChunk[] = [];
  for (const c of input) {
    const s = sanitizeRawChunk(c);
    if (s) out.push(s);
  }
  return out;
}
