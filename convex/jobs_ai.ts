import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";
import { JOB_EMBEDDING_VERSION } from "./versions";
import { JOB_SECTION_SPLITTER_SYSTEM } from "./prompts/jobSectionSplitter";

const SYSTEM_PROMPT = `You are an AI that parses natural language job descriptions for Indian K-12 schools into structured criteria.

Indian education context:
- Boards: CBSE, ICSE, IB, IGCSE, State Board
- Teaching levels: PRT (Primary Teacher, Classes 1-5), TGT (Trained Graduate Teacher, Classes 6-10), PGT (Post Graduate Teacher, Classes 11-12)
- Common qualifications: B.Ed, D.El.Ed, M.Ed, CTET, State TET, NET, Ph.D
- Subjects include: English, Hindi, Mathematics, Physics, Chemistry, Biology, History, Geography, Economics, Computer Science, Sanskrit, Regional Languages

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "subjects": string[],
  "board": string,
  "level": string,
  "requiredQualifications": string[],
  "preferredQualifications": string[],
  "minExperience": number | null,
  "skills": string[]
}`;

export const parseJobWithAI = action({
  args: {
    jobId: v.id("jobPostings"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(api.jobs.get as any, { jobId: args.jobId });
    if (!job) throw new Error("Job not found");

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY not configured");

    const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });

    const response = await client.chat.completions.create({
      model: "deepseek-v4-flash",
      max_tokens: 1024,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Parse this job description:\n\n${job.naturalLanguageDescription}` },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      throw new Error(`Failed to parse AI response: ${text.substring(0, 300)}`);
    }

    await ctx.runMutation(internal.jobs.saveParsedCriteria as any, {
      jobId: args.jobId,
      parsedCriteria: {
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
        board: typeof parsed.board === "string" ? parsed.board : "",
        level: typeof parsed.level === "string" ? parsed.level : "",
        requiredQualifications: Array.isArray(parsed.requiredQualifications) ? parsed.requiredQualifications : [],
        preferredQualifications: Array.isArray(parsed.preferredQualifications) ? parsed.preferredQualifications : [],
        minExperience: typeof parsed.minExperience === "number" ? parsed.minExperience : null,
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      },
    });

    return { parsedCriteria: parsed };
  },
});

export const computeRoleEmbeddings = action({
  args: { jobId: v.id("jobPostings") },
  handler: async (ctx, args): Promise<void> => {
    const job = await ctx.runQuery(api.jobs.get as any, { jobId: args.jobId });
    if (!job) return;

    // 1. Split JD into 5 sections via DeepSeek (or fallback to raw text)
    const apiKey = process.env.DEEPSEEK_API_KEY;
    let sections: { overall: string; experience: string; pedagogy: string; achievements: string; leadership: string };
    const fallback = job.naturalLanguageDescription || `${job.title} ${job.subject} ${job.board} ${job.level}`;

    if (!apiKey) {
      sections = { overall: fallback, experience: fallback, pedagogy: fallback, achievements: fallback, leadership: fallback };
    } else {
      try {
        const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
        const res = await client.chat.completions.create({
          model: "deepseek-v4-flash",
          max_tokens: 1024,
          temperature: 0,
          messages: [
            { role: "system", content: JOB_SECTION_SPLITTER_SYSTEM },
            { role: "user", content: `${job.title} (${job.subject}, ${job.board}, ${job.level}, min ${job.minExperience ?? 0}y): ${job.naturalLanguageDescription}` },
          ],
        });
        const text = res.choices[0]?.message?.content ?? "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        sections = jsonMatch ? JSON.parse(jsonMatch[0]) : { overall: fallback, experience: fallback, pedagogy: fallback, achievements: fallback, leadership: fallback };
        // Defensive: ensure all 5 keys present and non-empty
        for (const k of ["overall", "experience", "pedagogy", "achievements", "leadership"] as const) {
          if (!sections[k] || typeof sections[k] !== "string" || !sections[k].length) {
            sections[k] = fallback;
          }
        }
      } catch {
        sections = { overall: fallback, experience: fallback, pedagogy: fallback, achievements: fallback, leadership: fallback };
      }
    }

    // 2. Embed all 5 sections in one batched call
    const roleEmbeddings = await ctx.runAction(api.embeddings.embedBatch, { sections });
    if (!roleEmbeddings) return;

    // 3. Persist via jobs:setRoleEmbeddings
    await ctx.runMutation(api.jobs.setRoleEmbeddings as any, {
      jobId: args.jobId,
      roleEmbeddings,
      version: JOB_EMBEDDING_VERSION,
    });
  },
});
