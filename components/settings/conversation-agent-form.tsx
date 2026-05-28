"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, Button, Toggle } from "@/components/ui";

interface Props {
  schoolId: Id<"schools">;
}

export function ConversationAgentForm({ schoolId }: Props) {
  const school = useQuery(api.schools.get, { schoolId });
  const updateEnabled = useMutation(api.schools.updateConversationAgentEnabled);
  const updateFaq = useMutation(api.schools.updateFaqContent);

  const [enabled, setEnabled] = useState(false);
  const [content, setContent] = useState("");
  const [savingEnabled, setSavingEnabled] = useState(false);
  const [savingFaq, setSavingFaq] = useState(false);
  const [faqSavedAt, setFaqSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (school) {
      setEnabled(school.conversationAgentEnabled === true);
      setContent(school.faqContent ?? "");
    }
  }, [school]);

  if (!school) {
    return (
      <Card padding="lg">
        <div className="text-body-s text-ink-secondary">Loading...</div>
      </Card>
    );
  }

  async function toggleEnabled(next: boolean) {
    setEnabled(next);
    setSavingEnabled(true);
    try {
      await updateEnabled({ schoolId, enabled: next });
    } finally {
      setSavingEnabled(false);
    }
  }

  async function saveFaq() {
    setSavingFaq(true);
    try {
      await updateFaq({ schoolId, faqContent: content });
      setFaqSavedAt(Date.now());
    } finally {
      setSavingFaq(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-title-l text-ink mb-1">Conversation agent</h2>
        <p className="text-body-s text-ink-secondary">
          Automatically answers candidate replies on email and WhatsApp. Handles FAQs, reschedule
          requests, and escalates negotiation or unclear messages to your Inbox.
        </p>
      </div>

      <Card padding="lg" elevation={1}>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="text-body-s font-medium text-ink">Enable agent</div>
            <div className="text-caption text-ink-secondary mt-0.5">
              When off, every inbound reply lands in the Inbox for a human to handle. When on, the
              agent classifies replies and auto-answers high-confidence FAQs and reschedules.
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <Toggle
              checked={enabled}
              onCheckedChange={toggleEnabled}
              label="Enable conversation agent"
              disabled={savingEnabled}
            />
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <div>
          <h3 className="text-title-l text-ink mb-1">FAQ knowledge</h3>
          <p className="text-body-s text-ink-secondary">
            The agent uses this content (plus the role + school details) to answer candidate
            questions. Free text or markdown. Cover school timings, leave policy, transport, hostel,
            joining bonus, anything candidates typically ask about.
          </p>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="School timings: 8am - 3pm. Transport: subsidized routes from..."
          className="w-full rounded-sm bg-surface border border-hairline-strong text-ink placeholder:text-ink-tertiary p-3 text-body-s font-mono outline-none transition-all duration-fast ease-apple-out focus:border-accent focus:ring-2 focus:ring-accent-soft"
          rows={12}
          disabled={!enabled}
        />
        {!enabled && (
          <div className="text-caption text-ink-tertiary">
            Enable the agent above to use the FAQ.
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button variant="ink" size="md" onClick={saveFaq} loading={savingFaq}>
            Save FAQ
          </Button>
          {faqSavedAt && !savingFaq && (
            <span className="text-caption text-ink-tertiary">Saved</span>
          )}
        </div>
      </div>
    </div>
  );
}
