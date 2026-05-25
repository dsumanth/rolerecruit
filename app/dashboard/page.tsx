import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { RoleCards } from "@/components/dashboard/role-cards";

export default async function DashboardPage() {
  const { profile } = await requireProfile();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Dashboard
        </h1>
        <Link
          href="/dashboard/jobs/new"
          className="py-2.5 px-5 rounded-apple bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] active:bg-[#004999] transition-colors"
        >
          Post New Role
        </Link>
      </div>

      <div className="space-y-6">
        <StatsBar schoolId={profile.schoolId} />
        <div>
          <h2 className="text-sm font-semibold text-ink mb-3">
            Active Roles
          </h2>
          <RoleCards schoolId={profile.schoolId} />
        </div>
      </div>
    </div>
  );
}
