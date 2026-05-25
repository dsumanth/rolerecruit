import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { PageHeader, Button } from "@/components/ui";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { RoleCards } from "@/components/dashboard/role-cards";

export default async function DashboardPage() {
  const { profile } = await requireProfile();

  return (
    <div>
      <PageHeader
        eyebrow={`Welcome back, ${(profile.name ?? "").split(" ")[0] || "there"}`}
        title="Dashboard"
        actions={
          <Link href="/dashboard/jobs/new">
            <Button variant="ink" iconLeft="Plus" size="md">
              Post role
            </Button>
          </Link>
        }
      />

      <div className="space-y-7">
        <StatsBar schoolId={profile.schoolId} />
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-micro text-ink-secondary">Active roles</h2>
            <Link href="/dashboard/jobs" className="text-body-s font-medium text-accent">
              View all →
            </Link>
          </div>
          <RoleCards schoolId={profile.schoolId} />
        </section>
      </div>
    </div>
  );
}
