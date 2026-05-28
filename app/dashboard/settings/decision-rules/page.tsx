"use client";

import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge, Button, Card, PageHeader, useToast } from "@/components/ui";

export default function DecisionRulesIndexPage() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");
  const list = useQuery(
    api.decisionRules.list,
    profile?.schoolId ? { schoolId: profile.schoolId } : "skip",
  );
  const setActive = useMutation(api.decisionRules.setActive);
  const remove = useMutation(api.decisionRules.remove);
  const { toast } = useToast();

  if (!profile || !list) {
    return <div className="text-body-s text-ink-secondary">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Decision rules"
        subtitle="Auto-apply an outcome when all invites for a demo resolve. Pick one when scheduling."
        actions={
          <Link href="/dashboard/settings/decision-rules/new">
            <Button variant="primary" size="sm" iconLeft="Plus">New rule</Button>
          </Link>
        }
      />

      {list.length === 0 ? (
        <Card padding="md" elevation={1}>
          <p className="text-body-s text-ink-secondary">
            No rules yet. Click <span className="text-ink">New rule</span> to create one.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((r) => (
            <Card key={r._id} padding="md" elevation={1}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-body font-medium text-ink">{r.name}</p>
                    <Badge variant={r.isActive ? "success" : "neutral"}>
                      {r.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <p className="text-caption text-ink-secondary mt-0.5">
                    {r.branches.length} branch{r.branches.length === 1 ? "" : "es"} · fallback: {r.fallback}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/dashboard/settings/decision-rules/${r._id}`}>
                    <Button variant="secondary" size="sm">Edit</Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await setActive({ ruleId: r._id as Id<"decisionRules">, active: !r.isActive });
                    }}
                  >
                    {r.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft="Trash2"
                    onClick={async () => {
                      if (!confirm(`Delete rule "${r.name}"? This cannot be undone.`)) return;
                      await remove({ ruleId: r._id as Id<"decisionRules"> });
                      toast({ message: "Rule deleted", variant: "success" });
                    }}
                    aria-label={`Delete ${r.name}`}
                  >
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
