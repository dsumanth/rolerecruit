import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { EvaluatorRole } from "@convex/types";

export interface StaffRow {
  _id: string;
  name: string;
  role: EvaluatorRole;
}

export function useStaffDirectory({ schoolId }: { schoolId: string | null }) {
  const rows = useQuery(
    api.users.listSchoolStaff,
    schoolId ? { schoolId: schoolId as any } : "skip",
  );
  return {
    staff: (rows ?? []) as StaffRow[],
    loading: rows === undefined,
  };
}
