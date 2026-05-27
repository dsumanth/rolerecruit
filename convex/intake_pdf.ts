"use node";

// convex/intake_pdf.ts
// Resume text extraction. Dispatches by file type from the uploaded filename:
//   - .pdf          → unpdf (text layer). Falls back to Gemini vision when the
//                     text layer is empty/sparse (scanned-image PDFs).
//   - .docx         → mammoth (pure JS, no LibreOffice needed).
//   - image formats → Gemini vision directly.
//
// Why Gemini and not OpenAI: the rest of the codebase routes LLM calls
// through getLlmClient() → Gemini 2.5 Flash-Lite (see docs/superpowers/plans/
// 2026-05-27-model-swap-deepseek-to-gemini.md). The OCR path was overlooked
// in that migration. We use Gemini's native SDK here because PDF/image inline
// input is a Gemini-native feature; the OpenAI-compat endpoint we use for
// chat completions doesn't reliably accept PDF data URLs.

import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

const MIN_USABLE_TEXT_LEN = 200;
const VISION_MODEL = "gemini-2.5-flash-lite";
const VISION_PROMPT =
  "Extract the full text of this resume verbatim. Preserve section headers " +
  "and bullet structure. Return plain text only — no commentary, no markdown.";

type ExtractionMethod = "pdf-parse" | "gemini-vision" | "mammoth";

function getExt(name: string | undefined): string {
  if (!name) return "";
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "webp"]);

function imageMime(ext: string): string {
  switch (ext) {
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png":  return "image/png";
    case "gif":  return "image/gif";
    case "bmp":  return "image/bmp";
    case "tiff":
    case "tif":  return "image/tiff";
    case "webp": return "image/webp";
    default:     return "application/octet-stream";
  }
}

async function extractWithUnpdf(buf: Buffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const result = await extractText(pdf, { mergePages: true });
    const text: string | string[] = result.text as string | string[];
    return (Array.isArray(text) ? text.join("\n") : text).trim();
  } catch {
    return "";
  }
}

async function extractWithMammoth(buf: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value.trim();
}

async function extractWithGeminiVision(buf: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Resume needs OCR, but GOOGLE_API_KEY is not configured. " +
      "Set it via `bunx convex env set GOOGLE_API_KEY <key>`.",
    );
  }
  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({ model: VISION_MODEL });
  const result = await model.generateContent([
    { inlineData: { data: buf.toString("base64"), mimeType } },
    VISION_PROMPT,
  ]);
  return result.response.text().trim();
}

export const extractTextFromResume = internalAction({
  args: {
    candidateId: v.id("candidates"),
    storageId: v.id("_storage"),
    originalName: v.optional(v.string()),
    applicationId: v.optional(v.id("applications")),
  },
  handler: async (ctx, args): Promise<void> => {
    try {
      await ctx.runMutation(internal.candidates.setParseStatus, {
        candidateId: args.candidateId,
        status: "pending",
      });

      const blob = await ctx.storage.get(args.storageId);
      if (!blob) throw new Error(`Resume file not found in storage: ${args.storageId}`);
      const buf = Buffer.from(await blob.arrayBuffer());

      const ext = getExt(args.originalName);

      let text: string;
      let method: ExtractionMethod;

      if (ext === "docx") {
        text = await extractWithMammoth(buf);
        method = "mammoth";
      } else if (IMAGE_EXTS.has(ext)) {
        text = await extractWithGeminiVision(buf, imageMime(ext));
        method = "gemini-vision";
      } else {
        // Default to PDF. Try cheap text-layer extraction first; fall back to
        // Gemini vision when the layer is missing or sparse (scanned PDFs).
        text = await extractWithUnpdf(buf);
        method = "pdf-parse";
        if (text.length < MIN_USABLE_TEXT_LEN) {
          text = await extractWithGeminiVision(buf, "application/pdf");
          method = "gemini-vision";
        }
      }

      await ctx.runMutation(internal.candidates.attachResumeFile, {
        candidateId: args.candidateId,
        storageId: args.storageId,
        originalName: args.originalName,
        method,
      });

      await ctx.runAction(api.intake.parseAndStoreCandidate, {
        candidateId: args.candidateId,
        rawText: text,
      });

      await ctx.runMutation(internal.candidates.setParseStatus, {
        candidateId: args.candidateId,
        status: "done",
      });

      if (args.applicationId) {
        await ctx.scheduler.runAfter(0, api.triage.runTriage, {
          applicationId: args.applicationId,
        });
      }
    } catch (err: any) {
      await ctx.runMutation(internal.candidates.setParseStatus, {
        candidateId: args.candidateId,
        status: "failed",
        error: err?.message ?? String(err),
      });
      throw err;
    }
  },
});
