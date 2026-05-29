import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { EvaluatorRole } from "@convex/types";
import { useSession } from "@/hooks/use-session";

export interface RoleContext {
  loading: boolean;
  isHR: boolean;
  role: EvaluatorRole | null;
  permissions: string[];
  userProfileId: string | null;
  schoolId: string | null;
}

const EMPTY: RoleContext = {
  loading: false,
  isHR: false,
  role: null,
  permissions: [],
  userProfileId: null,
  schoolId: null,
};
const LOADING: RoleContext = { ...EMPTY, loading: true };

export function useRoleContext(): RoleContext {
  const { loading: sessionLoading, user } = useSession();
  const userId = user?.id ?? null;
  const ctx = useQuery(
    api.users.getMobileRoleContext,
    userId ? { userId } : "skip",
  );

  if (sessionLoading) return LOADING;
  if (!userId) return EMPTY;
  if (ctx === undefined) return LOADING;
  if (ctx === null) return EMPTY;
  return {
    loading: false,
    isHR: ctx.isHR,
    role: ctx.role,
    permissions: ctx.permissions,
    userProfileId: ctx.userProfileId,
    schoolId: ctx.schoolId,
  };
}
