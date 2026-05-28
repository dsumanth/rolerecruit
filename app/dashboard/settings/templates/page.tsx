"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

const ROLE_LABELS: Record<string, string> = {
  principal: "Principal",
  hod: "HOD",
  hr_admin: "HR Admin",
  teacher: "Teacher",
};

const ROLES = ["principal", "hod", "hr_admin", "teacher"] as const;

export default function TemplatesIndexPage() {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");
  const list = useQuery(
    api.formTemplates.listForSchool,
    profile?.schoolId ? { schoolId: profile.schoolId } : "skip",
  );

  if (!profile || !list) {
    return <div className="text-body-s text-ink-secondary">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Form templates"
        subtitle="Edit the evaluation form your team sees per role. School-wide overrides take effect immediately on demos scheduled afterward."
      />

      <div className="grid gap-3">
        {ROLES.map((role) => {
          const active = list.find((r) => r.role === role && r.isActive);
          return (
            <Card key={role} padding="md" elevation={1}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-body font-medium text-ink">{ROLE_LABELS[role]}</p>
                  {active ? (
                    <p className="text-caption text-ink-secondary mt-0.5">
                      <span className="text-ink">{active.name}</span> · {active.fields.length} field{active.fields.length === 1 ? "" : "s"}
                    </p>
                  ) : (
                    <Badge variant="warning">No active template</Badge>
                  )}
                </div>
                <Link
                  href={`/dashboard/settings/templates/${role}`}
                  aria-label={`Edit ${ROLE_LABELS[role]} template`}
                >
                  <Button variant="secondary" size="sm">Edit</Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
