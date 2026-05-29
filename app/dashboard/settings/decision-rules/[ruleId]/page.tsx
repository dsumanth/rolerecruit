"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/ui";
import { RuleEditor } from "@/components/settings/decision-rules/rule-editor";

export default function DecisionRuleEditorPage({ params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = use(params);
  const isNew = ruleId === "new";

  const { data: session } = authClient.useSession();
  const user = session?.user;
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");

  if (!profile?.schoolId) {
    return <div className="text-body-s text-ink-secondary">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? "New decision rule" : "Edit decision rule"}
        subtitle="Auto-applied once everyone has finished their evaluation. Steps are checked top to bottom, first match wins."
        back={{ href: "/dashboard/settings/decision-rules", label: "Decision rules" }}
      />
      <RuleEditor schoolId={profile.schoolId} ruleId={isNew ? undefined : ruleId} />
    </div>
  );
}
