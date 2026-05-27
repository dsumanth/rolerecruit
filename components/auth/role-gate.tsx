"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import type { ReactNode } from "react";

export function RoleGate({
  requiredAction,
  children,
  fallback = null,
}: {
  requiredAction: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const permissions = useQuery(api.users.getPermissions, userId ? { userId } : "skip");

  if (!userId || !permissions) return null;

  if (permissions.includes("*") || permissions.includes(requiredAction)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

const ROLE_LABELS: Record<string, string> = {
  hr_admin: "HR Admin",
  principal: "Principal",
  hod: "HOD",
  viewer: "Viewer",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-canvas text-ink-secondary">
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}
