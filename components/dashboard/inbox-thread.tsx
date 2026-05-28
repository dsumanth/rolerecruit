"use client";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, Button, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Props {
  applicationId: Id<"applications">;
  candidateId: Id<"candidates">;
}

export function InboxThread({ applicationId, candidateId }: Props) {
  const messages = useQuery(api.inbox.getThread, { applicationId });
  const humanReply = useMutation(api.inbox.humanReply);
  const [draft, setDraft] = useState("");
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [sending, setSending] = useState(false);

  if (!messages) {
    return (
      <Card padding="md">
        <div className="text-body-s text-ink-secondary">Loading thread...</div>
      </Card>
    );
  }

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await humanReply({ applicationId, candidateId, channel, body: draft });
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card padding="md" elevation={1}>
      <div className="space-y-3">
        <ul className="space-y-2 max-h-96 overflow-y-auto">
          {messages.length === 0 && (
            <li className="text-body-s text-ink-secondary">No messages yet.</li>
          )}
          {messages.map((m) => {
            const isInbound = m.direction === "inbound";
            const isAgent = m.draftedBy === "conversation_agent";
            return (
              <li
                key={m._id}
                className={cn(
                  "rounded-sm px-3 py-2 text-body-s",
                  isInbound
                    ? "bg-surface-canvas border border-hairline"
                    : isAgent
                      ? "bg-accent-soft border border-hairline"
                      : "bg-[color-mix(in_srgb,var(--success)_8%,transparent)] border border-hairline",
                )}
              >
                <div className="text-caption text-ink-tertiary mb-1">
                  {isInbound ? "Candidate" : isAgent ? "Agent" : "You"}
                  <span className="mx-1.5">·</span>
                  {m.channel}
                  {m.escalated && m.resolvedAt == null ? (
                    <>
                      <span className="mx-1.5">·</span>
                      <span className="text-warning">needs reply</span>
                    </>
                  ) : null}
                </div>
                <div className="whitespace-pre-wrap text-ink">{m.body}</div>
              </li>
            );
          })}
        </ul>

        <div className="space-y-2 pt-3 border-t border-hairline">
          <div className="flex items-center gap-2">
            <Select
              value={channel}
              onChange={(v) => setChannel(v as "email" | "whatsapp")}
              options={[
                { value: "email", label: "Email" },
                { value: "whatsapp", label: "WhatsApp" },
              ]}
            />
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your reply..."
            className="w-full rounded-sm bg-surface border border-hairline-strong text-ink placeholder:text-ink-tertiary p-3 text-body-s outline-none transition-all duration-fast ease-apple-out focus:border-accent focus:ring-2 focus:ring-accent-soft"
            rows={4}
          />
          <div>
            <Button variant="ink" size="md" onClick={send} disabled={!draft.trim()} loading={sending}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
