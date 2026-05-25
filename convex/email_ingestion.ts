import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

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

  const emailText = `${body.from ?? ""} - ${body.subject ?? ""}\n\n${body.text ?? body.html ?? ""}`;

  let parsed;
  try {
    parsed = await ctx.runAction(api.ai.parseProfileFromText as any, { text: emailText.substring(0, 4000) });
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
