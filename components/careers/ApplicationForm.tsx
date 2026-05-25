"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

interface Props {
  schoolId: string;
  jobId?: string;
  slug: string;
}

export function ApplicationForm({ schoolId, jobId, slug }: Props) {
  const submitApplication = useMutation(api.careers.submitApplication);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || (!form.phone && !form.email)) {
      setError("Please provide your name and either phone or email.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
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
      <div className="rounded-apple bg-surface border border-hairline p-8 text-center">
        <div className="text-4xl mb-4">✓</div>
        <h3 className="text-lg font-semibold text-ink mb-2">Application Submitted!</h3>
        <p className="text-sm text-ink-secondary">You'll receive a tracking link on your phone or email shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Full Name *</label>
        <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-surface border border-hairline text-sm" placeholder="Rajesh Kumar" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Phone</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-surface border border-hairline text-sm" placeholder="9876543210" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-surface border border-hairline text-sm" placeholder="rajesh@email.com" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Qualifications (comma-separated)</label>
        <input type="text" value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-surface border border-hairline text-sm" placeholder="B.Ed, M.Sc Physics" />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Certifications (comma-separated)</label>
        <input type="text" value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-surface border border-hairline text-sm" placeholder="CTET, NET" />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Subjects You Teach (comma-separated)</label>
        <input type="text" value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-surface border border-hairline text-sm" placeholder="Physics, Mathematics" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Years Experience</label>
          <input type="number" value={form.yearsExperience} onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-surface border border-hairline text-sm" placeholder="5" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Current School</label>
          <input type="text" value={form.currentSchool} onChange={(e) => setForm({ ...form, currentSchool: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-surface border border-hairline text-sm" placeholder="Delhi Public School" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Board Experience (comma-separated)</label>
        <input type="text" value={form.boardExperience} onChange={(e) => setForm({ ...form, boardExperience: e.target.value })} className="w-full px-4 py-2.5 rounded-apple bg-surface border border-hairline text-sm" placeholder="CBSE, ICSE" />
      </div>

      {error && <div className="px-4 py-3 rounded-apple bg-red-50 text-sm text-danger">{error}</div>}

      <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-apple bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors">
        {submitting ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}
