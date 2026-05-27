"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Input, Button } from "@/components/ui";

interface Props {
  schoolId: string;
  jobId?: string;
  slug: string;
}

const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10 MB

export function ApplicationForm({ schoolId, jobId, slug }: Props) {
  const submitApplication = useMutation(api.careers.submitApplication);
  const generateResumeUploadUrl = useMutation(api.intake.generateResumeUploadUrl);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    qualifications: "",
    certifications: "",
    boardExperience: "",
    subjects: "",
    yearsExperience: "",
    currentSchool: "",
  });

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > MAX_RESUME_BYTES) {
      setError("Resume file is too large (max 10MB).");
      e.target.value = "";
      return;
    }
    setError("");
    setResumeFile(file);
  };

  const uploadResume = async (file: File): Promise<string> => {
    const uploadUrl = await generateResumeUploadUrl();
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/pdf" },
      body: file,
    });
    if (!res.ok) {
      throw new Error(`Resume upload failed (${res.status})`);
    }
    const { storageId } = await res.json();
    return storageId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || (!form.phone && !form.email)) {
      setError("Please provide your name and either phone or email.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      let resumeStorageId: string | undefined;
      let resumeOriginalName: string | undefined;
      if (resumeFile) {
        resumeStorageId = await uploadResume(resumeFile);
        resumeOriginalName = resumeFile.name;
      }
      await submitApplication({
        schoolId: schoolId as any,
        jobId: jobId ? (jobId as any) : undefined,
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        qualifications: form.qualifications.split(",").map((s) => s.trim()).filter(Boolean),
        certifications: form.certifications.split(",").map((s) => s.trim()).filter(Boolean),
        boardExperience: form.boardExperience.split(",").map((s) => s.trim()).filter(Boolean),
        subjects: form.subjects.split(",").map((s) => s.trim()).filter(Boolean),
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : undefined,
        currentSchool: form.currentSchool || undefined,
        resumeStorageId: resumeStorageId as any,
        resumeOriginalName,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-6">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success mb-4 text-2xl">✓</div>
        <h3 className="text-title-m text-ink mb-2">Application submitted</h3>
        <p className="text-body-s text-ink-secondary">You'll receive a tracking link on your phone or email shortly.</p>
      </div>
    );
  }

  const hasResume = !!resumeFile;
  const optionalHint = hasResume ? "Optional — we'll extract this from your resume" : undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Resume" hint="Upload a PDF, Word document, or photo of your resume. We'll parse it automatically.">
        <input
          type="file"
          accept=".pdf,.docx,image/*"
          onChange={handleResumeChange}
          className="block w-full text-body-s text-ink file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] file:text-ink file:text-body-s file:font-medium hover:file:bg-[color-mix(in_srgb,var(--accent)_25%,transparent)] cursor-pointer"
        />
        {resumeFile && (
          <p className="mt-1.5 text-body-xs text-ink-secondary">
            {resumeFile.name} ({(resumeFile.size / 1024).toFixed(0)} KB)
          </p>
        )}
      </Field>

      <Field label="Full name" required>
        <Input
          size="lg"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Rajesh Kumar"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Phone">
          <Input size="lg" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" />
        </Field>
        <Field label="Email">
          <Input size="lg" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="rajesh@email.com" />
        </Field>
      </div>

      <Field label="Qualifications (comma separated)" hint={optionalHint}>
        <Input size="lg" value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} placeholder="B.Ed, M.Sc Physics" />
      </Field>
      <Field label="Certifications (comma separated)" hint={optionalHint}>
        <Input size="lg" value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} placeholder="CTET, NET" />
      </Field>
      <Field label="Subjects you teach (comma separated)" hint={optionalHint}>
        <Input size="lg" value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} placeholder="Physics, Mathematics" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Years experience" hint={optionalHint}>
          <Input size="lg" type="number" value={form.yearsExperience} onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })} placeholder="5" />
        </Field>
        <Field label="Current school" hint={optionalHint}>
          <Input size="lg" value={form.currentSchool} onChange={(e) => setForm({ ...form, currentSchool: e.target.value })} placeholder="Delhi Public School" />
        </Field>
      </div>

      <Field label="Board experience (comma separated)" hint={optionalHint}>
        <Input size="lg" value={form.boardExperience} onChange={(e) => setForm({ ...form, boardExperience: e.target.value })} placeholder="CBSE, ICSE" />
      </Field>

      {error && (
        <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger">
          {error}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
        Submit application
      </Button>
    </form>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-body-s font-medium text-ink mb-1.5">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {hint && <p className="text-body-xs text-ink-secondary mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}
