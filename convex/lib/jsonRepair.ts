// convex/lib/jsonRepair.ts
//
// LLM JSON outputs sometimes contain literal control characters (newlines,
// tabs, etc.) inside string values — usually because the model copied a chunk
// of source text verbatim into an `evidence.context` or similar field without
// escaping the embedded newline. JSON.parse rejects those as "Bad control
// character in string literal".
//
// This single-pass scanner walks the response and escapes any character in the
// 0x00-0x1F range when it appears INSIDE a string literal (i.e. between an
// opening `"` and the matching closing `"`). Characters outside string literals
// — like the whitespace JSON uses between tokens — are left alone.
//
// The scanner tracks backslash escapes so that already-escaped characters
// (e.g. `\"`, `\n`) pass through untouched.

export function repairJsonControlChars(input: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        if (ch === "\n") out += "\\n";
        else if (ch === "\r") out += "\\r";
        else if (ch === "\t") out += "\\t";
        else if (ch === "\b") out += "\\b";
        else if (ch === "\f") out += "\\f";
        else out += "\\u" + code.toString(16).padStart(4, "0");
        continue;
      }
    }
    out += ch;
  }
  return out;
}
