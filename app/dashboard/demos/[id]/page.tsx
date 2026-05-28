"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, PageHeader } from "@/components/ui";
import { DemoSummary } from "@/components/demos/demo-summary";
import { DecisionModal } from "@/components/demos/decision-modal";

export default function DemoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const data = useQuery(api.demoSessions.aggregate, { demoId: id as Id<"demoSessions"> });
  const [decisionOpen, setDecisionOpen] = useState(false);

  const alreadyDecided = data?.demo.appliedDecision != null;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        back={{ href: "/dashboard/pipeline", label: "Pipeline" }}
        title="Demo summary"
        subtitle={data ? new Date(data.demo.scheduledAt).toLocaleString("en-IN") : undefined}
        actions={
          data && !alreadyDecided ? (
            <Button variant="primary" size="lg" onClick={() => setDecisionOpen(true)}>
              Make decision
            </Button>
          ) : null
        }
      />

      <DemoSummary demoId={id} />

      {data && (
        <DecisionModal
          open={decisionOpen}
          onClose={() => setDecisionOpen(false)}
          demoId={id}
          applicationId={data.demo.applicationId}
          onDecided={() => {}}
        />
      )}
    </div>
  );
}
