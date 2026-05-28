import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Body shape matches the common inbound-email webhook envelopes
// (SendGrid Inbound Parse, Postmark Inbound, Resend Inbound):
//   { from, to, subject, text?, html?, attachments?: Array<{filename, contentType, content (base64)}> }
export const receiveEmail = httpAction(async (ctx, request) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const toAddress: string = body.to ?? "";
  const slug = toAddress.split("@")[0]?.trim() ?? "";
  if (!slug) {
    return new Response(JSON.stringify({ error: "No slug found" }), { status: 400 });
  }

  const school = await ctx.runQuery(api.careers.getSchoolBySlug as any, { slug });
  if (!school) {
    return new Response(JSON.stringify({ error: "School not found" }), { status: 404 });
  }

  // PDF attachment path: when the email carries one or more PDF attachments,
  // upload each to storage and route through extractTextFromResume rather than
  // re-parsing the (often boilerplate) email body.
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
    return new Response(
      JSON.stringify({ success: true, candidateIds, source: "email_pdf_attachment" }),
      { status: 200 },
    );
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

  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let trackingToken = "";
  for (let i = 0; i < 32; i++) {
    trackingToken += chars[Math.floor(Math.random() * chars.length)];
  }

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

  return new Response(JSON.stringify({ success: true, candidateId }), { status: 200 });
});
