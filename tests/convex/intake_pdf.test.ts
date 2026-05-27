// @vitest-environment node
// tests/convex/intake_pdf.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import * as intake from "../../convex/intake";
import * as intakePdf from "../../convex/intake_pdf";
import * as ai from "../../convex/ai";
import * as embeddings from "../../convex/embeddings";
import * as candidates from "../../convex/candidates";
import * as triage from "../../convex/triage";
import * as authConfig from "../../convex/auth.config";
import * as server from "../../convex/_generated/server";
import * as apiModule from "../../convex/_generated/api";

// unpdf exposes `extractText(pdf, opts)` and `getDocumentProxy(bytes)`. We mock
// both so each test can drive the extracted text per-case without touching the
// real pdfjs runtime. `vi.hoisted` is required because `vi.mock` factories are
// hoisted above all imports — direct module-scope vars would race the hoist.
const { extractTextMock, getDocumentProxyMock } = vi.hoisted(() => ({
  extractTextMock: vi.fn(),
  getDocumentProxyMock: vi.fn(async (_bytes: any) => ({})),
}));
vi.mock("unpdf", () => ({
  getDocumentProxy: getDocumentProxyMock,
  extractText: extractTextMock,
}));

// mammoth handles .docx extraction.
const { extractRawTextMock } = vi.hoisted(() => ({
  extractRawTextMock: vi.fn(),
}));
vi.mock("mammoth", () => ({
  default: { extractRawText: extractRawTextMock },
}));

// Gemini vision SDK — the OCR fallback for image PDFs and the direct path
// for image uploads. Mock the class shape so we can drive responses per-test.
const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    constructor(_apiKey: string) {}
    getGenerativeModel(_opts: any) {
      return { generateContent: generateContentMock };
    }
  },
}));

// openai SDK is still used by embeddings.ts and (via getLlmClient with the
// Gemini base URL) by ai.ts for parseProfileFromText. We stub it to a no-op
// class. Default chat.completions.create returns an empty-content shape so
// downstream code that reads `response.choices[0].message.content` doesn't
// blow up — emulates the "LLM returned nothing, emit empty profile" path.
vi.mock("openai", () => {
  class MockOpenAI {
    files = { create: vi.fn() };
    responses = { create: vi.fn() };
    chat = {
      completions: {
        create: vi.fn(async () => ({ choices: [{ message: { content: "" } }] })),
      },
    };
    constructor(_opts: any) {}
    static toFile = vi.fn(async (buf: any) => buf);
  }
  return { default: MockOpenAI };
});

const modules = {
  "schema.ts": async () => ({ default: schema }),
  "intake.ts": async () => intake,
  "intake_pdf.ts": async () => intakePdf,
  "ai.ts": async () => ai,
  "embeddings.ts": async () => embeddings,
  "candidates.ts": async () => candidates,
  "triage.ts": async () => triage,
  "auth.config.ts": async () => authConfig,
  "_generated/server.js": async () => server,
  "_generated/api.js": async () => apiModule,
};

beforeEach(() => {
  process.env.EMBEDDING_PROVIDER = "stub";
  delete process.env.GOOGLE_API_KEY;
  delete process.env.OPENAI_API_KEY;
  extractTextMock.mockReset();
  extractRawTextMock.mockReset();
  generateContentMock.mockReset();
});

function geminiResponse(text: string) {
  return { response: { text: () => text } };
}

const SAMPLE_PROFILE =
  "Priya Sharma — B.Ed, M.Sc Physics. " +
  "Seven years teaching PGT Physics at Delhi Public School (CBSE). " +
  "Led JEE preparation cohort that improved class average by 35%. " +
  "Pedagogy: inquiry-based learning, peer-led discussions, lab-driven instruction. " +
  "Certifications: CTET (Paper II), NET. Languages: English, Hindi.";

