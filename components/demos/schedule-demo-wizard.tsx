"use client";

import { useId, useState } from "react";
import { Avatar, Badge, Button, Dialog, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

type StaffRole = "principal" | "hod" | "hr_admin" | "teacher";
type StaffRow = { _id: string; name: string; role: StaffRole };
type Mode = "live" | "post" | "async";
type Format = "classroom" | "mock" | "recorded";

type ConfirmPayload = {
  applicationId: string;
  schoolId: string;
  scheduledAt: number;
  durationMinutes: number;
  mode: Mode;
  format: Format;
  location?: string;
  videoUrl?: string;
  evaluators: { userId: string; role: StaffRole }[];
  parentDemoId?: string;
  decisionRuleId?: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: ConfirmPayload) => void;
  applicationId: string;
  schoolId: string;
  candidateName: string;
  staffDirectory: StaffRow[];
  /** Pre-select evaluators (e.g., when re-demoing — carry over the prior demo's panel). */
  initialEvaluators?: { userId: string; role: StaffRole }[];
  /** Pre-fill the date/time inputs from this timestamp. */
  initialScheduledAt?: number;
  /** Forwarded into `onConfirm` so the parent can record the lineage on the new demo. */
  parentDemoId?: string;
  /** Active decision rules to offer on the review step. Empty / omitted hides the picker. */
  activeRules?: { _id: string; name: string }[];
}

function splitTimestamp(ts: number): { date: string; time: string } {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
}

const MODE_OPTIONS: Mode[] = ["live", "post", "async"];
const FORMAT_OPTIONS: Format[] = ["classroom", "mock", "recorded"];

const SECTION_LABEL = "text-caption font-semibold uppercase tracking-wide text-ink-tertiary";

function RadioRow<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value === option;
        return (
          <label
            key={option}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-body-s capitalize transition-all duration-fast ease-apple-out",
              selected
                ? "border-accent bg-accent-soft text-accent"
                : "border-hairline-strong text-ink-secondary hover:border-accent hover:text-accent",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={selected}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {option}
          </label>
        );
      })}
    </div>
  );
}

