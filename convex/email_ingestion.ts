import { action, httpAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// Body shape matches the common inbound-email webhook envelopes
// (SendGrid Inbound Parse, Postmark Inbound, Resend Inbound):
//   { from, to, subject, text?, html?, attachments?: Array<{filename, contentType, content (base64)}> }

export type ReceiveEmailResult =
  | { ok: false; reason: string }
  | { ok: true; candidateId?: string; candidateIds?: string[]; source: string };

export const receiveEmailAction = action({
  args: {
    to: v.string(),
    from: v.string(),
    subject: v.optional(v.string()),
    text: v.optional(v.string()),
    html: v.optional(v.string()),
    attachments: v.optional(v.array(v.any())),
  },
  handler: async (ctx, body): Promise<ReceiveEmailResult> => {
    const toAddress: string = body.to ?? "";
    const slug = toAddress.split("@")[0]?.trim() ?? "";
    if (!slug) return { ok: false, reason: "no_slug" };

    const school = await ctx.runQuery(api.careers.getSchoolBySlug as any, { slug });
    if (!school) return { ok: false, reason: "school_not_found" };

    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const pdfAttachments = attachments.filter((a: any) =>
      a && typeof a.content === "string" &&
      (a.contentType === "application/pdf" || /\.pdf$/i.test(a.filename ?? ""))
    );

    if (pdfAttachments.length > 0) {
      const fromRaw: string = body.from ?? "";
      const fromEmailMatch = fromRaw.match(/<([^>]+)>/);
      const candidateEmail = fromEmailMatch?.[1] ?? (fromRaw.includes("@") ? fromRaw.trim() : undefined);
      const candidateName = fromRaw.replace(/<[^>]+>/, "").trim().replace(/^"|"$/g, "") || undefined;
      const candidateIds: string[] = [];
      for (const att of pdfAttachments) {
        try {
          const bytes = Buffer.from(att.content as string, "base64");
          const blob = new Blob([bytes], { type: "application/pdf" });
          const storageId = await ctx.storage.store(blob);
          const result: { candidateId: string } = await ctx.runMutation(api.candidates.createFromUpload as any, {
            schoolId: school._id,
            storageId,
            originalName: att.filename ?? "resume.pdf",
            sourceChannel: "email_parsed",
            candidateNameHint: candidateName,
            candidateEmail,
          });
          candidateIds.push(result.candidateId);
        } catch {
          // continue to the next attachment if one fails
        }
      }
      return { ok: true, candidateIds, source: "email_pdf_attachment" };
    }

    const emailText = `${body.from ?? ""} - ${body.subject ?? ""}\n\n${body.text ?? body.html ?? ""}`;

    let parsed;
    try {
      parsed = await ctx.runAction(api.ai_candidate_parsing.parseProfileFromText as any, { text: emailText.substring(0, 4000) });
    } catch {
      parsed = {
        name: null, email: null, phone: null, location: null,
        qualifications: [], certifications: [], boardExperience: [],
        subjects: [], yearsExperience: null, currentSchool: null,
      };
    }

    const candidateName = parsed.name ?? "Unknown Candidate";
    const candidateEmail = parsed.email ?? body.from ?? "";

    const candidateId = await ctx.runMutation(api.candidates.create as any, {
      name: candidateName,
      phone: parsed.phone,
      email: candidateEmail,
      location: parsed.location,
      qualifications: parsed.qualifications ?? [],
      certifications: parsed.certifications ?? [],
      boardExperience: parsed.boardExperience ?? [],
      subjects: parsed.subjects ?? [],
      yearsExperience: parsed.yearsExperience,
      currentSchool: parsed.currentSchool,
      sourceChannel: "email_parsed",
    });

    await ctx.runMutation(internal.candidates.setOrigin as any, {
      candidateId,
      origin: "fresh_application",
    });
    await ctx.scheduler.runAfter(0, api.intake.parseAndStoreCandidate as any, {
      candidateId,
      rawText: emailText.substring(0, 4000),
    });

    await ctx.runMutation(internal.careers.submitApplicationForIngestion as any, {
      schoolId: school._id,
      name: candidateName,
      phone: parsed.phone,
      email: candidateEmail,
      qualifications: parsed.qualifications ?? [],
      certifications: parsed.certifications ?? [],
      boardExperience: parsed.boardExperience ?? [],
      subjects: parsed.subjects ?? [],
      yearsExperience: parsed.yearsExperience,
      currentSchool: parsed.currentSchool,
    });

    return { ok: true, candidateId, source: "email_parsed" };
  },
});

export const receiveEmail = httpAction(async (ctx, request) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }
  const result = await ctx.runAction(api.email_ingestion.receiveEmailAction, {
    to: body.to ?? "",
    from: body.from ?? "",
    subject: body.subject,
    text: body.text,
    html: body.html,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
  });
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.reason }), { status: 400 });
  }
  return new Response(JSON.stringify({ success: true, ...result }), { status: 200 });
});
