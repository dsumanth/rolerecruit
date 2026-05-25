"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";

const BOARDS = ["CBSE", "ICSE", "IB", "IGCSE", "State"];
const LEVELS = ["PRT", "TGT", "PGT", "Other"];

export function JobIntakeForm({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const createJob = useMutation(api.jobs.create);
  const parseWithAI = useAction(api.jobs_ai.parseJobWithAI);
  const publishJob = useMutation(api.jobs.publish);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("TGT");
  const [board, setBoard] = useState("CBSE");

  const handleParseWithAI = async () => {
    if (!description.trim()) {
      setError("Please write a job description first.");
      return;
    }

    setError("");
    setParsing(true);

    try {
      const job = await createJob({
        schoolId: schoolId as any,
        title: title || "Untitled Role",
        subject: subject || "TBD",
        level: level as "PRT" | "TGT" | "PGT" | "Other",
        board,
        qualifications: [],
        naturalLanguageDescription: description,
      });

      const result = await parseWithAI({ jobId: job as any });

      const criteria = (result as any).parsedCriteria;
      if (criteria) {
        if (criteria.subjects?.length) setSubject(criteria.subjects[0]);
        if (criteria.board) setBoard(criteria.board);
        if (criteria.level) setLevel(criteria.level);
        setTitle(
          `${criteria.subjects?.[0] || subject} ${criteria.level || level} Teacher`
        );
      }

      setParsed(true);
      setJobId(job as any);
    } catch (err: any) {
      setError(err.message || "AI parsing failed. You can fill in the fields manually.");
    } finally {
      setParsing(false);
    }
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (jobId) {
        router.push(`/dashboard/jobs/${jobId}`);
      } else {
        await createJob({
          schoolId: schoolId as any,
          title,
          subject,
          level: level as "PRT" | "TGT" | "PGT" | "Other",
          board,
          qualifications: [],
          naturalLanguageDescription: description,
        });
        router.push("/dashboard/jobs");
      }
    } catch (err: any) {
      setError(err.message || "Failed to save job");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!jobId) return;
    setError("");
    setLoading(true);

    try {
      await publishJob({ jobId: jobId as any });
      router.push(`/dashboard/jobs/${jobId}`);
    } catch (err: any) {
      setError(err.message || "Failed to publish job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSaveDraft} className="space-y-8">
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Describe the role
        </label>
        <p className="text-[13px] text-ink-secondary mb-3">
          Write naturally. Our AI will extract subjects, qualifications, and requirements.
        </p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="w-full px-4 py-3 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
          placeholder="We need a Physics teacher for Classes 11 and 12. Must have B.Ed and at least 3 years of CBSE teaching experience. CTET qualified preferred."
          required
        />

        {!parsed && (
          <button
            type="button"
            onClick={handleParseWithAI}
            disabled={parsing || !description.trim()}
            className="mt-3 py-2 px-4 rounded-apple bg-surface-secondary text-ink text-sm font-medium hover:bg-surface-tertiary disabled:opacity-50 transition-colors"
          >
            {parsing ? "Parsing with AI..." : "Parse with AI"}
          </button>
        )}

        {parsed && (
          <div className="mt-3 px-4 py-2 rounded-apple bg-green-50 text-sm text-success">
            AI has parsed your description. Review the fields below and edit if needed.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Job title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            placeholder="Physics PGT Teacher"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            placeholder="Physics"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Level</label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink focus:outline-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent appearance-none"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Board</label>
          <select
            value={board}
            onChange={(e) => setBoard(e.target.value)}
            className="w-full px-4 py-2.5 rounded-apple bg-surface border border-surface-tertiary text-sm text-ink focus:outline-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent appearance-none"
          >
            {BOARDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-apple bg-red-50 text-sm text-danger">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="py-2.5 px-8 rounded-apple bg-surface-secondary text-ink text-sm font-medium hover:bg-surface-tertiary disabled:opacity-50 transition-colors"
        >
          {loading && !parsed ? "Saving..." : "Save as Draft"}
        </button>
        {parsed && (
          <button
            type="button"
            onClick={handlePublish}
            disabled={loading}
            className="py-2.5 px-8 rounded-apple bg-accent text-white text-sm font-medium hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-50 transition-colors"
          >
            {loading ? "Publishing..." : "Publish Job"}
          </button>
        )}
      </div>
    </form>
  );
}
