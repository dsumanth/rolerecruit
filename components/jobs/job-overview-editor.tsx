"use client";

import { useState, useEffect } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
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

interface Props {
  jobId: string;
  initialTitle: string;
  initialSubject: string;
  initialLevel: string;
  initialBoard: string;
  initialDescription: string;
  initialCriteria: string;
  initialPositions: number;
}

export function JobOverviewEditor({
  jobId,
  initialTitle,
  initialSubject,
  initialLevel,
  initialBoard,
  initialDescription,
  initialCriteria,
  initialPositions,
}: Props) {
  const update = useMutation(api.jobs.updateJob);
  const reparse = useAction(api.jobs_ai.parseJobWithAI);

  const [title, setTitle] = useState(initialTitle);
  const [subject, setSubject] = useState(initialSubject);
  const [level, setLevel] = useState(initialLevel);
  const [board, setBoard] = useState(initialBoard);
  const [description, setDescription] = useState(initialDescription);
  const [criteria, setCriteria] = useState(initialCriteria);
  const [positions, setPositions] = useState(initialPositions);

  const [saving, setSaving] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");

  const dirty =
    title !== initialTitle ||
    subject !== initialSubject ||
    level !== initialLevel ||
    board !== initialBoard ||
    description !== initialDescription ||
    criteria !== initialCriteria ||
    positions !== initialPositions;

  // Hide the "Saved" pill after a few seconds so it doesn't linger forever.
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 4000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await update({
        jobId: jobId as any,
        title,
        subject,
        level: level as "PRT" | "TGT" | "PGT" | "Other",
        board,
        naturalLanguageDescription: description,
        criteria,
        positions,
      });
      setSavedAt(Date.now());
    } catch (err: any) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReparse = async () => {
    setError("");
    setReparsing(true);
    try {
      // Persist the latest description first so the AI sees the current text.
      if (description !== initialDescription) {
        await update({
          jobId: jobId as any,
          naturalLanguageDescription: description,
        });
      }
      await reparse({ jobId: jobId as any });
      setSavedAt(Date.now());
    } catch (err: any) {
      setError(err.message || "Re-parse failed");
    } finally {
      setReparsing(false);
    }
  };

  return (
    <Card padding="md" elevation={1}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-body-s font-semibold text-ink">Edit role</h3>
        {savedAt && !dirty && (
          <span className="text-caption text-success">Saved</span>
        )}
      </div>

      <div className="space-y-6">
        <section className="space-y-3">
          <div className="text-micro text-ink-secondary uppercase tracking-wide">Identity</div>
          <div>
            <label className="block text-body-s font-medium text-ink mb-1.5">Title</label>
            <Input
              size="md"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Physics PGT Teacher"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-body-s font-medium text-ink mb-1.5">Subject</label>
              <Input
                size="md"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Physics"
              />
            </div>
            <div>
              <label className="block text-body-s font-medium text-ink mb-1.5">Level</label>
              <Select value={level} onChange={setLevel} options={LEVEL_OPTIONS} className="w-full" />
            </div>
            <div>
              <label className="block text-body-s font-medium text-ink mb-1.5">Board</label>
              <Select value={board} onChange={setBoard} options={BOARD_OPTIONS} className="w-full" />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-micro text-ink-secondary uppercase tracking-wide">Description</div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={reparsing}
              disabled={!description.trim()}
              onClick={handleReparse}
            >
              {reparsing ? "Re-parsing" : "Re-parse with AI"}
            </Button>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full rounded-sm bg-surface border border-hairline-strong px-3 py-2 text-body-s text-ink placeholder:text-ink-tertiary outline-none transition-all duration-fast focus:border-accent focus:ring-2 focus:ring-accent-soft min-h-[120px] resize-none"
            placeholder="Describe the role in natural language…"
          />
        </section>

        <section className="space-y-3">
          <div className="text-micro text-ink-secondary uppercase tracking-wide">Criteria &amp; headcount</div>
          <div>
            <label className="block text-body-s font-medium text-ink mb-1.5">
              What you're looking for
            </label>
            <p className="text-caption text-ink-secondary mb-2">
              Edit anytime — the matching engine uses this alongside the parsed criteria.
            </p>
            <textarea
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              rows={6}
              className="w-full rounded-sm bg-surface border border-hairline-strong px-3 py-2 text-body-s text-ink placeholder:text-ink-tertiary outline-none transition-all duration-fast focus:border-accent focus:ring-2 focus:ring-accent-soft min-h-[140px] resize-none"
              placeholder="Describe ideal candidates, must-haves, nice-to-haves, deal-breakers…"
            />
          </div>
          <div className="grid grid-cols-[160px_1fr] items-end gap-4">
            <div>
              <label className="block text-body-s font-medium text-ink mb-1.5">Positions</label>
              <Input
                size="md"
                type="number"
                min={1}
                value={positions}
                onChange={(e) => setPositions(Math.max(1, parseInt(e.target.value || "1", 10)))}
              />
            </div>
            <p className="text-caption text-ink-secondary">
              Role auto-closes once this many candidates reach the <code>hired</code> stage.
            </p>
          </div>
        </section>

        {error && (
          <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-3 py-2 text-body-s text-danger">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            loading={saving}
            disabled={!dirty || saving}
            onClick={handleSave}
          >
            Save changes
          </Button>
        </div>
      </div>
    </Card>
  );
}
