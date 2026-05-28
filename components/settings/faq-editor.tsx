"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, Button } from "@/components/ui";

interface Props {
  schoolId: Id<"schools">;
}

export function FaqEditor({ schoolId }: Props) {
  const school = useQuery(api.schools.get, { schoolId });
  const updateFaq = useMutation(api.schools.updateFaqContent);

  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (school) setContent(school.faqContent ?? "");
  }, [school]);

  if (!school) {
    return (
      <Card padding="lg">
        <div className="text-body-s text-ink-secondary">Loading...</div>
      </Card>
    );
  }

  async function save() {
    setSaving(true);
    try {
      await updateFaq({ schoolId, faqContent: content });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-title-l text-ink mb-1">FAQ knowledge</h2>
        <p className="text-body-s text-ink-secondary">
          The conversation agent uses this content (plus the role + school details) to answer candidate
          FAQs. Free text or markdown. Cover school timings, leave policy, transport, hostel,
          joining bonus, anything candidates typically ask about.
        </p>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="School timings: 8am - 3pm. Transport: subsidized routes from..."
        className="w-full rounded-sm bg-surface border border-hairline-strong text-ink placeholder:text-ink-tertiary p-3 text-body-s font-mono outline-none transition-all duration-fast ease-apple-out focus:border-accent focus:ring-2 focus:ring-accent-soft"
        rows={12}
      />

      <div className="flex items-center gap-3">
        <Button variant="ink" size="md" onClick={save} loading={saving}>
          Save FAQ
        </Button>
        {savedAt && !saving && <span className="text-caption text-ink-tertiary">Saved</span>}
      </div>
    </div>
  );
}
