"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { EvaluationForm } from "@/components/evaluations/evaluation-form";
import { DictationModal } from "@/components/evaluations/dictation-modal";
import { Card, Icon, PageHeader, Skeleton } from "@/components/ui";

type VoiceInput = {
  fieldKey: string;
  transcript: string;
  summaryPoints: string[];
  language: string;
  durationSec: number;
  processedAt: number;
};

export default function EvaluationInvitePage() {
  return (
    <ConvexClientProvider>
      <EvaluationFormPage />
    </ConvexClientProvider>
  );
}

function EvaluationFormPage() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get("token") ?? undefined;

  const dataByToken = useQuery(
    api.evaluationInvites.getByToken,
    token ? { token } : "skip",
  );
  const dataById = useQuery(
    api.evaluationInvites.getById,
    !token && inviteId
      ? { inviteId: inviteId as Id<"evaluationInvites"> }
      : "skip",
  );
  const data = token ? dataByToken : dataById;

  const submit = useMutation(api.evaluations.submit);
  const submitByToken = useMutation(api.evaluations.submitByToken);
  const markViewed = useMutation(api.evaluationInvites.markViewed);
  const summarize = useAction(api.voiceProcessing.summarizeTranscript);

  const [dictating, setDictating] = useState<string | null>(null);
  const [voiceInputs, setVoiceInputs] = useState<VoiceInput[]>([]);
  const [responses, setResponses] = useState<Record<string, number | string>>({});
  // Bump to forcibly remount EvaluationForm after dictation completes,
  // so it picks up new `initialResponses` / `initialVoiceInputs`.
  const [formNonce, setFormNonce] = useState(0);

  const inviteIdResolved = data?.invite?._id;

  useEffect(() => {
    if (inviteIdResolved) markViewed({ inviteId: inviteIdResolved });
  }, [inviteIdResolved, markViewed]);

  const subtitle = useMemo(() => {
    if (!data?.demo) return undefined;
    return new Date(data.demo.scheduledAt).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [data?.demo]);

  if (data === undefined) {
    return (
      <div className="min-h-screen bg-surface-canvas p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
          <Card surface="card" elevation={1} padding="lg">
            <div className="space-y-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!data || !data.invite || !data.demo || !data.template) {
    return (
      <div className="min-h-screen bg-surface-canvas p-6">
        <div className="max-w-2xl mx-auto">
          <Card surface="card" elevation={1} padding="lg" className="text-center">
            <p className="text-body-s text-ink-secondary">Evaluation not found.</p>
          </Card>
        </div>
      </div>
    );
  }

  const candidateName = data.candidate?.name ?? "Candidate";

  if (data.invite.status === "submitted") {
    return (
      <div className="min-h-screen bg-surface-canvas p-6">
        <div className="max-w-2xl mx-auto">
          <PageHeader title={candidateName} subtitle={subtitle} />
          <Card surface="card" elevation={1} padding="lg">
            <div className="flex items-center gap-2 justify-center text-success font-semibold">
              <Icon name="CheckCircle2" size={20} />
              <span>Already submitted. Thank you.</span>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (data.invite.status === "cancelled") {
    return (
      <div className="min-h-screen bg-surface-canvas p-6">
        <div className="max-w-2xl mx-auto">
          <PageHeader title={candidateName} subtitle={subtitle} />
          <Card surface="card" elevation={1} padding="lg" className="text-center">
            <p className="text-danger font-semibold">
              This invitation has been cancelled.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (data.invite.status === "declined") {
    return (
      <div className="min-h-screen bg-surface-canvas p-6">
        <div className="max-w-2xl mx-auto">
          <PageHeader title={candidateName} subtitle={subtitle} />
          <Card surface="card" elevation={1} padding="lg" className="text-center">
            <p className="text-ink-secondary">
              You declined this invitation.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const handleDictate = async (fieldKey: string) => {
    setDictating(fieldKey);
    // Modal completes asynchronously and we re-mount the form;
    // returning null prevents EvaluationForm from also trying to update state.
    return null;
  };

  const handleDictateComplete = (input: VoiceInput) => {
    const bullets = input.summaryPoints.map((b) => `• ${b}`).join("\n");
    setResponses((prev) => ({ ...prev, [input.fieldKey]: bullets }));
    setVoiceInputs((prev) => [
      ...prev.filter((v) => v.fieldKey !== input.fieldKey),
      input,
    ]);
    setDictating(null);
    setFormNonce((n) => n + 1);
  };

  const handleSubmit = async (payload: {
    responses: Record<string, number | string>;
    recommendation: "hire" | "maybe" | "reject" | undefined;
    voiceInputs: VoiceInput[];
  }) => {
    if (!payload.recommendation) return;
    const args = {
      responses: payload.responses,
      recommendation: payload.recommendation,
      voiceInputs: payload.voiceInputs,
      submittedFromPlatform: "web" as const,
    };
    if (token) {
      await submitByToken({ token, ...args });
    } else {
      await submit({ inviteId: data.invite._id, ...args });
    }
    router.push("/evaluations?submitted=1");
  };

  return (
    <div className="min-h-screen bg-surface-canvas p-6">
      <div className="max-w-2xl mx-auto">
        <PageHeader title={candidateName} subtitle={subtitle} />
        <Card surface="card" elevation={1} padding="lg">
          <EvaluationForm
            key={formNonce}
            template={data.template as any}
            initialResponses={responses}
            initialVoiceInputs={voiceInputs}
            onDictate={handleDictate}
            onSubmit={handleSubmit}
          />
        </Card>
        {dictating && (
          <DictationModal
            open
            fieldKey={dictating}
            onClose={() => setDictating(null)}
            summarize={summarize}
            onComplete={handleDictateComplete}
          />
        )}
      </div>
    </div>
  );
}
