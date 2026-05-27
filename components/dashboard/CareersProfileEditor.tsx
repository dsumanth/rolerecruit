"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Card, Input } from "@/components/ui";

interface Perk {
  label: string;
  description: string;
}

interface SchoolProfileFields {
  _id: Id<"schools">;
  tagline?: string | null;
  about?: string | null;
  foundedYear?: number | null;
  studentCount?: number | null;
  facultyCount?: number | null;
  perks?: Perk[] | null;
  heroImageUrl?: string | null;
}

interface Props {
  school: SchoolProfileFields;
}

function numberOrEmpty(n?: number | null): string {
  return n != null ? String(n) : "";
}

function parseNumber(s: string): number | undefined {
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

export function CareersProfileEditor({ school }: Props) {
  const updateSettings = useMutation(api.schools.updateSettings);
  const generateHeroUploadUrl = useMutation(api.schools.generateHeroImageUploadUrl);
  const setHeroImage = useMutation(api.schools.setHeroImage);
  const clearHeroImage = useMutation(api.schools.clearHeroImage);

  const [tagline, setTagline] = useState(school.tagline ?? "");
  const [about, setAbout] = useState(school.about ?? "");
  const [foundedYear, setFoundedYear] = useState(numberOrEmpty(school.foundedYear));
  const [studentCount, setStudentCount] = useState(numberOrEmpty(school.studentCount));
  const [facultyCount, setFacultyCount] = useState(numberOrEmpty(school.facultyCount));
  const [perks, setPerks] = useState<Perk[]>(school.perks ?? []);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateSettings({
        schoolId: school._id,
        tagline: tagline.trim(),
        about: about.trim(),
        foundedYear: parseNumber(foundedYear),
        studentCount: parseNumber(studentCount),
        facultyCount: parseNumber(facultyCount),
        perks: perks.filter((p) => p.label.trim() && p.description.trim()),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Please upload an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setImageError("Image must be under 2 MB.");
      return;
    }
    setImageError(null);
    setUploading(true);
    try {
      const uploadUrl = await generateHeroUploadUrl({});
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Upload failed");
      const { storageId } = await result.json();
      await setHeroImage({ schoolId: school._id, storageId });
    } catch (err: any) {
      setImageError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleHeroClear = async () => {
    setImageError(null);
    try {
      await clearHeroImage({ schoolId: school._id });
    } catch (err: any) {
      setImageError(err.message ?? "Failed to remove image");
    }
  };

  const updatePerk = (idx: number, patch: Partial<Perk>) => {
    setPerks((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };
  const removePerk = (idx: number) => {
    setPerks((prev) => prev.filter((_, i) => i !== idx));
  };
  const addPerk = () => {
    setPerks((prev) => [...prev, { label: "", description: "" }]);
  };

  return (
    <Card padding="md" elevation={1}>
      <h2 className="text-body-s font-semibold text-ink mb-1">Careers page profile</h2>
      <p className="text-body-s text-ink-secondary mb-5">
        These fields show up on your public careers portal. Leave any blank to hide that part of the page.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] px-4 py-3 text-body-s text-danger">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Hero image */}
        <div>
          <label className="block text-body-s font-medium text-ink mb-1">Hero image</label>
          <p className="text-caption text-ink-tertiary mb-3">
            Shown next to your school name on the careers page. Portrait or 4:5 ratio works best.
          </p>
          <div className="flex items-start gap-5">
            <div className="h-28 w-[88px] rounded-md overflow-hidden border border-hairline bg-gradient-to-br from-[#2a4365] via-[#553c9a] to-[#b794f4] flex-shrink-0">
              {school.heroImageUrl && (
                <img
                  src={school.heroImageUrl}
                  alt="Hero preview"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <label className="inline-flex items-center justify-center rounded-full bg-ink text-surface-canvas px-3.5 py-1.5 text-body-s font-medium hover:opacity-90 transition-opacity cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleHeroUpload}
                  disabled={uploading}
                  className="sr-only"
                />
                {uploading ? "Uploading…" : school.heroImageUrl ? "Replace" : "Upload image"}
              </label>
              {school.heroImageUrl && (
                <Button variant="ghost" size="sm" onClick={handleHeroClear}>Remove</Button>
              )}
            </div>
          </div>
          {imageError && (
            <p className="mt-3 text-body-s text-danger">{imageError}</p>
          )}
          <p className="text-caption text-ink-tertiary mt-3">JPG or PNG · max 2 MB</p>
        </div>

        {/* Tagline */}
        <div>
          <label className="block text-body-s font-medium text-ink mb-1">Tagline</label>
          <p className="text-caption text-ink-tertiary mb-2">
            The big headline at the top of your careers page. Keep it short and editorial.
          </p>
          <Input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Teach at a school that respects your craft."
            maxLength={120}
          />
        </div>

        {/* About */}
        <div>
          <label className="block text-body-s font-medium text-ink mb-1">About us</label>
          <p className="text-caption text-ink-tertiary mb-2">
            What's your school like to work at? 2–3 short paragraphs. Separate paragraphs with a blank line.
          </p>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={7}
            placeholder={"We've been teaching since 1987 — and we've learned one thing: great schools start with great teachers, supported well and trusted to do their work.\n\nClass sizes stay under 32. New hires are paired with a senior mentor for their first year."}
            className="w-full rounded-md border border-hairline bg-surface px-3 py-2.5 text-body-s text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-accent transition-colors leading-relaxed"
          />
        </div>

        {/* Stats */}
        <div>
          <label className="block text-body-s font-medium text-ink mb-1">School stats</label>
          <p className="text-caption text-ink-tertiary mb-3">
            Shown as a quiet line under the hero CTA. Leave any blank to hide it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-caption text-ink-tertiary mb-1">Founded year</label>
              <Input
                type="number"
                inputMode="numeric"
                value={foundedYear}
                onChange={(e) => setFoundedYear(e.target.value)}
                placeholder="1987"
                min={1800}
                max={new Date().getFullYear()}
              />
            </div>
            <div>
              <label className="block text-caption text-ink-tertiary mb-1">Students</label>
              <Input
                type="number"
                inputMode="numeric"
                value={studentCount}
                onChange={(e) => setStudentCount(e.target.value)}
                placeholder="1200"
                min={0}
              />
            </div>
            <div>
              <label className="block text-caption text-ink-tertiary mb-1">Faculty</label>
              <Input
                type="number"
                inputMode="numeric"
                value={facultyCount}
                onChange={(e) => setFacultyCount(e.target.value)}
                placeholder="65"
                min={0}
              />
            </div>
          </div>
        </div>

        {/* Perks */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label className="block text-body-s font-medium text-ink">What we offer</label>
            <button
              type="button"
              onClick={addPerk}
              className="text-body-s text-accent hover:underline"
            >
              + Add perk
            </button>
          </div>
          <p className="text-caption text-ink-tertiary mb-3">
            One row per perk. Label is the short tag (e.g. Compensation, Health). Description is what you offer.
          </p>
          {perks.length === 0 ? (
            <p className="text-body-s text-ink-tertiary py-4 text-center border border-dashed border-hairline rounded-md">
              No perks added yet.
            </p>
          ) : (
            <div className="space-y-3">
              {perks.map((perk, idx) => (
                <div key={idx} className="grid grid-cols-[140px_1fr_auto] gap-2 items-start">
                  <Input
                    type="text"
                    value={perk.label}
                    onChange={(e) => updatePerk(idx, { label: e.target.value })}
                    placeholder="Compensation"
                  />
                  <Input
                    type="text"
                    value={perk.description}
                    onChange={(e) => updatePerk(idx, { description: e.target.value })}
                    placeholder="Salary above CBSE benchmarks…"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePerk(idx)}
                    aria-label="Remove perk"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-hairline flex items-center gap-3">
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            loading={saving}
            variant="primary"
          >
            {saved ? "Saved" : "Save profile"}
          </Button>
          <span className="text-caption text-ink-tertiary">
            Changes go live on your public careers page immediately.
          </span>
        </div>
      </div>
    </Card>
  );
}