export function ScheduleDemoWizard({
  open,
  onClose,
  onConfirm,
  applicationId,
  schoolId,
  candidateName,
  staffDirectory,
  initialEvaluators,
  initialScheduledAt,
  parentDemoId,
  activeRules,
}: Props) {
  const initial = initialScheduledAt ? splitTimestamp(initialScheduledAt) : { date: "", time: "" };
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [mode, setMode] = useState<Mode>("live");
  const [format, setFormat] = useState<Format>("classroom");
  const [location, setLocation] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(initialEvaluators?.map((e) => e.userId) ?? []),
  );
  const [decisionRuleId, setDecisionRuleId] = useState<string>("");

  const dateId = useId();
  const timeId = useId();
  const durationId = useId();
  const locationId = useId();
  const videoUrlId = useId();

  if (!open) return null;

  const togglePicked = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const scheduledAt = date && time ? new Date(`${date}T${time}`).getTime() : 0;
  const evaluators = staffDirectory
    .filter((s) => picked.has(s._id))
    .map((s) => ({ userId: s._id, role: s.role }));

  const handleConfirm = () => {
    onConfirm({
      applicationId,
      schoolId,
      scheduledAt,
      durationMinutes,
      mode,
      format,
      location: location || undefined,
      videoUrl: videoUrl || undefined,
      evaluators,
      parentDemoId,
      decisionRuleId: decisionRuleId || undefined,
    });
  };

  const footer = (
    <>
      {step > 0 ? (
        <Button variant="ghost" onClick={() => setStep((step - 1) as 0 | 1 | 2)}>
          Back
        </Button>
      ) : (
        <span />
      )}
      {step === 0 && (
        <Button variant="primary" size="md" onClick={() => setStep(1)}>
          Next
        </Button>
      )}
      {step === 1 && (
        <Button variant="primary" size="md" onClick={() => setStep(2)}>
          Review
        </Button>
      )}
      {step === 2 && (
        <Button variant="primary" size="md" onClick={handleConfirm}>
          Confirm
        </Button>
      )}
    </>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`Schedule demo for ${candidateName}`}
      description={`Step ${step + 1} of 3`}
      variant="center"
      footer={footer}
    >
      {step === 0 && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor={dateId} className="block text-body-s font-semibold text-ink">
                Date
              </label>
              <Input
                id={dateId}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={timeId} className="block text-body-s font-semibold text-ink">
                Time
              </label>
              <Input
                id={timeId}
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={durationId} className="block text-body-s font-semibold text-ink">
              Duration (minutes)
            </label>
            <Input
              id={durationId}
              type="number"
              min={5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <p className={SECTION_LABEL}>Mode</p>
            <RadioRow name="mode" options={MODE_OPTIONS} value={mode} onChange={setMode} />
          </div>

          <div className="space-y-2">
            <p className={SECTION_LABEL}>Format</p>
            <RadioRow
              name="format"
              options={FORMAT_OPTIONS}
              value={format}
              onChange={setFormat}
            />
          </div>

          {(format === "classroom" || format === "mock") && (
            <div className="space-y-1.5">
              <label htmlFor={locationId} className="block text-body-s font-semibold text-ink">
                Location
              </label>
              <Input
                id={locationId}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Classroom 3B, North wing"
              />
            </div>
          )}
          {format === "recorded" && (
            <div className="space-y-1.5">
              <label htmlFor={videoUrlId} className="block text-body-s font-semibold text-ink">
                Video URL
              </label>
              <Input
                id={videoUrlId}
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://"
              />
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className={SECTION_LABEL}>Pick evaluators</p>
          <ul className="space-y-1">
            {staffDirectory.map((s) => {
              const selected = picked.has(s._id);
              return (
                <li key={s._id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 transition-colors duration-fast",
                      selected
                        ? "border-accent bg-accent-soft"
                        : "border-hairline hover:bg-accent-soft",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => togglePicked(s._id)}
                      className="cursor-pointer"
                    />
                    <Avatar name={s.name} size={28} />
                    <span className="flex-1 text-body-s font-medium text-ink">{s.name}</span>
                    <Badge variant="neutral">{s.role}</Badge>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {step === 2 && (
        <dl className="space-y-3 text-body-s">
          <div>
            <dt className={SECTION_LABEL}>When</dt>
            <dd className="mt-1 text-ink">
              {scheduledAt
                ? new Date(scheduledAt).toLocaleString("en-IN")
                : "Date not set"}
            </dd>
          </div>
          <div>
            <dt className={SECTION_LABEL}>Duration</dt>
            <dd className="mt-1 text-ink">{durationMinutes} min</dd>
          </div>
          <div>
            <dt className={SECTION_LABEL}>Mode / Format</dt>
            <dd className="mt-1 text-ink capitalize">
              {mode} / {format}
            </dd>
          </div>
          {location && (
            <div>
              <dt className={SECTION_LABEL}>Location</dt>
              <dd className="mt-1 text-ink">{location}</dd>
            </div>
          )}
          {videoUrl && (
            <div>
              <dt className={SECTION_LABEL}>Video URL</dt>
              <dd className="mt-1 break-all text-ink">{videoUrl}</dd>
            </div>
          )}
          <div>
            <dt className={SECTION_LABEL}>Evaluators ({evaluators.length})</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {evaluators.length === 0 ? (
                <span className="text-ink-tertiary">None selected</span>
              ) : (
                evaluators.map((e) => {
                  const s = staffDirectory.find((row) => row._id === e.userId);
                  return (
                    <span
                      key={e.userId}
                      className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-2.5 py-0.5"
                    >
                      <Avatar name={s?.name ?? ""} size={20} />
                      <span className="text-caption text-ink">{s?.name}</span>
                    </span>
                  );
                })
              )}
            </dd>
          </div>
          {activeRules && activeRules.length > 0 && (
            <div>
              <dt className={SECTION_LABEL}>Decision rule (optional)</dt>
              <dd className="mt-1">
                <Select
                  aria-label="Decision rule"
                  value={decisionRuleId}
                  onChange={(value) => setDecisionRuleId(value)}
                  options={[
                    { value: "", label: "None - manual decision" },
                    ...activeRules.map((r) => ({ value: r._id, label: r.name })),
                  ]}
                />
                <p className="text-caption text-ink-tertiary mt-1">
                  If set, the matching action is auto-applied when all invites resolve. Otherwise HR decides manually.
                </p>
              </dd>
            </div>
          )}
        </dl>
      )}
    </Dialog>
  );
}
