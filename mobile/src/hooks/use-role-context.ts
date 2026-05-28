import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useSession } from "@/hooks/use-session";

export interface RoleContext {
  loading: boolean;
  isHR: boolean;
  role: string | null;
  permissions: string[];
  userProfileId: string | null;
  schoolId: string | null;
}

export function useRoleContext(): RoleContext {
  const { loading: sessionLoading, user } = useSession();
  const userId = user?.id ?? null;
  const ctx = useQuery(
    api.users.getMobileRoleContext,
    userId ? { userId } : "skip",
  );

  if (sessionLoading) {
    return { loading: true, isHR: false, role: null, permissions: [], userProfileId: null, schoolId: null };
  }
  if (!userId) {
    return { loading: false, isHR: false, role: null, permissions: [], userProfileId: null, schoolId: null };
  }
  if (ctx === undefined) {
    return { loading: true, isHR: false, role: null, permissions: [], userProfileId: null, schoolId: null };
  }
  if (ctx === null) {
    return { loading: false, isHR: false, role: null, permissions: [], userProfileId: null, schoolId: null };
  }
  return {
    loading: false,
    isHR: ctx.isHR,
    role: ctx.role,
    permissions: ctx.permissions,
    userProfileId: ctx.userProfileId,
    schoolId: ctx.schoolId,
  };
}
