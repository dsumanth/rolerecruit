"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Select } from "@/components/ui";

const BOARD_OPTIONS = [
  { value: "CBSE", label: "CBSE" },
  { value: "ICSE", label: "ICSE" },
  { value: "IB", label: "IB" },
  { value: "IGCSE", label: "IGCSE" },
  { value: "State", label: "State" },
];

const LEVEL_OPTIONS = [
  { value: "PRT", label: "PRT" },
  { value: "TGT", label: "TGT" },
  { value: "PGT", label: "PGT" },
  { value: "Other", label: "Other" },
];

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
  const [criteria, setCriteria] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("TGT");
  const [board, setBoard] = useState("CBSE");
  const [positions, setPositions] = useState(1);

  const handleParseWithAI = async () => {
    if (!description.trim()) {
      setError("Please write a job description first.");
      return;
    }
    if (!title.trim()) {
      setError("Please give the role a title before parsing.");
      return;
    }

    setError("");
    setParsing(true);

    try {
      const job = await createJob({
        schoolId: schoolId as any,
        title,
        subject: subject || "TBD",
        level: level as "PRT" | "TGT" | "PGT" | "Other",
        board,
        qualifications: [],
        naturalLanguageDescription: description,
        criteria: criteria.trim() || description,
        positions,
      });

      const result = await parseWithAI({ jobId: job as any });

      // Only fill blanks — don't clobber what the user typed. Subject is a
      // free-text field that starts empty, so an empty value clearly means
      // "untouched." Level/Board are Selects with default values (TGT/CBSE),
      // which we can't reliably distinguish from a user choice, so we leave
      // them alone here. The level value coming back is already normalized
      // by parseJobWithAI to one of PRT|TGT|PGT|Other.
      const parsedCriteria = (result as any).parsedCriteria;
      if (parsedCriteria) {
        if (!subject.trim() && parsedCriteria.subjects?.length) {
          setSubject(parsedCriteria.subjects[0]);
        }
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
          criteria: criteria.trim() || description,
          positions,
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
    <Card padding="lg" elevation={1}>
      <form onSubmit={handleSaveDraft} className="space-y-7">
        <div className="grid grid-cols-[1fr_120px] gap-5">
          <div>
            <label className="block text-body-s font-medium text-ink mb-1.5">Job title</label>
            <Input
              size="md"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Physics PGT Teacher"
              required
            />
          </div>
          <div>
            <label className="block text-body-s font-medium text-ink mb-1.5">Positions</label>
            <Input
              size="md"
              type="number"
              min={1}
              value={positions}
              onChange={(e) => setPositions(Math.max(1, parseInt(e.target.value || "1", 10)))}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-body-s font-medium text-ink mb-1.5">
            Describe the role
          </label>
          <p className="text-caption text-ink-secondary mb-3">
            Write naturally. Our AI will extract subjects, qualifications, and requirements.
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full rounded-sm bg-surface border border-hairline-strong px-3 py-2 text-body-s text-ink placeholder:text-ink-tertiary outline-none transition-all duration-fast focus:border-accent focus:ring-2 focus:ring-accent-soft min-h-[120px] resize-none"
            placeholder="We need a Physics teacher for Classes 11 and 12. Must have B.Ed and at least 3 years of CBSE teaching experience. CTET qualified preferred."
            required
          />

          {!parsed && (
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleParseWithAI}
                disabled={!description.trim() || !title.trim()}
                loading={parsing}
              >
                {parsing ? "Parsing with AI" : "Parse with AI"}
              </Button>
            </div>
          )}

          {parsed && (
            <div className="mt-3 rounded-md bg-[color-mix(in_srgb,var(--success)_8%,transparent)] border border-[color-mix(in_srgb,var(--success)_25%,transparent)] px-4 py-3 text-body-s text-[color-mix(in_srgb,var(--success)_75%,var(--ink-1))]">
              AI has parsed your description. Review the fields below and edit if needed.
            </div>
          )}
        </div>

        <div>
          <label className="block text-body-s font-medium text-ink mb-1.5">
            Criteria <span className="text-ink-tertiary font-normal">(optional)</span>
          </label>
          <p className="text-caption text-ink-secondary mb-3">
            What you're really looking for. You can edit this later on the role's Criteria tab.
          </p>
          <textarea
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            rows={4}
            className="w-full rounded-sm bg-surface border border-hairline-strong px-3 py-2 text-body-s text-ink placeholder:text-ink-tertiary outline-none transition-all duration-fast focus:border-accent focus:ring-2 focus:ring-accent-soft min-h-[96px] resize-none"
            placeholder="Must have managed a board prep class. Prior IB exposure is a plus. Comfortable with project-based learning."
          />
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div>
            <label className="block text-body-s font-medium text-ink mb-1.5">Subject</label>
            <Input
              size="md"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Physics"
              required
            />
          </div>
          <div>
            <label className="block text-body-s font-medium text-ink mb-1.5">Level</label>
            <Select
              value={level}
              onChange={setLevel}
              options={LEVEL_OPTIONS}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-body-s font-medium text-ink mb-1.5">Board</label>
            <Select
              value={board}
              onChange={setBoard}
              options={BOARD_OPTIONS}
              className="w-full"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            loading={loading && !parsed}
          >
            Save as draft
          </Button>
          {parsed && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handlePublish}
              loading={loading}
            >
              Post role
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
