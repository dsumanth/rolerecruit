#!/usr/bin/env bun
// Runs unpdf locally on a file and prints what it extracts. No Convex, no
// Next.js, no Vercel — just pure local Node. Useful for comparing unpdf vs
// LiteParse output on the same input.
//
// Usage:
//   bun scripts/test-unpdf.ts <path-to-pdf> [--full]
//
// Examples:
//   bun scripts/test-unpdf.ts ~/Downloads/resume-with-photo.pdf
//   bun scripts/test-unpdf.ts ~/Downloads/a.pdf --full
//
// Only handles PDFs. For .docx use mammoth (the prod path will dispatch
// based on extension); for images use the LiteParse script.

import { extractText, getDocumentProxy } from "unpdf";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const filePath = args.find((a) => !a.startsWith("--"));

  if (!filePath) {
    console.error("Usage: bun scripts/test-unpdf.ts <path-to-pdf> [--full]");
    process.exit(1);
  }

  const absPath = resolve(filePath);
  const filename = basename(absPath);
  const buf = await readFile(absPath);
  console.log(`→ ${filename} (${(buf.length / 1024).toFixed(1)} KB)`);

  const t0 = Date.now();
  let text = "";
  let pageCount = 0;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    pageCount = pdf.numPages;
    const result = await extractText(pdf, { mergePages: true });
    const raw = result.text as string | string[];
    text = (Array.isArray(raw) ? raw.join("\n") : raw).trim();
  } catch (err: any) {
    console.error(`unpdf threw: ${err?.message ?? err}`);
    process.exit(1);
  }
  const durationMs = Date.now() - t0;

  console.log("");
  console.log("─── Result ─────────────────────────────────────────────");
  console.log(`File:        ${filename}`);
  console.log(`Method:      unpdf`);
  console.log(`Pages:       ${pageCount}`);
  console.log(`Chars:       ${text.length}`);
  console.log(`Parse time:  ${durationMs}ms`);
  console.log("────────────────────────────────────────────────────────");
  console.log("");
  if (flags.has("--full")) {
    console.log(text);
  } else {
    const preview = text.slice(0, 800);
    console.log(preview);
    if (text.length > 800) {
      console.log(`\n… (${text.length - 800} more chars; pass --full to see all)`);
    }
  }
}

main().catch((err) => {
  console.error("Failed:", err?.message ?? err);
  process.exit(1);
});