describe("intake_pdf.extractTextFromResume", () => {
  it("uses pdf-parse on a text PDF, persists file pointer, and chains parseAndStoreCandidate", async () => {
    extractTextMock.mockResolvedValueOnce({ text: SAMPLE_PROFILE });

    const t = convexTest(schema, modules);
    const candidateId = await t.mutation("candidates:create" as any, {
      name: "Unparsed Placeholder",
      qualifications: [],
      certifications: [],
      boardExperience: [],
      subjects: [],
    });

    const storageId = await t.run(async (ctx: any) => {
      return await ctx.storage.store(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: "application/pdf" }));
    });

    await t.action("intake_pdf:extractTextFromResume" as any, {
      candidateId,
      storageId,
      originalName: "priya-sharma.pdf",
    });

    const c = await t.query("candidates:get" as any, { candidateId });
    expect(c).not.toBeNull();
    expect(c!.resumeStorageId).toBe(storageId);
    expect(c!.resumeOriginalName).toBe("priya-sharma.pdf");
    expect(c!.resumeExtractionMethod).toBe("pdf-parse");
    expect(c!.resumeUrl).toBeTruthy();
    expect(c!.facetEmbeddings).toBeDefined();
    expect(c!.facetEmbeddings!.overall.length).toBe(1536);
    expect(extractTextMock).toHaveBeenCalledOnce();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("falls back to Gemini vision when pdf-parse yields too little text", async () => {
    process.env.GOOGLE_API_KEY = "test-key";
    extractTextMock.mockResolvedValueOnce({ text: "scanned" }); // < 200 chars
    generateContentMock.mockResolvedValueOnce(geminiResponse(
      "Anita Verma — B.Ed, M.A. English. " +
      "Five years as TGT English at Modern School (CBSE). " +
      "Led the inter-school debate team and the school magazine. " +
      "Pedagogical approach: literature circles, Socratic seminars. " +
      "CTET Paper II cleared. Fluent in English, Hindi, French.",
    ));

    const t = convexTest(schema, modules);
    const candidateId = await t.mutation("candidates:create" as any, {
      name: "Placeholder",
      qualifications: [],
      certifications: [],
      boardExperience: [],
      subjects: [],
    });
    const storageId = await t.run(async (ctx: any) => {
      return await ctx.storage.store(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: "application/pdf" }));
    });

    await t.action("intake_pdf:extractTextFromResume" as any, {
      candidateId,
      storageId,
      originalName: "anita-scan.pdf",
    });

    const c = await t.query("candidates:get" as any, { candidateId });
    expect(c!.resumeExtractionMethod).toBe("gemini-vision");
    expect(generateContentMock).toHaveBeenCalledOnce();
  });

  it("uses mammoth on a .docx file", async () => {
    extractRawTextMock.mockResolvedValueOnce({
      value: SAMPLE_PROFILE,
      messages: [],
    });

    const t = convexTest(schema, modules);
    const candidateId = await t.mutation("candidates:create" as any, {
      name: "Placeholder",
      qualifications: [],
      certifications: [],
      boardExperience: [],
      subjects: [],
    });
    const storageId = await t.run(async (ctx: any) => {
      // ZIP signature — real .docx files would start with this, but for the
      // test the bytes are irrelevant because mammoth is mocked.
      return await ctx.storage.store(new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])]));
    });

    await t.action("intake_pdf:extractTextFromResume" as any, {
      candidateId,
      storageId,
      originalName: "dimpy-resume.docx",
    });

    const c = await t.query("candidates:get" as any, { candidateId });
    expect(c!.resumeExtractionMethod).toBe("mammoth");
    expect(extractRawTextMock).toHaveBeenCalledOnce();
    expect(extractTextMock).not.toHaveBeenCalled();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("uses Gemini vision directly on an image upload", async () => {
    process.env.GOOGLE_API_KEY = "test-key";
    generateContentMock.mockResolvedValueOnce(geminiResponse(SAMPLE_PROFILE));

    const t = convexTest(schema, modules);
    const candidateId = await t.mutation("candidates:create" as any, {
      name: "Placeholder",
      qualifications: [],
      certifications: [],
      boardExperience: [],
      subjects: [],
    });
    const storageId = await t.run(async (ctx: any) => {
      return await ctx.storage.store(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }));
    });

    await t.action("intake_pdf:extractTextFromResume" as any, {
      candidateId,
      storageId,
      originalName: "photo-of-resume.jpg",
    });

    const c = await t.query("candidates:get" as any, { candidateId });
    expect(c!.resumeExtractionMethod).toBe("gemini-vision");
    expect(generateContentMock).toHaveBeenCalledOnce();
    // unpdf must not be touched for image inputs
    expect(extractTextMock).not.toHaveBeenCalled();
  });

  it("throws when the storage object is missing", async () => {
    const t = convexTest(schema, modules);
    const candidateId = await t.mutation("candidates:create" as any, {
      name: "Placeholder",
      qualifications: [],
      certifications: [],
      boardExperience: [],
      subjects: [],
    });
    const storageId = await t.run(async (ctx: any) => {
      const id = await ctx.storage.store(new Blob([new Uint8Array([0])], { type: "application/pdf" }));
      await ctx.storage.delete(id);
      return id;
    });

    await expect(
      t.action("intake_pdf:extractTextFromResume" as any, {
        candidateId,
        storageId,
      }),
    ).rejects.toThrow(/Resume file not found/);
  });

  it("throws a friendly error on a scanned PDF when GOOGLE_API_KEY is unset", async () => {
    extractTextMock.mockResolvedValueOnce({ text: "img" }); // < 200 chars, triggers fallback

    const t = convexTest(schema, modules);
    const candidateId = await t.mutation("candidates:create" as any, {
      name: "Placeholder",
      qualifications: [],
      certifications: [],
      boardExperience: [],
      subjects: [],
    });
    const storageId = await t.run(async (ctx: any) => {
      return await ctx.storage.store(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: "application/pdf" }));
    });

    await expect(
      t.action("intake_pdf:extractTextFromResume" as any, {
        candidateId,
        storageId,
      }),
    ).rejects.toThrow(/GOOGLE_API_KEY is not configured/);
  });
});

