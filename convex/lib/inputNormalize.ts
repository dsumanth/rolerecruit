// convex/lib/inputNormalize.ts
//
// Resume text is fed verbatim to the facet-extraction LLM. When the source
// (an OCR'd PDF with tabular layout, a Word doc with table cells, etc.)
// produces runs of tabs or other repetitive whitespace, Gemini at temperature 0
// can lock into a greedy-decoding loop that emits the same whitespace token
// repeatedly until max_tokens. The truncated response is unrecoverable.
//
// Collapsing whitespace at the input boundary removes the trigger pattern
// AND shrinks the input. Semantic content is unaffected because resumes carry
// no meaning in tab/space layout, only in tokens and line breaks.

export function normalizeResumeWhitespace(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[\x00-\x08\x0B-\x1F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
