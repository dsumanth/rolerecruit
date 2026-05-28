"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function EvaluateTab({ applicationId }: { applicationId: string }) {
  const createEval = useMutation(api.evaluations.create);
  const [evaluatorRole, setEvaluatorRole] = useState<string>("principal");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [token, setToken] = useState("");

  const handleRequest = async () => {
    setSending(true);
    setResult(null);
    try {
      const evalResult = await createEval({
        applicationId: applicationId as any,
        evaluatorRole: evaluatorRole as "principal" | "hod" | "hr_admin",
      });
      setToken((evalResult as any).token ?? "");
      setResult("success");
    } catch {
      setResult("error");
    } finally {
      setSending(false);
    }
  };

  const feedbackUrl = token
    ? `/feedback/${token}`
    : "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-secondary">
        Request a demo lesson evaluation from a team member. They will receive a feedback link.
      </p>

      <div>
        <label className="block text-xs text-ink-secondary mb-1">Evaluator Role</label>
        <Select
          value={evaluatorRole}
          onChange={setEvaluatorRole}
          options={[
            { value: "principal", label: "Principal" },
            { value: "hod", label: "HOD" },
            { value: "hr_admin", label: "HR Admin" },
          ]}
        />
      </div>

      {result === "success" && (
        <div className="px-3 py-2 rounded-md bg-green-50 text-sm text-success">
          Evaluation request created! Share this link with the evaluator:
          <br />
          <code className="text-xs text-ink break-all">{feedbackUrl}</code>
        </div>
      )}
      {result === "error" && (
        <div className="px-3 py-2 rounded-md bg-red-50 text-sm text-danger">
          Failed to create evaluation request.
        </div>
      )}

      <Button
        variant="primary"
        size="md"
        loading={sending}
        onClick={handleRequest}
        className="w-full"
      >
        Request Evaluation
      </Button>
    </div>
  );
}