describe("candidates.createFromUpload", () => {
  // Use fake timers so the scheduled extractTextFromResume doesn't fire after
  // the test ends.
  beforeEach(() => { vi.useFakeTimers(); });

  it("creates a candidate row + application row with the expected source channel", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("schools", {
        name: "Test School",
        board: "CBSE",
        city: "Bangalore",
        state: "KA",
        planTier: "free",
      });
    });
    const storageId = await t.run(async (ctx: any) => {
      return await ctx.storage.store(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: "application/pdf" }));
    });

    const result = await t.mutation("candidates:createFromUpload" as any, {
      schoolId,
      storageId,
      originalName: "ravi-iyer.pdf",
    });
    expect(result.candidateId).toBeDefined();
    expect(result.applicationId).toBeDefined();

    const c = await t.query("candidates:get" as any, { candidateId: result.candidateId });
    expect(c!.sourceChannel).toBe("hr_upload");
    expect(c!.origin).toBe("manual_import");

    const apps = await t.run(async (ctx: any) =>
      await ctx.db.query("applications").withIndex("by_schoolId", (q: any) => q.eq("schoolId", schoolId)).collect(),
    );
    expect(apps.length).toBe(1);
    expect(apps[0].source).toBe("manual");
    expect(apps[0].stage).toBe("sourced");
  });

  it("accepts overrides for sourceChannel + candidate name (email path)", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("schools", {
        name: "Email School",
        board: "ICSE",
        city: "Mumbai",
        state: "MH",
        planTier: "free",
      });
    });
    const storageId = await t.run(async (ctx: any) => {
      return await ctx.storage.store(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: "application/pdf" }));
    });
    const result = await t.mutation("candidates:createFromUpload" as any, {
      schoolId,
      storageId,
      originalName: "resume.pdf",
      sourceChannel: "email_parsed",
      candidateNameHint: "Asha Patel",
      candidateEmail: "asha@example.com",
    });
    const c = await t.query("candidates:get" as any, { candidateId: result.candidateId });
    expect(c!.sourceChannel).toBe("email_parsed");
    expect(c!.name).toBe("Asha Patel");
    expect(c!.email).toBe("asha@example.com");
  });
});
