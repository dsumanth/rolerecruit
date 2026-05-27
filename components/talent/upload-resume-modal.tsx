"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button, Dialog } from "@/components/ui";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  schoolId: string;
}

const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export function UploadResumeModal({ open, onOpenChange, schoolId }: Props) {
  const generateResumeUploadUrl = useMutation(api.intake.generateResumeUploadUrl);
  const createFromUpload = useMutation(api.candidates.createFromUpload);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<number | null>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const oversized = selected.find((f) => f.size > MAX_RESUME_BYTES);
    if (oversized) {
      setError(`"${oversized.name}" is too large (max 10MB).`);
      e.target.value = "";
      return;
    }
    setError("");
    setFiles(selected);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    setCompleted(0);
    try {
      let done = 0;
      for (const file of files) {
        const uploadUrl = await generateResumeUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/pdf" },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status}) for ${file.name}`);
        const { storageId } = await res.json();
        await createFromUpload({
          schoolId: schoolId as any,
          storageId,
          originalName: file.name,
        });
        done += 1;
        setCompleted(done);
      }
      setFiles([]);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      setCompleted(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload resume"
      description="Drop a resume into the talent bank — PDF, Word, or image. We'll parse it and run triage automatically."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} loading={uploading} disabled={files.length === 0}>
            {uploading && completed !== null
              ? `Uploading (${completed}/${files.length})`
              : files.length > 1
                ? `Upload ${files.length} files`
                : "Upload"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <input
          type="file"
          accept=".pdf,.docx,image/*"
          multiple
          onChange={handleFiles}
          disabled={uploading}
          className="block w-full text-body-s text-ink file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] file:text-ink file:text-body-s file:font-medium hover:file:bg-[color-mix(in_srgb,var(--accent)_25%,transparent)] cursor-pointer"
        />
        {files.length > 0 && (
          <ul className="text-body-s text-ink-secondary space-y-1">
            {files.map((f) => (
              <li key={f.name}>
                {f.name} <span className="text-body-xs">({(f.size / 1024).toFixed(0)} KB)</span>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <div className="rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-3 py-2 text-body-s text-danger">
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}
