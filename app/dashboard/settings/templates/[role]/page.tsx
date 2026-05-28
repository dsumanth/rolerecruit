"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/ui";
import { TemplateEditor } from "@/components/settings/templates/template-editor";

const ROLES = ["principal", "hod", "hr_admin", "teacher"] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  principal: "Principal",
  hod: "HOD",
  hr_admin: "HR Admin",
  teacher: "Teacher",
};

export default function TemplateRolePage({ params }: { params: Promise<{ role: string }> }) {
  const { role: roleParam } = use(params);
  const role = (ROLES.includes(roleParam as Role) ? roleParam : null) as Role | null;

  const { data: session } = authClient.useSession();
  const user = session?.user;
  const profile = useQuery(api.users.getByClerkId, user?.id ? { userId: user.id } : "skip");

  if (!role) {
    return <div className="text-body-s text-danger">Unknown role: {roleParam}</div>;
  }
  if (!profile?.schoolId) {
    return <div className="text-body-s text-ink-secondary">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${ROLE_LABELS[role]} template`}
        subtitle="Field changes take effect on demos scheduled after this save. Existing invites use the template pinned at invite time."
        back={{ href: "/dashboard/settings/templates", label: "Templates" }}
      />
      <TemplateEditor schoolId={profile.schoolId} role={role} />
    </div>
  );
}
